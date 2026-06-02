"""prod 의 OpsAlert 수신자 휴대폰 번호 등록 — 사장님(jackeee06)."""
from __future__ import annotations
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

RECIPIENT = "01075740572"


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 필요", file=sys.stderr)
        return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

    _, out, _ = c.exec_command(
        "grep '^DATABASE_URL=' /data/wwwroot/api.sajuplan.com/.env | head -1 | cut -d= -f2- | tr -d \"'\\\"\"",
        timeout=15,
    )
    url = out.read().decode("utf-8", "replace").strip()

    # 1) UPSERT
    sql_upsert = (
        "INSERT INTO setting (namespace, key, value) "
        f"VALUES ('ops','admin_alert.recipients','{RECIPIENT}') "
        "ON CONFLICT (namespace, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()"
    )
    _, out, err = c.exec_command(f"psql '{url}' -c \"{sql_upsert}\"", timeout=30)
    print("=== UPSERT ===")
    print(out.read().decode("utf-8", "replace"))
    err_str = err.read().decode("utf-8", "replace")
    if err_str.strip():
        print(f"stderr: {err_str}", file=sys.stderr)

    # 2) 확인
    print("\n=== ops namespace 전체 ===")
    _, out, _ = c.exec_command(
        f"psql '{url}' -At -F'|' -c \"SELECT key, value FROM setting WHERE namespace = 'ops' ORDER BY key\"",
        timeout=30,
    )
    print(out.read().decode("utf-8", "replace"))

    # 3) 알림톡 템플릿 본문 확인 (변수 #{category} #{at} #{detail} 검증용)
    print("\n=== ops_admin_alert 템플릿 본문 ===")
    _, out, _ = c.exec_command(
        f"psql '{url}' -At -c \"SELECT message FROM alimtalk_template WHERE template_code = 'ops_admin_alert'\"",
        timeout=30,
    )
    print(out.read().decode("utf-8", "replace"))

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
