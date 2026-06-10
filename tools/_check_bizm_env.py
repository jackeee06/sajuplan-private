import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

pw = 'saju26moon@!!'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

_, o, _ = client.exec_command('grep -i "bizm" /data/wwwroot/api.sajumoon.co.kr/.env')
print('=== BizM 환경변수 ===')
print(o.read().decode('utf-8','replace').strip())

client.close()
