"""[role/level 정리] role='counselor' vs level=5 불일치 회원 추출."""
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
    for label, host, domain in [
        ("test", "172.235.211.75", "api.sajumoon.kr"),
        ("prod", "104.64.128.103", "api.sajumoon.co.kr"),
    ]:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

        _, out, _ = c.exec_command(
            f"grep '^DATABASE_URL=' /data/wwwroot/{domain}/.env | head -1 | cut -d= -f2-",
            timeout=15,
        )
        url = out.read().decode("utf-8", "replace").strip().strip('"').strip("'")

        print(f"\n{'='*70}\n[{label}]\n{'='*70}")

        for desc, sql in [
            ("role='counselor' AND left_at IS NULL",
             "SELECT count(*) FROM member WHERE role='counselor' AND left_at IS NULL"),
            ("level=5 AND left_at IS NULL",
             "SELECT count(*) FROM member WHERE level=5 AND left_at IS NULL"),
            ("role='counselor' but level<>5 (위험: 정산 누락)",
             "SELECT id, mb_id, role, level FROM member WHERE role='counselor' AND (level IS NULL OR level<>5) AND left_at IS NULL"),
            ("level=5 but role<>'counselor' (위험: 잘못된 정산)",
             "SELECT id, mb_id, role, level FROM member WHERE level=5 AND (role IS NULL OR role<>'counselor') AND left_at IS NULL"),
            ("role='counselor' but grade IS NULL (등급 시스템 누락)",
             "SELECT id, mb_id, role, level, grade FROM member WHERE role='counselor' AND grade IS NULL AND left_at IS NULL"),
        ]:
            cmd = f'psql \'{url}\' -At -F "|" -c "{sql}"'
            _, out, _ = c.exec_command(cmd, timeout=20)
            result = out.read().decode("utf-8", "replace").rstrip()
            print(f"\n{desc}:")
            print(f"  {result or '(0건)'}")
        c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
