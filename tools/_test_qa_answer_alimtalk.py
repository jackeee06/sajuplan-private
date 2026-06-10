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

# jackee 폰번호 + 최근 QnA ID 확인
q('jackee 정보', "SELECT id, mb_id, phone FROM member WHERE mb_id='jackee' LIMIT 1")
q('jackee 관련 최근 QnA', "SELECT id FROM counselor_qna WHERE member_id=91 OR counselor_id=91 ORDER BY id DESC LIMIT 3")

# BizM 직접 발송 (Node.js로 sms.service 우회)
cmd = '''cd /data/wwwroot/api.sajumoon.co.kr && node -e "
const {Pool} = require('pg');
const axios = require('axios');
require('dotenv').config();

const pool = new Pool({connectionString: process.env.DATABASE_URL});

async function main() {
  // BizM 설정 조회
  const cfg = await pool.query(\\"SELECT key, value FROM setting WHERE namespace='bizm'\\"  );
  const map = {};
  cfg.rows.forEach(r => map[r.key] = r.value);

  const bizm_url = 'https://alimtalk-api.bizmsg.kr/v2/sender/send';
  const user_id = process.env.BIZM_USER_ID;

  console.log('BIZM_USER_ID:', user_id ? user_id.substring(0,5)+'...' : '없음');

  // alimtalk_template에서 qa_answer_v2 조회
  const tpl = await pool.query(\\"SELECT template_code, primary_btn_type, primary_btn_url FROM alimtalk_template WHERE template_code='qa_answer_v2' LIMIT 1\\");
  console.log('template:', JSON.stringify(tpl.rows[0]));

  const payload = {
    message_type: 'at',
    phone: '01075740572',
    template_code: 'qa_answer_v2',
    message: JSON.stringify({
      \\"고객명\\": \\"찬물선생\\",
      \\"상담사명\\": \\"테스트상담사\\",
      \\"문의링크\\": \\"mypage/my-qnas/999\\"
    }),
    resend_type: 'N'
  };

  try {
    const res = await axios.post(bizm_url, [payload], {
      headers: {
        'Content-Type': 'application/json',
        'userid': user_id
      }
    });
    console.log('BizM 응답:', JSON.stringify(res.data));
  } catch(e) {
    console.log('에러:', e.message);
    if (e.response) console.log('응답:', JSON.stringify(e.response.data));
  }

  await pool.end();
}
main().catch(e => { console.log('main 에러:', e.message); process.exit(1); });
"
'''

_, o, e = client.exec_command(cmd)
print('=== 알림톡 발송 테스트 ===')
print(o.read().decode('utf-8','replace'))
err = e.read().decode('utf-8','replace').strip()
if err: print('STDERR:', err[:300])

client.close()
