import base64, os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)
def run(sql):
    b64 = base64.b64encode(sql.encode()).decode()
    cmd = ('export DATABASE_URL=$(grep -E "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && ' + f'echo {b64} | base64 -d | psql "$DATABASE_URL"')
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=20)
    return out.read().decode() + err.read().decode()
print(run("SELECT column_name FROM information_schema.columns WHERE table_name='setting' ORDER BY ordinal_position;"))
# 이미 있는 promotion 값 확인
print(run("SELECT namespace, key, value FROM setting WHERE namespace='promotion';"))
# setting 샘플 INSERT (label 없이)
print(run("""
INSERT INTO setting (namespace, key, value)
VALUES
  ('promotion', 'referral_rate',   '0.01'),
  ('promotion', 'referral_months', '3')
ON CONFLICT (namespace, key) DO NOTHING;
"""))
print(run("SELECT namespace, key, value FROM setting WHERE namespace='promotion';"))
c.close()
