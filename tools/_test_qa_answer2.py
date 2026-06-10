import paramiko, sys, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
pw = 'saju26moon@!!'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

def q(label, sql):
    _, o, _ = client.exec_command(f'psql "{DB}" -t -c "{sql}"')
    out = o.read().decode('utf-8','replace').strip()
    print(f'=== {label} ===\n{out}\n')
    return out

# BizM 설정 조회
q('BizM 관련 env', "SELECT 'check'")

# BIZM_USER_ID 확인
_, o, _ = client.exec_command('grep BIZM_USER_ID /data/wwwroot/api.sajumoon.co.kr/.env')
bizm_user_id = o.read().decode('utf-8','replace').strip().split('=',1)[-1].strip()
print(f'BIZM_USER_ID: {bizm_user_id[:8]}...\n')

# alimtalk_template에서 qa_answer_v2 조회
_, o, _ = client.exec_command(f'psql "{DB}" -t -c "SELECT template_code, primary_btn_type, primary_btn_url FROM alimtalk_template WHERE template_code=\'qa_answer_v2\'"')
print(f'=== qa_answer_v2 템플릿 ===\n{o.read().decode("utf-8","replace").strip()}\n')

# Node.js에서 API 앱 경로로 직접 실행
cmd = f'''cd /data/wwwroot/api.sajumoon.co.kr/dist && node -e "
const https = require('https');

const payload = JSON.stringify([{{
  message_type: 'at',
  phone: '01075740572',
  template_code: 'qa_answer_v2',
  message: JSON.stringify({{
    고객명: '찬물선생',
    상담사명: '라온선생',
    문의링크: 'mypage/my-qnas/283'
  }}),
  resend_type: 'N'
}}]);

const options = {{
  hostname: 'alimtalk-api.bizmsg.kr',
  port: 443,
  path: '/v2/sender/send',
  method: 'POST',
  headers: {{
    'Content-Type': 'application/json',
    'userid': '{bizm_user_id}',
    'Content-Length': Buffer.byteLength(payload)
  }}
}};

const req = https.request(options, (res) => {{
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('응답:', data));
}});
req.on('error', e => console.log('에러:', e.message));
req.write(payload);
req.end();
"
'''

_, o, e = client.exec_command(cmd)
print('=== BizM 발송 결과 ===')
print(o.read().decode('utf-8','replace').strip())
err = e.read().decode('utf-8','replace').strip()
if err and 'DeprecationWarning' not in err: print('ERR:', err[:200])

client.close()
