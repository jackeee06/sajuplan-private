import base64, os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

SQL = "SELECT template_code, primary_btn_name, primary_btn_url, is_active FROM alimtalk_template WHERE template_code LIKE 'qa%' ORDER BY template_code;"
b64 = base64.b64encode(SQL.encode()).decode()

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)
inner = (
    f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
    f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
)
_, out, err = c.exec_command(f"bash -lc {repr(inner)}", timeout=30)
print(out.read().decode("utf-8", errors="replace"))
e = err.read().decode("utf-8", errors="replace")
if e: print("ERR:", e, file=sys.stderr)
c.close()
