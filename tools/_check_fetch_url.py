import paramiko

pw = 'saju26moon@!!'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw)

# notifications/pending 앞 100글자
s,o,e = c.exec_command("grep -oP '.{0,100}notifications/pending' /data/wwwroot/sajumoon.co.kr/assets/index-CQx1Uz1z.js | head -3")
result = o.read().decode()
print("pending URL context:")
print(result)

# API_BASE 값
s,o,e = c.exec_command("grep -oP 'VITE_API_BASE.{0,60}' /data/wwwroot/sajumoon.co.kr/assets/index-CQx1Uz1z.js | head -3")
vite = o.read().decode()
print("VITE_API_BASE context:", vite or "(not found)")

# __SAJUMOON_ENV__ 치환 확인
s,o,e = c.exec_command("grep -c '__SAJUMOON_ENV__' /data/wwwroot/sajumoon.co.kr/index.html 2>/dev/null; grep -oP 'sajumoon_env.{0,30}' /data/wwwroot/sajumoon.co.kr/assets/index-CQx1Uz1z.js | head -3")
print("env:", o.read().decode())

c.close()
