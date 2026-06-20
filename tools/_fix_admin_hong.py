"""hong 슈퍼관리자 비번 해시 재설정 (셸 !! 히스토리확장 회피: base64 전달) + 실제 로그인 API 검증."""
import base64, json, paramiko, urllib.request, urllib.error

HOST = '104.64.128.103'
DB_URL = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
API_DIR = '/data/wwwroot/api.sajumoon.co.kr'
LOGIN_URL = 'https://api.sajuplan.com/api/admin/auth/login'

MB_ID = 'hong'
PLAIN_PW = 'ara!!'
PW_B64 = base64.b64encode(PLAIN_PW.encode()).decode()  # 셸 안전


def ssh_run(client, cmd, timeout=40):
    chan = client.get_transport().open_session()
    chan.settimeout(timeout)
    chan.exec_command(cmd)
    chan.shutdown_write()
    out, err = b'', b''
    while not chan.exit_status_ready():
        if chan.recv_ready(): out += chan.recv(4096)
        if chan.recv_stderr_ready(): err += chan.recv_stderr(4096)
    while chan.recv_ready(): out += chan.recv(4096)
    while chan.recv_stderr_ready(): err += chan.recv_stderr(4096)
    code = chan.recv_exit_status(); chan.close()
    return out.decode('utf-8','replace'), err.decode('utf-8','replace'), code


client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, 'root', 'saju26moon@!!', timeout=15)
print("SSH OK | pw_b64 =", PW_B64)

# 1) base64 → 디코드 → hashSync (password 가 셸을 직접 거치지 않음)
node_hash = (
    f"cd {API_DIR} && node -e \""
    f"const b=require('bcrypt');"
    f"const pw=Buffer.from('{PW_B64}','base64').toString('utf8');"
    f"console.log(b.hashSync(pw,10));\""
)
o, e, rc = ssh_run(client, node_hash)
pw_hash = o.strip().splitlines()[-1] if o.strip() else ''
print("hash:", pw_hash, "| err:", e.strip(), "rc:", rc)
assert pw_hash.startswith('$2'), "해시 생성 실패"

# 2) UPDATE (해시는 $2b...로 특수문자 없음 → 셸 안전)
o, e, rc = ssh_run(client, f"psql \"{DB_URL}\" -c \"UPDATE member SET password='{pw_hash}' WHERE mb_id='{MB_ID}' AND role='admin'\"")
print("UPDATE:", o.strip() or e.strip(), "rc:", rc)

# 3) 서버측 bcrypt compare (base64 디코드한 값으로)
node_cmp = (
    f"cd {API_DIR} && node -e \""
    f"const b=require('bcrypt');"
    f"const pw=Buffer.from('{PW_B64}','base64').toString('utf8');"
    f"b.compare(pw, '{pw_hash}').then(r=>console.log('compare:',r));\""
)
o, e, _ = ssh_run(client, node_cmp)
print("compare:", o.strip(), e.strip())

client.close()

# 4) 실제 로그인 API 검증 (requests 없이 urllib — 셸/이스케이프 무관)
body = json.dumps({"mb_id": MB_ID, "password": PLAIN_PW}).encode()
req = urllib.request.Request(LOGIN_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        print("LOGIN HTTP", resp.status, resp.read().decode()[:300])
except urllib.error.HTTPError as he:
    print("LOGIN HTTP", he.code, he.read().decode()[:300])
print("완료")
