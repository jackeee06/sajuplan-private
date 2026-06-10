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
# admin 은 member 테이블에 is_admin 컬럼
print("=== member 테이블 admin 관련 컬럼 ===")
print(run("SELECT column_name FROM information_schema.columns WHERE table_name='member' AND column_name LIKE '%admin%' OR (table_name='member' AND column_name LIKE '%super%');"))
print("=== lee 계정 권한 ===")
print(run("SELECT id, mb_id, role, is_admin FROM member WHERE mb_id='lee' LIMIT 1;"))
print("=== is_admin='super' 계정 목록 ===")
print(run("SELECT mb_id, is_admin FROM member WHERE is_admin IS NOT NULL AND is_admin != '' ORDER BY id;"))
c.close()
