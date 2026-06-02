"""채팅 시작 실패 진단 — 라온선생 state + 최근 chat_room + pm2 에러."""
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
    psql = "/usr/bin/psql"

    print(">> 1. 라온선생(id=123) 현재 state")
    _, out, _ = c.exec_command(
        f'{psql} "{dburl}" -c '
        '"SELECT id, mb_id, name, role, state, use_chat, csrid, '
        'last_login_at::timestamp FROM member WHERE id=123;"'
    )
    print(out.read().decode())

    print(">> 2. 라온선생의 진행 중 (STAY/CNCH) chat_room")
    _, out, _ = c.exec_command(
        f'{psql} "{dburl}" -c '
        '"SELECT id, member_id, counselor_id, status, '
        'started_at::timestamp, ended_at::timestamp '
        "FROM chat_room WHERE counselor_id = 123 AND status IN ('STAY','CNCH') "
        'ORDER BY id DESC;"'
    )
    print(out.read().decode())

    print(">> 3. 최근 chat_room 5건 (라온선생)")
    _, out, _ = c.exec_command(
        f'{psql} "{dburl}" -c '
        '"SELECT id, member_id, status, started_at::timestamp, ended_at::timestamp '
        'FROM chat_room WHERE counselor_id = 123 ORDER BY id DESC LIMIT 5;"'
    )
    print(out.read().decode())

    print(">> 4. pm2 최근 startChat 또는 채팅 시작 에러 (최근 100라인)")
    _, out, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 200 --err 2>/dev/null | "
        "grep -aE 'startChat|채팅 시작|csrchat|chat.*Error|chat.*ERROR' | tail -20 || echo '(없음)'"
    )
    body = out.read().decode().strip()
    if body and body != "(없음)":
        for line in body.splitlines()[:20]:
            print(f"  {line[:400]}")
    else:
        print("  (흔적 없음)")

    print(">> 5. pm2 최근 일반 에러 (최근 50라인)")
    _, out, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 100 --err 2>/dev/null | "
        "grep -aE 'ERROR' | tail -15 || echo '(없음)'"
    )
    body = out.read().decode().strip()
    for line in body.splitlines()[:15]:
        print(f"  {line[:400]}")

    print(">> 6. 사장님(이상화 id=91) m2net_membid + 현재 잔액")
    _, out, _ = c.exec_command(
        f'{psql} "{dburl}" -c '
        '"SELECT m.id, m.mb_id, m.name, m.m2net_membid, m.point, '
        'p.free_balance, p.paid_balance, p.earning_balance '
        'FROM member m LEFT JOIN point p ON p.member_id=m.id '
        'WHERE m.id = 91;"'
    )
    print(out.read().decode())

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
