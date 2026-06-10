import paramiko, sys, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

pw = 'saju26moon@!!'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

# API 로그인 직접 테스트
cmd = """curl -s -X POST https://api.sajuplan.com/api/user/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mb_id":"aabbcc1","password":"saju1234"}' \
  -c /tmp/test_cookie.txt"""

_, o, e = client.exec_command(cmd)
resp = o.read().decode('utf-8', 'replace').strip()
print('=== 로그인 응답 ===')
try:
    parsed = json.loads(resp)
    print(json.dumps(parsed, ensure_ascii=False, indent=2))
except:
    print(resp)

client.close()
