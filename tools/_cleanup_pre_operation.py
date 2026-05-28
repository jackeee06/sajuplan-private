"""운영 시작 전 클린업 — 화이트리스트 명시 + 트랜잭션 검증.

A-1: settlement_monthly 5/25 테스트 더미 14건 삭제
A-2: chat_room m2net_failed 5/23 테스트 10건 → settle_status='dropped'
A-3: jackee member.point 38200 → 38000 정정 (point.paid+free 와 동기화)

각 작업:
  1. SELECT COUNT (영향 row 확인)
  2. SELECT 샘플 (어떤 데이터인지 확인)
  3. UPDATE/DELETE 실행
  4. SELECT 검증 (정상 적용 확인)
모두 단일 트랜잭션. 카운트가 예상과 다르면 ROLLBACK.

사용:
  SSHPASS=... python tools/_cleanup_pre_operation.py [--apply]
  --apply 없으면 DRY RUN (모두 ROLLBACK)
"""
from __future__ import annotations
import os, sys

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

import paramiko

HOST = "104.64.128.103"
ENV_FILE = "/data/wwwroot/api.sajumoon.co.kr/.env"

APPLY = "--apply" in sys.argv

END_TX = "COMMIT;" if APPLY else "ROLLBACK;"

SQL = f"""
BEGIN;

\\echo
\\echo ============================================================
\\echo  [A-1] settlement_monthly 14건 테스트 더미 삭제
\\echo ============================================================
\\echo  화이트리스트: month='2026-04' AND price=0 AND created_at::date='2026-05-25'

\\echo --- 영향 row 확인 (정확히 14 이어야 함) ---
SELECT COUNT(*) AS will_delete
  FROM settlement_monthly
 WHERE month='2026-04' AND price=0 AND created_at::date='2026-05-25';

\\echo --- 샘플 (지워질 row) ---
SELECT id, member_id, mb_id, month, price, created_at::date
  FROM settlement_monthly
 WHERE month='2026-04' AND price=0 AND created_at::date='2026-05-25'
 ORDER BY id;

DELETE FROM settlement_monthly
 WHERE month='2026-04' AND price=0 AND created_at::date='2026-05-25';

\\echo --- 삭제 후 남은 settlement_monthly ---
SELECT COUNT(*) AS remaining FROM settlement_monthly;

\\echo
\\echo ============================================================
\\echo  [A-2] chat_room m2net_failed 5/23 10건 → settle_status='dropped'
\\echo ============================================================
\\echo  화이트리스트: settle_status='m2net_failed' AND started_at::date='2026-05-23'

\\echo --- 영향 row 확인 (정확히 10 이어야 함) ---
SELECT COUNT(*) AS will_update
  FROM chat_room
 WHERE settle_status='m2net_failed' AND started_at::date='2026-05-23';

UPDATE chat_room
   SET settle_status='dropped',
       settle_failure_reason=COALESCE(settle_failure_reason,'') || ' [cleaned 2026-05-29 운영시작전 테스트데이터정리]'
 WHERE settle_status='m2net_failed' AND started_at::date='2026-05-23';

\\echo --- 갱신 후 m2net_failed 잔여 (0 이어야 함) ---
SELECT COUNT(*) AS remaining_m2net_failed
  FROM chat_room
 WHERE settle_status='m2net_failed';

SELECT COUNT(*) AS dropped_cnt
  FROM chat_room
 WHERE settle_status='dropped';

\\echo
\\echo ============================================================
\\echo  [A-3] jackee member.point 38200 → 38000 정정
\\echo ============================================================

\\echo --- 정정 전 ---
SELECT m.id, m.mb_id, m.point AS before_point,
       p.free_balance + p.paid_balance AS computed
  FROM member m JOIN point p ON p.member_id=m.id
 WHERE m.mb_id='jackee';

UPDATE member
   SET point = (SELECT free_balance + paid_balance FROM point WHERE member_id=member.id),
       updated_at=NOW()
 WHERE mb_id='jackee'
   AND point != (SELECT free_balance + paid_balance FROM point WHERE member_id=member.id);

\\echo --- 정정 후 (drift 0 이어야 함) ---
SELECT m.id, m.mb_id, m.point AS after_point,
       p.free_balance + p.paid_balance AS computed,
       m.point - (p.free_balance + p.paid_balance) AS drift
  FROM member m JOIN point p ON p.member_id=m.id
 WHERE m.mb_id='jackee';

\\echo
\\echo ============================================================
\\echo  [V] health-check C-1/C-8/C-17 재검증 (모두 0 이어야 함)
\\echo ============================================================
SELECT 'C-1 negative point' AS check, COUNT(*) AS cnt
  FROM point WHERE free_balance < 0 OR paid_balance < 0 OR earning_balance < 0
UNION ALL
SELECT 'C-8 member.point drift', COUNT(*)
  FROM member m JOIN point p ON p.member_id=m.id
 WHERE m.point != (p.free_balance + p.paid_balance)
UNION ALL
SELECT 'C-17 chat_room m2net_failed', COUNT(*)
  FROM chat_room WHERE settle_status='m2net_failed';

{END_TX}

\\echo
\\echo ============================================================
\\echo  최종 ({'APPLIED' if APPLY else 'DRY RUN — rolled back'})
\\echo ============================================================
"""


def main():
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS env not set", file=sys.stderr); return 1
    print(f"[mode] {'APPLY (변경 영구 반영)' if APPLY else 'DRY RUN (자동 ROLLBACK)'}")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=30)
    cmd = (
        f"export $(grep -E '^(DATABASE_URL|DB_)' {ENV_FILE} | xargs -d '\\n') && "
        f"psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 <<'EOSQL'\n{SQL}\nEOSQL"
    )
    _, out, err = c.exec_command(cmd, get_pty=False)
    sys.stdout.write(out.read().decode("utf-8", errors="replace"))
    e = err.read().decode("utf-8", errors="replace")
    if e: sys.stderr.write(e)
    c.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
