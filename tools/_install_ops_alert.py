"""OpsAlert recipients 설정 + BIZM_USER_ID 확인."""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

print("=== .env.defaults BIZM_USER_ID 값 (마스킹) ===")
_, o, _ = c.exec_command("grep '^BIZM_USER_ID=' /data/wwwroot/api.sajumoon.co.kr/.env.defaults | cut -d= -f2- | tr -d '\"'", get_pty=False)
val = o.read().decode("utf-8", errors="replace").strip()
if val:
    if len(val) <= 6:
        print(f"  값: {val} (len={len(val)})")
    else:
        print(f"  앞={val[:3]}, 뒤={val[-3:]}, len={len(val)}")
else:
    print("  MISSING")

print()
print("=== OpsAlert setting INSERT ===")
sql = """
INSERT INTO setting (namespace, key, value) VALUES
  ('ops', 'admin_alert.enabled',       'true'),
  ('ops', 'admin_alert.recipients',    '01075740572,01056910572'),
  ('ops', 'admin_alert.template_code', 'ops_admin_alert_v2'),
  ('ops', 'admin_alert.cooldown_sec',  '300')
ON CONFLICT (namespace, key) DO UPDATE SET value = EXCLUDED.value;

SELECT namespace, key, value FROM setting WHERE namespace='ops' ORDER BY key;
"""
cmd = f"psql $(grep '^DATABASE_URL' /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) <<'EOSQL'\n{sql}\nEOSQL"
_, o, e = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
err = e.read().decode("utf-8", errors="replace")
if err: print("STDERR:", err[:500])

c.close()
