"""모달 미표시 원인 진단 — 라온선생 측 polling 호출 + 사장님 채팅 신청 흔적."""
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

    print(">> 1. 사장님이 18:39 전후로 채팅 신청한 흔적 (chat_room)")
    _, out, _ = c.exec_command(
        "grep '^DATABASE_URL=' /data/wwwroot/api.sajumoon.co.kr/.env | head -1"
    )
    dburl = out.read().decode().strip().split("=", 1)[1].strip("'\"")
    _, out, _ = c.exec_command(
        f'/usr/bin/psql "{dburl}" -c '
        '"SELECT id, member_id, counselor_id, status, '
        'started_at::timestamp, ended_at::timestamp, csrid '
        'FROM chat_room WHERE counselor_id = 123 ORDER BY id DESC LIMIT 10;"'
    )
    print(out.read().decode())

    print(">> 2. consultation 신청 흔적 (5/23 18:30 이후)")
    _, out, _ = c.exec_command(
        f'/usr/bin/psql "{dburl}" -c '
        '"SELECT id, member_id, counselor_id, reason, created_at::timestamp '
        "FROM consultation WHERE counselor_id = 123 "
        "AND created_at >= '2026-05-23 18:30:00+08' ORDER BY id DESC LIMIT 5;\""
    )
    print(out.read().decode())

    print(">> 3. pm2 로그 — 사장님 IP 또는 라온선생의 incoming 호출 흔적 (최근 100라인)")
    _, out, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 200 2>/dev/null | "
        "grep -aE 'user/consult/incoming|user/consult/chat|counselor_id.*123' | tail -20 || echo '(흔적 없음)'"
    )
    body = out.read().decode().strip()
    if body and "(흔적 없음)" not in body:
        for line in body.splitlines()[:30]:
            print(f"  {line[:400]}")
    else:
        print("  (흔적 없음)")

    print("\n>> 4. pm2 access 로그 — incoming 호출 빈도 (지난 5분)")
    _, out, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 500 2>/dev/null | "
        "grep -aE 'GET.*/user/consult/incoming|GET.*incoming' | tail -10 || echo '(흔적 없음)'"
    )
    body = out.read().decode().strip()
    if body and "(흔적 없음)" not in body:
        for line in body.splitlines()[:10]:
            print(f"  {line[:400]}")
    else:
        print("  (흔적 없음 — 5초 polling 이 호출되지 않고 있음!)")

    print("\n>> 5. 라온선생 m2net 측 상태 — 채팅 가능?")
    _, out, _ = c.exec_command(
        f'/usr/bin/psql "{dburl}" -c '
        '"SELECT id, mb_id, state, use_chat, csrid, '
        'last_login_at::timestamp FROM member WHERE id = 123;"'
    )
    print(out.read().decode())

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
