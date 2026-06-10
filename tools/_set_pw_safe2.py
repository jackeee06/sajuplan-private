import paramiko, sys, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
pw = 'saju26moon@!!'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

# 1. Node.js로 해시 생성 → 파일 저장
_, o, _ = client.exec_command(
    "cd /data/wwwroot/api.sajumoon.co.kr && node -e "
    "\"const b=require('bcrypt');b.hash('saju1234',12).then(h=>{"
    "require('fs').writeFileSync('/tmp/pw_hash.txt',h);console.log(h.length)})\""
)
print('해시생성:', o.read().decode().strip())

# 2. 해시를 Node.js로 직접 DB 업데이트 ($ 이스케이프 걱정 없음)
_, o, e = client.exec_command(
    "cd /data/wwwroot/api.sajumoon.co.kr && node -e \""
    "const {Pool}=require('pg');"
    "const pool=new Pool({connectionString:process.env.DATABASE_URL});"
    "const h=require('fs').readFileSync('/tmp/pw_hash.txt','utf8').trim();"
    "pool.query('UPDATE member SET password=$1 WHERE id=125 RETURNING mb_id,name',[h])"
    ".then(r=>{console.log('updated:',JSON.stringify(r.rows[0]));pool.end()})"
    ".catch(e=>{console.log('err:',e.message);pool.end()})\""
)
print('DB업데이트:', o.read().decode().strip())

time.sleep(2)

# 3. 로그인 API 테스트
_, o, _ = client.exec_command(
    "curl -s -X POST https://api.sajuplan.com/api/user/auth/login "
    "-H 'Content-Type: application/json' "
    "-d '{\"mb_id\":\"aabbcc1\",\"password\":\"saju1234\"}'"
)
result = o.read().decode('utf-8', 'replace').strip()
print('로그인테스트:', result[:200])

client.close()
