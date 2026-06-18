"""운영 전 등급↔단가 정합성 정정 — 어긋난 상담사 단가를 '등급 최상위 옵션'으로 정정.

대상(예비/파트너1 인데 단가가 옵션 밖): 104,107,109,112,123,131 → 1000원.
시스템 강등 클램프 규칙(Math.max(options))과 동일. 이력(member_unit_cost_history) 기록.

  MODE=inspect : 정정 대상 + 이력테이블 컬럼 확인
  MODE=apply   : 트랜잭션 UPDATE + 이력 INSERT
"""
from __future__ import annotations
import base64
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

IDS = "104,107,109,112,123,131"

INSPECT_SQL = f"""
SELECT id, nickname, grade, call_070_unit_cost, chat_unit_cost
  FROM member WHERE id IN ({IDS}) ORDER BY id;
SELECT column_name, is_nullable, data_type
  FROM information_schema.columns WHERE table_name='member_unit_cost_history' ORDER BY ordinal_position;
SELECT id, mb_id FROM member WHERE role='admin' ORDER BY id LIMIT 3;
"""

APPLY_SQL = f"""
BEGIN;
INSERT INTO member_unit_cost_history
  (member_id, grade_at_change, unit_cost_before, unit_cost_after, changed_by, reason)
SELECT m.id, m.grade, m.call_070_unit_cost, 1000,
       'system',
       '운영 전 데이터 정합성 정정 — 등급↔단가 불일치(시드/강제값) → 등급 최상위 단가(1000)로 정정'
  FROM member m WHERE m.id IN ({IDS});

UPDATE member
   SET call_070_unit_cost = 1000,
       chat_unit_cost = 1000,
       unit_cost_changeable_at = NULL
 WHERE id IN ({IDS})
RETURNING id, nickname, grade, call_070_unit_cost, chat_unit_cost;

-- 잔여 불일치 확인 (예비/파트너1 단가는 800/1000 이어야, 파트너2~5 도 옵션 내여야)
SELECT id, nickname, grade, call_070_unit_cost AS uc
  FROM member
 WHERE role='counselor' AND left_at IS NULL AND call_070_unit_cost IS NOT NULL
   AND (
     (grade IN ('preliminary','partner1') AND call_070_unit_cost NOT IN (800,1000)) OR
     (grade='partner2' AND call_070_unit_cost NOT IN (1000,1200)) OR
     (grade='partner3' AND call_070_unit_cost NOT IN (1000,1200,1300)) OR
     (grade='partner4' AND call_070_unit_cost NOT IN (1000,1200,1300,1400,1500)) OR
     (grade='partner5' AND call_070_unit_cost NOT IN (1200,1300,1400,1500,1800,2000))
   );
COMMIT;
"""


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        return 1
    mode = os.environ.get("MODE", "inspect")
    sql = APPLY_SQL if mode == "apply" else INSPECT_SQL
    b64 = base64.b64encode(sql.encode("utf-8")).decode("ascii")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    inner = (
        'export DATABASE_URL=$(grep -E "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    _, out, err = c.exec_command(f"bash -lc {repr(inner)}")
    print(f"========== prod MODE={mode} ==========")
    sys.stdout.write(out.read().decode("utf-8", "replace"))
    e = err.read().decode("utf-8", "replace")
    if e.strip():
        sys.stderr.write(e)
    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
