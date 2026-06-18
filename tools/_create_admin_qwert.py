"""일반관리자 계정 생성: qwert / qwert!! (member 테이블, role=admin, level=10, is_super=false)
현재 permissions.service.ts createAdmin 로직과 동일하게 INSERT.
bcrypt 해시는 prod api 의 node bcrypt 로 생성(코드와 동일 알고리즘)."""
import paramiko

HOST = '104.64.128.103'
DB_URL = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
API_DIR = '/data/wwwroot/api.sajumoon.co.kr'

MB_ID = 'qwert'
PLAIN_PW = 'qwert!!'
NAME = 'qwert'
NICK = 'qwert'


def ssh_run(client, cmd, timeout=30):
    chan = client.get_transport().open_session()
    chan.settimeout(timeout)
    chan.exec_command(cmd)
    chan.shutdown_write()
    out, err = b'', b''
    while not chan.exit_status_ready():
        if chan.recv_ready():
            out += chan.recv(4096)
        if chan.recv_stderr_ready():
            err += chan.recv_stderr(4096)
    while chan.recv_ready():
        out += chan.recv(4096)
    while chan.recv_stderr_ready():
        err += chan.recv_stderr(4096)
    code = chan.recv_exit_status()
    chan.close()
    return out.decode('utf-8', errors='replace'), err.decode('utf-8', errors='replace'), code


client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(HOST, 22, 'root', 'saju26moon@!!', timeout=15)
    print("SSH 연결 성공")

    # 0) member 컬럼 확인
    o, e, _ = ssh_run(client, f'psql "{DB_URL}" -c "SELECT column_name FROM information_schema.columns WHERE table_name=\'member\' AND column_name IN (\'mb_id\',\'password\',\'name\',\'nickname\',\'email\',\'phone\',\'role\',\'level\',\'is_super\',\'left_at\') ORDER BY 1"')
    print("--- member 컬럼 확인 ---\n", o.strip() or e.strip())

    # 1) 중복 체크
    o, e, _ = ssh_run(client, f"psql \"{DB_URL}\" -t -c \"SELECT id, role, level, is_super, left_at FROM member WHERE mb_id='{MB_ID}'\"")
    print("--- 기존 동일 mb_id ---\n", (o.strip() or '(없음)'), e.strip())
    if o.strip():
        print("!! 이미 mb_id 가 존재합니다. 중단. 수동 확인 필요.")
        raise SystemExit(0)

    # 2) bcrypt 해시 생성 (api 의 node bcrypt, 코드와 동일)
    node_cmd = (
        f"cd {API_DIR} && node -e \""
        f"const b=require('bcrypt');"
        f"console.log(b.hashSync('{PLAIN_PW}',10));\""
    )
    o, e, rc = ssh_run(client, node_cmd)
    pw_hash = o.strip().splitlines()[-1] if o.strip() else ''
    print("--- bcrypt 해시 ---\n", pw_hash, "| err:", e.strip(), "rc:", rc)
    if not pw_hash.startswith('$2'):
        print("!! 해시 생성 실패. 중단.")
        raise SystemExit(1)

    # 3) INSERT (createAdmin 과 동일: role=admin, level=10, is_super=false)
    ins = (
        f"psql \"{DB_URL}\" -c \"INSERT INTO member "
        f"(mb_id, password, name, nickname, role, level, is_super) "
        f"VALUES ('{MB_ID}', '{pw_hash}', '{NAME}', '{NICK}', 'admin', 10, false)\""
    )
    o, e, rc = ssh_run(client, ins)
    print("--- INSERT ---\n", o.strip() or e.strip(), "rc:", rc)

    # 4) 최종 확인
    o, e, _ = ssh_run(client, f"psql \"{DB_URL}\" -c \"SELECT id, mb_id, name, nickname, role, level, is_super, left_at FROM member WHERE mb_id='{MB_ID}'\"")
    print("--- 최종 확인 ---\n", o.strip() or e.strip())

except SystemExit:
    raise
except Exception as ex:
    print("오류:", ex)
finally:
    client.close()
print("완료")
