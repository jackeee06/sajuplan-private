"""settlement_complete 기능 엄격 검증 — SQL 시뮬레이션 (트랜잭션 안 + ROLLBACK).

테스트 시나리오:
  1. 임시 settlement_monthly row INSERT (status='calculated')
  2. markPaid 흉내 SELECT + UPDATE
  3. 검증 (status / paid_at / paid_by_id)
  4. notifySettlementComplete 흉내 SELECT (member 조인, phone/nickname/name)
  5. ROLLBACK (모든 변경 되돌림)

prod 데이터 변경 X — 트랜잭션 안에서 검증만.
"""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

SQL = r"""
\echo === [V-1] 사장님 (mb_id='jackee') 정보 확인 ===
SELECT id, mb_id, name, nickname, phone, role
  FROM member
 WHERE mb_id = 'jackee'
 LIMIT 1;

BEGIN;

\echo
\echo === [V-2] 임시 settlement_monthly row INSERT (테스트, jackee 본인) ===
INSERT INTO settlement_monthly
  (member_id, mb_id, month, kind, price_free, price_paid, price_other, price_tot,
   vat_amount, withholding_tax, reply_fee, price, wr_datetime, created_at, status,
   early_payout_total, carry_over_negative, final_payout_amount)
SELECT id, mb_id, '2026-99', NULL, 0, 0, 0, 0, 0, 0, 0, 1000000, NOW(), NOW(), 'calculated', 0, 0, 1000000
  FROM member WHERE mb_id = 'jackee'
RETURNING id, mb_id, month, price, status;

\echo
\echo === [V-3] markPaid 단계 1: SELECT status (현재 calculated 확인) ===
SELECT id, mb_id, status, paid_at, paid_by_id
  FROM settlement_monthly
 WHERE month = '2026-99'
 LIMIT 1;

\echo
\echo === [V-4] markPaid 단계 2: UPDATE → status='paid' ===
UPDATE settlement_monthly
   SET status = 'paid',
       paid_at = NOW(),
       paid_by_id = 1
 WHERE month = '2026-99';

\echo
\echo === [V-5] UPDATE 후 검증 (status='paid' / paid_at 채워짐 / paid_by_id=1) ===
SELECT id, mb_id, status,
       paid_at::timestamp(0) AS paid_at,
       paid_by_id
  FROM settlement_monthly
 WHERE month = '2026-99';

\echo
\echo === [V-6] notifySettlementComplete 흉내: settlement + member 조인 ===
SELECT s.mb_id, s.month, s.price, m.phone, m.nickname, m.name,
       COALESCE(NULLIF(TRIM(m.nickname), ''), NULLIF(TRIM(m.name), ''), '상담사') AS display_name,
       to_char(s.price, 'FM999,999,999') AS price_formatted
  FROM settlement_monthly s
  LEFT JOIN member m ON m.id = s.member_id
 WHERE s.month = '2026-99';

\echo
\echo === [V-7] 멱등성 시뮬 — 두 번째 markPaid 호출 (BadRequest 가야 함) ===
\echo '실제 코드는 이미 paid 상태면 BadRequest. SQL 만으로 검증 — SELECT status 결과가 paid 면 코드는 던짐.'
SELECT status FROM settlement_monthly WHERE month = '2026-99';

\echo
\echo === [V-8] mark-voided 시도 시뮬 (paid 후 voided 가능) ===
\echo '코드는 paid → voided 허용. voided → paid 만 차단. 검증:'
UPDATE settlement_monthly
   SET status = 'voided',
       voided_at = NOW(),
       voided_by_id = 1,
       void_reason = 'TEST 시뮬레이션 — 무시'
 WHERE month = '2026-99' AND status = 'paid';

SELECT status, voided_at IS NOT NULL AS has_voided_at, void_reason
  FROM settlement_monthly
 WHERE month = '2026-99';

\echo
\echo === [V-9] mark-voided 후 mark-paid 시도 시뮬 (코드는 BadRequest) ===
\echo 'SELECT status 결과가 voided → 코드는 throw BadRequest'
SELECT status FROM settlement_monthly WHERE month = '2026-99';

ROLLBACK;

\echo
\echo === [V-10] ROLLBACK 후 — 임시 row 사라졌는지 확인 ===
SELECT COUNT(*) AS test_row_count
  FROM settlement_monthly
 WHERE month = '2026-99';

\echo
\echo === [V-11] 실제 prod settlement_monthly 변경 없는지 ===
SELECT COUNT(*) AS total_in_prod FROM settlement_monthly;
"""

cmd = f"psql $(grep '^DATABASE_URL' /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -v ON_ERROR_STOP=0 <<'EOSQL'\n{SQL}\nEOSQL"
_, o, e = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
err = e.read().decode("utf-8", errors="replace")
if err: print("STDERR:", err[:500])

c.close()
