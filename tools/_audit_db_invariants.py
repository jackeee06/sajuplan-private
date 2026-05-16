"""Phase C — DB 데이터 일관성 정밀 검사.

돈/포인트/정산 관련 불변식(invariant) 위반 자동 감지.
재실행 안전 (모든 쿼리 READ ONLY). 정기 health-check 로 사용 가능.

발견된 위반:
  🔴 Critical: 즉시 처리 필요 (실제 자금 사고 시그널)
  🟡 Warning: 잠재 위험 (의심스러운 상태)
  🟢 Info: 운영 통계 (참고용)

사용:
  SSHPASS=... python tools/_audit_db_invariants.py
"""
from __future__ import annotations
import base64
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import paramiko

TARGETS = [
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr/.env"),
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr/.env"),
]

# ========================================================================
# 불변식 검사 SQL
# 각 검사는 NULL/0건이면 PASS, 위반 행이 있으면 FAIL/WARN
# ========================================================================
SQL = """
\\echo === [C-1] 음수 포인트 잔액 (있으면 안 됨) ===
SELECT 'point' AS table,
       COUNT(*)::int AS cnt
  FROM point WHERE free_balance < 0 OR paid_balance < 0;

\\echo === [C-2] member.point 음수 ===
SELECT 'member.point' AS table,
       COUNT(*)::int AS cnt
  FROM member WHERE point < 0;

\\echo === [C-3] consultation.amt_free + amt_pro != amt 깨진 데이터 ===
SELECT COUNT(*)::int AS cnt,
       'amt_free+amt_pro != amt' AS note
  FROM consultation
 WHERE amt > 0 AND (amt_free + amt_pro) != amt
   AND reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL');

\\echo === [C-4] consultation.refunded_amount > amt 과다 환불 ===
SELECT COUNT(*)::int AS cnt
  FROM consultation
 WHERE refunded_amount > amt;

\\echo === [C-5] refund_request 합계 > consultation.amt 과다 환불 ===
WITH rr_sum AS (
  SELECT consultation_id, SUM(amount)::int AS total
    FROM refund_request
   WHERE status = 'approved'
   GROUP BY consultation_id
)
SELECT COUNT(*)::int AS cnt
  FROM consultation c
  JOIN rr_sum r ON r.consultation_id = c.id
 WHERE r.total > c.amt;

\\echo === [C-6] refund_request.amount_free + amount_pro != amount ===
SELECT COUNT(*)::int AS cnt
  FROM refund_request
 WHERE (amount_free + amount_pro) != amount;

\\echo === [C-7] orphan refund_request (consultation 없음) ===
SELECT COUNT(*)::int AS cnt
  FROM refund_request r
  LEFT JOIN consultation c ON c.id = r.consultation_id
 WHERE c.id IS NULL;

\\echo === [C-8] member.point vs (point.free + paid) 동기화 ===
SELECT COUNT(*)::int AS cnt,
       MIN(m.point - (p.free_balance + p.paid_balance))::int AS min_diff,
       MAX(m.point - (p.free_balance + p.paid_balance))::int AS max_diff
  FROM member m
  JOIN point p ON p.member_id = m.id
 WHERE m.point != (p.free_balance + p.paid_balance);

\\echo === [C-9] settlement_monthly 중복 (member_id, month) ===
SELECT member_id, month, COUNT(*) AS cnt
  FROM settlement_monthly
 WHERE member_id IS NOT NULL
 GROUP BY member_id, month
HAVING COUNT(*) > 1
 LIMIT 10;

\\echo === [C-10] consultation 시간(usetm) 음수 또는 비현실적 ===
SELECT COUNT(*)::int AS cnt,
       'usetm < 0 또는 > 86400 (24h)' AS note
  FROM consultation
 WHERE usetm < 0 OR usetm > 86400;

\\echo === [C-11] settlement_monthly.price 음수 (음수 정산은 가능하지만 알림 필요) ===
SELECT COUNT(*)::int AS cnt,
       COALESCE(MIN(price), 0)::int AS min_price
  FROM settlement_monthly
 WHERE price < 0;

\\echo === [C-12] 등급 임계값 역전 (partner1 > partner2 등) ===
WITH thresholds AS (
  SELECT
    (SELECT NULLIF(value, '')::int FROM setting WHERE namespace='grade' AND key='thresholds.partner1') AS p1,
    (SELECT NULLIF(value, '')::int FROM setting WHERE namespace='grade' AND key='thresholds.partner2') AS p2,
    (SELECT NULLIF(value, '')::int FROM setting WHERE namespace='grade' AND key='thresholds.partner3') AS p3,
    (SELECT NULLIF(value, '')::int FROM setting WHERE namespace='grade' AND key='thresholds.partner4') AS p4,
    (SELECT NULLIF(value, '')::int FROM setting WHERE namespace='grade' AND key='thresholds.partner5') AS p5
)
SELECT
  CASE
    WHEN p1 >= p2 OR p2 >= p3 OR p3 >= p4 OR p4 >= p5
    THEN 'ANOMALY'
    ELSE 'OK'
  END AS status,
  p1, p2, p3, p4, p5
FROM thresholds;

\\echo === [C-13] 정산률 범위 외 (0~1) ===
SELECT key, value
  FROM setting
 WHERE namespace='grade' AND key LIKE 'revenue_rate.%'
   AND (NULLIF(value, '')::numeric < 0 OR NULLIF(value, '')::numeric > 1);

\\echo === [C-14] point.free_balance > total_earned (수익보다 잔액이 큰 사기성 데이터) ===
SELECT COUNT(*)::int AS cnt
  FROM point
 WHERE free_balance + paid_balance > total_earned + 100000;  -- 100k 마진 허용

\\echo === [C-15] consultation.refund_status 일관성 — full 이면 amt 만큼 환불됐어야 ===
SELECT COUNT(*)::int AS cnt
  FROM consultation
 WHERE refund_status = 'full' AND refunded_amount < amt;

\\echo === [C-16] payment.m2net_status='코인충전실패' 가 너무 많이 쌓임 ===
SELECT COUNT(*)::int AS pending_retry,
       MAX(m2net_retry_count)::int AS max_retries
  FROM payment
 WHERE m2net_status = '코인충전실패';

\\echo === [C-17] chat_room.settle_status='m2net_failed' 쌓임 (#9 retry 큐) ===
SELECT COUNT(*)::int AS pending_retry,
       MAX(settle_retry_count)::int AS max_retries
  FROM chat_room
 WHERE settle_status = 'm2net_failed';

\\echo === [C-18] 운영 통계 — 전체 데이터 양 (참고) ===
SELECT 'member' AS t, COUNT(*)::int AS n FROM member
UNION ALL SELECT 'consultation', COUNT(*) FROM consultation
UNION ALL SELECT 'payment', COUNT(*) FROM payment
UNION ALL SELECT 'point_history', COUNT(*) FROM point_history
UNION ALL SELECT 'settlement_monthly', COUNT(*) FROM settlement_monthly
UNION ALL SELECT 'refund_request', COUNT(*) FROM refund_request
ORDER BY t;
"""


def run_audit(label: str, host: str, env_file: str, pw: str) -> int:
    b64 = base64.b64encode(SQL.encode("utf-8")).decode("ascii")
    inner = (
        f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" {env_file} | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=30)
    _, stdout, stderr = c.exec_command(f"bash -lc {repr(inner)}", get_pty=False)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(f"\n{'='*60}\n  [{label}] {host}\n{'='*60}")
    print(out)
    if err.strip():
        sys.stderr.write(err)
    rc = stdout.channel.recv_exit_status()
    c.close()
    return rc


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 환경변수 필요", file=sys.stderr)
        return 1
    rc = 0
    for label, host, env_file in TARGETS:
        r = run_audit(label, host, env_file, pw)
        if r != 0:
            rc = r
    return rc


if __name__ == "__main__":
    sys.exit(main())
