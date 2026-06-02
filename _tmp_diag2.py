"""payment 19 + 상담사 단가 + m2net 잔액 확인."""
import paramiko
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=os.environ['SSHPASS'], timeout=20)

queries = [
    ("payment 19 전체 (충전 성공 + m2net 적립 상태)",
     "SELECT id, oid, pay_method, status, m2net_status, m2net_retry_count, amount, coin_amount, "
     "LEFT(COALESCE(result_message, '-'), 80) AS msg, created_at::timestamp(0) "
     "FROM payment WHERE id = 19;"),
    ("payment 컬럼 목록",
     "SELECT column_name FROM information_schema.columns WHERE table_name = 'payment' AND column_name LIKE '%complet%' OR column_name LIKE '%m2net%' ORDER BY column_name;"),
    ("INSUFFICIENT 통화의 cpid/dtmfno 추적 (상담사 호출 번호)",
     "SELECT id, callid, cpid, dtmfno, callee_phone, caller_phone, member_id, counselor_id, csrid "
     "FROM consultation WHERE id IN (141, 144) ORDER BY id;"),
    ("ubub1234가 호출한 상담사 단가",
     "SELECT id, mb_id, name, csrid, call_070_unit_cost, call_unit_seconds, "
     "chat_unit_cost, chat_unit_seconds "
     "FROM member WHERE role = 'counselor' ORDER BY id LIMIT 10;"),
    ("ubub1234 m2net_membid 296611 다른 회원 매핑 충돌 검사",
     "SELECT id, mb_id, name, m2net_membid FROM member WHERE m2net_membid = '296611';"),
    ("retry-cron 영구실패한 payment 있는지",
     "SELECT id, oid, status, m2net_status, m2net_retry_count, amount, "
     "LEFT(COALESCE(result_message, '-'), 60) "
     "FROM payment WHERE member_id = 136 ORDER BY id DESC LIMIT 5;"),
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
