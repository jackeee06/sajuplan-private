"""Find the API .env file location on prod server."""
import os, sys
import paramiko

pw = os.environ["SSHPASS"]
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

cmd = "ls -la /data/wwwroot/ 2>&1; echo ---; find /data/wwwroot -maxdepth 3 -name '.env' 2>/dev/null"
_, out, err = client.exec_command(cmd, get_pty=False)
sys.stdout.write(out.read().decode("utf-8", errors="replace"))
e = err.read().decode("utf-8", errors="replace")
if e: sys.stderr.write(e)
client.close()
