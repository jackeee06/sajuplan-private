"""Debug: dump DATABASE_URL parsing."""
import os, sys
import paramiko

pw = os.environ["SSHPASS"]
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

cmd = "head -5 /data/wwwroot/api.sajumoon.co.kr/.env"
_, out, err = client.exec_command(cmd, get_pty=False)
sys.stdout.write(out.read().decode("utf-8", errors="replace"))
e = err.read().decode("utf-8", errors="replace")
if e: sys.stderr.write(e)
client.close()
