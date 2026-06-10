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

q('회원 조회',
  "SELECT id, mb_id, name, nickname, role, phone, created_at FROM member WHERE regexp_replace(phone,'[^0-9]','','g')='01089237232' LIMIT 5")

q('최근 상담 이력',
  """SELECT c.id, c.reason, c.usetm, c.amt, c.created_at,
            m.mb_id AS member_id, m.name AS member_name,
            cs.mb_id AS counselor_mbid, cs.nickname AS counselor_name
     FROM consultation c
     LEFT JOIN member m ON m.id = c.member_id
     LEFT JOIN member cs ON cs.id = c.counselor_id
     WHERE regexp_replace(m.phone,'[^0-9]','','g')='01089237232'
        OR regexp_replace(cs.phone,'[^0-9]','','g')='01089237232'
     ORDER BY c.created_at DESC LIMIT 5""")

client.close()
