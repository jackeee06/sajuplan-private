import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)
def sh(cmd):
    _, out, err = c.exec_command(f"bash -c {repr(cmd)}", timeout=15)
    return out.read().decode("utf-8", errors="replace") + err.read().decode("utf-8", errors="replace")
print("=== sajuplan.com 전체 vhost (location 블록 포함) ===")
print(sh("cat /usr/local/nginx/conf/vhost/sajuplan.com.conf 2>&1"))
c.close()
