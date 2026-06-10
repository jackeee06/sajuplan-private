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
print("=== admin 테이블 컬럼 ===")
print(run("SELECT column_name FROM information_schema.columns WHERE table_name='admin' ORDER BY ordinal_position;"))
print("=== lee 권한 ===")
print(run("SELECT * FROM admin WHERE mb_id='lee' LIMIT 1;"))
print("=== 전체 admin 목록 ===")
print(run("SELECT mb_id, is_super, role FROM admin ORDER BY id;"))
c.close()
