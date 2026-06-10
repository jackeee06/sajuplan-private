import paramiko

pw = 'saju26moon@!!'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw)

# api.sajuplan.com nginx 로그 위치 확인
s,o,e = c.exec_command("find /var/log/nginx -name '*.log' -o -name '*.access' 2>/dev/null")
print("nginx logs:", o.read().decode())

# api conf 확인
s,o,e = c.exec_command("ls /etc/nginx/sites-enabled/ 2>/dev/null && ls /etc/nginx/conf.d/ 2>/dev/null")
print("nginx confs:", o.read().decode())

# 최근 api access log
s,o,e = c.exec_command("find /var/log/nginx -name '*api*' 2>/dev/null | head -5")
api_log = o.read().decode().strip()
print("api log files:", api_log)

if api_log:
    logfile = api_log.split('\n')[0].strip()
    s,o,e = c.exec_command(f"tail -50 {logfile} 2>/dev/null | grep 'pending' | tail -10")
    print("pending in api log:", o.read().decode() or "(없음)")

# NestJS 앱 pm2 로그 경로 확인
s,o,e = c.exec_command("pm2 list 2>/dev/null | grep sajumoon")
print("pm2:", o.read().decode())
s,o,e = c.exec_command("ls ~/.pm2/logs/ 2>/dev/null")
print("pm2 log files:", o.read().decode())

c.close()
