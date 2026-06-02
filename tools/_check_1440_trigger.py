"""5/23 14:40:51 KST (=13:40:51 +08) 시점에 사주플랜이 m2net 에 호출한 흔적 추적."""
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

    # 1) member.last_login_at 다시 확인 (5/23 갱신 흔적)
    _, out, _ = c.exec_command("grep '^DATABASE_URL=' /data/wwwroot/api.sajumoon.co.kr/.env | head -1")
    dburl = out.read().decode().strip().split("=", 1)[1].strip("'\"")
    print(">> 1. 이상화(91) 최신 last_login_at")
    _, out, _ = c.exec_command(
        f'/usr/bin/psql "{dburl}" -c "SELECT id, mb_id, last_login_at::text, point FROM member WHERE id=91;"'
    )
    print(out.read().decode())

    # 2) pm2 로그 — 5/23 14:40 ± 2분 시각 모든 활동 (KST = 05:40 UTC)
    print("\n>> 2. pm2 로그 5/23 13:38~13:43 (+08 = KST 14:38~14:43) 의 syncM2net / m2net 호출")
    _, out, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 5000 2>/dev/null | "
        "grep -a -E '5/23/2026, (13:3[8-9]|13:4[0-3])|syncM2net|m2net' | head -50 || true"
    )
    body = out.read().decode()
    if body.strip():
        for line in body.rstrip().splitlines()[:50]:
            print(f"  {line[:300]}")
    else:
        print("  (흔적 없음)")

    # 3) pm2 로그에서 295109 또는 m2net_membid 295109 관련 호출
    print("\n>> 3. pm2 로그 295109 모든 흔적 (최근 5000줄)")
    _, out, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 5000 2>/dev/null | grep -a '295109' | head -30 || true"
    )
    body = out.read().decode()
    if body.strip():
        for line in body.rstrip().splitlines()[:30]:
            print(f"  {line[:400]}")
    else:
        print("  (흔적 없음)")

    # 4) syncM2net 또는 updateMember/addMemberCoin 호출 흔적 전체
    print("\n>> 4. pm2 로그의 m2net 관련 모든 호출 (최근)")
    _, out, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 5000 2>/dev/null | "
        "grep -a -E 'syncM2netBalance|updateMember|addMemberCoin|memb-mgr' | tail -30 || true"
    )
    body = out.read().decode()
    if body.strip():
        for line in body.rstrip().splitlines():
            print(f"  {line[:400]}")
    else:
        print("  (흔적 없음 — pm2 로그가 짧거나 m2net 호출 로그가 적은 듯)")

    # 5) payment id=13 의 m2net_status / m2net_retry_count
    print("\n>> 5. payment id=13 의 m2net 상태 + 재시도 카운트")
    _, out, _ = c.exec_command(
        f'/usr/bin/psql "{dburl}" -c '
        '"SELECT id, status, m2net_status, m2net_retry_count, m2net_last_retry_at, updated_at '
        'FROM payment WHERE id=13;"'
    )
    print(out.read().decode())

    # 6) m2net retry cron 흔적 (retry-cron.service.ts 가 호출하는지)
    print("\n>> 6. pm2 로그의 retry-cron 흔적")
    _, out, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 5000 2>/dev/null | "
        "grep -a -E 'retry.*payment|retry-cron|payment-m2net retry' | tail -20 || true"
    )
    body = out.read().decode()
    if body.strip():
        for line in body.rstrip().splitlines():
            print(f"  {line[:300]}")
    else:
        print("  (흔적 없음)")

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
