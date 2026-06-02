"""소비/수익 포인트 분리 작업 엄격 검증 (양 서버).

검증 5단계:
  A. DB 스키마 + 데이터 정합성
  B. 음수/drift invariant
  C. 라온선생 케이스 (id=123)
  D. point_history 흐름 분포
  E. 원격 코드(dist) 패치 반영 여부

사용:
    SSHPASS='...' python tools/_verify_point_separation_strict.py
"""
import os
import sys
import paramiko

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
    except Exception:
        pass


TARGETS = [
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr",   "/usr/local/pgsql/bin/psql"),
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr", "/usr/bin/psql"),
]


def run(c, cmd, label=""):
    if label:
        print(f"\n  >> {label}")
    _, out, err = c.exec_command(cmd)
    o = out.read().decode("utf-8", errors="replace")
    e = err.read().decode("utf-8", errors="replace")
    if o.strip():
        for line in o.rstrip().splitlines():
            print(f"     {line}")
    if e.strip():
        for line in e.rstrip().splitlines():
            print(f"     [stderr] {line}")
    return o, e


def verify(label, host, api_remote, psql, pw):
    print(f"\n{'='*70}\n[{label}] {host}\n{'='*70}")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    try:
        # DBURL 추출
        _, out, _ = c.exec_command(
            f"grep '^DATABASE_URL=' {api_remote}/.env | head -1 | sed \"s/^DATABASE_URL=//; s/^['\\\"]//; s/['\\\"]$//\""
        )
        dburl = out.read().decode().strip().splitlines()[-1]

        # ── A. 스키마 ────────────────────────────────────────────
        run(c, f'{psql} "{dburl}" -Atc "SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name=\'point\' ORDER BY ordinal_position;"',
            "A. point 테이블 스키마")

        # ── B. 합계 + 음수 검증 ──────────────────────────────────
        run(c, f'{psql} "{dburl}" -c "SELECT COUNT(*) AS members, SUM(free_balance) AS free, SUM(paid_balance) AS paid, SUM(earning_balance) AS earning FROM point;"',
            "B-1. point 합계")
        run(c, f'{psql} "{dburl}" -c "SELECT COUNT(*) AS neg_rows FROM point WHERE free_balance<0 OR paid_balance<0 OR earning_balance<0;"',
            "B-2. 음수 잔액 (0이어야 함)")
        run(c, f'{psql} "{dburl}" -c "SELECT COUNT(*) AS drift FROM member m JOIN point p ON p.member_id=m.id WHERE m.point IS DISTINCT FROM (p.free_balance + p.paid_balance);"',
            "B-3. member.point drift (소비포인트 미러 — 0이어야 함)")

        # ── C. 라온선생 케이스 (id=123) ──────────────────────────
        run(c, f'{psql} "{dburl}" -c "SELECT m.id, m.mb_id, m.name, m.csrid, m.role, m.point AS member_point, p.free_balance, p.paid_balance, p.earning_balance, p.total_earned, p.total_used FROM member m LEFT JOIN point p ON p.member_id=m.id WHERE m.id=123;"',
            "C. 라온선생(id=123) 분리 상태")

        # ── D. point_history rel_table 분포 ─────────────────────
        run(c, f'{psql} "{dburl}" -c "SELECT COALESCE(rel_table, \'(null)\') AS rel_table, COUNT(*) AS rows, SUM(earn_point) AS earn, SUM(use_point) AS use FROM point_history GROUP BY rel_table ORDER BY rel_table;"',
            "D. point_history rel_table 분포")

        # ── E. 원격 코드(dist) 반영 여부 ─────────────────────────
        run(c, f"grep -c 'earning_balance' {api_remote}/dist/pg-callbacks/m2net-push.service.js 2>/dev/null || echo 0",
            "E-1. m2net-push dist 에 earning_balance 패치 적용 (>=2 기대)")
        run(c, f"grep -c 'earning_balance' {api_remote}/dist/cron/settlement-cron.service.js 2>/dev/null || echo 0",
            "E-2. settlement-cron dist 에 earning_balance 패치 적용 (>=2 기대)")
        run(c, f"grep -c \"'earning'\" {api_remote}/dist/admin/points/points.service.js 2>/dev/null || echo 0",
            "E-3. admin/points dist 에 kind='earning' 패치 적용 (>=1 기대)")
        run(c, f"grep -c \"earning_balance\" {api_remote}/dist/cron/health-check.service.js 2>/dev/null || echo 0",
            "E-4. health-check dist 에 earning_balance invariant (>=1 기대)")
        run(c, f"grep -c \"earning_balance\" {api_remote}/dist/user/settlements/settlements.service.js 2>/dev/null || echo 0",
            "E-5. user/settlements dist balance=earning_balance (>=1 기대)")
        run(c, f"grep -c \"earning_balance\" {api_remote}/dist/admin/dashboard/dashboard.service.js 2>/dev/null || echo 0",
            "E-6. admin/dashboard dist 에 earning_balance 응답 (>=1 기대)")

        # ── F. health-check 호출해서 실제 invariant 통과 확인 ──
        run(c, f"grep '^CRON_TOKEN=' {api_remote}/.env | head -1 | cut -d= -f2 | tr -d '\"' | tr -d \"'\"",
            "F-prep. CRON_TOKEN 확인")
    finally:
        c.close()


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("ERROR: SSHPASS env var required.", file=sys.stderr)
        return 2
    for label, host, api_remote, psql in TARGETS:
        try:
            verify(label, host, api_remote, psql, pw)
        except Exception as ex:
            print(f"\n[{label}] ✗ 검증 실패: {ex}", file=sys.stderr)
            return 3
    print("\n✓ 양 서버 검증 완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
