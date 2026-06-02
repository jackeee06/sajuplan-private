"""검증 G — 사고 시나리오 6종 SQL 시뮬레이션.

S1. 이중 역할 (한 mb_id 에 회원·상담사 잔액 동시 보유)
S2. consultation 적립 멱등성 (같은 상담 2번 적립?)
S3. short_call_refund 상담사 적립 회수 흔적
S4. refund_status='full' 인데 적립 회수 안 된 케이스
S5. is_settled=true 인 적립이 또 차감된 흔적
S6. payment-history 미스매치 (payment.coin_amount vs point_history.earn_point)
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

    # S1. 이중 역할 — 같은 사람이 회원 m2net_membid 와 csrid 둘 다 갖고 있고 잔액도 둘 다 보유
    run(c, dburl, (
        "SELECT m.id, m.mb_id, m.name, m.role, m.m2net_membid, m.csrid, "
        "p.paid_balance, p.earning_balance, "
        "CASE WHEN p.paid_balance > 0 AND p.earning_balance > 0 THEN '⚠️ 이중잔액' ELSE 'OK' END AS risk "
        "FROM member m JOIN point p ON p.member_id=m.id "
        "WHERE m.m2net_membid IS NOT NULL AND m.m2net_membid <> '' "
        "  AND m.csrid IS NOT NULL AND m.csrid <> '' "
        "ORDER BY m.id;"
    ), "S1. 이중 역할 (m2net_membid + csrid 동시 보유 — 라온선생 같은 케이스)")

    # S2. 같은 상담 중복 적립 검사 — (rel_table, rel_id, rel_action) UNIQUE 위반
    run(c, dburl, (
        "SELECT rel_table, rel_id, rel_action, member_id, COUNT(*) AS dups "
        "FROM point_history "
        "WHERE rel_table IN ('payment','payment_autopay','consultation') "
        "  AND rel_id IS NOT NULL AND rel_action IS NOT NULL "
        "GROUP BY rel_table, rel_id, rel_action, member_id "
        "HAVING COUNT(*) > 1;"
    ), "S2. point_history 멱등성 위반 (0 row 기대)")

    # S3. short_call_refund 인데 상담사 적립이 남아있는 케이스
    run(c, dburl, (
        "SELECT c.id AS cons_id, c.counselor_id, c.amt, c.refund_status, c.reason, "
        "(SELECT earn_point FROM point_history WHERE rel_table='consultation' "
        " AND rel_id = c.id::text AND member_id = c.counselor_id LIMIT 1) AS counselor_earn "
        "FROM consultation c "
        "WHERE c.refund_status = 'short_call_refund' "
        "  AND EXISTS (SELECT 1 FROM point_history ph WHERE ph.rel_table='consultation' "
        "              AND ph.rel_id = c.id::text AND ph.member_id = c.counselor_id "
        "              AND ph.earn_point > 0) "
        "ORDER BY c.id DESC LIMIT 10;"
    ), "S3. 단기통화환불(7초 미만) 후 상담사 적립이 남은 케이스 (정책 의문)")

    # S4. refund_status='full' 인데 상담사 적립이 회수되지 않은 케이스
    run(c, dburl, (
        "SELECT c.id, c.counselor_id, c.amt, c.refund_status, c.refunded_amount, "
        "COALESCE((SELECT SUM(earn_point) - SUM(use_point) FROM point_history ph "
        "  WHERE ph.rel_table='consultation' AND ph.rel_id=c.id::text "
        "  AND ph.member_id=c.counselor_id), 0) AS net_earn "
        "FROM consultation c "
        "WHERE c.refund_status = 'full' AND c.refunded_amount >= c.amt "
        "  AND (SELECT SUM(earn_point) - SUM(use_point) FROM point_history ph "
        "       WHERE ph.rel_table='consultation' AND ph.rel_id=c.id::text "
        "       AND ph.member_id=c.counselor_id) > 0;"
    ), "S4. 전액환불 됐는데 상담사 적립 회수 안 된 케이스 (위반 0 기대)")

    # S5. is_settled=true 인 적립을 또 차감한 흔적
    run(c, dburl, (
        "SELECT ph2.id AS dup_settle_id, ph2.member_id, ph2.use_point, ph2.created_at, "
        "ph2.rel_action, "
        "(SELECT MAX(created_at) FROM point_history WHERE member_id=ph2.member_id "
        " AND is_settled=true AND created_at < ph2.created_at) AS prev_settle "
        "FROM point_history ph2 "
        "WHERE ph2.rel_table = 'settlement_monthly' "
        "  AND EXISTS (SELECT 1 FROM point_history ph1 "
        "              WHERE ph1.member_id=ph2.member_id "
        "                AND ph1.rel_table='settlement_monthly' "
        "                AND ph1.id <> ph2.id "
        "                AND DATE_TRUNC('month', ph1.created_at) = DATE_TRUNC('month', ph2.created_at));"
    ), "S5. 같은 월에 정산 차감 2번 일어난 흔적 (위반 0 기대)")

    # S6. payment.coin_amount vs point_history.earn_point 일치
    run(c, dburl, (
        "SELECT p.id AS pay_id, p.member_id, p.status, p.coin_amount, "
        "COALESCE((SELECT SUM(earn_point) FROM point_history "
        "  WHERE rel_table IN ('payment','payment_autopay') "
        "    AND rel_id = p.id::text AND member_id = p.member_id), 0) AS ph_earn, "
        "(p.coin_amount - COALESCE((SELECT SUM(earn_point) FROM point_history "
        "  WHERE rel_table IN ('payment','payment_autopay') "
        "    AND rel_id = p.id::text AND member_id = p.member_id), 0)) AS drift "
        "FROM payment p "
        "WHERE p.status = 'completed' AND p.coin_amount > 0 "
        "  AND p.coin_amount <> COALESCE((SELECT SUM(earn_point) FROM point_history "
        "    WHERE rel_table IN ('payment','payment_autopay') "
        "      AND rel_id = p.id::text AND member_id = p.member_id), 0);"
    ), "S6. 결제 완료 payment.coin_amount vs point_history earn 일치 (위반 0 기대)")

    # 추가 — point_history id=15 와 consultation id=64 매칭 의문 검증
    run(c, dburl, (
        "SELECT ph.id, ph.member_id, ph.rel_table, ph.rel_id, ph.rel_action, "
        "ph.earn_point, ph.balance_after, ph.created_at "
        "FROM point_history ph WHERE ph.id = 15;"
    ), "Z. point_history id=15 의 rel_id (라온선생 적립이 어느 consultation 인지)")

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
