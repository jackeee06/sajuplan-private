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
print("=== nginx 설정 파일 위치 ===")
print(sh("find /etc/nginx -name '*.conf' 2>/dev/null | head -20"))
print(sh("find /usr/local/nginx -name '*.conf' 2>/dev/null | head -10"))
print("=== vhosts ===")
print(sh("find /etc -name 'vhost*' -o -name '*sajuplan*' -o -name '*sajumoon*' 2>/dev/null | head -10"))
print("=== nginx root 검색 ===")
print(sh("grep -r 'sajuplan\\|sajumoon' /etc/nginx/ 2>/dev/null | grep 'root\\|return\\|redirect' | head -20"))
c.close()
