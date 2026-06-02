"""D 검증으로 생긴 유령 settlement_monthly row 정리."""
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
    _, out, _ = c.exec_command(
        "grep '^DATABASE_URL=' /data/wwwroot/api.sajumoon.co.kr/.env | head -1"
    )
    dburl = out.read().decode().strip().split("=", 1)[1].strip("'\"")

    psql = "/usr/bin/psql"

    # 1) 현재 상태 확인
    print("[BEFORE] settlement_monthly 라온선생 row:")
    _, out, _ = c.exec_command(
        f'{psql} "{dburl}" -c '
        '"SELECT id, member_id, mb_id, month, price, final_payout_amount, wr_datetime '
        'FROM settlement_monthly WHERE member_id=123;"'
    )
    print(out.read().decode())

    # 2) BEGIN; DELETE WHERE month=2026-05 AND member_id=123 (D 검증으로 생긴 유령 row); COMMIT;
    print("[DELETE] 유령 row 제거 (BEGIN/COMMIT 안에서)")
    cmd = (
        f'{psql} "{dburl}" -c '
        '"BEGIN; DELETE FROM settlement_monthly WHERE member_id=123 AND month=\'2026-05\' '
        "AND wr_datetime >= '2026-05-23'::date RETURNING id, member_id, month; COMMIT;\""
    )
    _, out, err = c.exec_command(cmd)
    print(out.read().decode())
    print(err.read().decode())

    # 3) 사후 확인
    print("[AFTER] settlement_monthly 라온선생 row:")
    _, out, _ = c.exec_command(
        f'{psql} "{dburl}" -c '
        '"SELECT id, member_id, mb_id, month, price, final_payout_amount, wr_datetime '
        'FROM settlement_monthly WHERE member_id=123;"'
    )
    print(out.read().decode())

    # 4) 잔액 변화 없는지 확인
    print("[CHECK] 라온선생 잔액 (변화 없어야 함):")
    _, out, _ = c.exec_command(
        f'{psql} "{dburl}" -c '
        '"SELECT m.id, m.mb_id, m.name, p.free_balance, p.paid_balance, p.earning_balance '
        'FROM member m JOIN point p ON p.member_id=m.id WHERE m.id=123;"'
    )
    print(out.read().decode())

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
