"""qwert 계정 검증: (1) DB 해시 bcrypt.compare (2) 로그인 API 호출"""
import paramiko, json

HOST = '104.64.128.103'
DB_URL = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
API_DIR = '/data/wwwroot/api.sajumoon.co.kr'
MB_ID = 'qwert'
PLAIN_PW = 'qwert!!'


def ssh_run(client, cmd, timeout=30):
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
try:
    client.connect(HOST, 22, 'root', 'saju26moon@!!', timeout=15)

    # (1) DB 해시 직접 검증 — node bcrypt.compare. PW 는 파일에 안전하게 기록 후 읽기.
    pywrite = (
        f"cat > /tmp/_vpw.txt <<'EOF'\n{PLAIN_PW}\nEOF\n"
    )
    ssh_run(client, pywrite)
    node_cmd = (
        f"cd {API_DIR} && node -e \""
        f"const b=require('bcrypt'),fs=require('fs');"
        f"const pw=fs.readFileSync('/tmp/_vpw.txt','utf8').replace(/\\n$/,'');"
        f"const {{Client}}=require('pg');"  # pg may not exist; fallback below
        f"\" 2>/dev/null; echo SKIP_PG"
    )
    # 더 단순하게: psql 로 해시 가져와 node 로 compare
    o, e, _ = ssh_run(client, f"psql \"{DB_URL}\" -t -A -c \"SELECT password FROM member WHERE mb_id='{MB_ID}'\"")
    db_hash = o.strip().splitlines()[-1] if o.strip() else ''
    print("DB 해시:", db_hash[:20], "...")

    cmp_cmd = (
        f"cd {API_DIR} && node -e \""
        f"const b=require('bcrypt'),fs=require('fs');"
        f"const pw=fs.readFileSync('/tmp/_vpw.txt','utf8').replace(/\\n$/,'');"
        f"console.log('match=',b.compareSync(pw, process.argv[1]));"
        f"\" '{db_hash}'"
    )
    o, e, rc = ssh_run(client, cmp_cmd)
    print("bcrypt.compare 결과:", o.strip() or e.strip())

    # (2) 로그인 API 호출 — 서버 localhost 에서 직접 (히스토리확장/쉘 이슈 회피, JSON 파일 사용)
    payload = json.dumps({"mb_id": MB_ID, "password": PLAIN_PW})
    ssh_run(client, f"cat > /tmp/_login.json <<'EOF'\n{payload}\nEOF")
    # API 포트/프리픽스 자동: nginx 통하는 공인 도메인으로
    login_cmd = (
        "curl -s -o /tmp/_login_resp.txt -w 'HTTP=%{http_code}' "
        "-X POST https://api.sajuplan.com/api/admin/auth/login "
        "-H 'Content-Type: application/json' --data @/tmp/_login.json; "
        "echo; echo '---BODY---'; cat /tmp/_login_resp.txt"
    )
    o, e, rc = ssh_run(client, login_cmd)
    print("로그인 API:\n", o.strip() or e.strip())

    ssh_run(client, "rm -f /tmp/_vpw.txt /tmp/_login.json /tmp/_login_resp.txt")
finally:
    client.close()
print("완료")
