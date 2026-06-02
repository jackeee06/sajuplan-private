"""prod setting 에 admin_alert.recipient_labels row 등록 + 코드 UPSERT 전환은 별도."""
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

    sql = (
        "INSERT INTO setting (namespace, key, value) "
        "VALUES ('ops', 'admin_alert.recipient_labels', '이상화') "
        "ON CONFLICT (namespace, key) DO UPDATE SET value = EXCLUDED.value"
    )
    _, out, err = c.exec_command(f"psql '{url}' -c \"{sql}\"", timeout=30)
    print(out.read().decode("utf-8", "replace"))
    err_str = err.read().decode("utf-8", "replace")
    if err_str.strip():
        print("stderr:", err_str)

    _, out, _ = c.exec_command(
        f"psql '{url}' -At -F'|' -c \"SELECT key, value FROM setting WHERE namespace='ops' ORDER BY key\"",
        timeout=30,
    )
    print("=== ops 전체 ===")
    print(out.read().decode("utf-8", "replace"))
    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
