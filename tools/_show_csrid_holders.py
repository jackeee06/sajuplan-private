"""현재 prod 에 csrid 보유 상담사 목록."""
import os
import sys
import paramiko

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
    except Exception:
        pass


def main() -> int:
    pw = os.environ["SSHPASS"]
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    _, out, _ = c.exec_command("grep '^DATABASE_URL=' /data/wwwroot/api.sajumoon.co.kr/.env | head -1")
    dburl = out.read().decode().strip().split("=", 1)[1].strip("'\"")

    print(">> csrid 보유 상담사 전체 목록 (현재 prod)")
    _, out, _ = c.exec_command(
        f'/usr/bin/psql "{dburl}" -c '
        '"SELECT m.id, m.mb_id, m.name, m.nickname, m.phone, m.csrid, '
        'COALESCE(p.earning_balance, 0) AS earning, '
        'm.bank_name, m.bank_holder, '
        "CASE WHEN m.bank_account IS NOT NULL THEN '등록됨' ELSE '미등록' END AS bank, "
        'm.state, m.created_at::date AS created '
        'FROM member m LEFT JOIN point p ON p.member_id=m.id '
        "WHERE m.role='counselor' AND m.csrid IS NOT NULL AND m.csrid <> '' "
        'AND m.left_at IS NULL '
        'ORDER BY m.id;"'
    )
    print(out.read().decode())

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
