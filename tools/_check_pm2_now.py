import paramiko, time

pw = 'saju26moon@!!'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw)

# PM2 로그 파일 위치 확인
s,o,e = c.exec_command("ls -la ~/.pm2/logs/ 2>/dev/null | grep sajumoon")
print("PM2 로그 파일:")
print(o.read().decode())

# stdout 로그에서 enqueue
s,o,e = c.exec_command("tail -200 ~/.pm2/logs/sajumoon-api-out.log 2>/dev/null | grep -i 'enqueue\\|grade\\|pending\\|91' | tail -20")
out = o.read().decode()
print("stdout enqueue/grade/pending:")
print(out or "(없음)")

# stderr 로그 (NestJS 기본 출력이 여기 있을 수 있음)
s,o,e = c.exec_command("tail -200 ~/.pm2/logs/sajumoon-api-error.log 2>/dev/null | grep -i 'enqueue\\|grade\\|pending\\|91' | tail -20")
err = o.read().decode()
print("stderr enqueue/grade/pending:")
print(err or "(없음)")

# 혹시 다른 로그 위치
s,o,e = c.exec_command("pm2 logs sajumoon-api --lines 30 --nostream 2>&1 | grep -i 'enqueue\\|grade\\|91' | tail -10")
pm2 = o.read().decode()
print("pm2 logs cmd:")
print(pm2 or "(없음)")

c.close()
