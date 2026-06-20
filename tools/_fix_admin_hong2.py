"""hong 비번 해시를 'node 파일 내부'에서 생성·UPDATE·검증 (셸 $ 확장 함정 완전 회피).
파일은 SFTP로 업로드 → node 실행 → 실제 로그인 API 재검증."""
import base64, json, paramiko, urllib.request, urllib.error

HOST = '104.64.128.103'
DB_URL = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
API_DIR = '/data/wwwroot/api.sajumoon.co.kr'
LOGIN_URL = 'https://api.sajuplan.com/api/admin/auth/login'
MB_ID = 'hong'
PLAIN_PW = 'ara!!'
PW_B64 = base64.b64encode(PLAIN_PW.encode()).decode()
REMOTE_JS = '/data/wwwroot/api.sajumoon.co.kr/_mk_hong.js'  # API_DIR 안이라야 node_modules(bcrypt) 해석됨

JS = f"""
const bcrypt = require('bcrypt');
let postgres;
try {{ postgres = require('postgres'); }} catch (e) {{ postgres = null; }}
(async () => {{
  const pw = Buffer.from('{PW_B64}', 'base64').toString('utf8');
  const hash = bcrypt.hashSync(pw, 10);
  const cmp = await bcrypt.compare(pw, hash);
  if (!postgres) {{ console.log(JSON.stringify({{err:'no postgres module'}})); return; }}
  const sql = postgres('{DB_URL}');
  await sql`UPDATE member SET password=${{hash}} WHERE mb_id='{MB_ID}' AND role='admin'`;
  const row = await sql`SELECT id, mb_id, name, role, is_super, left(password,4) AS pw4, left_at FROM member WHERE mb_id='{MB_ID}'`;
  console.log(JSON.stringify({{ compare: cmp, hashHead: hash.slice(0,4), row: row[0] }}));
  await sql.end();
}})().catch(e => {{ console.log(JSON.stringify({{err: String(e)}})); }});
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, 'root', 'saju26moon@!!', timeout=15)

# SFTP 업로드 (셸 미경유)
sftp = client.open_sftp()
with sftp.open(REMOTE_JS, 'w') as f:
    f.write(JS)
sftp.close()
print("JS 업로드 완료:", REMOTE_JS)

# 실행
chan = client.get_transport().open_session(); chan.settimeout(40)
chan.exec_command(f'cd {API_DIR} && node {REMOTE_JS}')
chan.shutdown_write()
out = b''
while not chan.exit_status_ready() or chan.recv_ready():
    if chan.recv_ready(): out += chan.recv(4096)
    elif chan.exit_status_ready(): break
err = b''
while chan.recv_stderr_ready(): err += chan.recv_stderr(4096)
print("node out:", out.decode('utf-8','replace').strip())
if err.strip(): print("node err:", err.decode('utf-8','replace').strip()[:500])

# 정리
client.exec_command(f'rm -f {REMOTE_JS}')
client.close()

# 실제 로그인 API 검증
body = json.dumps({"mb_id": MB_ID, "password": PLAIN_PW}).encode()
req = urllib.request.Request(LOGIN_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        print("LOGIN HTTP", resp.status, "->", json.loads(resp.read().decode()).get('mb_id'), "OK")
except urllib.error.HTTPError as he:
    print("LOGIN HTTP", he.code, he.read().decode('utf-8','replace')[:200])
print("완료")
