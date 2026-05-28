"""MONEY_FLOW.md 전 섹션 prod 엄격 매칭 검증.

각 SQL 블록은 MONEY_FLOW.md 의 § 와 1:1 매핑.
§14 금지 추측 (단기통화=1행 / 정상=2행) 반영.
모두 READ ONLY.
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
\echo
\echo ============================================================
\echo  [V-S] schema 확인 (consultation PK / point_history rel_id type)
\echo ============================================================
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name='consultation' AND column_name IN ('id','no','member_id','counselor_id','roomid','callid')
 ORDER BY column_name;

SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name='point_history' AND column_name IN ('rel_id','rel_table','rel_action','member_id','earn_point','use_point')
 ORDER BY column_name;

\echo
\echo ============================================================
\echo  [V-3.1] §3.1 결제 흐름 — payment vs point_history(rel_table=payment*) 매칭
\echo ============================================================
\echo  정상: payment.status='completed' 1건 = point_history 1행

SELECT
  COUNT(*) FILTER (WHERE p.status='completed') AS completed,
  COUNT(*) FILTER (WHERE p.status='pending')   AS pending,
  COUNT(*) FILTER (WHERE p.status='cancelled') AS cancelled,
  COUNT(*) FILTER (WHERE p.status='completed' AND EXISTS (
    SELECT 1 FROM point_history ph
     WHERE ph.rel_table IN ('payment','payment_autopay')
       AND ph.rel_id::text = p.id::text
  )) AS completed_with_ph,
  COUNT(*) FILTER (WHERE p.status='completed' AND NOT EXISTS (
    SELECT 1 FROM point_history ph
     WHERE ph.rel_table IN ('payment','payment_autopay')
       AND ph.rel_id::text = p.id::text
  )) AS completed_without_ph
  FROM payment p;

\echo --- 누락 payment 상세 (있으면 사고) ---
SELECT id, oid, status, amount, coin_amount, pay_type, m2net_status, created_at::date AS d
  FROM payment p
 WHERE p.status='completed'
   AND NOT EXISTS (
     SELECT 1 FROM point_history ph
      WHERE ph.rel_table IN ('payment','payment_autopay')
        AND ph.rel_id::text = p.id::text
   )
 ORDER BY id;

\echo
\echo ============================================================
\echo  [V-4.1] §4.1 상담 차감 — consultation 매칭 패턴 (§14 #6 적용)
\echo ============================================================
\echo  정상(refund_status NULL): point_history 2행 (회원차감 use_point>0 + 상담사적립 earn_point>0)
\echo  단기통화(short_call_refund): 1행 (상담사 적립만, 회원 차감 스킵)
\echo  전액환불(full): 정산 제외 — point_history 환원행 추가

WITH stats AS (
  SELECT c.id, c.reason, c.refund_status,
         (SELECT COUNT(*) FROM point_history ph
            WHERE ph.rel_table='consultation' AND ph.rel_id::text = c.id::text
              AND ph.earn_point > 0) AS credit_rows,
         (SELECT COUNT(*) FROM point_history ph
            WHERE ph.rel_table='consultation' AND ph.rel_id::text = c.id::text
              AND ph.use_point > 0) AS debit_rows
    FROM consultation c
   WHERE c.reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
)
SELECT
  COALESCE(refund_status, 'normal') AS category,
  COUNT(*) AS cons_cnt,
  SUM(credit_rows) AS sum_credits,
  SUM(debit_rows) AS sum_debits,
  COUNT(*) FILTER (WHERE
    (COALESCE(refund_status,'normal') = 'normal'   AND credit_rows >= 1 AND debit_rows >= 1) OR
    (refund_status = 'short_call_refund'           AND credit_rows >= 1 AND debit_rows = 0) OR
    (refund_status = 'partial'                     AND credit_rows >= 1 AND debit_rows >= 1) OR
    (refund_status = 'full')
  ) AS pattern_ok,
  COUNT(*) FILTER (WHERE NOT (
    (COALESCE(refund_status,'normal') = 'normal'   AND credit_rows >= 1 AND debit_rows >= 1) OR
    (refund_status = 'short_call_refund'           AND credit_rows >= 1 AND debit_rows = 0) OR
    (refund_status = 'partial'                     AND credit_rows >= 1 AND debit_rows >= 1) OR
    (refund_status = 'full')
  )) AS pattern_fail
  FROM stats
 GROUP BY category
 ORDER BY category;

\echo --- 패턴 위반 consultation 상세 (있으면 적립 누락 사고) ---
WITH stats AS (
  SELECT c.id, c.reason, c.refund_status, c.amt, c.amt_free, c.amt_pro,
         c.member_id, c.counselor_id, c.created_at::date AS d,
         (SELECT COUNT(*) FROM point_history ph
            WHERE ph.rel_table='consultation' AND ph.rel_id::text = c.id::text
              AND ph.earn_point > 0) AS credits,
         (SELECT COUNT(*) FROM point_history ph
            WHERE ph.rel_table='consultation' AND ph.rel_id::text = c.id::text
              AND ph.use_point > 0) AS debits
    FROM consultation c
   WHERE c.reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
)
SELECT id, d, reason, refund_status, amt, amt_free, amt_pro,
       member_id, counselor_id, credits, debits
  FROM stats
 WHERE NOT (
    (COALESCE(refund_status,'normal') = 'normal'   AND credits >= 1 AND debits >= 1) OR
    (refund_status = 'short_call_refund'           AND credits >= 1 AND debits = 0) OR
    (refund_status = 'partial'                     AND credits >= 1 AND debits >= 1) OR
    (refund_status = 'full')
  )
 ORDER BY id DESC
 LIMIT 40;

\echo --- consultation reason 전체 분포 (제외된 케이스 가시화) ---
SELECT COALESCE(reason,'(NULL)') AS reason,
       COALESCE(refund_status,'(NULL)') AS refund_status,
       COUNT(*) AS cnt
  FROM consultation
 GROUP BY reason, refund_status
 ORDER BY reason NULLS LAST, refund_status NULLS LAST;

\echo
\echo ============================================================
\echo  [V-5] §5 환불 흐름 — refund_request vs consultation.refund_status
\echo ============================================================
SELECT 'refund_request_total' AS t, COUNT(*) AS cnt FROM refund_request
UNION ALL SELECT 'cons.refund_status=full', COUNT(*) FROM consultation WHERE refund_status='full'
UNION ALL SELECT 'cons.refund_status=partial', COUNT(*) FROM consultation WHERE refund_status='partial'
UNION ALL SELECT 'cons.refund_status=short_call_refund', COUNT(*) FROM consultation WHERE refund_status='short_call_refund'
UNION ALL SELECT 'cons.refund_status=NULL', COUNT(*) FROM consultation WHERE refund_status IS NULL;

\echo
\echo ============================================================
\echo  [V-6] §6 정산 흐름 — settlement_monthly 14건 정체 확인
\echo ============================================================
SELECT to_char(month::date, 'YYYY-MM') AS month, COUNT(*) AS cnt,
       SUM(price) AS sum_price,
       SUM(final_payout_amount) AS sum_payout,
       string_agg(DISTINCT status, ',') AS statuses,
       MIN(calculated_at)::date AS calc_first,
       MAX(calculated_at)::date AS calc_last
  FROM settlement_monthly
 GROUP BY month
 ORDER BY month;

\echo --- 정산 개별 (최근 20건) ---
SELECT id, member_id, mb_id, to_char(month::date,'YYYY-MM') AS month, status,
       amt_free, amt_pro, price, final_payout_amount,
       early_payout_total, carry_over_negative,
       calculated_at::date AS calc, paid_at::date AS paid
  FROM settlement_monthly
 ORDER BY month DESC, id DESC
 LIMIT 20;

\echo --- 월별 consultation 발생 vs 정산 매칭 ---
SELECT to_char(date_trunc('month', created_at)::date, 'YYYY-MM') AS month,
       COUNT(*) AS cons_total,
       COUNT(*) FILTER (WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')) AS valid_reason,
       COUNT(DISTINCT counselor_id) FILTER (WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')) AS distinct_counselors
  FROM consultation
 GROUP BY 1
 ORDER BY 1;

\echo
\echo ============================================================
\echo  [V-7] §7 선지급 — payout_request
\echo ============================================================
SELECT status, COUNT(*) AS cnt,
       SUM(requested_amount) AS sum_requested,
       SUM(actual_payout) AS sum_actual
  FROM payout_request
 GROUP BY status
 ORDER BY status;

\echo
\echo ============================================================
\echo  [V-8] §8 point 3계좌 — earning_balance>0 (정산 대기 중)
\echo ============================================================
SELECT m.id, m.mb_id, m.name, m.role,
       p.free_balance AS free, p.paid_balance AS paid, p.earning_balance AS earning,
       p.total_earned, p.total_used,
       m.point AS m_point_snap,
       (p.free_balance + p.paid_balance) AS computed
  FROM point p
  JOIN member m ON m.id = p.member_id
 WHERE p.earning_balance > 0 OR p.paid_balance > 0 OR p.free_balance > 0
 ORDER BY p.earning_balance DESC, p.paid_balance DESC
 LIMIT 30;

\echo --- C-8 drift 상세 (1건 발견됨) ---
SELECT m.id, m.mb_id, m.name, m.role,
       m.point AS member_point,
       p.free_balance, p.paid_balance,
       (p.free_balance + p.paid_balance) AS computed,
       m.point - (p.free_balance + p.paid_balance) AS drift
  FROM member m
  JOIN point p ON p.member_id = m.id
 WHERE m.point != (p.free_balance + p.paid_balance);

\echo
\echo ============================================================
\echo  [V-11] §11 정책 상수 — setting 테이블 prod 매칭
\echo ============================================================
SELECT namespace, key, value
  FROM setting
 WHERE namespace IN ('grade','payout','settlement','system','vat','withholding','tax','consultation')
    OR key ~* 'royalty|revenue|fee|threshold|vat|withholding|tax|payout|grade|rate|cost'
 ORDER BY namespace, key
 LIMIT 60;

\echo
\echo ============================================================
\echo  [V-12-C17] §12 C-17 chat_room m2net_failed 10건 — consultation 매칭
\echo ============================================================
SELECT cr.id AS cr_id, cr.roomid, cr.status, cr.settle_status, cr.settle_retry_count,
       cr.created_at::date AS d,
       EXISTS (SELECT 1 FROM consultation c WHERE c.roomid = cr.roomid) AS exact_match,
       EXISTS (SELECT 1 FROM consultation c WHERE c.roomid LIKE cr.roomid || '%') AS prefix_match
  FROM chat_room cr
 WHERE cr.settle_status = 'm2net_failed'
 ORDER BY cr.created_at DESC;

\echo
\echo ============================================================
\echo  [V-13-H1] §13 H-1 m2net 이중적립 안전망 — payment.m2net_status 분포
\echo ============================================================
SELECT COALESCE(m2net_status,'(NULL)') AS m2net_status, COUNT(*) AS cnt
  FROM payment
 WHERE status = 'completed'
 GROUP BY m2net_status
 ORDER BY cnt DESC;

\echo
\echo ============================================================
\echo  [V-운영] 운영 데이터 양 + 최근 7일 활동
\echo ============================================================
SELECT 'member.role=user' AS metric, COUNT(*) AS cnt FROM member WHERE role='user'
UNION ALL SELECT 'member.role=counselor', COUNT(*) FROM member WHERE role='counselor'
UNION ALL SELECT 'consultation total', COUNT(*) FROM consultation
UNION ALL SELECT 'payment total', COUNT(*) FROM payment
UNION ALL SELECT 'payment completed', COUNT(*) FROM payment WHERE status='completed'
UNION ALL SELECT 'point_history total', COUNT(*) FROM point_history
UNION ALL SELECT 'settlement_monthly total', COUNT(*) FROM settlement_monthly
UNION ALL SELECT 'refund_request total', COUNT(*) FROM refund_request
UNION ALL SELECT 'payout_request total', COUNT(*) FROM payout_request
UNION ALL SELECT 'chat_room total', COUNT(*) FROM chat_room
UNION ALL SELECT 'chat_room m2net_failed', COUNT(*) FROM chat_room WHERE settle_status='m2net_failed';

SELECT 'consultation_7d' AS metric, COUNT(*) AS cnt
  FROM consultation WHERE created_at >= NOW() - INTERVAL '7 days'
UNION ALL SELECT 'payment_completed_7d', COUNT(*)
  FROM payment WHERE created_at >= NOW() - INTERVAL '7 days' AND status='completed'
UNION ALL SELECT 'new_member_7d', COUNT(*)
  FROM member WHERE created_at >= NOW() - INTERVAL '7 days';
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
        f"psql \"$DATABASE_URL\" -v ON_ERROR_STOP=0 <<'EOSQL'\n{SQL}\nEOSQL"
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
