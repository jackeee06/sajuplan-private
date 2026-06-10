import paramiko, os, urllib.request

pw = 'saju26moon@!!'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw)

# 1. 현재 배포된 JS 파일명 확인
s,o,e = c.exec_command("grep -o 'index-[A-Za-z0-9_-]*.js' /data/wwwroot/sajumoon.co.kr/index.html | head -3")
js_file = o.read().decode().strip()
print(f"[서버 JS] {js_file}")

# 2. jackee role 확인
s,o,e = c.exec_command("psql -U sajumoon -d sajumoon -t -c \"SELECT id,mb_id,role FROM member WHERE mb_id='jackee' LIMIT 1;\"")
print(f"[jackee DB] {o.read().decode().strip()}")

# 3. 최근 pm2 로그 (pending/enqueue)
s,o,e = c.exec_command("tail -200 ~/.pm2/logs/sajumoon-api-out.log 2>/dev/null | grep -E 'enqueue|grade' | tail -10")
logs = o.read().decode().strip()
print(f"[pm2 logs]\n{logs or '(없음)'}")

c.close()

# 4. pending 엔드포인트 401 확인
try:
    r = urllib.request.urlopen('https://api.sajuplan.com/api/user/notifications/pending', timeout=5)
    print(f"[pending] status={r.status} (로그인 없이 200이면 이상)")
except urllib.error.HTTPError as e:
    print(f"[pending] HTTP {e.code} {'← 정상 (인증 필요)' if e.code==401 else ''}")
except Exception as ex:
    print(f"[pending] error: {ex}")
