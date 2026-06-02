"""prod 의 OpsAlert 테스트 호출 — SMS 폴백까지 검증."""
from __future__ import annotations
import os
import sys
import time

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

    _, out, _ = c.exec_command(
        "grep '^CRON_TOKEN=' /data/wwwroot/api.sajuplan.com/.env | head -1 | cut -d= -f2- | tr -d \"'\\\"\"",
        timeout=15,
    )
    tok = out.read().decode().strip()

    _, out, _ = c.exec_command(
        "grep '^DATABASE_URL=' /data/wwwroot/api.sajuplan.com/.env | head -1 | cut -d= -f2- | tr -d \"'\\\"\"",
        timeout=15,
    )
    url = out.read().decode().strip()

    # pm2 reload 로 in-memory cooldown 초기화
    print("=== pm2 reload (cooldown 메모리 초기화) ===")
    _, out, _ = c.exec_command("pm2 reload sajumoon-api 2>&1 | tail -2", timeout=30)
    print(out.read().decode())
    time.sleep(3)

    # test-alert 호출
    print("\n=== test-alert 호출 ===")
    _, out, _ = c.exec_command(
        f"curl -s -H 'X-Cron-Token: {tok}' https://api.sajuplan.com/api/cron/test-alert",
        timeout=60,
    )
    print(out.read().decode())

    # 로그 확인
    time.sleep(2)
    print("\n=== pm2 로그 (OpsAlert 관련) ===")
    _, out, _ = c.exec_command(
        "pm2 logs sajumoon-api --lines 30 --nostream --raw 2>&1 | grep -iE 'opsalert|aligo|adminsms|bizm' | tail -15",
        timeout=30,
    )
    print(out.read().decode("utf-8", "replace"))

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
