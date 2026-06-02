import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)
_, o, _ = c.exec_command("curl -s -o /dev/null -w '%{http_code}' https://sajuplan.com/mng/assets/index-1r6n2nnM.css", get_pty=False)
print("CSS index-1r6n2nnM.css:", o.read().decode("utf-8", errors="replace").strip())
_, o, _ = c.exec_command("ls -la /data/wwwroot/sajumoon.co.kr/mng/assets/index-1r6n2nnM.css 2>&1", get_pty=False)
print("prod file:", o.read().decode("utf-8", errors="replace").strip())
c.close()
