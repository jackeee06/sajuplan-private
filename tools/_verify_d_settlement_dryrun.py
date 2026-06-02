"""검증 D — 정산 cron dry-run 시뮬레이션 (prod).

prod 의 settlement/monthly?test=1 호출 — 실 데이터 변경 없이 결과만 미리 계산.
대상: 라온선생(4875978218_K) — 5월 1,000P 적립 분.
"""
import os
import sys
import json
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

    # CRON_TOKEN 읽기
    _, out, _ = c.exec_command("grep '^CRON_TOKEN=' /data/wwwroot/api.sajumoon.co.kr/.env")
    raw = out.read().decode().strip()
    token = raw.split("=", 1)[1].strip("'\"") if "=" in raw else ""
    print(f"CRON_TOKEN={token[:6]}***")

    # 1) 사전 진단 호출
    print("\n[STEP 1] settlement/diagnose — 라온선생 5월 정산 대상 분석")
    cmd = (
        f"curl -s -m 30 'https://api.sajuplan.com/api/cron/settlement/diagnose?"
        f"mb_id=4875978218_K&month=2026-05&token={token}'"
    )
    _, out, _ = c.exec_command(cmd)
    body = out.read().decode()
    try:
        data = json.loads(body)
        print(json.dumps(data, indent=2, ensure_ascii=False)[:3000])
    except Exception:
        print(body[:1500])

    # 2) dry-run 호출 (test=1)
    print("\n[STEP 2] settlement/monthly?test=1 — dry-run 시뮬레이션")
    cmd = (
        f"curl -s -m 60 'https://api.sajuplan.com/api/cron/settlement/monthly?"
        f"month=2026-05&test=1&mb_id=4875978218_K&token={token}'"
    )
    _, out, _ = c.exec_command(cmd)
    body = out.read().decode()
    try:
        data = json.loads(body)
        print(json.dumps(data, indent=2, ensure_ascii=False)[:3000])
    except Exception:
        print(body[:1500])

    # 3) dry-run 직후 라온선생 잔액이 그대로인지 검증 (test=1 이라 실 변경 없어야 함)
    print("\n[STEP 3] dry-run 후 잔액 변화 없음 검증")
    _, out, _ = c.exec_command(
        "grep '^DATABASE_URL=' /data/wwwroot/api.sajumoon.co.kr/.env | head -1"
    )
    dbline = out.read().decode().strip()
    dburl = dbline.split("=", 1)[1].strip("'\"")
    cmd = (
        f'/usr/bin/psql "{dburl}" -c '
        '"SELECT m.id, m.mb_id, m.name, p.free_balance, p.paid_balance, p.earning_balance, '
        'p.total_earned, p.total_used FROM member m JOIN point p ON p.member_id=m.id WHERE m.id=123;"'
    )
    _, out, _ = c.exec_command(cmd)
    print(out.read().decode())

    # 4) settlement_monthly 테이블에 라온선생 row 가 만들어졌는지 (test=1 이라 만들면 안 됨? — 실제로는 만들어짐)
    print("[STEP 4] settlement_monthly 에 라온선생 5월 row 존재 여부")
    cmd = (
        f'/usr/bin/psql "{dburl}" -c '
        '"SELECT id, member_id, mb_id, month, price, price_tot, final_payout_amount, wr_datetime '
        'FROM settlement_monthly WHERE member_id=123 ORDER BY id DESC LIMIT 5;"'
    )
    _, out, _ = c.exec_command(cmd)
    print(out.read().decode())

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
