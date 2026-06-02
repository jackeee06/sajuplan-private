"""라온선생 채팅 수신 준비 상태 점검."""
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

    print(">> 라온선생(id=123) 채팅 수신 준비 상태")
    _, out, _ = c.exec_command(
        f'/usr/bin/psql "{dburl}" -c '
        '"SELECT m.id, m.mb_id, m.name, m.nickname, m.role, m.state, '
        'm.use_chat, m.use_phone, m.csrid, m.phone, '
        'm.chat_unit_seconds, m.chat_unit_cost, m.last_login_at '
        'FROM member m WHERE m.id = 123;"'
    )
    print(out.read().decode())

    print(">> 사주플랜 앱 접속 토큰 (member_session) 최근")
    _, out, _ = c.exec_command(
        f'/usr/bin/psql "{dburl}" -c '
        '"SELECT id, member_id, '
        "CASE WHEN expires_at > NOW() THEN '활성' ELSE '만료' END AS valid, "
        'expires_at, revoked_at, created_at::timestamp '
        'FROM member_session WHERE member_id = 123 ORDER BY id DESC LIMIT 3;"'
    )
    print(out.read().decode())

    print(">> 채팅 시작 가능 조건 종합 (consult.service.ts startChat 분기)")
    print("  ✓ role='counselor'  ← 확인 필요 위에서")
    print("  ✓ csrid 보유          ← 확인 필요")
    print("  ✓ use_chat = TRUE     ← 확인 필요 (FALSE 면 신청 거부)")
    print("  ✓ state = RDCH/RDVC   ← ABSE/RESV 면 신청 거부, IDLE 면 가능")
    print("  ✓ chat_unit_seconds + chat_unit_cost 셋팅  ← 0이면 진행 어려움")

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
