import paramiko, re

pw = 'saju26moon@!!'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw)

s,o,e = c.exec_command("cat /data/wwwroot/sajumoon.co.kr/assets/index-CQx1Uz1z.js | grep -o 'grade_upgraded' | wc -l")
count = o.read().decode().strip()
print(f"grade_upgraded 등장 횟수: {count}")

# grade_upgraded 주변 코드 (50자씩)
s,o,e = c.exec_command("grep -o '.\\{0,60\\}grade_upgraded.\\{0,60\\}' /data/wwwroot/sajumoon.co.kr/assets/index-CQx1Uz1z.js | head -5")
print(f"grade_upgraded 컨텍스트:\n{o.read().decode()}")

# 현재 enqueue 로그 (발화 흔적)
s,o,e = c.exec_command("tail -100 ~/.pm2/logs/sajumoon-api-out.log 2>/dev/null | grep 'enqueue' | tail -5")
print(f"최근 enqueue 로그:\n{o.read().decode() or '(없음)'}")

c.close()
