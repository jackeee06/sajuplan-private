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
    q(c,"SELECT column_name FROM information_schema.columns WHERE table_name='post_review' ORDER BY 1","post_review 컬럼")
    q(c,"SELECT id, member_id AS writer, counselor_id, created_at FROM post_review WHERE id=307","후기 307 (작성자/대상상담사)")
    q(c,"SELECT m.id, m.nickname, m.name, m.phone, m.role FROM member m JOIN post_review r ON r.counselor_id=m.id WHERE r.id=307","후기307 대상 상담사 = 알림톡 수신자")
    q(c,"SELECT id, phone, success, error_reason, sent_at FROM alimtalk_log WHERE template_code='review_for_counselor_v2' ORDER BY id DESC LIMIT 15","review_for_counselor_v2 발송로그 최근15")
    q(c,"SELECT platform, count(*) FROM member_push_token WHERE member_id=112 GROUP BY 1","선샤인(112) 푸시토큰 OS")
finally:
    c.close()
print("done")
