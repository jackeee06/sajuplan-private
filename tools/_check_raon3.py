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
       "(last_login_at AT TIME ZONE 'Asia/Seoul') AS last_login_kst FROM member WHERE id=123","박기수(123) 계정")
    q(c,"SELECT id, target_kind, attended_date, base_coin, bonus_coin, consecutive_days, created_at FROM member_attendance WHERE member_id=123 ORDER BY attended_date DESC LIMIT 8","박기수 출석 이력")
    q(c,"SELECT member_id, free_balance, paid_balance, earning_balance, total_earned FROM point WHERE member_id=123","박기수 코인 잔액")
    q(c,"SELECT id, content, earn_point, balance_kind, rel_action, created_at FROM point_history WHERE member_id=123 ORDER BY id DESC LIMIT 6","박기수 최근 코인 내역")
finally:
    c.close()
print("\n완료")
