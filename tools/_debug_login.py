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

# 현재 DB 상태 확인
q('현재 password 해시 앞 30자',
  "SELECT id, mb_id, left(password,30) AS pw_start, intercept_until, left_at FROM member WHERE id=125")

# bcrypt 검증
_, o, _ = client.exec_command(
    "cd /data/wwwroot/api.sajumoon.co.kr && node -e \""
    "const bcrypt=require('bcrypt');"
    "const {Pool}=require('pg');"
    "const pool=new Pool({connectionString:process.env.DATABASE_URL});"
    "pool.query('SELECT password FROM member WHERE id=125').then(r=>{"
    "  const hash=r.rows[0].password;"
    "  bcrypt.compare('saju1234',hash).then(ok=>console.log('match:',ok)).catch(e=>console.log('err',e.message));"
    "}).catch(e=>console.log('db err',e.message))\""
)
result = o.read().decode('utf-8', 'replace').strip()
print(f'=== bcrypt 검증 ===\n{result}\n')

client.close()
