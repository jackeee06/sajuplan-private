import paramiko, sys, time, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

pw = 'saju26moon@!!'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

def curl(label, cmd):
    _, o, _ = client.exec_command(cmd)
    out = o.read().decode('utf-8','replace').strip()
    print(f'\n[{label}]')
    try:
        print(json.dumps(json.loads(out), ensure_ascii=False, indent=2)[:300])
    except:
        print(out[:300])
    return out

BASE = 'https://api.sajuplan.com/api/user/auth'
COOKIE = '/tmp/test_aabbcc1.txt'

# 1. 로그인
curl('1. 로그인 (saju1234)',
    f'curl -s -X POST {BASE}/login -H "Content-Type: application/json" '
    f'-d \'{{"mb_id":"aabbcc1","password":"saju1234"}}\' -c {COOKIE}')

time.sleep(0.5)

# 2. 유효한 비밀번호로 변경 (8자+영문+숫자)
curl('2. 비밀번호 변경 → Test1234',
    f'curl -s -X POST {BASE}/me/password -H "Content-Type: application/json" '
    f'-d \'{{"current_password":"saju1234","new_password":"Test1234"}}\' -b {COOKIE}')

time.sleep(0.5)

# 3. 새 비밀번호로 로그인 확인
curl('3. 새 비밀번호(Test1234)로 로그인',
    f'curl -s -X POST {BASE}/login -H "Content-Type: application/json" '
    f'-d \'{{"mb_id":"aabbcc1","password":"Test1234"}}\' -c {COOKIE}')

time.sleep(0.5)

# 4. 다시 saju1234로 복원
curl('4. saju1234 로 복원',
    f'curl -s -X POST {BASE}/me/password -H "Content-Type: application/json" '
    f'-d \'{{"current_password":"Test1234","new_password":"saju1234"}}\' -b {COOKIE}')

time.sleep(0.5)

# 5. saju1234 로그인 최종 확인
curl('5. 복원 후 saju1234 로그인 확인',
    f'curl -s -X POST {BASE}/login -H "Content-Type: application/json" '
    f'-d \'{{"mb_id":"aabbcc1","password":"saju1234"}}\' -c {COOKIE}')

# 6. 정책 위반 케이스 테스트
print('\n--- 정책 위반 케이스 ---')
# 6a. 7자 (너무 짧음)
curl('6a. 7자 비밀번호 (실패 예상)',
    f'curl -s -X POST {BASE}/me/password -H "Content-Type: application/json" '
    f'-d \'{{"current_password":"saju1234","new_password":"abc1234"}}\' -b {COOKIE}')
# 6b. 숫자만
curl('6b. 숫자만 (실패 예상)',
    f'curl -s -X POST {BASE}/me/password -H "Content-Type: application/json" '
    f'-d \'{{"current_password":"saju1234","new_password":"12345678"}}\' -b {COOKIE}')
# 6c. 현재 비밀번호 틀림
curl('6c. 현재 비밀번호 틀림 (실패 예상)',
    f'curl -s -X POST {BASE}/me/password -H "Content-Type: application/json" '
    f'-d \'{{"current_password":"wrongpw1","new_password":"NewPass12"}}\' -b {COOKIE}')

client.close()
print('\n=== 테스트 완료 ===')
