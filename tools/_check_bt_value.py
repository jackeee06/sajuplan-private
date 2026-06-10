import paramiko

pw = 'saju26moon@!!'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw)

# bt 변수값 — API_BASE 실제 값 찾기
s,o,e = c.exec_command(r"""grep -oP 'bt="https[^"]*"' /data/wwwroot/sajumoon.co.kr/assets/index-CQx1Uz1z.js | head -3""")
print("bt value:", o.read().decode())

# sajuplan.com 도메인 포함된 URL 전체
s,o,e = c.exec_command(r"""grep -oP '"https://api\.sajuplan\.com[^"]{0,30}"' /data/wwwroot/sajumoon.co.kr/assets/index-CQx1Uz1z.js | sort -u | head -5""")
print("api URLs in JS:", o.read().decode())

c.close()
