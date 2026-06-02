"""prod + test DB 의 setting 테이블에 스토어 URL row 추가 + 누락된 버전 row seed."""
from __future__ import annotations
import os, sys
import paramiko

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

# 임시 placeholder. 추후 관리자에서 실제 스토어 주소로 교체.
SQL = """\
INSERT INTO setting (namespace, key, value, value_type, description) VALUES
  ('app', 'aos_latest_version', '1.1.1', 'string', 'Android 최신 버전 (권장 업데이트 기준)'),
  ('app', 'ios_latest_version', '1.1',   'string', 'iOS 최신 버전 (권장 업데이트 기준)'),
  ('app', 'aos_store_url', 'https://play.google.com/store/apps/details?id=PLACEHOLDER', 'string', 'Google Play 스토어 주소 (임시 placeholder)'),
  ('app', 'ios_store_url', 'https://apps.apple.com/kr/app/id0000000000', 'string', 'App Store 주소 (임시 placeholder)')
ON CONFLICT (namespace, key) DO NOTHING;

SELECT key, value FROM setting WHERE namespace = 'app' ORDER BY key;
"""

SERVERS = [
    ("104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr/.env", "PROD", "psql"),
    ("172.235.211.75", "/data/wwwroot/api.sajumoon.kr/.env",    "TEST", "/usr/local/pgsql/bin/psql"),
]


def run(host, env_file, label, psql_bin):
    pw = os.environ["SSHPASS"]
    print(f"\n=== {label} ({host}) ===")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    cmd = f"bash -c 'set -a; . {env_file}; set +a; {psql_bin} \"$DATABASE_URL\"'"
    stdin, out, err = c.exec_command(cmd, get_pty=False)
    stdin.write(SQL); stdin.channel.shutdown_write()
    sys.stdout.write(out.read().decode("utf-8", errors="replace"))
    e = err.read().decode("utf-8", errors="replace")
    if e.strip(): sys.stderr.write(e)
    c.close()


for h, env, lbl, psql in SERVERS:
    run(h, env, lbl, psql)
