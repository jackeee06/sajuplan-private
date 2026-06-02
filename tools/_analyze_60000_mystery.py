"""60,000원 미스터리 분석 — 사장님(이상화, membid=295109) 의 사주플랜 vs m2net 측 거래 대조.

분석 단계:
  Q1. 이상화(member.id=91, m2net_membid=295109) 의 모든 payment 시도 흔적
  Q2. point_history 의 적립 흔적 (실제 사주플랜에 들어간 코인)
  Q3. payment vs point_history 매칭
  Q4. autopay-push.log 또는 m2net push 로그 trace
"""
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

    # 사장님 본인 = membid 295109. member 측에서 누구인지 먼저 확인
    run_sql(c, dburl, (
        "SELECT id, mb_id, name, role, m2net_membid, csrid, point, created_at "
        "FROM member WHERE m2net_membid = '295109' OR csrid = '19970';"
    ), "Q0. m2net membid=295109 / csrid=19970 의 member row")

    # 결제 시도 전체 (status, m2net_status 같이)
    run_sql(c, dburl, (
        "SELECT id, oid, pay_method, amount, coin_amount, status, "
        "m2net_status, result_message, tid, created_at, updated_at "
        "FROM payment "
        "WHERE member_id IN (SELECT id FROM member WHERE m2net_membid = '295109') "
        "ORDER BY id;"
    ), "Q1. 이상화의 모든 payment 시도 (사주플랜 측)")

    # 적립 흔적 (실제 사주플랜에 들어간 코인)
    run_sql(c, dburl, (
        "SELECT id, content, earn_point, use_point, balance_after, "
        "rel_table, rel_id, rel_action, created_at "
        "FROM point_history "
        "WHERE member_id IN (SELECT id FROM member WHERE m2net_membid = '295109') "
        "ORDER BY id;"
    ), "Q2. 이상화의 사주플랜 측 point_history")

    # payment 와 point_history 매칭 — coin_amount 합 vs earn_point 합
    run_sql(c, dburl, (
        "SELECT "
        "(SELECT COALESCE(SUM(coin_amount), 0) FROM payment "
        " WHERE member_id IN (SELECT id FROM member WHERE m2net_membid = '295109') "
        "   AND status = 'completed') AS pay_completed_sum, "
        "(SELECT COALESCE(SUM(coin_amount), 0) FROM payment "
        " WHERE member_id IN (SELECT id FROM member WHERE m2net_membid = '295109') "
        "   AND m2net_status = 'success') AS pay_m2net_success_sum, "
        "(SELECT COALESCE(SUM(earn_point), 0) FROM point_history "
        " WHERE member_id IN (SELECT id FROM member WHERE m2net_membid = '295109') "
        "   AND rel_table IN ('payment','payment_autopay')) AS history_earn_sum, "
        "(SELECT COALESCE(p.free_balance + p.paid_balance, 0) "
        " FROM point p JOIN member m ON m.id = p.member_id "
        " WHERE m.m2net_membid = '295109') AS current_balance;"
    ), "Q3. 사주플랜 측 누적 정합성 (이상화)")

    # m2net push 로그 tail — 295109 흔적
    print("\n  >> Q4. autopay-push.log 의 membid=295109 흔적 (최근 50라인)")
    _, out, _ = c.exec_command(
        "grep -a '295109' /data/wwwroot/api.sajumoon.co.kr/logs/autopay-push.log 2>/dev/null | tail -50 || echo '(로그 없음)'"
    )
    body = out.read().decode("utf-8", errors="replace")
    if body.strip():
        for line in body.rstrip().splitlines()[-30:]:
            print(f"     {line}")
    else:
        print("     (로그 없음)")

    # 추가: pm2 logs 또는 일반 로그
    print("\n  >> Q5. pm2 sajumoon-api 로그에서 295109 또는 이상화 결제 흔적")
    _, out, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 500 2>/dev/null | grep -a -E '295109|m2net.*fill|payment.*91' | tail -20 || echo '(흔적 없음)'"
    )
    body = out.read().decode("utf-8", errors="replace")
    if body.strip():
        for line in body.rstrip().splitlines():
            print(f"     {line}")
    else:
        print("     (흔적 없음)")

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
