"""60,000원 + 결제 시도 출처 추적 — '누가' 했나."""
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

    # 1) payment 테이블에 IP / User-Agent / actor 컬럼이 있는지
    run_sql(c, dburl, (
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name='payment' "
        "  AND (column_name LIKE '%ip%' OR column_name LIKE '%actor%' "
        "       OR column_name LIKE '%agent%' OR column_name LIKE '%request%') "
        "ORDER BY ordinal_position;"
    ), "1. payment 테이블의 추적 컬럼 (IP/actor/agent)")

    # 2) 5/22 14:36 ~ 14:37 의 모든 사주플랜 활동 (이상화 계정 외 다른 mb_id 도 동시 활동?)
    run_sql(c, dburl, (
        "SELECT 'payment' AS type, p.id, p.member_id, m.mb_id, m.name, "
        "p.amount, p.status, p.created_at "
        "FROM payment p JOIN member m ON m.id = p.member_id "
        "WHERE p.created_at >= '2026-05-22 14:30:00+09' "
        "  AND p.created_at <  '2026-05-22 14:50:00+09' "
        "ORDER BY p.created_at;"
    ), "2. 5/22 14:30~14:50 의 모든 payment 활동")

    # 3) member.last_login_at 확인 — 사장님 계정(jackee, id=91) 의 로그인 흔적
    run_sql(c, dburl, (
        "SELECT id, mb_id, name, last_login_at::text, created_at::text "
        "FROM member WHERE id = 91;"
    ), "3. 이상화(jackee, id=91) 로그인 기록")

    # 4) audit_log / actor_log 같은 감사 테이블이 있나
    run_sql(c, dburl, (
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = 'public' "
        "  AND (table_name LIKE '%audit%' OR table_name LIKE '%log%' "
        "       OR table_name LIKE '%session%') "
        "ORDER BY table_name;"
    ), "4. 감사/세션 관련 테이블 존재 여부")

    # 5) admin_session 또는 admin_login 흔적 (sajumoon01 운영자가 누구?)
    run_sql(c, dburl, (
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = 'public' "
        "  AND (table_name LIKE 'admin%' OR table_name LIKE '%admin%') "
        "ORDER BY table_name;"
    ), "5. admin 관련 테이블 — sajumoon01 운영자 추적")

    # 6) 5/22 18:17 ± 5분 사이의 모든 사주플랜 활동 — m2net 잔액 변경 시점
    run_sql(c, dburl, (
        "SELECT 'point_history' AS type, ph.id, ph.member_id, m.mb_id, "
        "ph.earn_point, ph.use_point, ph.rel_table, ph.rel_action, ph.actor_type, ph.created_at "
        "FROM point_history ph LEFT JOIN member m ON m.id = ph.member_id "
        "WHERE ph.created_at >= '2026-05-22 18:10:00+09' "
        "  AND ph.created_at <  '2026-05-22 18:25:00+09' "
        "UNION ALL "
        "SELECT 'consultation', c.id, c.member_id, m.mb_id, c.amt, c.amt, c.reason, NULL, NULL, c.created_at "
        "FROM consultation c LEFT JOIN member m ON m.id = c.member_id "
        "WHERE c.created_at >= '2026-05-22 18:10:00+09' "
        "  AND c.created_at <  '2026-05-22 18:25:00+09' "
        "ORDER BY 10;"
    ), "6. 5/22 18:10~18:25 의 모든 활동 — m2net 변경 시점 주변")

    # 7) push 로그 5/22 09:17 UTC ± 5min (= KST 18:17)
    print("\n  >> 7. push 로그 5/22 09:00~09:30 UTC (KST 18:00~18:30) 사이 모든 활동")
    _, out, _ = c.exec_command(
        "grep -a '2026-05-22T09:' /data/wwwroot/api.sajumoon.co.kr/logs/autopay-push.log 2>/dev/null | head -30 || echo '(흔적 없음)'"
    )
    body = out.read().decode("utf-8", errors="replace")
    if body.strip():
        for line in body.rstrip().splitlines()[:30]:
            print(f"     {line[:300]}")
    else:
        print("     (흔적 없음)")

    # 8) pm2 로그에 5/22 18:17 시각 m2net 호출 흔적
    print("\n  >> 8. pm2 로그 5/22 18:17 시각 sajumoon01 / m2net 호출")
    _, out, _ = c.exec_command(
        "find /data/wwwroot/api.sajumoon.co.kr/logs/ -type f -name '*.log' 2>/dev/null | head -10"
    )
    print("     로그 파일 목록:")
    print("    ", out.read().decode())

    # 9) e2e 테스트 흔적 — playwright 로그 또는 e2e 자동화 흔적
    print("\n  >> 9. e2e 자동화 또는 sajumoon01 흔적")
    _, out, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 5000 2>/dev/null | grep -a -E 'sajumoon01|playwright|e2e|jackee' | head -20 || true"
    )
    body = out.read().decode("utf-8", errors="replace")
    if body.strip():
        for line in body.rstrip().splitlines()[:20]:
            print(f"     {line[:300]}")
    else:
        print("     (흔적 없음)")

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
