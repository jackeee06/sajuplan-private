import paramiko, os, sys
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'],
          allow_agent=False, look_for_keys=False, timeout=10)
sql = "select template_code, primary_btn_name, primary_btn_url, is_active, message from alimtalk_template where template_code like 'qa%' order by template_code;"
cmd = f"bash -c 'psql $DATABASE_URL -c \"{sql}\"'"
_, out, err = c.exec_command(cmd, timeout=20)
print(out.read().decode())
e = err.read().decode()
if e: print("ERR:", e, file=sys.stderr)
c.close()
