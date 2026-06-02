import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)
print("=== prod mng/index.html 시점 ===")
_, o, _ = c.exec_command("ls -la /data/wwwroot/sajumoon.co.kr/mng/index.html", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
print()
print("=== mng JS hash (사장님 브라우저가 받음) ===")
_, o, _ = c.exec_command("curl -s https://sajuplan.com/mng/ | grep -oE 'index-[A-Za-z0-9_-]+\\.js' | head -1", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
print()
print("=== 로컬 빌드 hash ===")
import glob
local_js = glob.glob(r"C:\claudeworkspace\sajumoon\web\mng\dist\assets\index-*.js")
print([os.path.basename(f) for f in local_js])
c.close()
