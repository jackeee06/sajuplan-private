"""admin_memo 테이블 양 서버 마이그레이션."""
from __future__ import annotations
import os, sys
import paramiko

SERVERS = [
    # (label, host, api_path, psql_bin) — test 는 psql 이 PATH 에 없어 절대경로 사용.
    ('test', '172.235.211.75', '/data/wwwroot/api.sajumoon.kr', '/usr/local/pgsql/bin/psql'),
    ('prod', '104.64.128.103', '/data/wwwroot/api.sajumoon.co.kr', 'psql'),
]

SQL = """
CREATE TABLE IF NOT EXISTS admin_memo (
  admin_id INT PRIMARY KEY REFERENCES member(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE admin_memo IS '관리자 개인 메모장 (admin 1명당 1 row, content=HTML)';
"""


def main() -> int:
    pw = os.environ.get('SSHPASS')
    if not pw:
        print('SSHPASS env required', file=sys.stderr); return 2

    for label, host, api_path, psql_bin in SERVERS:
        print(f'\n[{label}] {host} → {api_path}')
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, username='root', password=pw, timeout=20,
                  look_for_keys=False, allow_agent=False)

        tmp = f'/tmp/migrate_admin_memo_{os.getpid()}.sql'
        stdin, stdout, _ = c.exec_command(f'cat > {tmp}', timeout=15)
        stdin.write(SQL); stdin.channel.shutdown_write()
        stdout.channel.recv_exit_status()

        _, env_out, _ = c.exec_command(
            f'grep ^DATABASE_URL= {api_path}/.env', timeout=10,
        )
        env_line = env_out.read().decode().strip()
        if '=' not in env_line:
            print('  ✗ DATABASE_URL not found'); c.close(); return 1
        db_url = env_line.split('=', 1)[1].strip().strip('"').strip("'")

        _, out, err = c.exec_command(
            f'{psql_bin} "{db_url}" -v ON_ERROR_STOP=1 -f {tmp} && rm -f {tmp}',
            timeout=30,
        )
        print(out.read().decode())
        e = err.read().decode()
        if e: print('  STDERR:', e, file=sys.stderr)
        c.close()

    return 0


if __name__ == '__main__':
    sys.exit(main())
