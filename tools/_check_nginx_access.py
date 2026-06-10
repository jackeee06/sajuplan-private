import paramiko, time

pw = 'saju26moon@!!'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw)

# nginx access log에서 최근 pending 요청
s,o,e = c.exec_command("tail -500 /var/log/nginx/access.log 2>/dev/null | grep 'notifications/pending' | tail -20")
result = o.read().decode().strip()
print("=== /notifications/pending 최근 요청 ===")
print(result or "(없음 - 요청이 안 오고 있음)")

# api.sajuplan.com access log도 확인
s2,o2,e2 = c.exec_command("find /var/log/nginx -name '*.log' 2>/dev/null | head -10")
print("\n=== nginx 로그 파일 목록 ===")
print(o2.read().decode())

# 최근 30초간 인입된 요청
s3,o3,e3 = c.exec_command("tail -200 /var/log/nginx/access.log 2>/dev/null | tail -20")
print("=== nginx 최근 요청 20줄 ===")
print(o3.read().decode())

c.close()
