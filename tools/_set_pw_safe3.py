import paramiko, sys, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
pw = 'saju26moon@!!'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

def run(cmd):
    _, o, e = client.exec_command(cmd)
    out = o.read().decode('utf-8','replace').strip()
    err = e.read().decode('utf-8','replace').strip()
    return out, err

# 1. 해시 생성
out, _ = run(
    "cd /data/wwwroot/api.sajumoon.co.kr && "
    "node -e \"const b=require('bcrypt');"
    "b.hash('saju1234',12).then(h=>{"
    "require('fs').writeFileSync('/tmp/pw_hash.txt',h);"
    "console.log('HASH:'+h)})\""
)
print(out[:80])
hash_line = [l for l in out.split('\n') if l.startswith('HASH:')]
if not hash_line:
    print('해시 생성 실패'); client.close(); sys.exit(1)

hash_val = hash_line[0][5:]
print(f'해시 길이: {len(hash_val)}, 시작: {hash_val[:7]}')

# 2. SQL 파일로 저장 후 실행 ($ 이스케이프 문제 완전 우회)
# Python이 hash_val을 직접 파일에 씀
sql_content = f"UPDATE member SET password='{hash_val}' WHERE id=125 RETURNING id, mb_id, name;\n"
sftp = client.open_sftp()
with sftp.open('/tmp/update_pw.sql', 'w') as f:
    f.write(sql_content)
sftp.close()

out, err = run(f'psql "{DB}" -f /tmp/update_pw.sql')
print('업데이트 결과:', out)
if err: print('ERR:', err)

# 3. 검증
out, _ = run(f'psql "{DB}" -t -c "SELECT length(password), left(password,7) FROM member WHERE id=125"')
print('저장된 해시 확인:', out)

time.sleep(1)

# 4. 로그인 API 테스트
out, _ = run(
    "curl -s -X POST https://api.sajuplan.com/api/user/auth/login "
    "-H 'Content-Type: application/json' "
    "-d '{\"mb_id\":\"aabbcc1\",\"password\":\"saju1234\"}'"
)
print('로그인 테스트:', out[:300])

client.close()
