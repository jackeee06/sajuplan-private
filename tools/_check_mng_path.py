"""Find where sajumoon.co.kr/mng/ is served from."""
import os, sys, paramiko
pw = os.environ["SSHPASS"]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=10)
cmds = [
    "ls -la /data/wwwroot/sajumoon.co.kr/mng/favicon/ 2>&1 | head -15",
    "ls -la /data/wwwroot/mng.sajumoon.co.kr/favicon/ 2>&1 | head -15",
    "ls -la /data/wwwroot/sajuplan.com/mng/favicon/ 2>&1 | head -15",
]
for cmd in cmds:
    print(f"\n--- {cmd} ---")
    _, out, _ = c.exec_command(cmd)
    print(out.read().decode("utf-8", errors="replace"))
c.close()
