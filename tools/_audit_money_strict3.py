"""사고 시그널 3종 심층 추적.

1. counselor_id NULL 10건 상세 (회원/시각/amt/reason)
2. settlement_monthly 14건 (correct schema)
3. chat_room m2net_failed 10건 (started_at)
4. jackee +200 drift 원인 (member.point UPDATE 추적)
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
\echo ============================================================
\echo  [★ S-1] counselor_id NULL consultation 10건 — 사고 시그널 추적
\echo ============================================================
SELECT c.id, c.created_at::timestamp(0) AS at,
       c.reason, c.refund_status,
       c.member_id, c.counselor_id,
       c.csrid, c.membid,
       c.callid, c.roomid,
       c.amt, c.amt_free, c.amt_pro, c.usetm,
       c.preflag,
       m.mb_id AS member_mb_id, m.name AS member_name
  FROM consultation c
  LEFT JOIN member m ON m.id = c.member_id
 WHERE c.reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
   AND c.counselor_id IS NULL
 ORDER BY c.id;

\echo
\echo --- counselor_id NULL 10건의 amt 합계 (회사 손실 또는 회원 이득 금액) ---
SELECT COUNT(*) AS cnt,
       SUM(amt) AS sum_amt,
       SUM(amt_free) AS sum_amt_free,
       SUM(amt_pro) AS sum_amt_pro,
       SUM(usetm) AS sum_usetm_sec
  FROM consultation
 WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
   AND counselor_id IS NULL;

\echo
\echo --- counselor_id NULL 10건의 csrid 분포 (m2net id 는 있는데 사주플랜 매칭 실패?) ---
SELECT csrid, COUNT(*) AS cnt,
       string_agg(DISTINCT membid::text, ',') AS membids
  FROM consultation
 WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
   AND counselor_id IS NULL
 GROUP BY csrid;

\echo
\echo --- csrid 가 실제 어느 상담사인지 확인 (member 매칭 시도) ---
SELECT DISTINCT c.csrid,
       m.id AS counselor_id_lookup, m.mb_id, m.name, m.role
  FROM consultation c
  LEFT JOIN member m ON m.csrid = c.csrid
 WHERE c.reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
   AND c.counselor_id IS NULL;

\echo
\echo ============================================================
\echo  [★ S-2] settlement_monthly 14건 - correct schema
\echo ============================================================
SELECT id, no, member_id, mb_id, month, kind,
       price_free, price_paid, price_other, price_tot,
       vat_amount, withholding_tax, reply_fee, price,
       early_payout_total, carry_over_negative, final_payout_amount,
       wr_datetime::date AS wr_d,
       created_at::date AS created_d
  FROM settlement_monthly
 ORDER BY month DESC, id DESC;

\echo
\echo --- month/kind 별 합계 ---
SELECT month, kind, COUNT(*) AS cnt,
       SUM(price) AS sum_price,
       SUM(final_payout_amount) AS sum_payout,
       MIN(created_at)::date AS first_create,
       MAX(created_at)::date AS last_create
  FROM settlement_monthly
 GROUP BY month, kind
 ORDER BY month DESC, kind;

\echo
\echo ============================================================
\echo  [★ S-3] chat_room m2net_failed 10건 - started_at 사용
\echo ============================================================
SELECT cr.id, cr.roomid, cr.status,
       cr.settle_status, cr.settle_retry_count,
       cr.settle_last_retry_at::timestamp(0) AS last_retry,
       cr.settle_failure_reason,
       cr.started_at::timestamp(0) AS started,
       cr.ended_at::timestamp(0) AS ended,
       cr.use_seconds,
       cr.member_id, cr.counselor_id,
       EXISTS (SELECT 1 FROM consultation c WHERE c.roomid = cr.roomid) AS cons_exact,
       (SELECT COUNT(*) FROM consultation c WHERE c.roomid LIKE cr.roomid || '%') AS cons_like
  FROM chat_room cr
 WHERE cr.settle_status = 'm2net_failed'
 ORDER BY cr.started_at DESC NULLS LAST;

\echo
\echo ============================================================
\echo  [★ S-4] jackee +200 drift — member.point UPDATE 흔적 추적
\echo ============================================================
\echo  point_history 합계: earn 61000 - use 22000 = 39000 (paid + earning)
\echo  실제 잔액: paid 38000 + earning 1000 = 39000  ← 일치!
\echo  → drift 는 member.point 만의 문제 (point 테이블은 정상)
\echo  → member.point 가 +200 어디서 왔는지 추적 필요

\echo --- jackee member 의 변경 흔적 ---
SELECT id, mb_id, name, role, point,
       created_at::date AS created, updated_at::timestamp(0) AS updated
  FROM member
 WHERE mb_id = 'jackee';

\echo --- jackee 와 동일 mb_id 또는 비슷한 member (중복 가능성) ---
SELECT id, mb_id, name, role, point
  FROM member
 WHERE mb_id LIKE '%jackee%' OR name = '이상화';

\echo --- jackee 의 free_balance/paid_balance 합산 (3계좌 모두) ---
SELECT m.id, m.mb_id, m.point AS member_point,
       p.free_balance + p.paid_balance + p.earning_balance AS p_sum_all,
       p.free_balance + p.paid_balance AS p_sum_consumer,
       (m.point - (p.free_balance + p.paid_balance)) AS drift_vs_consumer,
       (m.point - (p.free_balance + p.paid_balance + p.earning_balance)) AS drift_vs_all
  FROM member m
  JOIN point p ON p.member_id = m.id
 WHERE m.mb_id = 'jackee';
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
