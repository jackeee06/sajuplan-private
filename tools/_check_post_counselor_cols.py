"""prod/test 의 post_counselor 테이블 위치/컬럼 정밀 조사."""
from __future__ import annotations
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

TARGETS = [
    ("test", "172.235.211.75", "api.sajumoon.kr"),
    ("prod", "104.64.128.103", "api.sajumoon.co.kr"),
]


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        return 1
    for label, host, domain in TARGETS:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

        _, out, _ = c.exec_command(
            f"grep '^DATABASE_URL=' /data/wwwroot/{domain}/.env | head -1 | cut -d= -f2-",
            timeout=15,
        )
        url = out.read().decode("utf-8", "replace").strip().strip('"').strip("'")
        print(f"\n[{label}] DATABASE_URL hash={hash(url)} length={len(url)}")

        # 모든 schema 에서 post_counselor 검색
        cmd = (
            f"psql '{url}' -At -c \"SELECT table_schema, table_name FROM information_schema.tables "
            f"WHERE table_name LIKE '%counselor%' ORDER BY table_schema, table_name\""
        )
        _, out, _ = c.exec_command(cmd, timeout=30)
        print(f"[{label}] *counselor* 테이블들:")
        print(out.read().decode("utf-8", "replace").rstrip() or "  (없음)")

        # 정확히 post_counselor 검색
        cmd2 = (
            f"psql '{url}' -At -c \"SELECT table_schema FROM information_schema.tables "
            f"WHERE table_name = 'post_counselor'\""
        )
        _, out, _ = c.exec_command(cmd2, timeout=30)
        schemas = out.read().decode("utf-8", "replace").strip().splitlines()
        print(f"[{label}] post_counselor 가 있는 schema: {schemas}")

        # search_path 확인
        _, out, _ = c.exec_command(f"psql '{url}' -At -c \"SHOW search_path\"", timeout=15)
        print(f"[{label}] search_path: {out.read().decode().strip()}")

        # 만약 어디든 post_counselor 가 있으면 이벤트 컬럼 존재 여부 확인
        for sch in schemas:
            cmd3 = (
                f"psql '{url}' -At -c \"SELECT column_name FROM information_schema.columns "
                f"WHERE table_schema = '{sch}' AND table_name = 'post_counselor' "
                f"AND column_name IN ('event_starts_at','event_ends_at','event_banner_image_url')\""
            )
            _, out, _ = c.exec_command(cmd3, timeout=15)
            print(f"[{label}] {sch}.post_counselor 이벤트 컬럼: {out.read().decode().strip().splitlines() or '없음'}")
        c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
