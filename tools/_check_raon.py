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
    q(c,"SELECT id, mb_id, name, nickname, role, created_at::date AS joined, "
       "(now() AT TIME ZONE 'Asia/Seoul')::date - created_at::date AS age_days, "
       "(last_login_at AT TIME ZONE 'Asia/Seoul') AS last_login_kst "
       "FROM member WHERE nickname ILIKE '%라온%' OR name ILIKE '%라온%' OR mb_id='jackee' ORDER BY id",
       "라온선생 계정")
    q(c,"SELECT a.* FROM member_attendance a JOIN member m ON m.id=a.member_id "
       "WHERE m.nickname ILIKE '%라온%' OR m.name ILIKE '%라온%' OR m.mb_id='jackee' "
       "ORDER BY a.attended_date DESC LIMIT 10","라온선생 출석 이력")
finally:
    c.close()
print("\n완료")
