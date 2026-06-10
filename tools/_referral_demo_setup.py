"""데모 설정 — 라온선생(123)→jackee(91) 추천 관계 + 5월분 수당 단일 트랜잭션."""
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
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=30)
    return out.read().decode("utf-8", errors="replace") + err.read().decode("utf-8", errors="replace")

print("=== 전체 작업 단일 트랜잭션 ===")
print(run("""
BEGIN;

-- ① counselor_referral 등록 (라온선생→jackee, 오늘부터 3개월)
INSERT INTO counselor_referral
  (referrer_id, referee_id, rate_snapshot, months_snapshot,
   registered_at, expires_at, status, created_at, updated_at)
VALUES
  (123, 91, 0.01, 3,
   NOW(), NOW() + INTERVAL '3 months', 'active', NOW(), NOW());

-- ② counselor_referral_payment (5월분)
--    rate_pct=1 (1%), referee_sales=400 (jackee 5월 수익), paid_amount=4
INSERT INTO counselor_referral_payment
  (referral_id, pay_month, rate_pct, referee_sales, paid_amount, paid_at)
SELECT
  cr.id,
  '2026-05-01'::date,
  1,
  400,
  4,
  '2026-06-01 04:00:00'::timestamptz
FROM counselor_referral cr
WHERE cr.referrer_id = 123 AND cr.referee_id = 91
LIMIT 1;

-- ③ jackee point_history (차감)
INSERT INTO point_history
  (member_id, mb_id, content, earn_point, use_point, balance_after,
   is_expired, rel_table, rel_id, rel_action, is_settled, created_at)
SELECT
  91, 'jackee',
  '[추천 수당 차감] 2026-05',
  0, 4,
  (SELECT earning_balance - 4 FROM point WHERE member_id = 91),
  false, 'counselor_referral', cr.id::text,
  '추천수당차감_2026-05', false,
  '2026-06-01 04:00:00'::timestamptz
FROM counselor_referral cr
WHERE cr.referrer_id = 123 AND cr.referee_id = 91
LIMIT 1;

-- ④ 라온선생 point_history (적립)
INSERT INTO point_history
  (member_id, mb_id, content, earn_point, use_point, balance_after,
   is_expired, rel_table, rel_id, rel_action, is_settled, created_at)
SELECT
  123, '4875978218_K',
  '[추천 수당] jackee 2026-05',
  4, 0,
  (SELECT earning_balance + 4 FROM point WHERE member_id = 123),
  false, 'counselor_referral', cr.id::text,
  '추천수당_2026-05', false,
  '2026-06-01 04:00:00'::timestamptz
FROM counselor_referral cr
WHERE cr.referrer_id = 123 AND cr.referee_id = 91
LIMIT 1;

-- ⑤ jackee earning_balance -4
UPDATE point SET
  earning_balance = earning_balance - 4,
  total_used      = total_used + 4,
  updated_at      = NOW()
WHERE member_id = 91;

-- ⑥ 라온선생 earning_balance +4
UPDATE point SET
  earning_balance = earning_balance + 4,
  total_earned    = total_earned + 4,
  updated_at      = NOW()
WHERE member_id = 123;

COMMIT;
"""))

print("\n=== 최종 검증 ===")
print(run("""
SELECT
  rer.nickname AS 추천인, ree.nickname AS 피추천인,
  cr.rate_snapshot AS 요율, cr.months_snapshot AS 기간,
  cr.expires_at::date AS 만료일, cr.status
FROM counselor_referral cr
JOIN member rer ON rer.id = cr.referrer_id
JOIN member ree ON ree.id = cr.referee_id
WHERE cr.referrer_id = 123 AND cr.referee_id = 91;
"""))

print(run("""
SELECT crp.pay_month, crp.rate_pct AS "요율%", crp.referee_sales AS "수익기준",
       crp.paid_amount AS "수당(원)"
FROM counselor_referral_payment crp
JOIN counselor_referral cr ON cr.id = crp.referral_id
WHERE cr.referrer_id = 123 AND cr.referee_id = 91;
"""))

print(run("""
SELECT member_id,
  CASE member_id WHEN 91 THEN 'jackee(찬물선생)' ELSE '라온선생' END AS 이름,
  earning_balance AS 수익금잔액
FROM point WHERE member_id IN (91, 123)
ORDER BY member_id;
"""))

c.close()
