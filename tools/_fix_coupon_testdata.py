#!/usr/bin/env python3
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
    if err and 'NOTICE' not in err: print("ERR:", err[:200])

# 기존 쿠폰존 확인
q("SELECT id, subject, cz_point, is_active FROM coupon_zone WHERE cz_point > 0 LIMIT 5", "기존 쿠폰존 (cz_point>0)")

# 테스트용 쿠폰존 생성
q("""
  INSERT INTO coupon_zone (subject, cz_type, cp_method, cp_target, cz_point, cp_type, cp_id, cz_period, cz_download, is_active, created_at)
  VALUES ('E2E 테스트 쿠폰존', 1, 1, 'all', 1000, false, 'E2E_ZONE_TEST', 30, 0, true, now())
  ON CONFLICT DO NOTHING
  RETURNING id, subject, cz_point
""", "쿠폰존 생성")

# 생성된 zone_id 가져오기 + 쿠폰 업데이트
q("""
  UPDATE coupon
  SET zone_id = (SELECT id FROM coupon_zone WHERE cp_id = 'E2E_ZONE_TEST' ORDER BY created_at DESC LIMIT 1),
      used_at = NULL
  WHERE id = 27 AND member_id = 140
  RETURNING id, zone_id, used_at
""", "쿠폰 zone_id 연결 + used_at 초기화")

# 확인
q("""
  SELECT c.id, c.title, c.zone_id, cz.cz_point, c.used_at, c.ends_at
  FROM coupon c
  LEFT JOIN coupon_zone cz ON cz.id = c.zone_id
  WHERE c.id = 27
""", "쿠폰 최종 상태")

# e2e_member point 확인 (me() 응답과 DB 일치?)
q("""
  SELECT m.mb_id, m.point, p.free_balance, p.paid_balance, p.free_balance+p.paid_balance AS total
  FROM member m LEFT JOIN point p ON p.member_id = m.id
  WHERE m.mb_id = 'e2e_member'
""", "e2e_member 잔액 (DB)")

c.close()
print("\n✅ 완료")
