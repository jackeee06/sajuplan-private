"""60,000원 미스터리 깊이 분석 — 이상화 회원으로서의 통화 흔적 + m2net 복구 호출 흔적."""
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

    # 1) 이상화(id=91)가 회원으로 받은 통화 흔적
    run_sql(c, dburl, (
        "SELECT id, member_id, counselor_id, amt, amt_free, amt_pro, "
        "reason, refund_status, usetm, refunded_amount, created_at "
        "FROM consultation WHERE member_id = 91 ORDER BY id;"
    ), "1. 이상화(id=91)가 회원으로 받은 통화 (consultation.member_id=91)")

    # 2) 이상화가 상담사로 받은 통화 (counselor_id=91)
    run_sql(c, dburl, (
        "SELECT id, member_id, counselor_id, amt, amt_free, amt_pro, "
        "reason, refund_status, usetm, refunded_amount, created_at "
        "FROM consultation WHERE counselor_id = 91 ORDER BY id;"
    ), "2. 이상화(id=91)가 상담사로 제공한 통화 (counselor_id=91)")

    # 3) 모든 consultation 의 short_call_refund / refund_eligible 상태 + 각 회원 m2net_membid
    run_sql(c, dburl, (
        "SELECT c.id, c.member_id, m.m2net_membid AS member_m2net, c.counselor_id, "
        "c.amt, c.refund_status, c.usetm, c.reason "
        "FROM consultation c LEFT JOIN member m ON m.id = c.member_id "
        "WHERE c.refund_status IS NOT NULL "
        "   OR c.reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL') "
        "ORDER BY c.id;"
    ), "3. 정상종료 또는 환불 consultation 의 m2net_membid 매핑")

    # 4) payment id=4 (이상화의 첫 vbank 33000) 의 콜백 흔적
    print("\n  >> 4. payment id=4 (vbank_91_1779431765541_08bc53) 의 push 콜백 흔적")
    _, out, _ = c.exec_command(
        "grep -a 'vbank_91_1779431765541_08bc53' /data/wwwroot/api.sajumoon.co.kr/logs/autopay-push.log 2>/dev/null | head -5 || echo '(흔적 없음)'"
    )
    body = out.read().decode("utf-8", errors="replace")
    if body.strip():
        for line in body.rstrip().splitlines():
            print(f"     {line}")
    else:
        print("     (흔적 없음)")

    # 5) 295109 콜백 전체 흔적 (시간순 모든 흔적)
    print("\n  >> 5. autopay-push.log 의 295109 전체 흔적 (시간순)")
    _, out, _ = c.exec_command(
        "grep -a '295109' /data/wwwroot/api.sajumoon.co.kr/logs/autopay-push.log 2>/dev/null | sort"
    )
    body = out.read().decode("utf-8", errors="replace")
    if body.strip():
        for i, line in enumerate(body.rstrip().splitlines(), 1):
            print(f"  [{i}]  {line}")
    else:
        print("     (흔적 없음)")

    # 6) m2net push 로그 (call-push, settleChatRoomLocal) — 단기환불 시 m2net 복구 흔적
    print("\n  >> 6. pm2 sajumoon-api 로그에서 'short-call-refund' 흔적 (전체)")
    _, out, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 2000 2>/dev/null | grep -a -E 'short-call-refund|short_call|단기' | head -30 || true"
    )
    body = out.read().decode("utf-8", errors="replace")
    if body.strip():
        for line in body.rstrip().splitlines()[:20]:
            print(f"     {line}")
    else:
        print("     (흔적 없음)")

    # 7) m2net fill 호출 흔적 — 295109 대상
    print("\n  >> 7. pm2 sajumoon-api 로그에서 m2net fill / addMemberCoin 호출 흔적 (이상화)")
    _, out, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 2000 2>/dev/null | grep -a -E 'addMemberCoin|memb-mgr.*fill|m2net.*fill' | head -30 || true"
    )
    body = out.read().decode("utf-8", errors="replace")
    if body.strip():
        for line in body.rstrip().splitlines()[:30]:
            print(f"     {line}")
    else:
        print("     (흔적 없음)")

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
