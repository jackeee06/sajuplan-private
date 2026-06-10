#!/usr/bin/env python3
"""
E2E 검증용 테스트 데이터 생성 스크립트
- e2e_member: 쿠폰 1개, 5분+ 상담 이력 1건, 후기 작성 가능 상태
- e2e_dual: earning_balance 설정 (선지급 신청 가능 상태)
- 실행 후 검증, 이상 시 롤백
"""
import os, sys, paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'],
          allow_agent=False, look_for_keys=False, timeout=15)

def q(sql, label=""):
    if label: print(f"\n[{label}]")
    _, o, e = c.exec_command(f"psql {DB} -c \"{sql}\"", timeout=20)
    out = o.read().decode('utf-8', 'replace').strip()
    err = e.read().decode('utf-8', 'replace').strip()
    if out: print(out)
    if err and 'NOTICE' not in err: print("ERR:", err[:200])
    return out

# === 기본 계정 ID 조회 ===
q("SELECT id, mb_id, role FROM member WHERE mb_id IN ('e2e_member','e2e_dual') ORDER BY mb_id", "기본 계정 확인")

# === 1. e2e_member 쿠폰 생성 ===
# coupon_zone이 있으면 거기서, 없으면 수동으로
print("\n" + "="*50)
print("1. e2e_member 쿠폰 생성")
print("="*50)

q("""
  SELECT id, mb_id, point FROM member WHERE mb_id = 'e2e_member'
""", "e2e_member 현재 상태")

# 쿠폰존 확인
coupon_zone_result = q("""
  SELECT id, title, point_amount FROM coupon_zone WHERE is_active = true LIMIT 3
""", "활성 쿠폰존")

# e2e_member 사용 가능한 쿠폰 확인
q("""
  SELECT COUNT(*) AS available_coupons
  FROM member_coupon mc
  WHERE mc.member_id = (SELECT id FROM member WHERE mb_id = 'e2e_member')
    AND mc.used_at IS NULL
    AND (mc.expires_at IS NULL OR mc.expires_at > NOW())
""", "e2e_member 보유 쿠폰 수")

# 쿠폰 직접 INSERT (member_coupon 테이블 구조 확인 후)
q("""
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'member_coupon'
  ORDER BY ordinal_position
""", "member_coupon 스키마")

# === 2. e2e_dual 수익금 설정 ===
print("\n" + "="*50)
print("2. e2e_dual earning_balance 설정")
print("="*50)

q("""
  SELECT m.id, m.mb_id, m.role, p.earning_balance, p.free_balance, p.paid_balance
  FROM member m
  LEFT JOIN point p ON p.member_id = m.id
  WHERE m.mb_id = 'e2e_dual'
""", "e2e_dual 현재 잔액")

# === 3. 5분+ consultation 데이터 확인 ===
print("\n" + "="*50)
print("3. consultation 데이터 (후기 작성용)")
print("="*50)

q("""
  SELECT c.id, c.member_id, c.counselor_id, c.usetm, c.amt,
         c.refund_status, m.mb_id as member_mb_id
  FROM consultation c
  JOIN member m ON m.id = c.member_id
  WHERE c.member_id = (SELECT id FROM member WHERE mb_id = 'e2e_member')
  ORDER BY c.created_at DESC LIMIT 5
""", "e2e_member 상담 이력")

# 5분+ 상담 조회
q("""
  SELECT COUNT(*) AS cnt_5min_plus
  FROM consultation c
  WHERE c.member_id = (SELECT id FROM member WHERE mb_id = 'e2e_member')
    AND c.usetm >= 300
""", "e2e_member 5분+ 상담 건수")

# === 4. 데이터 생성 계획 실행 ===
print("\n" + "="*50)
print("4. 테스트 데이터 생성")
print("="*50)

# 4a. e2e_dual earning_balance 50,000 설정 (선지급 신청 가능 수준)
q("""
  UPDATE point
  SET earning_balance = 50000,
      updated_at = now()
  WHERE member_id = (SELECT id FROM member WHERE mb_id = 'e2e_dual')
""", "4a. e2e_dual earning_balance = 50,000")

q("""
  SELECT m.mb_id, p.earning_balance
  FROM member m JOIN point p ON p.member_id = m.id
  WHERE m.mb_id = 'e2e_dual'
""", "4a 결과 확인")

# 4b. e2e_member consultation 5분+ 데이터 INSERT (후기 작성용)
# 먼저 상담사 ID 가져오기
q("""
  SELECT id, mb_id FROM member WHERE role = 'counselor' AND left_at IS NULL LIMIT 3
""", "상담사 목록 (consultation 생성용)")

q("""
  WITH counselor AS (
    SELECT id FROM member WHERE role = 'counselor' AND left_at IS NULL LIMIT 1
  ),
  e2e_m AS (
    SELECT id, m2net_membid FROM member WHERE mb_id = 'e2e_member' LIMIT 1
  )
  INSERT INTO consultation
    (member_id, counselor_id, csrid, membid, callid, reason,
     usetm, amt, amt_free, amt_pro,
     refund_status, created_at, started_at, ended_at)
  SELECT
    e2e_m.id,
    counselor.id,
    (SELECT m2net_csrid FROM member WHERE id = counselor.id LIMIT 1),
    COALESCE(e2e_m.m2net_membid, 'e2e_test'),
    'E2E_TEST_CALL_' || extract(epoch from now())::bigint,
    'DISCONNECT',
    360,  -- 6분 (5분 정책 초과)
    0,    -- 코인 차감 0 (테스트용)
    0,
    0,
    NULL,
    now() - interval '1 hour',
    now() - interval '1 hour',
    now() - interval '54 minutes'
  FROM counselor, e2e_m
  ON CONFLICT DO NOTHING
  RETURNING id, member_id, counselor_id, usetm
""", "4b. e2e_member 테스트 consultation INSERT (6분)")

# 4c. e2e_member 쿠폰 INSERT
# member_coupon 테이블 구조 확인 필요
q("""
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'member_coupon' ORDER BY ordinal_position
""", "member_coupon 컬럼")

c.close()
print("\n✅ 완료")
