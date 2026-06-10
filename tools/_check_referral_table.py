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
print("=== counselor_referral_payment 실제 컬럼 ===")
print(run("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='counselor_referral_payment' ORDER BY ordinal_position;"))
print("=== counselor_referral 실제 컬럼 ===")
print(run("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='counselor_referral' ORDER BY ordinal_position;"))
c.close()
