import paramiko, os, sys
pw = 'saju26moon@!!'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw)
s,o,e = c.exec_command("psql -U sajumoon -d sajumoon -t -c \"SELECT id||' '||mb_id||' '||role FROM member WHERE mb_id='jackee' LIMIT 1;\"")
out = o.read().decode().strip()
sys.stdout.write("jackee: " + out + "\n")
sys.stdout.flush()
s2,o2,e2 = c.exec_command("tail -200 ~/.pm2/logs/sajumoon-api-out.log 2>/dev/null | grep -E 'enqueue|pending|grade' | tail -10")
sys.stdout.write("logs:\n" + o2.read().decode() + "\n")
sys.stdout.flush()
c.close()
