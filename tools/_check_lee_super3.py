import base64, os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)
def run(sql):
    b64 = base64.b64encode(sql.encode()).decode()
    cmd = ('export DATABASE_URL=$(grep -E "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
           f'echo {b64} | base64 -d | psql "$DATABASE_URL"')
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=15)
    return out.read().decode("utf-8", errors="replace")
# member 의 role='admin' 인 계정
print("=== role=admin 계정 목록 ===")
print(run("SELECT id, mb_id, role, is_super FROM member WHERE role IN ('admin','super','manager') AND left_at IS NULL ORDER BY id;"))
# admin_permission 테이블 확인
print("=== admin_permission 테이블 확인 ===")
print(run("SELECT column_name FROM information_schema.columns WHERE table_name='admin_permission' ORDER BY ordinal_position LIMIT 10;"))
print(run("SELECT * FROM admin_permission LIMIT 5;"))
c.close()
