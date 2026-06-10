"""데모 작업 전 현황 확인 — 읽기 전용."""
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
           f'echo {b64} | base64 -d | psql "$DATABASE_URL"')
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=20)
    return out.read().decode("utf-8", errors="replace")

print("=== 1. 라온선생 정보 ===")
print(run("""
SELECT id, mb_id, nickname, referral_code
FROM member WHERE mb_id = '4875978218_K' LIMIT 1;
"""))

print("=== 2. jackee(id=91) 현재 point 잔액 ===")
print(run("""
SELECT member_id, free_balance, paid_balance, earning_balance, total_earned
FROM point WHERE member_id = 91;
"""))

print("=== 3. 라온선생 현재 point 잔액 ===")
print(run("""
SELECT p.member_id, p.earning_balance
FROM point p JOIN member m ON m.id = p.member_id
WHERE m.mb_id = '4875978218_K';
"""))

print("=== 4. jackee 5월 상담사 수익 (point_history) ===")
print(run("""
SELECT ph.id, ph.earn_point, ph.content, ph.rel_id, ph.created_at::date
FROM point_history ph
WHERE ph.member_id = 91
  AND ph.earn_point > 0
  AND ph.rel_table = 'consultation'
  AND ph.created_at >= '2026-05-01'
  AND ph.created_at < '2026-06-01'
ORDER BY ph.id;
"""))

print("=== 5. jackee 5월 settlement_monthly (정산결과) ===")
print(run("""
SELECT id, month, price_tot, price, final_payout_amount
FROM settlement_monthly
WHERE member_id = 91 AND month = '2026-05';
"""))

print("=== 6. 기존 counselor_referral (라온선생↔jackee) ===")
print(run("""
SELECT * FROM counselor_referral
WHERE (referrer_id = 91 OR referee_id = 91)
ORDER BY id;
"""))

c.close()
