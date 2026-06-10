"""nginx 설정에서 각 도메인의 실제 root 경로 확인."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"],
          allow_agent=False, look_for_keys=False, timeout=15)
def sh(cmd):
    _, out, err = c.exec_command(f"bash -c {repr(cmd)}", timeout=15)
    return out.read().decode("utf-8", errors="replace") + err.read().decode("utf-8", errors="replace")
print("=== nginx vhosts 목록 ===")
print(sh("ls /etc/nginx/sites-enabled/ 2>/dev/null || ls /etc/nginx/conf.d/ 2>/dev/null"))
print("=== sajuplan.com root 경로 ===")
print(sh("grep -A5 'server_name.*sajuplan.com' /etc/nginx/sites-enabled/* /etc/nginx/conf.d/* 2>/dev/null | grep -E 'server_name|root|return|redirect' | head -20"))
print("=== sajumoon.co.kr root/redirect ===")
print(sh("grep -A5 'server_name.*sajumoon.co.kr' /etc/nginx/sites-enabled/* /etc/nginx/conf.d/* 2>/dev/null | grep -E 'server_name|root|return|redirect' | head -20"))
c.close()
