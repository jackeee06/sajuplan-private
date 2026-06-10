import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
pw = 'saju26moon@!!'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

# 해시를 파일에 저장 ($ 이스케이프 문제 우회)
_, o, e = client.exec_command(
    "cd /data/wwwroot/api.sajumoon.co.kr && node -e "
    "\"const bcrypt=require('bcrypt'); "
    "bcrypt.hash('saju1234',12).then(h=>{ "
    "require('fs').writeFileSync('/tmp/pw_hash.txt',h); "
    "console.log('ok',h.length) })\" "
)
print('해시 생성:', o.read().decode().strip())

# 파일에서 해시 읽기
_, o, _ = client.exec_command("cat /tmp/pw_hash.txt")
hash_val = o.read().decode().strip()
print(f'해시 확인: {hash_val[:10]}... (길이: {len(hash_val)})')

# psql stdin으로 SQL 전달 ($ 이스케이프 불필요)
sql = f"UPDATE member SET password='{hash_val}' WHERE id=125 RETURNING id, mb_id, name;"
_, o, e = client.exec_command(f'psql "{DB}" -t', get_pty=False)
o._channel.sendall(sql.encode() + b'\n')
o._channel.shutdown_write()
result = o.read().decode('utf-8', 'replace').strip()
print(f'업데이트 결과: {result}')

# 저장된 길이 검증
_, o, _ = client.exec_command(f'psql "{DB}" -t -c "SELECT length(password) FROM member WHERE id=125"')
print(f'저장된 길이: {o.read().decode().strip()}')

# 로그인 테스트
import time
time.sleep(1)
_, o, _ = client.exec_command(
    "curl -s -X POST https://api.sajuplan.com/api/user/auth/login "
    "-H 'Content-Type: application/json' "
    "-d '{\"mb_id\":\"aabbcc1\",\"password\":\"saju1234\"}'"
)
print(f'로그인 테스트: {o.read().decode("utf-8","replace").strip()}')

client.close()
