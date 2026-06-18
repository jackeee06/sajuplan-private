"""qwert 비밀번호 해시 수정 — 쉘 $ 확장 문제 회피.
node 스크립트를 단일인용 heredoc 으로 서버에 기록 후 실행 (해시/SQL 모두 node 내부 처리)."""
import paramiko

HOST = '104.64.128.103'
DB_URL = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
API_DIR = '/data/wwwroot/api.sajumoon.co.kr'


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


# node 스크립트: 해싱 → UPDATE → compare 검증, 전부 node 내부에서 처리 (쉘 $ 확장 없음)
NODE_JS = f"""
const bcrypt = require('bcrypt');
const postgres = require('postgres');
const sql = postgres('{DB_URL}');
const PLAIN = 'qwert!!';
const MB_ID = 'qwert';
(async () => {{
  try {{
    const hash = await bcrypt.hash(PLAIN, 10);
    const upd = await sql`UPDATE member SET password = ${{hash}} WHERE mb_id = ${{MB_ID}} RETURNING id`;
    const rows = await sql`SELECT password FROM member WHERE mb_id = ${{MB_ID}}`;
    const stored = rows[0] ? rows[0].password : null;
    const ok = stored ? await bcrypt.compare(PLAIN, stored) : false;
    console.log('updated_id=' + (upd[0] && upd[0].id));
    console.log('stored_prefix=' + (stored ? stored.slice(0,10) : 'NULL'));
    console.log('compare=' + ok);
  }} catch (e) {{
    console.error('ERR', e.message);
  }} finally {{
    await sql.end();
  }}
}})();
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(HOST, 22, 'root', 'saju26moon@!!', timeout=15)
    # API 디렉터리 안에 기록 (node_modules 해석 위해) + 단일인용 heredoc 으로 $ 확장 방지
    target = f"{API_DIR}/_fix_qwert.js"
    write_cmd = f"cat > {target} <<'SAJUEOF'\n" + NODE_JS + "\nSAJUEOF"
    ssh_run(client, write_cmd)
    o, e, rc = ssh_run(client, f"cd {API_DIR} && node {target}")
    print("--- node 실행 결과 ---")
    print(o.strip())
    if e.strip(): print("stderr:", e.strip())
    ssh_run(client, f"rm -f {target}")
finally:
    client.close()
print("완료")
