"""고객보호비용 기록 검증 — 라온선생 사례가 어드민에 정확히 기재되어 있는가."""
import os
import sys
import paramiko

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
    except Exception:
        pass


def run(c, dburl, q, label):
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

    # 1) consultation 의 short_call_refund 케이스 전체
    run(c, dburl, (
        "SELECT id, member_id, counselor_id, amt, refunded_amount, "
        "refund_status, reason, usetm, calc_flag, created_at "
        "FROM consultation "
        "WHERE refund_status = 'short_call_refund' "
        "ORDER BY id DESC;"
    ), "1. consultation 의 short_call_refund 케이스")

    # 2) consultation 컬럼 스키마 (손해 액수 별도 기록 컬럼 있는지 확인)
    run(c, dburl, (
        "SELECT column_name, data_type "
        "FROM information_schema.columns "
        "WHERE table_name='consultation' "
        "  AND (column_name LIKE '%short%' OR column_name LIKE '%protect%' OR column_name LIKE '%refund%') "
        "ORDER BY ordinal_position;"
    ), "2. consultation 의 단기환불 관련 컬럼 (손해 액수 기록 컬럼)")

    # 3) admin 어드민이 단기환불을 어떻게 집계하는지 — service 가 사용하는 쿼리 확인
    run(c, dburl, (
        "SELECT COUNT(*) AS cnt, "
        "COALESCE(SUM(amt), 0) AS total_protection_cost, "
        "MIN(created_at)::date AS first_case, "
        "MAX(created_at)::date AS last_case "
        "FROM consultation WHERE refund_status = 'short_call_refund';"
    ), "3. 전체 단기환불 (=고객보호비용) 합계")

    # 4) 이번달 단기환불 합계 (Dashboard '고객보호비용(이번달)' 카드 값)
    run(c, dburl, (
        "SELECT COUNT(*) AS cnt, "
        "COALESCE(SUM(amt), 0) AS this_month_cost "
        "FROM consultation "
        "WHERE refund_status = 'short_call_refund' "
        "  AND created_at >= date_trunc('month', CURRENT_DATE) "
        "  AND created_at <  date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';"
    ), "4. 이번달(2026-05) 고객보호비용 합계")

    # 5) 라온선생 case 가 short-call-refunds 페이지 데이터에 포함되는지 — 페이지 동등 쿼리
    run(c, dburl, (
        "SELECT c.id, c.usetm, c.amt AS protection_cost, "
        "c.member_id, mm.name AS member_name, "
        "c.counselor_id, cm.name AS counselor_name, "
        "c.created_at "
        "FROM consultation c "
        "LEFT JOIN member mm ON mm.id = c.member_id "
        "LEFT JOIN member cm ON cm.id = c.counselor_id "
        "WHERE c.refund_status = 'short_call_refund' "
        "ORDER BY c.id DESC;"
    ), "5. 어드민 short-call-refunds 페이지 표시 동등 데이터")

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
