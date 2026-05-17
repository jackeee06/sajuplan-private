"""OpsAlert 운영자 알림 설정 상태 점검 + 테스트 발송."""
from __future__ import annotations
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko


def check_one(label: str, host: str, domain: str, pw: str) -> None:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    print(f"\n========== [{label}] {host} ({domain}) ==========")

    # CRON_TOKEN 추출
    cmd = f"grep '^CRON_TOKEN=' /data/wwwroot/{domain}/.env | head -1 | cut -d= -f2- | tr -d \"'\\\"\""
    _, out, _ = c.exec_command(cmd, timeout=15)
    tok = out.read().decode("utf-8", "replace").strip()

    # health-check 호출 — 응답에 alerted 여부 보임 (정책 enabled 인지)
    _, out, _ = c.exec_command(
        f"curl -s -H 'X-Cron-Token: {tok}' https://{domain}/api/cron/health-check | head -c 500",
        timeout=60,
    )
    health = out.read().decode("utf-8", "replace")
    print(f"health-check 첫 500자: {health[:500]}")

    c.close()


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 필요", file=sys.stderr)
        return 1
    for label, host, domain in [
        ("test", "172.235.211.75", "api.sajumoon.kr"),
        ("prod", "104.64.128.103", "api.sajumoon.co.kr"),
    ]:
        check_one(label, host, domain, pw)
    return 0


if __name__ == "__main__":
    sys.exit(main())
