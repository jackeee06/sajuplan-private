import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

pw = 'saju26moon@!!'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

# .env에서 BizM/Kakao 관련 키 확인
_, o, _ = client.exec_command('grep -i "bizm\\|kakao\\|channel" /data/wwwroot/api.sajumoon.co.kr/.env | grep -v "SECRET\\|KEY\\|PASSWORD\\|TOKEN"')
print('=== env 카카오/BizM 설정 ===')
print(o.read().decode('utf-8','replace').strip())

# BizM 채널 ID (BIZM_USER_ID가 카카오 채널 ID임)
_, o, _ = client.exec_command('grep "BIZM_USER_ID\\|BIZM_SENDER\\|BIZM_CHANNEL\\|KAKAO_CHANNEL" /data/wwwroot/api.sajumoon.co.kr/.env')
print('\n=== BizM 채널 ID ===')
print(o.read().decode('utf-8','replace').strip())

client.close()
