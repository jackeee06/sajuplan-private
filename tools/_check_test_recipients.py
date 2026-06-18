import paramiko
HOST='104.64.128.103'
DB='postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
def run(c,cmd,t=30):
    ch=c.get_transport().open_session();ch.settimeout(t);ch.exec_command(cmd);ch.shutdown_write()
    o=b'';e=b''
    while not ch.exit_status_ready():
        if ch.recv_ready():o+=ch.recv(4096)
        if ch.recv_stderr_ready():e+=ch.recv_stderr(4096)
    while ch.recv_ready():o+=ch.recv(4096)
    while ch.recv_stderr_ready():e+=ch.recv_stderr(4096)
    ch.recv_exit_status();ch.close();return o.decode('utf-8','replace'),e.decode('utf-8','replace')
def q(c,s,t):
    o,e=run(c,f'psql "{DB}" -c "{s}"');print(f"\n=== {t} ===\n"+(o.strip() or e.strip()))
c=paramiko.SSHClient();c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST,22,'root','saju26moon@!!',timeout=15)
try:
    q(c,"SELECT id, mb_id, nickname, name, phone, role FROM member WHERE id IN (91,112,127) ORDER BY id","대상 신원 (91=jackee, 112=선샤인, 127=이심원)")
    q(c,"SELECT member_id, platform, is_active, count(*) FROM member_push_token WHERE member_id IN (91,112,127) GROUP BY 1,2,3 ORDER BY 1,2","푸시토큰 OS (91/112/127)")
finally:
    c.close()
print("done")
