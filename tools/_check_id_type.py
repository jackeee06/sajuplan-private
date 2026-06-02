import paramiko, sys, os
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=10)
sql = "select column_name, data_type, udt_name from information_schema.columns where table_name='member' order by ordinal_position limit 5;"
cmd = f"bash -c 'psql $DATABASE_URL -c \"{sql}\"'"
_, out, err = c.exec_command(cmd, timeout=15)
print(out.read().decode())
e = err.read().decode()
if e: print("STDERR:", e, file=sys.stderr)
c.close()
