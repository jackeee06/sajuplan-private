"""counselor_request_alert 테이블 마이그레이션.

회원이 부재중 상담사에게 "지금 접속해주세요" 요청 알림.
- 24시간 내 같은 (member, counselor) 중복 요청 차단 (코드 레벨)
- 알림 발송 후 row 유지 (이력 + 향후 통계)
"""
from __future__ import annotations
import os, sys
import paramiko

SERVERS = [
    ('test', '172.235.211.75', '/data/wwwroot/api.sajumoon.kr', '/usr/local/pgsql/bin/psql'),
    ('prod', '104.64.128.103', '/data/wwwroot/api.sajumoon.co.kr', 'psql'),
]

SQL = """
CREATE TABLE IF NOT EXISTS counselor_request_alert (
  id SERIAL PRIMARY KEY,
  counselor_id INT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  member_id    INT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at  TIMESTAMPTZ,
  notify_method TEXT,
  notify_error  TEXT
);
CREATE INDEX IF NOT EXISTS idx_cra_counselor_recent
  ON counselor_request_alert (counselor_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_cra_member_counselor_recent
  ON counselor_request_alert (member_id, counselor_id, requested_at DESC);
COMMENT ON TABLE counselor_request_alert IS
  '회원이 부재중 상담사에게 보낸 "지금 접속해주세요" 알림 요청 이력';
"""


def main() -> int:
    pw = os.environ.get('SSHPASS')
    if not pw:
        print('SSHPASS env required', file=sys.stderr); return 2

    for label, host, api_path, psql_bin in SERVERS:
        print(f'\n[{label}] {host}')
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, username='root', password=pw, timeout=20,
                  look_for_keys=False, allow_agent=False)

        tmp = f'/tmp/migrate_cra_{os.getpid()}.sql'
        i, o, _ = c.exec_command(f'cat > {tmp}')
        i.write(SQL); i.channel.shutdown_write(); o.channel.recv_exit_status()

        _, env, _ = c.exec_command(f'grep ^DATABASE_URL= {api_path}/.env')
        db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")

        _, out, err = c.exec_command(
            f'{psql_bin} "{db_url}" -v ON_ERROR_STOP=1 -f {tmp} && rm -f {tmp}', timeout=30,
        )
        print(out.read().decode())
        e = err.read().decode()
        if e: print('STDERR:', e, file=sys.stderr)
        c.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
