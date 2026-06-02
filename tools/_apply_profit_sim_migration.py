"""profit_simulator_config 테이블 마이그레이션 양 서버 적용."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']

MIG_SQL = """
CREATE TABLE IF NOT EXISTS profit_simulator_config (
  id          BIGSERIAL    PRIMARY KEY,
  admin_id    BIGINT       NOT NULL UNIQUE,
  data        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  profit_simulator_config IS '슈퍼관리자 순이익 시뮬레이터 설정 저장';
"""

for label, host, api_remote, psql in [
    ('test','172.235.211.75','/data/wwwroot/api.sajumoon.kr','/usr/local/pgsql/bin/psql'),
    ('prod','104.64.128.103','/data/wwwroot/api.sajumoon.co.kr','/usr/bin/psql'),
]:
    print(f"\n=== [{label}] {host} ===")
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
    _, o, _ = c.exec_command(f'grep "^DATABASE_URL=" {api_remote}/.env | head -1')
    dburl = o.read().decode().strip().split('=',1)[1].strip("'\"")

    # SQL 실행
    sql_escaped = MIG_SQL.replace('"', '\\"').replace('$', '\\$')
    _, o, e = c.exec_command(f'{psql} "{dburl}" -c "{sql_escaped}"')
    print(o.read().decode())
    err = e.read().decode()
    if err.strip():
        print(f"⚠️ stderr: {err[:500]}")

    # 검증
    _, o, _ = c.exec_command(
        f'{psql} "{dburl}" -Atc '
        '"SELECT count(*) FROM information_schema.tables '
        "WHERE table_name='profit_simulator_config';\""
    )
    cnt = o.read().decode().strip()
    print(f"  테이블 존재 확인: {cnt} (1이어야 함)")
    c.close()
