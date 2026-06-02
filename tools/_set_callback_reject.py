"""prod .env 에 CALLBACK_IP_MODE=reject 추가 (없으면) 또는 업데이트 (log→reject)."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"],
          allow_agent=False, look_for_keys=False, timeout=15)
env_path = "/data/wwwroot/api.sajumoon.co.kr/.env"
# 이미 있으면 replace, 없으면 append
cmd = (
    f"if grep -q 'CALLBACK_IP_MODE' {env_path}; then "
    f"  sed -i 's/CALLBACK_IP_MODE=.*/CALLBACK_IP_MODE=reject/' {env_path}; "
    f"  echo 'updated'; "
    f"else "
    f"  echo 'CALLBACK_IP_MODE=reject' >> {env_path}; "
    f"  echo 'appended'; "
    f"fi && grep 'CALLBACK_IP_MODE' {env_path}"
)
_, out, err = c.exec_command(f"bash -c {repr(cmd)}", timeout=20)
print(out.read().decode("utf-8", errors="replace"))
e = err.read().decode("utf-8", errors="replace")
if e: print("ERR:", e, file=sys.stderr)
c.close()
