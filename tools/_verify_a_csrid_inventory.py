"""검증 A — csrid 인벤토리. csrid 없는 counselor 10명 정체 파악."""
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

        # 1) csrid 없는 counselor 전체 리스트 — 누구, 언제 생성, 어디서 가입
        run(c, dburl, (
            "SELECT m.id, m.mb_id, m.name, m.nickname, m.phone, "
            "m.created_at::date AS created, "
            "m.acquisition_source, m.left_at::date AS left_at, m.state, m.role "
            "FROM member m "
            "WHERE m.role = 'counselor' AND (m.csrid IS NULL OR m.csrid = '') "
            "ORDER BY m.id;"
        ), "1. csrid 누락 counselor 전체 리스트")

        # 2) 각 누락 counselor 의 활동 흔적 — 실제 상담했나?
        run(c, dburl, (
            "SELECT m.id, m.mb_id, m.name, "
            "COALESCE(c.cnt, 0) AS consultations, "
            "COALESCE(ph.cnt, 0) AS point_history_rows, "
            "COALESCE(p.free_balance, 0) AS free, "
            "COALESCE(p.paid_balance, 0) AS paid, "
            "COALESCE(p.earning_balance, 0) AS earning "
            "FROM member m "
            "LEFT JOIN (SELECT counselor_id, COUNT(*) AS cnt FROM consultation GROUP BY counselor_id) c "
            "       ON c.counselor_id = m.id "
            "LEFT JOIN (SELECT member_id, COUNT(*) AS cnt FROM point_history GROUP BY member_id) ph "
            "       ON ph.member_id = m.id "
            "LEFT JOIN point p ON p.member_id = m.id "
            "WHERE m.role = 'counselor' AND (m.csrid IS NULL OR m.csrid = '') "
            "ORDER BY m.id;"
        ), "2. 각 누락 counselor 의 활동 흔적 (consultation/point_history/잔액)")

        # 3) 비교용 — csrid 있는 counselor 의 활동 분포
        run(c, dburl, (
            "SELECT COUNT(*) AS total_counselors_with_csrid, "
            "COUNT(*) FILTER(WHERE EXISTS (SELECT 1 FROM consultation c WHERE c.counselor_id = m.id)) AS with_consultation, "
            "COUNT(*) FILTER(WHERE state = 'IDLE') AS idle_state "
            "FROM member m "
            "WHERE m.role = 'counselor' AND m.csrid IS NOT NULL AND m.csrid <> '';"
        ), "3. 비교용: csrid 있는 counselor 분포")

        # 4) member 전체 통계
        run(c, dburl, (
            "SELECT role, COUNT(*) AS cnt, "
            "COUNT(*) FILTER(WHERE csrid IS NOT NULL AND csrid <> '') AS with_csrid, "
            "COUNT(*) FILTER(WHERE m2net_membid IS NOT NULL AND m2net_membid <> '') AS with_m2net_membid "
            "FROM member GROUP BY role ORDER BY role;"
        ), "4. role 별 ID 보유 현황 (전체 회원)")

        # 5) counselor_apply 테이블에 해당 회원의 신청/승인 흔적
        run(c, dburl, (
            "SELECT m.id AS member_id, m.mb_id, m.name, "
            "ca.id AS apply_id, ca.status, ca.applied_at::date AS applied, ca.processed_at::date AS processed "
            "FROM member m "
            "LEFT JOIN counselor_apply ca ON ca.member_id = m.id "
            "WHERE m.role = 'counselor' AND (m.csrid IS NULL OR m.csrid = '') "
            "ORDER BY m.id;"
        ), "5. 누락 counselor 의 counselor_apply 신청 흔적")
    finally:
        c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
