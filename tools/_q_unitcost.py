"""전체 상담사 등급↔단가 정합성 전수 점검 (read-only)."""
from __future__ import annotations
import base64, os, sys
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
import paramiko

SQL = r"""
-- 등급별 허용 단가 옵션
SELECT key, value FROM setting WHERE namespace='grade' AND key LIKE 'options.%' ORDER BY key;
-- 기본 단가/기타 grade 설정
SELECT key, value FROM setting WHERE namespace='grade' AND (key LIKE 'default%' OR key LIKE 'unit%' OR key LIKE '%default%') ORDER BY key;
-- 전체 상담사: 등급 + 단가 (좌탈퇴 제외)
SELECT id, nickname, grade,
       call_070_unit_cost AS call_uc, chat_unit_cost AS chat_uc, state, left_at IS NOT NULL AS left
  FROM member
 WHERE role='counselor'
 ORDER BY grade, id;
"""

def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw: return 1
    b64 = base64.b64encode(SQL.encode("utf-8")).decode("ascii")
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    inner = ('export DATABASE_URL=$(grep -E "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
             f'echo {b64} | base64 -d | psql "$DATABASE_URL"')
    _, out, err = c.exec_command(f"bash -lc {repr(inner)}")
    sys.stdout.write(out.read().decode("utf-8", "replace"))
    e = err.read().decode("utf-8", "replace")
    if e.strip(): sys.stderr.write(e)
    c.close(); return 0

if __name__ == "__main__": sys.exit(main())
