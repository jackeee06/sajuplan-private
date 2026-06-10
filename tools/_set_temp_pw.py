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

# 1. 회원 확인
q('01064789992 회원 조회',
  "SELECT id, mb_id, name, nickname, role, phone FROM member WHERE regexp_replace(phone,'[^0-9]','','g')='01064789992' AND left_at IS NULL")

# 2. bcrypt로 1234 해시 생성 후 업데이트
# Node.js로 bcrypt 해시 생성
_, o, e = client.exec_command(
    "node -e \"const bcrypt=require('bcrypt'); bcrypt.hash('1234',12).then(h=>console.log(h))\""
)
hash_val = o.read().decode('utf-8', 'replace').strip()
print(f'=== bcrypt hash ===\n{hash_val}\n')

if hash_val.startswith('$2b$'):
    # 업데이트
    update_sql = f"UPDATE member SET password='{hash_val}' WHERE regexp_replace(phone,'[^0-9]','','g')='01064789992' AND left_at IS NULL RETURNING id, mb_id, name"
    q('비밀번호 업데이트', update_sql)
else:
    print('해시 생성 실패:', hash_val)
    print('ERR:', e.read().decode('utf-8', 'replace'))

client.close()
