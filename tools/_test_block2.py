import paramiko, sys, json, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

pw = 'saju26moon@!!'
DB = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
BASE = 'https://api.sajuplan.com/api'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

def q(label, sql):
    _, o, _ = client.exec_command(f'psql "{DB}" -t -c "{sql}"')
    out = o.read().decode('utf-8','replace').strip()
    print(f'=== {label} ===\n{out}\n')
    return out

def curl(label, cmd):
    _, o, _ = client.exec_command(cmd)
    out = o.read().decode('utf-8','replace').strip()
    print(f'\n=== {label} ===')
    try:
        d = json.loads(out)
        if isinstance(d, dict) and 'items' in d:
            ids = [i.get('id') for i in d['items']]
            names = [f"{i.get('nickname')}(id={i.get('id')})" for i in d['items'][:8]]
            has_dalsi = 139 in [int(x) for x in ids]
            print(f"달시(id=139) 포함: {'✅' if has_dalsi else '❌ (차단됨)'}")
            print(f"목록({len(d['items'])}명): {', '.join(names)}")
        else:
            print(json.dumps(d, ensure_ascii=False)[:300])
    except:
        print(out[:200])
    return out

# aabbcc1(시온) 비번 saju1234 로 테스트
TESTER_COOKIE = '/tmp/test_sion.txt'
COUNSELOR_ID = 139   # 달시 차단자
TESTER_ID = 125      # 시온 = 차단당할 회원

# 1. 시온으로 로그인 (saju1234)
curl('1. 시온(aabbcc1) 로그인',
     f'curl -s -X POST {BASE}/user/auth/login '
     f'-H "Content-Type: application/json" '
     f'-d \'{{"mb_id":"aabbcc1","password":"saju1234"}}\' '
     f'-c {TESTER_COOKIE}')

time.sleep(0.3)

# 2. 로그인 상태에서 상담사 목록 (달시 보여야 함)
curl('2. 로그인 후 상담사 목록 (달시 보여야 함)',
     f'curl -s "{BASE}/user/counselors?tab=all&limit=50" -b {TESTER_COOKIE}')

# 3. 달시가 시온(aabbcc1)을 차단
q('3. 달시가 시온(aabbcc1) 차단',
  f"INSERT INTO counselor_block (counselor_id, member_id, reason) "
  f"VALUES ({COUNSELOR_ID},{TESTER_ID},'E2E 테스트 차단') "
  f"ON CONFLICT DO NOTHING RETURNING id")

time.sleep(0.3)

# 4. 로그인 상태에서 상담사 목록 (달시 안 보여야 함 ← 핵심!)
curl('4. 차단 후 상담사 목록 (달시 ❌ 안 보여야 함)',
     f'curl -s "{BASE}/user/counselors?tab=all&limit=50" -b {TESTER_COOKIE}')

# 5. 차단 해제
q('5. 차단 해제',
  f'DELETE FROM counselor_block WHERE counselor_id={COUNSELOR_ID} AND member_id={TESTER_ID} RETURNING id')

time.sleep(0.3)

# 6. 해제 후 목록 (달시 다시 보여야 함)
curl('6. 해제 후 상담사 목록 (달시 ✅ 다시 보여야 함)',
     f'curl -s "{BASE}/user/counselors?tab=all&limit=50" -b {TESTER_COOKIE}')

# 7. 검색에서도 확인
q('7. 차단 재추가 (검색 테스트용)',
  f"INSERT INTO counselor_block (counselor_id, member_id, reason) "
  f"VALUES ({COUNSELOR_ID},{TESTER_ID},'검색 테스트') "
  f"ON CONFLICT DO NOTHING RETURNING id")

time.sleep(0.3)

curl('8. 검색에서도 달시 ❌ 안 보여야 함',
     f'curl -s "{BASE}/user/counselors/search?q=달시" -b {TESTER_COOKIE}')

q('9. 최종 정리',
  f'DELETE FROM counselor_block WHERE counselor_id={COUNSELOR_ID} AND member_id={TESTER_ID}')

client.close()
print('\n=== 테스트 완료 ===')
