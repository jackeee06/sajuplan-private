import base64, os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"],
          allow_agent=False, look_for_keys=False, timeout=15)

SQL = "SELECT id, mb_id, name, role FROM member WHERE role='user' ORDER BY id DESC LIMIT 5;"
b64 = base64.b64encode(SQL.encode()).decode()
inner = (
    f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
    f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
)
_, out, _ = c.exec_command(f"bash -lc {repr(inner)}", timeout=20)
print(out.read().decode())

# 상담사 목록도
SQL2 = "SELECT id, mb_id, name FROM member WHERE role='counselor' AND left_at IS NULL ORDER BY id LIMIT 3;"
b64_2 = base64.b64encode(SQL2.encode()).decode()
inner2 = (
    f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
    f'echo {b64_2} | base64 -d | psql "$DATABASE_URL"'
)
_, out2, _ = c.exec_command(f"bash -lc {repr(inner2)}", timeout=20)
print(out2.read().decode())
c.close()
