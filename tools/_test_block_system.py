import paramiko, sys, json, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

pw = 'saju26moon@!!'
DB = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
BASE = 'https://api.sajuplan.com/api'
ADMIN_COOKIE = '/tmp/test_admin.txt'
USER_COOKIE  = '/tmp/test_user.txt'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

def run(cmd):
    _, o, e = client.exec_command(cmd)
    out = o.read().decode('utf-8','replace').strip()
    err = e.read().decode('utf-8','replace').strip()
    return out, err

def jq(label, cmd):
    out, _ = run(cmd)
    print(f'\n=== {label} ===')
    try:
        parsed = json.loads(out)
        print(json.dumps(parsed, ensure_ascii=False, indent=2)[:400])
    except:
        print(out[:300])
    return out

def q(label, sql):
    out, _ = run(f'psql "{DB}" -t -c "{sql}"')
    print(f'=== {label} ===\n{out.strip()}\n')
    return out.strip()

# 테스트에 사용할 상담사와 회원 확인
q('테스트 상담사 (달시 qwerty)', "SELECT id, mb_id, nickname FROM member WHERE mb_id='qwerty' LIMIT 1")
q('테스트 회원 (위대한 홍휴)', "SELECT id, mb_id, name FROM member WHERE id=132 LIMIT 1")

# 1. 어드민 로그인
jq('1. 어드민 로그인',
   f'curl -s -X POST {BASE}/admin/auth/login '
   f'-H "Content-Type: application/json" '
   f'-d \'{{"mb_id":"jackee","password":"kunwoo77"}}\' '
   f'-c {ADMIN_COOKIE}')

time.sleep(0.5)

# 상담사 ID 조회
out, _ = run(f'psql "{DB}" -t -c "SELECT id FROM member WHERE mb_id=\'qwerty\' LIMIT 1"')
COUNSELOR_ID = out.strip()
MEMBER_ID = '132'
print(f'\n상담사 ID: {COUNSELOR_ID}, 회원 ID: {MEMBER_ID}')

# 2. 차단 목록 조회 (초기 빈 상태)
jq('2. 차단 목록 조회 (초기)',
   f'curl -s {BASE}/admin/members/counselors/{COUNSELOR_ID}/blocks -b {ADMIN_COOKIE}')

# 3. 회원 ID로 차단 추가
jq('3. 회원 ID로 차단 추가',
   f'curl -s -X POST {BASE}/admin/members/counselors/{COUNSELOR_ID}/blocks '
   f'-H "Content-Type: application/json" '
   f'-d \'{{"member_id":{MEMBER_ID},"reason":"테스트 차단"}}\' '
   f'-b {ADMIN_COOKIE}')

time.sleep(0.3)

# 4. 차단 목록 재조회
jq('4. 차단 목록 재조회',
   f'curl -s {BASE}/admin/members/counselors/{COUNSELOR_ID}/blocks -b {ADMIN_COOKIE}')

# 5. 회원으로 로그인 (홍휴)
jq('5. 홍휴 회원 로그인',
   f'curl -s -X POST {BASE}/user/auth/login '
   f'-H "Content-Type: application/json" '
   f'-d \'{{"mb_id":"4911399083_K","password":"saju1234"}}\' '
   f'-c {USER_COOKIE}')

time.sleep(0.3)

# 6. 차단 전 상담사 목록에서 달시 보이는지 (사실 이미 차단됐으므로 안 보여야 함)
jq('6. 회원 상담사 목록 조회 (달시 차단됨 → 안 보여야 함)',
   f'curl -s "{BASE}/user/counselors?tab=all&limit=50" -b {USER_COOKIE}')

# 7. 차단 해제
jq(f'7. 차단 해제 (member_id={MEMBER_ID})',
   f'curl -s -X DELETE {BASE}/admin/members/counselors/{COUNSELOR_ID}/blocks/{MEMBER_ID} '
   f'-b {ADMIN_COOKIE}')

time.sleep(0.3)

# 8. 차단 해제 후 목록 재조회
jq('8. 차단 해제 후 목록 (빈 상태 예상)',
   f'curl -s {BASE}/admin/members/counselors/{COUNSELOR_ID}/blocks -b {ADMIN_COOKIE}')

# 9. 전화번호로 차단 추가 테스트
jq('9. 전화번호로 차단 추가',
   f'curl -s -X POST {BASE}/admin/members/counselors/{COUNSELOR_ID}/blocks '
   f'-H "Content-Type: application/json" '
   f'-d \'{{"member_phone":"01089237232","reason":"전화번호 테스트"}}\' '
   f'-b {ADMIN_COOKIE}')

time.sleep(0.3)

# 10. 해제 후 상담사 목록에서 다시 보이는지
jq('10. 차단 해제 후 회원 상담사 목록 (달시 다시 보여야 함)',
   f'curl -s "{BASE}/user/counselors?tab=all&limit=50" -b {USER_COOKIE}')

# 최종 정리 - 테스트 차단 삭제
run(f'psql "{DB}" -c "DELETE FROM counselor_block WHERE counselor_id={COUNSELOR_ID} AND member_id={MEMBER_ID}"')
print('\n=== 테스트 차단 정리 완료 ===')

client.close()
