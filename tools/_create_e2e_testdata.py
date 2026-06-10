#!/usr/bin/env python3
"""E2E 테스트 데이터 최종 생성"""
import os, sys, paramiko
for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=15)

def q(sql, label=""):
    if label: print(f"\n[{label}]")
    _, o, e = c.exec_command(f'psql {DB} -c "{sql}"', timeout=20)
    out = o.read().decode('utf-8','replace').strip()
    err = e.read().decode('utf-8','replace').strip()
    if out: print(out)
    if err and 'NOTICE' not in err: print("ERR:", err[:300])
    return out

# 1. e2e_dual point row INSERT
q("""
  INSERT INTO point (member_id, free_balance, paid_balance, earning_balance, total_earned, total_used)
  VALUES (141, 0, 0, 50000, 50000, 0)
  ON CONFLICT (member_id) DO UPDATE
    SET earning_balance = 50000, updated_at = now()
""", "1. e2e_dual point row 생성 (earning_balance=50,000)")

q("""
  SELECT member_id, free_balance, paid_balance, earning_balance
  FROM point WHERE member_id = 141
""", "1. 결과 확인")

# 2. e2e_member 쿠폰 INSERT
# coupon 테이블: id, cp_no, cp_id, zone_id, member_id, mb_id, title, method, target,
#               starts_at, ends_at, discount_value, discount_type, trunc_unit,
#               min_amount, max_amount, zone_type, is_visible, used_at, od_id, created_at
q("""
  INSERT INTO coupon
    (cp_id, member_id, mb_id, title, method, target,
     starts_at, ends_at, discount_value, discount_type,
     trunc_unit, min_amount, max_amount, zone_type, is_visible, created_at)
  VALUES
    ('E2E_TEST_COUPON_' || extract(epoch from now())::bigint,
     140, 'e2e_member', 'E2E 테스트 쿠폰 (1,000코인)',
     1, 'all',
     now(), now() + interval '30 days',
     1000, 1,
     1, 0, 0, 1, true, now())
  ON CONFLICT DO NOTHING
  RETURNING id, title, discount_value
""", "2. e2e_member 쿠폰 INSERT")

q("""
  SELECT id, title, discount_value, used_at, ends_at
  FROM coupon
  WHERE member_id = 140 AND used_at IS NULL AND ends_at > now()
  ORDER BY created_at DESC LIMIT 3
""", "2. 사용 가능한 쿠폰 확인")

# 3. e2e_member consultation 확인 (후기 작성용)
q("""
  SELECT id, member_id, counselor_id, usetm, amt, created_at::date
  FROM consultation
  WHERE member_id = 140 AND usetm >= 300
  ORDER BY created_at DESC LIMIT 5
""", "3. e2e_member 5분+ 상담 이력")

# 4. e2e_member 후기 작성 가능 여부 확인 (기존 후기 있으면 consultation_id 달리 써야)
q("""
  SELECT r.id, r.counselor_id, r.content, r.created_at::date
  FROM post_review r
  WHERE r.member_id = 140
  ORDER BY created_at DESC LIMIT 3
""", "4. e2e_member 기존 후기")

# 5. e2e_member point 현황
q("""
  SELECT free_balance, paid_balance, total_earned
  FROM point WHERE member_id = 140
""", "5. e2e_member 현재 포인트")

c.close()
print("\n✅ 완료")
