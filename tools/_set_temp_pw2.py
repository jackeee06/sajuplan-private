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

# API 경로에서 bcrypt 사용
_, o, e = client.exec_command(
    "cd /data/wwwroot/api.sajumoon.co.kr && node -e \"const bcrypt=require('bcrypt'); bcrypt.hash('1234',12).then(h=>console.log(h))\""
)
hash_val = o.read().decode('utf-8', 'replace').strip()
print(f'=== bcrypt hash ===\n{hash_val}\n')

if hash_val.startswith('$2b$'):
    q('비밀번호 업데이트',
      f"UPDATE member SET password='{hash_val}' WHERE regexp_replace(phone,'[^0-9]','','g')='01064789992' AND left_at IS NULL RETURNING id, mb_id, name, nickname")
else:
    print('ERR:', e.read().decode('utf-8','replace'))

client.close()
