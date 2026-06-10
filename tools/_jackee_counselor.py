import paramiko, sys
pw = 'saju26moon@!!'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw)
# 현재 상태
s,o,e = c.exec_command("psql -U sajumoon -d sajumoon -At -c \"SELECT id||','||mb_id||','||role||','||COALESCE(grade,'null') FROM member WHERE mb_id='jackee' LIMIT 1;\"")
before = o.read().decode().strip()
sys.stdout.write(f"BEFORE: {before}\n")
sys.stdout.flush()
# counselor 전환
s,o,e = c.exec_command("psql -U sajumoon -d sajumoon -c \"UPDATE member SET role='counselor', grade=COALESCE(NULLIF(grade,''),'preliminary'), use_phone=true, use_chat=true WHERE mb_id='jackee' RETURNING id,mb_id,role,grade;\"")
result = o.read().decode().strip()
sys.stdout.write(f"RESULT: {result}\n")
sys.stdout.flush()
c.close()
