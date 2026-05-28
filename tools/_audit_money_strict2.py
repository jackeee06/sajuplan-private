"""V-6 settlement_monthly + V-12 chat_room + V-8 drift 깊이 추적.

이전 SQL 컬럼명 오류 수정 + 상세 분석.
"""
from __future__ import annotations
import os, sys

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

import paramiko

HOST = "104.64.128.103"
ENV_FILE = "/data/wwwroot/api.sajumoon.co.kr/.env"

SQL = r"""
\echo
\echo === [SCHEMA] settlement_monthly 컬럼 확인 ===
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name='settlement_monthly'
 ORDER BY ordinal_position;

\echo
\echo === [SCHEMA] chat_room 컬럼 확인 ===
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name='chat_room'
 ORDER BY ordinal_position;

\echo
\echo === [V-6] settlement_monthly 14건 — month/member 분포 ===
SELECT to_char(month::date, 'YYYY-MM') AS month, member_id, mb_id,
       amt_free, amt_pro, price, final_payout_amount,
       early_payout_total, carry_over_negative,
       calculated_at::date AS calc_date
  FROM settlement_monthly
 ORDER BY month DESC, member_id;

\echo
\echo === [V-6] settlement_monthly month 별 합계 ===
SELECT to_char(month::date, 'YYYY-MM') AS month, COUNT(*) AS cnt,
       SUM(price) AS sum_price,
       SUM(final_payout_amount) AS sum_payout,
       MIN(calculated_at)::date AS first_calc,
       MAX(calculated_at)::date AS last_calc
  FROM settlement_monthly
 GROUP BY month
 ORDER BY month;

\echo
\echo === [V-12 C-17] chat_room m2net_failed 10건 - 시간/consultation 매칭 ===
SELECT cr.id, cr.roomid, cr.status, cr.settle_status, cr.settle_retry_count,
       cr.start_at::date AS start_d,
       cr.end_at::date AS end_d,
       EXISTS (SELECT 1 FROM consultation c WHERE c.roomid = cr.roomid) AS cons_exact,
       (SELECT COUNT(*) FROM consultation c WHERE c.roomid LIKE cr.roomid || '%') AS cons_like_cnt
  FROM chat_room cr
 WHERE cr.settle_status = 'm2net_failed'
 ORDER BY cr.start_at DESC NULLS LAST;

\echo
\echo === [V-8] jackee drift 200원 원인 추적 ===
\echo --- jackee point_history 전체 ---
SELECT ph.id, ph.created_at::date AS d, ph.content,
       ph.earn_point, ph.use_point, ph.balance_after,
       ph.rel_table, ph.rel_id, ph.rel_action, ph.is_paid
  FROM point_history ph
  JOIN member m ON m.id = ph.member_id
 WHERE m.mb_id = 'jackee'
 ORDER BY ph.id;

\echo --- jackee point 잔액 ---
SELECT m.id, m.mb_id, m.name, m.point AS member_point,
       p.free_balance, p.paid_balance, p.earning_balance,
       p.total_earned, p.total_used
  FROM member m
  JOIN point p ON p.member_id = m.id
 WHERE m.mb_id = 'jackee';

\echo
\echo === [V-4.1 deep] 한 consultation 에 credit row 가 여러 개 있는 케이스 ===
\echo  (sum_credits=9 vs cons 19건 = 일부 consultation 에 2+ credit?)
WITH cons_ph AS (
  SELECT c.id AS cons_id,
         c.member_id AS user_id,
         c.counselor_id,
         c.reason,
         c.refund_status,
         (SELECT COUNT(*) FROM point_history ph
            WHERE ph.rel_table='consultation' AND ph.rel_id::text = c.id::text
              AND ph.earn_point > 0) AS credit_rows,
         (SELECT COUNT(*) FROM point_history ph
            WHERE ph.rel_table='consultation' AND ph.rel_id::text = c.id::text
              AND ph.use_point > 0) AS debit_rows,
         (SELECT string_agg(member_id::text, ',') FROM point_history ph
            WHERE ph.rel_table='consultation' AND ph.rel_id::text = c.id::text
              AND ph.earn_point > 0) AS credit_member_ids
    FROM consultation c
   WHERE c.reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
)
SELECT credit_rows, debit_rows, COUNT(*) AS cons_cnt
  FROM cons_ph
 GROUP BY credit_rows, debit_rows
 ORDER BY credit_rows DESC, debit_rows DESC;

\echo
\echo --- normal consultation 중 credit 적립 받은 상담사 분포 ---
WITH cons_ph AS (
  SELECT c.id AS cons_id, c.counselor_id,
         (SELECT COUNT(*) FROM point_history ph
            WHERE ph.rel_table='consultation' AND ph.rel_id::text = c.id::text
              AND ph.earn_point > 0) AS credits,
         (SELECT COUNT(*) FROM point_history ph
            WHERE ph.rel_table='consultation' AND ph.rel_id::text = c.id::text
              AND ph.use_point > 0) AS debits
    FROM consultation c
   WHERE c.reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
     AND c.refund_status IS NULL
)
SELECT counselor_id, COUNT(*) AS cons_cnt,
       SUM(credits) AS sum_credits, SUM(debits) AS sum_debits,
       MIN(credits) AS min_c, MAX(credits) AS max_c
  FROM cons_ph
 GROUP BY counselor_id
 ORDER BY counselor_id;

\echo
\echo === [V-운영] 상담사별 누적 (현황) ===
SELECT m.id, m.mb_id, m.name,
       p.earning_balance, p.total_earned, p.total_used,
       (SELECT COUNT(*) FROM consultation c WHERE c.counselor_id = m.id
          AND c.reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')) AS cons_done
  FROM member m
  JOIN point p ON p.member_id = m.id
 WHERE m.role = 'counselor'
   AND (p.earning_balance > 0 OR p.total_earned > 0)
 ORDER BY p.earning_balance DESC;
"""


def main():
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS env not set", file=sys.stderr); return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=30)
    cmd = (
        f"export $(grep -E '^(DATABASE_URL|DB_)' {ENV_FILE} | xargs -d '\\n') && "
        f"psql \"$DATABASE_URL\" -v ON_ERROR_STOP=0 <<'EOSQL'\n{SQL}\nEOSQL"
    )
    _, out, err = c.exec_command(cmd, get_pty=False)
    sys.stdout.write(out.read().decode("utf-8", errors="replace"))
    e = err.read().decode("utf-8", errors="replace")
    if e: sys.stderr.write(e)
    c.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
