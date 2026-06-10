"""데모 롤백 — 아래 스크립트 실행 시 작업 전 상태로 100% 원복.

원복 대상:
  jackee  earning_balance: 9596 → 9600
  라온선생 earning_balance: 29004 → 29000
  counselor_referral 1행 삭제
  counselor_referral_payment 1행 삭제
  point_history 2행 삭제 (추천 수당 관련)
"""
import base64, os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"],
          allow_agent=False, look_for_keys=False, timeout=15)

def run(sql):
    b64 = base64.b64encode(sql.encode()).decode()
    cmd = ('export DATABASE_URL=$(grep -E "^DATABASE_URL=" '
           '/data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
           f'echo {b64} | base64 -d | psql "$DATABASE_URL" -v ON_ERROR_STOP=1')
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=20)
    return out.read().decode("utf-8", errors="replace") + err.read().decode("utf-8", errors="replace")

print("=== 롤백 실행 ===")
print(run("""
BEGIN;

-- 1. counselor_referral_payment 삭제
DELETE FROM counselor_referral_payment
WHERE referral_id = (
  SELECT id FROM counselor_referral
  WHERE referrer_id = 123 AND referee_id = 91
  LIMIT 1
)
AND pay_month = '2026-05'
RETURNING id, pay_month, paid_amount;

-- 2. counselor_referral 삭제
DELETE FROM counselor_referral
WHERE referrer_id = 123 AND referee_id = 91
RETURNING id, referrer_id, referee_id;

-- 3. point_history 삭제 (추천 수당 관련)
DELETE FROM point_history
WHERE rel_table = 'counselor_referral'
  AND member_id IN (91, 123)
  AND rel_action IN ('추천수당_2026-05', '추천수당차감_2026-05')
RETURNING id, member_id, earn_point, use_point;

-- 4. jackee earning_balance 원복
UPDATE point SET
  earning_balance = 9600,
  total_used      = total_used - 4
WHERE member_id = 91
RETURNING member_id, earning_balance;

-- 5. 라온선생 earning_balance 원복
UPDATE point SET
  earning_balance = 29000,
  total_earned    = total_earned - 4
WHERE member_id = 123
RETURNING member_id, earning_balance;

COMMIT;
"""))

c.close()
print("롤백 완료.")
