import paramiko, re

pw = 'saju26moon@!!'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw)

# 1) 현재 index.html JS 파일명
s,o,e = c.exec_command("grep -o 'assets/index-[A-Za-z0-9_-]*.js' /data/wwwroot/sajumoon.co.kr/index.html")
js_file = o.read().decode().strip()
print(f"JS: {js_file}")

# 2) 배포된 JS에서 API_BASE와 notifications/pending 확인
if js_file:
    s,o,e = c.exec_command(f"grep -o 'api.sajuplan.com[^\"]*' /data/wwwroot/sajumoon.co.kr/{js_file} | head -5")
    print(f"API URL 패턴:\n{o.read().decode()}")

    s,o,e = c.exec_command(f"grep -o 'notifications/pending[^\"]*' /data/wwwroot/sajumoon.co.kr/{js_file} | head -3")
    print(f"pending 패턴: {o.read().decode()}")

    # grade_upgraded 존재 여부
    s,o,e = c.exec_command(f"grep -c 'grade_upgraded' /data/wwwroot/sajumoon.co.kr/{js_file}")
    print(f"grade_upgraded 코드 존재: {o.read().decode().strip()}")

c.close()
