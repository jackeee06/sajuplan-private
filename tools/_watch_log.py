import paramiko, time

pw = 'saju26moon@!!'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw)

# pending 호출 + enqueue 로그를 15초간 감시
s,o,e = c.exec_command("timeout 15 tail -f ~/.pm2/logs/sajumoon-api-out.log 2>/dev/null | grep -E 'pending|enqueue|grade|91' ")
for line in o:
    print(line.rstrip())

c.close()
