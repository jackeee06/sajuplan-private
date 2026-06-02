"""
소비포인트 / 수익포인트 분리 마이그레이션 적용 스크립트.

- 양 서버 (test=172.235.211.75, prod=104.64.128.103) 에 SQL 적용
- 단계: pre-check → SQL upload → 실행 → 검증 SQL 출력
- 실제 적용 전 dry-run 모드(--dry-run) 로 ROLLBACK 안전 검증 가능

사용법:
    SSHPASS='...' python tools/_apply_point_separation.py test          # test 실 적용
    SSHPASS='...' python tools/_apply_point_separation.py prod          # prod 실 적용
    SSHPASS='...' python tools/_apply_point_separation.py prod --dry-run # prod 트랜잭션 ROLLBACK 검증
"""
import os
import sys
import io
import paramiko
from pathlib import Path

TARGETS = {
    "test": {
        "host": "172.235.211.75",
        "api_remote": "/data/wwwroot/api.sajumoon.kr",
    },
    "prod": {
        "host": "104.64.128.103",
        "api_remote": "/data/wwwroot/api.sajumoon.co.kr",
    },
}

SQL_LOCAL = Path(__file__).resolve().parent.parent / "api/db/migrations/20260522120000_point_separation.sql"
SQL_REMOTE = "/tmp/sajumoon_point_separation.sql"


def run(ssh: paramiko.SSHClient, cmd: str, label: str = "") -> tuple[str, str, int]:
    if label:
        print(f"\n>> {label}")
    print(f"   $ {cmd[:200]}{'...' if len(cmd) > 200 else ''}")
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=False)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    rc = stdout.channel.recv_exit_status()
    if out:
        print(out, end="" if out.endswith("\n") else "\n")
    if err:
        print(f"   [stderr] {err}", end="" if err.endswith("\n") else "\n")
    return out, err, rc


def apply_target(target: str, dry_run: bool = False) -> int:
    info = TARGETS[target]
    host = info["host"]
    api_remote = info["api_remote"]
    sshpass = os.environ.get("SSHPASS")
    if not sshpass:
        print("ERROR: SSHPASS env var required.")
        return 2
    if not SQL_LOCAL.exists():
        print(f"ERROR: SQL not found: {SQL_LOCAL}")
        return 2

    print(f"\n{'='*60}\n[{target}] {host}  api={api_remote}  dry_run={dry_run}\n{'='*60}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, 22, "root", sshpass, allow_agent=False, look_for_keys=False, timeout=20, banner_timeout=20)
    try:
        # 0) psql 경로 동적 탐색 (PATH 에 없을 수 있음 — OneInStack 등은 /usr/local/pgsql/bin/)
        out, _, rc = run(
            ssh,
            "bash -lc 'command -v psql || ls /usr/local/pgsql/bin/psql /usr/pgsql-*/bin/psql /usr/bin/psql 2>/dev/null | head -1'",
            "psql 경로 탐색",
        )
        psql = out.strip().splitlines()[-1] if out.strip() else ""
        if not psql or "psql" not in psql:
            print("   [!] psql binary not found")
            return 3
        print(f"   psql={psql}")

        # 1) DATABASE_URL 추출
        out, _, rc = run(
            ssh,
            f"grep '^DATABASE_URL=' {api_remote}/.env | head -1 | sed \"s/^DATABASE_URL=//; s/^['\\\"]//; s/['\\\"]$//\"",
            "DATABASE_URL 추출",
        )
        if rc != 0 or not out.strip():
            print(f"   [!] DATABASE_URL 추출 실패")
            return 3
        dburl = out.strip().splitlines()[-1]
        masked = dburl[:30] + "..." + dburl[-15:] if len(dburl) > 50 else dburl
        print(f"   DBURL={masked}")

        # 2) point 테이블 사전 상태
        run(
            ssh,
            f'{psql} "{dburl}" -c "SELECT COUNT(*) AS members, SUM(free_balance) AS sum_free, SUM(paid_balance) AS sum_paid FROM point;"',
            "사전 상태 (point 합계)",
        )
        run(
            ssh,
            f'{psql} "{dburl}" -c "SELECT COUNT(*) AS counselor_count, COUNT(*) FILTER(WHERE p.paid_balance>0) AS counselor_with_paid FROM member m JOIN point p ON p.member_id=m.id WHERE m.csrid IS NOT NULL AND m.csrid <> \'\';"',
            "사전 상태 (상담사 수)",
        )

        # 3) SQL 업로드
        sftp = ssh.open_sftp()
        with open(SQL_LOCAL, "rb") as f:
            data = f.read()
        if dry_run:
            # BEGIN/COMMIT 을 BEGIN/ROLLBACK 으로 치환
            data = data.replace(b"\nCOMMIT;\n", b"\nROLLBACK;\n")
            print("   [dry-run] COMMIT → ROLLBACK 치환")
        sftp.putfo(io.BytesIO(data), SQL_REMOTE)
        sftp.close()
        print(f"   업로드 완료: {SQL_REMOTE} ({len(data)} bytes)")

        # 4) 마이그레이션 실행 (-v ON_ERROR_STOP=1 로 오류 시 즉시 중단)
        run(
            ssh,
            f'{psql} "{dburl}" -v ON_ERROR_STOP=1 -f {SQL_REMOTE} 2>&1',
            f"마이그레이션 {'dry-run' if dry_run else '실행'}",
        )

        # 5) 사후 검증
        run(
            ssh,
            f'{psql} "{dburl}" -c "SELECT COUNT(*) AS members, SUM(free_balance) AS sum_free, SUM(paid_balance) AS sum_paid, SUM(earning_balance) AS sum_earning FROM point;"',
            "사후 상태 (point 합계)",
        )
        run(
            ssh,
            f'{psql} "{dburl}" -c "SELECT m.id, m.mb_id, m.name, m.csrid, p.free_balance, p.paid_balance, p.earning_balance, p.total_earned, p.total_used FROM member m JOIN point p ON p.member_id=m.id WHERE m.csrid IS NOT NULL AND m.csrid <> \'\' AND p.earning_balance > 0 ORDER BY p.earning_balance DESC LIMIT 10;"',
            "수익포인트 보유 상담사 TOP 10",
        )
        run(
            ssh,
            f'{psql} "{dburl}" -c "SELECT COUNT(*) AS neg_rows FROM point WHERE free_balance < 0 OR paid_balance < 0 OR earning_balance < 0;"',
            "음수 잔액 검증",
        )

        # 6) 임시 SQL 파일 삭제
        run(ssh, f"rm -f {SQL_REMOTE}", "임시 파일 정리")
    finally:
        ssh.close()
    print(f"\n[{target}] 완료")
    return 0


def main():
    args = sys.argv[1:]
    if not args or args[0] not in TARGETS:
        print(__doc__)
        return 1
    target = args[0]
    dry_run = "--dry-run" in args[1:]
    return apply_target(target, dry_run)


if __name__ == "__main__":
    sys.exit(main())
