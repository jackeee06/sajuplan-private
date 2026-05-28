"""정식 운영 직전 — 돈 흐름 심층 엄격 검증.

22 invariants 통과 후에도 남아있을 수 있는 "조용한 사고 시그널" 검출.
모두 READ ONLY. prod 만 점검 (test 서버 미사용).

사용:
  SSHPASS=... python tools/_audit_money_deep.py
"""
from __future__ import annotations
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import paramiko

HOST = "104.64.128.103"
ENV_FILE = "/data/wwwroot/api.sajumoon.co.kr/.env"

SQL = r"""
\echo === [D-1] consultation vs point_history 매칭 — 누락 검출 ★ ===
\echo  정상: consultation 1건 = point_history 2건 (회원차감 + 상담사적립)
\echo  누락 = "상담은 했는데 적립 기록 없음" = 돈 사고 시그널

WITH cons AS (
  SELECT COUNT(*) AS total_cons
    FROM consultation
   WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
), ph AS (
  SELECT COUNT(*) AS total_ph
    FROM point_history
   WHERE rel_table IN ('consultation','@platform_consulting')
)
SELECT cons.total_cons,
       ph.total_ph,
       cons.total_cons * 2 AS expected_ph,
       ph.total_ph - cons.total_cons * 2 AS diff
  FROM cons, ph;

\echo --- 각 consultation 의 point_history 매칭 상세 ---
SELECT c.reason,
       c.refund_status,
       COUNT(*) AS cons_cnt,
       SUM(CASE WHEN EXISTS (
         SELECT 1 FROM point_history ph
          WHERE ph.rel_table IN ('consultation','@platform_consulting')
            AND ph.rel_id::text = c.id::text
       ) THEN 1 ELSE 0 END) AS with_ph,
       SUM(CASE WHEN NOT EXISTS (
         SELECT 1 FROM point_history ph
          WHERE ph.rel_table IN ('consultation','@platform_consulting')
            AND ph.rel_id::text = c.id::text
       ) THEN 1 ELSE 0 END) AS without_ph
  FROM consultation c
 GROUP BY c.reason, c.refund_status
 ORDER BY c.reason, c.refund_status;

\echo === [D-2] settlement_monthly 14건 상세 — 누가, 언제, 얼마 ===
SELECT month,
       COUNT(*) AS cnt,
       MIN(price) AS min_price,
       MAX(price) AS max_price,
       SUM(price) AS sum_price,
       SUM(final_payout_amount) AS sum_payout,
       string_agg(status, ',') AS statuses
  FROM settlement_monthly
 GROUP BY month
 ORDER BY month;

\echo --- 정산 상세 (개별) ---
SELECT id, member_id, mb_id, month, status,
       price, final_payout_amount,
       early_payout_total, carry_over_negative,
       calculated_at::date AS calc_date,
       paid_at::date AS paid_date
  FROM settlement_monthly
 ORDER BY month DESC, id DESC
 LIMIT 20;

\echo === [D-3] C-8 drift — 어느 member 인지 정확히 ===
SELECT m.id, m.mb_id, m.name, m.role,
       m.point AS member_point,
       p.free_balance, p.paid_balance, p.earning_balance,
       (p.free_balance + p.paid_balance) AS computed,
       m.point - (p.free_balance + p.paid_balance) AS drift
  FROM member m
  JOIN point p ON p.member_id = m.id
 WHERE m.point != (p.free_balance + p.paid_balance);

\echo === [D-4] C-17 chat_room m2net_failed 10건 상세 ===
SELECT id, roomid, status, settle_status, settle_retry_count,
       created_at::date AS created,
       updated_at::date AS updated
  FROM chat_room
 WHERE settle_status = 'm2net_failed'
 ORDER BY updated_at DESC;

\echo --- chat_room 의 consultation 매칭 (이미 정산됐는가) ---
SELECT cr.id AS room_id, cr.roomid, cr.settle_status,
       EXISTS (
         SELECT 1 FROM consultation c WHERE c.roomid LIKE cr.roomid || '%'
       ) AS has_consultation
  FROM chat_room cr
 WHERE cr.settle_status = 'm2net_failed';

\echo === [D-5] point.earning_balance > 0 인 상담사 (정산 대기 중) ===
SELECT m.id, m.mb_id, m.name, m.role,
       p.earning_balance,
       p.total_earned, p.total_used
  FROM point p
  JOIN member m ON m.id = p.member_id
 WHERE p.earning_balance > 0
 ORDER BY p.earning_balance DESC;

\echo === [D-6] payment 14건 vs point_history payment-rel 매칭 ===
SELECT 'payment' AS t, COUNT(*) AS cnt,
       SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
       SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled
  FROM payment
UNION ALL
SELECT 'point_history (payment)', COUNT(*),
       0, 0, 0
  FROM point_history
 WHERE rel_table = 'payment';

\echo --- 각 payment 의 point_history 매칭 ---
SELECT p.id, p.oid, p.status, p.amount, p.coin_amount,
       EXISTS (
         SELECT 1 FROM point_history ph
          WHERE ph.rel_table='payment' AND ph.rel_id=p.id
       ) AS has_ph
  FROM payment p
 ORDER BY p.id DESC;

\echo === [D-7] 정책 상수 prod 확인 — setting 테이블 ===
SELECT namespace, key, value
  FROM setting
 WHERE namespace IN ('grade','payout','vat','withholding','system')
    OR key LIKE '%royalty%'
    OR key LIKE '%revenue%'
    OR key LIKE '%fee%'
    OR key LIKE '%threshold%'
 ORDER BY namespace, key;

\echo === [D-8] 회원/상담사 분포 (운영 데이터 양 감) ===
SELECT role,
       state,
       COUNT(*) AS cnt
  FROM member
 GROUP BY role, state
 ORDER BY role, state;

\echo === [D-9] m2net_membid / csrid 누락 (외부 시스템 미연동 상담사) ===
SELECT COUNT(*) AS counselor_without_csrid
  FROM member
 WHERE role = 'counselor' AND (csrid IS NULL OR csrid = '');

SELECT COUNT(*) AS member_without_m2net_membid
  FROM member
 WHERE role = 'user' AND (m2net_membid IS NULL OR m2net_membid = '');

\echo === [D-10] 최근 7일 활동 (운영 가시화) ===
SELECT 'consultation_7d' AS metric, COUNT(*) AS cnt
  FROM consultation
 WHERE created_at >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT 'payment_7d', COUNT(*)
  FROM payment
 WHERE created_at >= NOW() - INTERVAL '7 days'
   AND status = 'completed'
UNION ALL
SELECT 'new_member_7d', COUNT(*)
  FROM member
 WHERE created_at >= NOW() - INTERVAL '7 days';
"""


def main():
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS env not set", file=sys.stderr)
        return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=30)
    cmd = (
        f"export $(grep -E '^(DATABASE_URL|DB_)' {ENV_FILE} | xargs -d '\\n') && "
        f"PGPASSWORD=$(echo $DATABASE_URL | sed -E 's|.*://[^:]+:([^@]+)@.*|\\1|') "
        f"psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 <<'EOSQL'\n{SQL}\nEOSQL"
    )
    _, out, err = c.exec_command(cmd, get_pty=False)
    sys.stdout.write(out.read().decode("utf-8", errors="replace"))
    e = err.read().decode("utf-8", errors="replace")
    if e:
        sys.stderr.write(e)
    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
