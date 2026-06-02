"""검증 B — 잔액 3원장 정합성.

3원장 (3 sources of truth):
  ① member.point             : 회원 표면 잔액 = (free + paid) 미러
  ② point.{free,paid,earning}: 현재 잔액 집계
  ③ point_history            : 모든 거래 원장 (적립/사용)

검증 식:
  B-1: member.point = point.free + point.paid           (소비포인트 미러)
  B-2: point.(free+paid+earning) = ΣΣ(earn-use) FROM point_history
  B-3: 회원별 점검: 각 row 의 잔액 vs history 합 일치
  B-4: total_earned / total_used 누적도 history 합과 일치
  B-5: balance_after (point_history 의 매 거래 후 잔액) 가 연속적인지
"""
import os
import sys
import paramiko

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
    except Exception:
        pass

HOST = "104.64.128.103"
API_REMOTE = "/data/wwwroot/api.sajumoon.co.kr"
PSQL = "/usr/bin/psql"


def run(c, dburl, q, label):
    print(f"\n  >> {label}")
    _, out, err = c.exec_command(f'{PSQL} "{dburl}" -c "{q}"')
    o = out.read().decode("utf-8", errors="replace")
    e = err.read().decode("utf-8", errors="replace")
    if o.strip():
        for line in o.rstrip().splitlines():
            print(f"     {line}")
    if e.strip():
        for line in e.rstrip().splitlines():
            print(f"     [stderr] {line}")


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("ERROR: SSHPASS env var required.")
        return 2
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    try:
        _, out, _ = c.exec_command(
            f"grep '^DATABASE_URL=' {API_REMOTE}/.env | head -1 | "
            "sed \"s/^DATABASE_URL=//; s/^['\\\"]//; s/['\\\"]$//\""
        )
        dburl = out.read().decode().strip().splitlines()[-1]

        # B-1: 회원 표면 잔액 미러 검증
        run(c, dburl, (
            "SELECT m.id, m.mb_id, m.name, m.point AS member_point, "
            "(p.free_balance + p.paid_balance) AS computed, "
            "(m.point - (p.free_balance + p.paid_balance)) AS drift "
            "FROM member m JOIN point p ON p.member_id = m.id "
            "WHERE m.point IS DISTINCT FROM (p.free_balance + p.paid_balance);"
        ), "B-1. member.point drift (위반 0 row 기대)")

        # B-2: 전체 합산 일치 검증
        run(c, dburl, (
            "WITH ph AS ("
            "  SELECT member_id, "
            "    SUM(earn_point)::bigint AS earn, "
            "    SUM(use_point)::bigint AS used "
            "  FROM point_history GROUP BY member_id"
            ") "
            "SELECT m.id, m.mb_id, m.name, "
            "(p.free_balance + p.paid_balance + p.earning_balance) AS pt_total, "
            "COALESCE(ph.earn, 0) - COALESCE(ph.used, 0) AS history_net, "
            "(p.free_balance + p.paid_balance + p.earning_balance) - (COALESCE(ph.earn,0) - COALESCE(ph.used,0)) AS drift "
            "FROM member m JOIN point p ON p.member_id = m.id "
            "LEFT JOIN ph ON ph.member_id = m.id "
            "WHERE (p.free_balance + p.paid_balance + p.earning_balance) <> COALESCE(ph.earn, 0) - COALESCE(ph.used, 0);"
        ), "B-2. point 합계 vs history 순증 (위반 0 row 기대)")

        # B-3: 활동 있는 회원 전체 분포 (참고)
        run(c, dburl, (
            "WITH ph AS ("
            "  SELECT member_id, "
            "    SUM(earn_point)::bigint AS earn, "
            "    SUM(use_point)::bigint AS used, "
            "    COUNT(*) AS rows "
            "  FROM point_history GROUP BY member_id"
            ") "
            "SELECT m.id, m.mb_id, m.name, m.role, "
            "ph.rows AS h_rows, ph.earn, ph.used, "
            "p.free_balance AS free, p.paid_balance AS paid, p.earning_balance AS earning, "
            "(p.free_balance + p.paid_balance + p.earning_balance) AS pt_total, "
            "(p.free_balance + p.paid_balance + p.earning_balance) - (ph.earn - ph.used) AS drift "
            "FROM member m JOIN point p ON p.member_id = m.id "
            "JOIN ph ON ph.member_id = m.id "
            "ORDER BY m.id;"
        ), "B-3. 활동 있는 회원 전체 분포 (참고용)")

        # B-4: total_earned/total_used 누적도 history 와 일치 확인
        run(c, dburl, (
            "WITH ph AS ("
            "  SELECT member_id, "
            "    SUM(earn_point)::bigint AS earn, "
            "    SUM(use_point)::bigint AS used "
            "  FROM point_history GROUP BY member_id"
            ") "
            "SELECT m.id, m.mb_id, "
            "p.total_earned, ph.earn AS h_earn, (p.total_earned - ph.earn) AS earn_drift, "
            "p.total_used, ph.used AS h_used, (p.total_used - ph.used) AS used_drift "
            "FROM member m JOIN point p ON p.member_id = m.id "
            "JOIN ph ON ph.member_id = m.id "
            "WHERE p.total_earned <> ph.earn OR p.total_used <> ph.used;"
        ), "B-4. total_earned/total_used vs history 합 (위반 0 row 기대)")

        # B-5: balance_after 연속성 — 각 회원의 마지막 거래의 balance_after 가 합리적인지
        run(c, dburl, (
            "WITH last_ph AS ("
            "  SELECT DISTINCT ON (member_id) "
            "    member_id, id, earn_point, use_point, balance_after, rel_table, created_at "
            "  FROM point_history "
            "  WHERE member_id IS NOT NULL "
            "  ORDER BY member_id, id DESC"
            ") "
            "SELECT m.id, m.mb_id, m.name, lp.id AS last_ph_id, lp.rel_table, "
            "lp.balance_after AS last_balance_after, "
            "(p.free_balance + p.paid_balance + p.earning_balance) AS current_pt_total, "
            "p.earning_balance AS current_earning "
            "FROM member m JOIN point p ON p.member_id = m.id "
            "JOIN last_ph lp ON lp.member_id = m.id "
            "ORDER BY m.id;"
        ), "B-5. 각 회원 마지막 거래의 balance_after vs 현재 잔액 (참고)")

        # B-6: 트랜잭션 멱등성 — point_history 중복 row 없는지 (rel_table, rel_id, rel_action) 부분 UNIQUE
        run(c, dburl, (
            "SELECT rel_table, rel_id, rel_action, COUNT(*) AS dup_count "
            "FROM point_history "
            "WHERE rel_table IN ('payment','payment_autopay','consultation') "
            "  AND rel_id IS NOT NULL AND rel_action IS NOT NULL "
            "GROUP BY rel_table, rel_id, rel_action "
            "HAVING COUNT(*) > 1;"
        ), "B-6. point_history 멱등성 — 중복 거래 (위반 0 row 기대)")
    finally:
        c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
