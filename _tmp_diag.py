"""ubub1234 / 01066633914 잔액 부족 진단."""
import paramiko
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=os.environ['SSHPASS'], timeout=20)

queries = [
    ("회원 정보 (mb_id LIKE ubub1234 또는 phone 01066633914)",
     "SELECT id, mb_id, name, nickname, phone, m2net_membid, csrid, role, point AS dp_balance, created_at::date "
     "FROM member "
     "WHERE mb_id ILIKE '%ubub1234%' OR mb_id ILIKE '%ubuub1234%' OR phone = '01066633914' OR phone = '010-6663-3914' "
     "ORDER BY id;"),
    ("point 테이블 잔액 (free/paid/earning)",
     "SELECT p.member_id, m.mb_id, p.free_balance, p.paid_balance, p.earning_balance, p.total_earned, p.total_used "
     "FROM point p JOIN member m ON m.id = p.member_id "
     "WHERE m.mb_id ILIKE '%ubub1234%' OR m.mb_id ILIKE '%ubuub1234%' OR m.phone = '01066633914' OR m.phone = '010-6663-3914';"),
    ("최근 payment 10건",
     "SELECT p.id, p.oid, p.pay_method, p.status, p.m2net_status, p.amount, p.coin_amount, p.created_at::timestamp(0), p.completed_at::timestamp(0) "
     "FROM payment p JOIN member m ON m.id = p.member_id "
     "WHERE m.mb_id ILIKE '%ubub1234%' OR m.mb_id ILIKE '%ubuub1234%' OR m.phone = '01066633914' OR m.phone = '010-6663-3914' "
     "ORDER BY p.created_at DESC LIMIT 10;"),
    ("최근 point_history 15건",
     "SELECT ph.id, ph.content, ph.earn_point, ph.use_point, ph.balance_after, ph.rel_table, ph.rel_id, ph.created_at::timestamp(0) "
     "FROM point_history ph JOIN member m ON m.id = ph.member_id "
     "WHERE m.mb_id ILIKE '%ubub1234%' OR m.mb_id ILIKE '%ubuub1234%' OR m.phone = '01066633914' OR m.phone = '010-6663-3914' "
     "ORDER BY ph.created_at DESC LIMIT 15;"),
    ("최근 consultation (사용 내역) 10건",
     "SELECT c.id, c.callid, c.roomid, c.reason, c.usetm, c.amt, c.amt_free, c.amt_pro, c.started_at::timestamp(0), c.ended_at::timestamp(0) "
     "FROM consultation c JOIN member m ON m.id = c.member_id "
     "WHERE m.mb_id ILIKE '%ubub1234%' OR m.mb_id ILIKE '%ubuub1234%' OR m.phone = '01066633914' OR m.phone = '010-6663-3914' "
     "ORDER BY c.created_at DESC LIMIT 10;"),
    ("payment_method (자동결제 등록)",
     "SELECT pm.id, pm.member_id, pm.card_no_masked, pm.amount, pm.auto_enabled, pm.is_active, pm.registered_at::timestamp(0) "
     "FROM payment_method pm JOIN member m ON m.id = pm.member_id "
     "WHERE m.mb_id ILIKE '%ubub1234%' OR m.mb_id ILIKE '%ubuub1234%' OR m.phone = '01066633914' OR m.phone = '010-6663-3914';"),
]

for label, q in queries:
    cmd = 'sudo -u postgres psql sajumoon -c ' + repr(q)
    _, stdout, stderr = c.exec_command(cmd)
    print(f'\n=== {label} ===')
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print('ERR:', err[:200])
c.close()
