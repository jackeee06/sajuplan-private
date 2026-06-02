"""Read test server's index.html favicon block."""
import os, sys, paramiko
pw = os.environ["SSHPASS"]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("172.235.211.75", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=10)
_, out, _ = c.exec_command("head -15 /data/wwwroot/sajumoon.kr/index.html")
print(out.read().decode("utf-8", errors="replace"))
c.close()
