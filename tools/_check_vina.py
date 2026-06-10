import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
pw = 'saju26moon@!!'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

def q(label, sql):
    _, o, e = client.exec_command(f'psql "{DB}" -t -c "{sql}"')
    print(f'=== {label} ===')
    print(o.read().decode('utf-8', 'replace').strip())
    err = e.read().decode('utf-8', 'replace').strip()
    if err: print('ERR:', err)
    print()

q('Vina 회원 상세', 'SELECT id, mb_id, role, phone, created_at FROM member WHERE id=153')
q('Vina 역대 신청 전수', "SELECT id, status, created_at FROM post_apply WHERE member_id=153 OR applicant_phone='01098395666' ORDER BY id")
q('Vina 등급 이력', 'SELECT id, grade_before, grade_after, changed_by, created_at FROM member_grade_history WHERE member_id=153 ORDER BY id')
q('Vina 상담사 상담 건수', 'SELECT COUNT(*) FROM consultation WHERE counselor_id=153')

client.close()
