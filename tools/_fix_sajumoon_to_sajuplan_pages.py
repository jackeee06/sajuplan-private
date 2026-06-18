"""약관/콘텐츠 페이지 본문의 '사주문' → '사주플랜' 치환 (prod).

1단계(MODE=inspect): page/setting 테이블에서 '사주문' 포함 행 조회만.
2단계(MODE=apply): page.content/title 의 '사주문' → '사주플랜' UPDATE (RETURNING 으로 확인).

사용:
  MODE=inspect python tools/_fix_sajumoon_to_sajuplan_pages.py
  MODE=apply   python tools/_fix_sajumoon_to_sajuplan_pages.py
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

PROD_HOST = "104.64.128.103"
ENV_FILE = "/data/wwwroot/api.sajumoon.co.kr/.env"

INSPECT_SQL = r"""
SELECT 'page' AS tbl, slug, title,
       (content LIKE '%사주문%') AS content_has,
       (mobile_content LIKE '%사주문%') AS mobile_has
  FROM page
 WHERE content LIKE '%사주문%' OR title LIKE '%사주문%' OR mobile_content LIKE '%사주문%'
 ORDER BY slug;
SELECT 'setting' AS tbl, namespace, key, value
  FROM setting WHERE value LIKE '%사주문%'
 ORDER BY namespace, key;
"""

APPLY_SQL = r"""
BEGIN;
UPDATE page
   SET content        = replace(coalesce(content, ''), '사주문', '사주플랜'),
       mobile_content = replace(coalesce(mobile_content, ''), '사주문', '사주플랜'),
       title          = replace(coalesce(title, ''), '사주문', '사주플랜'),
       updated_at     = now()
 WHERE content LIKE '%사주문%' OR title LIKE '%사주문%' OR mobile_content LIKE '%사주문%'
RETURNING slug, title;
-- 잔여 확인 (0 이어야 함) — content/mobile_content/title 전부
SELECT count(*) AS remaining FROM page
 WHERE content LIKE '%사주문%' OR title LIKE '%사주문%' OR mobile_content LIKE '%사주문%';
COMMIT;
"""


TITLE_SQL = r"""
BEGIN;
UPDATE page SET title = '이용약관', updated_at = now()
 WHERE slug = 'terms' AND title <> '이용약관'
RETURNING slug, title;
SELECT slug, title FROM page WHERE slug = 'terms';
COMMIT;
"""


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 없음 — .env.local 로드 후 실행", file=sys.stderr)
        return 1
    mode = os.environ.get("MODE", "inspect")
    sql = TITLE_SQL if mode == "title" else APPLY_SQL if mode == "apply" else INSPECT_SQL
    b64 = base64.b64encode(sql.encode("utf-8")).decode("ascii")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(PROD_HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    inner = (
        f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" {ENV_FILE} | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    _, stdout, stderr = c.exec_command(f"bash -lc {repr(inner)}", get_pty=False)
    print(f"========== prod ({PROD_HOST}) MODE={mode} ==========")
    sys.stdout.write(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        sys.stderr.write(err)
    rc = stdout.channel.recv_exit_status()
    c.close()
    return rc


if __name__ == "__main__":
    sys.exit(main())
