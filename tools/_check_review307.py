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
    # 후기 307: 작성자(member_id) / 대상 상담사(counselor_id)
    q(c,"SELECT id, board_type, member_id AS writer_id, counselor_id, status, created_at FROM post WHERE id=307","후기 307 (작성자/대상상담사)")
    # 작성자 정보
    q(c,"SELECT m.id, m.mb_id, m.nickname, m.name, m.phone, m.role FROM member m JOIN post p ON p.member_id=m.id WHERE p.id=307","후기 307 작성자")
    # 대상 상담사 정보 (= 알림톡 수신자)
    q(c,"SELECT m.id, m.mb_id, m.nickname, m.name, m.phone, m.role FROM member m JOIN post p ON p.counselor_id=m.id WHERE p.id=307","후기 307 대상 상담사 = 알림톡 수신자")
    # 대상 상담사 푸시토큰 OS
    q(c,"SELECT t.member_id, t.platform, count(*) FROM member_push_token t JOIN post p ON p.counselor_id=t.member_id WHERE p.id=307 GROUP BY 1,2","대상 상담사 푸시토큰 OS")
    # 알림톡 로그: review_for_counselor_v2 최근 20건
    q(c,"SELECT id, phone, template_code, success, error_reason, created_at FROM alimtalk_log WHERE template_code='review_for_counselor_v2' ORDER BY id DESC LIMIT 20","review_for_counselor_v2 알림톡 로그 최근20")
    # 선샤인(112) / 이심원(127) 신원 확인
    q(c,"SELECT id, mb_id, nickname, name, phone, role FROM member WHERE id IN (112,127) ORDER BY id","선샤인(112) vs 이심원(127) 신원")
finally:
    c.close()
print("\n완료")
