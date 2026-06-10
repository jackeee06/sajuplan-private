"""추천 코드 변경 화면 검증 — 실제 서버 경로 사용."""
import base64, os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"],
          allow_agent=False, look_for_keys=False, timeout=15)

def run(sql):
    b64 = base64.b64encode(sql.encode()).decode()
    cmd = ('export DATABASE_URL=$(grep -E "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
           f'echo {b64} | base64 -d | psql "$DATABASE_URL"')
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=20)
    return out.read().decode()

def sh(cmd):
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=15)
    return out.read().decode() + err.read().decode()

# 실제 경로 탐색
print("=== 서버 wwwroot 경로 확인 ===")
print(sh("ls /data/wwwroot/ 2>&1"))

print("=== user 번들 위치 ===")
print(sh("find /data/wwwroot -name 'index.html' -not -path '*/api*' 2>&1 | head -10"))

c.close()
