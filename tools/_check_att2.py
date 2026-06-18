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
    # 오늘 KST 로그인한 회원 (last_login_at 오늘) + 가입경과일 + 오늘 출석여부
    q(c,"SELECT m.id, m.mb_id, m.role, m.created_at::date AS joined, "
        "(now() AT TIME ZONE 'Asia/Seoul')::date - m.created_at::date AS age_days, "
        "(m.last_login_at AT TIME ZONE 'Asia/Seoul')::date AS last_login_kst, "
        "EXISTS(SELECT 1 FROM member_attendance a WHERE a.member_id=m.id AND a.attended_date=(now() AT TIME ZONE 'Asia/Seoul')::date) AS attended_today "
        "FROM member m "
        "WHERE (m.last_login_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date "
        "ORDER BY m.last_login_at DESC LIMIT 30",
        "오늘 로그인한 회원 + 가입경과일(age_days<3=신규제한) + 오늘출석여부")
    # point_history 실제 컬럼명 확인
    q(c,"SELECT column_name FROM information_schema.columns WHERE table_name='point_history' AND column_name IN ('created_at','reg_date','updated_at','id') ORDER BY 1","point_history 날짜컬럼명")
finally:
    c.close()
print("\n완료")
