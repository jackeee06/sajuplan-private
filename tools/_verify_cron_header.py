"""[Audit E-C4] 양 서버에서 X-Cron-Token 헤더 방식 health-check 호출 검증."""
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
    ("test", "172.235.211.75", "sajumoon.kr"),
    ("prod", "104.64.128.103", "sajuplan.com"),
]


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 필요", file=sys.stderr)
        return 1
    for label, host, domain in TARGETS:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
        # token 추출
        cmd = f"grep CRON_TOKEN /data/wwwroot/api.{domain}/.env | head -1 | cut -d= -f2-"
        _, out, _ = c.exec_command(cmd)
        tok = out.read().decode("utf-8", "replace").strip().strip('"').strip("'")
        # 헤더 방식 호출 (HTTP status code 만)
        curl = (
            f'curl -s -o /dev/null -w "%{{http_code}}" '
            f'-H "X-Cron-Token: {tok}" https://api.{domain}/api/cron/health-check'
        )
        _, out, _ = c.exec_command(curl)
        code = out.read().decode("utf-8", "replace").strip()
        print(f"[{label}] header auth → HTTP {code}")
        # 쿼리스트링 방식이 여전히 동작하는지 (backward compat)
        curl2 = (
            f'curl -s -o /dev/null -w "%{{http_code}}" '
            f'"https://api.{domain}/api/cron/health-check?token={tok}"'
        )
        _, out, _ = c.exec_command(curl2)
        code2 = out.read().decode("utf-8", "replace").strip()
        print(f"[{label}] query auth (legacy) → HTTP {code2}")
        # 무인증 호출 → 401 기대
        curl3 = f'curl -s -o /dev/null -w "%{{http_code}}" https://api.{domain}/api/cron/health-check'
        _, out, _ = c.exec_command(curl3)
        code3 = out.read().decode("utf-8", "replace").strip()
        print(f"[{label}] no auth → HTTP {code3} (401 기대)")
        c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
