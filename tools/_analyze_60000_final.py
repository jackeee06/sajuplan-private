"""60,000원 마지막 추적 — m2net-push.log + visit_log."""
import os
import sys
import paramiko

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
    except Exception:
        pass


def run_sql(c, dburl, q, label):
    print(f"\n  >> {label}")
    _, out, err = c.exec_command(f'/usr/bin/psql "{dburl}" -c "{q}"')
    o = out.read().decode("utf-8", errors="replace")
    e = err.read().decode("utf-8", errors="replace")
    if o.strip():
        for line in o.rstrip().splitlines():
            print(f"     {line}")
    if e.strip():
        for line in e.rstrip().splitlines():
            print(f"     [stderr] {line}")


def main() -> int:
    pw = os.environ["SSHPASS"]
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    _, out, _ = c.exec_command("grep '^DATABASE_URL=' /data/wwwroot/api.sajumoon.co.kr/.env | head -1")
    dburl = out.read().decode().strip().split("=", 1)[1].strip("'\"")

    # 1) m2net-push.log 의 5/22 295109 흔적 (KST 17:00~18:30 = UTC 08:00~09:30)
    print("\n  >> 1. m2net-push.log 의 295109 전체 흔적")
    _, out, _ = c.exec_command(
        "grep -a '295109' /data/wwwroot/api.sajumoon.co.kr/logs/m2net-push.log 2>/dev/null | head -50 || echo '(없음)'"
    )
    body = out.read().decode("utf-8", errors="replace")
    if body.strip():
        for line in body.rstrip().splitlines()[:30]:
            print(f"     {line[:400]}")
    else:
        print("     (흔적 없음)")

    # 2) m2net-push.log 5/22 08:00~09:30 UTC (= KST 17:00~18:30)
    print("\n  >> 2. m2net-push.log 5/22 08:**~09:** UTC 사이 모든 활동")
    _, out, _ = c.exec_command(
        "grep -a -E '2026-05-22T0[89]:' /data/wwwroot/api.sajumoon.co.kr/logs/m2net-push.log 2>/dev/null | head -30 || echo '(없음)'"
    )
    body = out.read().decode("utf-8", errors="replace")
    if body.strip():
        for line in body.rstrip().splitlines()[:30]:
            print(f"     {line[:400]}")
    else:
        print("     (없음)")

    # 3) visit_log — 5/22 이상화 접근 흔적
    run_sql(c, dburl, (
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='visit_log' ORDER BY ordinal_position;"
    ), "3. visit_log 스키마")

    run_sql(c, dburl, (
        "SELECT * FROM visit_log "
        "WHERE created_at >= '2026-05-22 14:00:00+08' "
        "  AND created_at <  '2026-05-22 19:00:00+08' "
        "ORDER BY created_at LIMIT 50;"
    ), "4. 5/22 14:00~19:00 의 visit_log")

    # 5) member_session 흔적 — 이상화 세션 (id=91)
    run_sql(c, dburl, (
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='member_session' ORDER BY ordinal_position;"
    ), "5. member_session 스키마")

    # 6) 사주플랜 코드의 m2net fill 호출 흔적 (다른 호출처 — settlement 정산? 회원 가입?)
    print("\n  >> 6. 사주플랜 → m2net 호출 흔적 (autopay-push.log 외)")
    _, out, _ = c.exec_command(
        "ls -la /data/wwwroot/api.sajumoon.co.kr/logs/ 2>/dev/null"
    )
    print(out.read().decode())

    # 7) m2net-push.log 의 전체 줄 수 + tail 10
    print("\n  >> 7. m2net-push.log 마지막 50줄")
    _, out, _ = c.exec_command(
        "tail -50 /data/wwwroot/api.sajumoon.co.kr/logs/m2net-push.log 2>/dev/null || echo '(없음)'"
    )
    body = out.read().decode("utf-8", errors="replace")
    if body.strip():
        for line in body.rstrip().splitlines()[:30]:
            print(f"     {line[:300]}")
    else:
        print("     (없음)")

    # 8) consultation_log — 5/22 17~18시 활동
    run_sql(c, dburl, (
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='consultation_log' ORDER BY ordinal_position;"
    ), "8. consultation_log 스키마")

    run_sql(c, dburl, (
        "SELECT * FROM consultation_log "
        "WHERE created_at >= '2026-05-22 16:00:00+08' "
        "  AND created_at <  '2026-05-22 19:00:00+08' "
        "ORDER BY created_at;"
    ), "9. 5/22 16:00~19:00 의 consultation_log")

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
