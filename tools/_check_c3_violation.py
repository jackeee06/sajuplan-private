import base64, os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"],
          allow_agent=False, look_for_keys=False, timeout=15)

SQL = """
SELECT c.id, c.created_at::date AS date, c.reason,
       c.amt, c.amt_free, c.amt_pro,
       (c.amt_free + c.amt_pro) AS sum_parts,
       c.amt - (c.amt_free + c.amt_pro) AS diff,
       m.mb_id AS member_id, cs.mb_id AS counselor_id
FROM consultation c
LEFT JOIN member m  ON m.id = c.member_id
LEFT JOIN member cs ON cs.id = c.counselor_id
WHERE c.amt > 0
  AND (c.amt_free + c.amt_pro) != c.amt
  AND c.reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
ORDER BY c.id;
"""
b64 = base64.b64encode(SQL.encode()).decode()
cmd = (
    'export DATABASE_URL=$(grep -E "^DATABASE_URL=" '
    '/data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
    f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
)
_, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=30)
print(out.read().decode())
e = err.read().decode()
if e: print("ERR:", e, file=sys.stderr)
c.close()
