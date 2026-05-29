"""recipients 보조 폰 제거 (K119 발생)."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)
sql = "UPDATE setting SET value='01075740572' WHERE namespace='ops' AND key='admin_alert.recipients'; SELECT key,value FROM setting WHERE namespace='ops' ORDER BY key;"
cmd = f"psql $(grep '^DATABASE_URL' /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -c \"{sql}\""
_, o, e = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
err = e.read().decode("utf-8", errors="replace")
if err: print("ERR:", err)
c.close()
