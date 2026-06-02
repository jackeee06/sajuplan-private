"""소비/수익 포인트 분리 후 prod DB 현재 상태 확인."""
import os
import sys
import paramiko

HOST = "104.64.128.103"
API_REMOTE = "/data/wwwroot/api.sajumoon.co.kr"

def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("ERROR: SSHPASS env var required.")
        return 2
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    try:
        # DBURL 추출
        _, out, _ = c.exec_command(
            f"grep '^DATABASE_URL=' {API_REMOTE}/.env | head -1 | "
            "sed \"s/^DATABASE_URL=//; s/^['\\\"]//; s/['\\\"]$//\""
        )
        dburl = out.read().decode().strip().splitlines()[-1]

        queries = [
            ("스키마 확인 (point 컬럼)",
             "SELECT column_name, data_type FROM information_schema.columns "
             "WHERE table_name='point' ORDER BY ordinal_position;"),
            ("point 합계",
             "SELECT COUNT(*) AS members, SUM(free_balance) AS free, "
             "SUM(paid_balance) AS paid, SUM(earning_balance) AS earning FROM point;"),
            ("수익 보유자 (earning > 0)",
             "SELECT m.id, m.mb_id, m.name, m.csrid, "
             "p.free_balance, p.paid_balance, p.earning_balance, "
             "p.total_earned, p.total_used "
             "FROM member m JOIN point p ON p.member_id=m.id "
             "WHERE p.earning_balance > 0 ORDER BY p.earning_balance DESC;"),
            ("음수 잔액 검증 (0이어야 함)",
             "SELECT COUNT(*) AS neg FROM point "
             "WHERE free_balance < 0 OR paid_balance < 0 OR earning_balance < 0;"),
            ("최근 point_history (10건)",
             "SELECT id, member_id, rel_table, earn_point, use_point, "
             "balance_after, created_at FROM point_history "
             "ORDER BY id DESC LIMIT 10;"),
        ]
        for label, q in queries:
            print(f"\n=== {label} ===")
            _, out, err = c.exec_command(f'/usr/bin/psql "{dburl}" -c "{q}"')
            sys.stdout.write(out.read().decode(errors="replace"))
            e = err.read().decode(errors="replace")
            if e:
                print("ERR:", e)
    finally:
        c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
