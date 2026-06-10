#!/usr/bin/env python3
import paramiko, os

pw = os.environ.get('SSHPASS','')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw)

# jackee role 확인
s,o,e = c.exec_command("psql -U sajumoon -d sajumoon -c \"SELECT id,mb_id,role FROM member WHERE mb_id='jackee' LIMIT 1;\"")
print("=== jackee role ===")
print(o.read().decode())

# pm2 최근 50줄에서 pending/enqueue
s,o,e = c.exec_command("pm2 logs sajumoon-api --lines 100 --nostream 2>&1 | grep -E 'pending|enqueue|grade' | tail -20")
print("=== pm2 logs ===")
print(o.read().decode() or "(없음)")

c.close()
