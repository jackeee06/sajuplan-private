import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)
_, o, _ = c.exec_command("rm -f /data/wwwroot/sajumoon.co.kr/mng/index.html.bak && echo OK", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
c.close()
