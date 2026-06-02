"""prod setting 의 admin_alert.recipients 에서 누적된 E2E 테스트 데이터 정리."""
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
    _, out, _ = c.exec_command(
        "grep '^DATABASE_URL=' /data/wwwroot/api.sajuplan.com/.env | head -1 | cut -d= -f2- | tr -d \"'\\\"\"",
        timeout=15,
    )
    url = out.read().decode().strip()

    # 현재 값 확인
    _, out, _ = c.exec_command(
        f"psql '{url}' -At -F'|' -c \"SELECT key, value FROM setting WHERE namespace = 'ops' AND key LIKE 'admin_alert.recipient%' ORDER BY key\"",
        timeout=15,
    )
    print("=== 정리 전 ===")
    print(out.read().decode())

    # 사장님 본인 + 추가 등록한 휴대폰만 유지 (01075740572, 01066633914) — 그 외 E2E 누적 제거
    sql_phones = (
        "UPDATE setting SET value = '01075740572,01066633914' "
        "WHERE namespace = 'ops' AND key = 'admin_alert.recipients'"
    )
    sql_labels = (
        "UPDATE setting SET value = '이상화,' "
        "WHERE namespace = 'ops' AND key = 'admin_alert.recipient_labels'"
    )
    for sql in [sql_phones, sql_labels]:
        _, out, _ = c.exec_command(f"psql '{url}' -c \"{sql}\"", timeout=15)
        print(out.read().decode())

    # 정리 후 확인
    _, out, _ = c.exec_command(
        f"psql '{url}' -At -F'|' -c \"SELECT key, value FROM setting WHERE namespace = 'ops' AND key LIKE 'admin_alert.recipient%' ORDER BY key\"",
        timeout=15,
    )
    print("\n=== 정리 후 ===")
    print(out.read().decode())

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
