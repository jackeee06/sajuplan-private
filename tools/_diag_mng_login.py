"""mng 로그인 Failed to fetch 진단."""
from __future__ import annotations
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

    cmds = [
        ("runtime config 파일 검색",
         "find /data/wwwroot/sajumoon.co.kr -maxdepth 3 -type f \\( -name 'config*.js' -o -name 'env*.js' -o -name 'runtime*.js' \\) 2>/dev/null"),
        ("user dist 디렉토리",
         "ls /data/wwwroot/sajumoon.co.kr/ 2>&1 | head -20"),
        ("user index.html 전체",
         "cat /data/wwwroot/sajumoon.co.kr/index.html"),
        ("mng index.html 전체",
         "cat /data/wwwroot/sajumoon.co.kr/mng/index.html"),
        ("mng js 안에서 'api.sajumoon' 찾기",
         "grep -oE 'api\\.sajumoon\\.[a-z.]+' /data/wwwroot/sajumoon.co.kr/mng/assets/index-CEq93b9s.js | sort -u"),
        ("user js 안에서 'api.sajumoon' 찾기 (user 의 새 js hash 파악 후)",
         "ls /data/wwwroot/sajumoon.co.kr/assets/index-*.js 2>/dev/null | head -3"),
    ]
    for label, cmd in cmds:
        print(f"\n=== {label} ===")
        _, out, _ = c.exec_command(cmd, timeout=30)
        print(out.read().decode("utf-8", "replace").rstrip() or "(빈 결과)")

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
