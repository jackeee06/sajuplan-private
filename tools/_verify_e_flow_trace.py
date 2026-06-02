"""검증 E — 소비/수익 종단 흐름 추적.

각 활동 회원의 거래 종단을 따라가서 빠짐없이 매칭되는지 검증.
"""
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

    # E-1. 홍루연 (회원) — 충전 → 사용 → 환불 흐름
    run(c, dburl, (
        "SELECT 'PAYMENT' AS 종류, p.id, p.amount, p.coin_amount, p.status, p.created_at "
        "FROM payment p WHERE p.member_id = 112 "
        "UNION ALL "
        "SELECT 'CONSULTATION', c.id, c.amt, c.amt_free + c.amt_pro, c.reason, c.created_at "
        "FROM consultation c WHERE c.member_id = 112 "
        "UNION ALL "
        "SELECT 'REFUND', r.id, r.amount, r.amount_pro, r.status, r.created_at "
        "FROM refund_request r WHERE r.member_id = 112 "
        "UNION ALL "
        "SELECT 'PT_HISTORY', ph.id, ph.earn_point, ph.use_point, ph.rel_table, ph.created_at "
        "FROM point_history ph WHERE ph.member_id = 112 "
        "ORDER BY 6;"
    ), "E-1. 홍루연(id=112) 종단 흐름 — payment vs point_history 매칭")

    # E-2. 라온선생 (상담사) — 적립 → (정산 예정)
    run(c, dburl, (
        "SELECT 'CONSULTATION', c.id, c.reason, c.amt_free, c.amt_pro, c.amt, "
        "c.refund_status, c.calc_flag, c.created_at "
        "FROM consultation c WHERE c.counselor_id = 123 ORDER BY c.id;"
    ), "E-2a. 라온선생(id=123) 상담 흐름 (counselor 입장)")
    run(c, dburl, (
        "SELECT ph.id, ph.rel_table, ph.earn_point, ph.use_point, ph.balance_after, "
        "ph.is_settled, ph.created_at FROM point_history ph WHERE ph.member_id = 123 ORDER BY ph.id;"
    ), "E-2b. 라온선생(id=123) point_history (적립 흐름)")

    # E-3. 모든 회원 잔액 vs history 합 격차 (분리 후 정합성 종합)
    run(c, dburl, (
        "WITH ph AS ("
        "  SELECT member_id, "
        "    SUM(earn_point)::bigint AS earn, "
        "    SUM(use_point)::bigint AS used, "
        "    SUM(CASE WHEN rel_table='consultation' AND earn_point>0 THEN earn_point ELSE 0 END) AS earn_consult, "
        "    SUM(CASE WHEN rel_table='settlement_monthly' THEN use_point ELSE 0 END) AS settled, "
        "    SUM(CASE WHEN rel_table IN ('payment','payment_autopay') THEN earn_point ELSE 0 END) AS earn_pay, "
        "    SUM(CASE WHEN rel_table='consultation' AND use_point>0 THEN use_point ELSE 0 END) AS use_consult "
        "  FROM point_history GROUP BY member_id"
        ") "
        "SELECT m.id, m.role, "
        "ph.earn_pay AS 충전, ph.use_consult AS 사용, "
        "(p.free_balance + p.paid_balance) AS 현_소비, "
        "(ph.earn_pay - ph.use_consult) AS 예상_소비, "
        "ph.earn_consult AS 적립, ph.settled AS 정산, "
        "p.earning_balance AS 현_수익, "
        "(ph.earn_consult - ph.settled) AS 예상_수익, "
        "((p.free_balance + p.paid_balance) - (ph.earn_pay - ph.use_consult)) AS 소비_drift, "
        "(p.earning_balance - (ph.earn_consult - ph.settled)) AS 수익_drift "
        "FROM member m JOIN point p ON p.member_id = m.id JOIN ph ON ph.member_id = m.id "
        "ORDER BY m.id;"
    ), "E-3. 활동 회원 종단 정합성 (소비/수익 흐름별 격차)")

    # E-4. consultation 적립금 vs point_history.consultation earn_point 매칭
    run(c, dburl, (
        "SELECT "
        "(SELECT COUNT(*) FROM consultation WHERE reason IN ('END_CHAT','END_CHAT_LOCAL','DISCONNECT') AND amt > 0) AS cons_with_amt, "
        "(SELECT COUNT(*) FROM point_history WHERE rel_table='consultation' AND earn_point > 0) AS ph_credits, "
        "(SELECT COALESCE(SUM(amt),0) FROM consultation WHERE reason IN ('END_CHAT','END_CHAT_LOCAL','DISCONNECT') AND amt > 0) AS cons_sum, "
        "(SELECT COALESCE(SUM(earn_point),0) FROM point_history WHERE rel_table='consultation' AND earn_point > 0) AS ph_sum;"
    ), "E-4. 정상 종료 상담 amt 합 vs 적립 point_history earn 합")

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
