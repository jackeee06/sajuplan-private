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
    print(f'=== {label} ===')
    try:
        d = json.loads(out)
        # 상담사 목록이면 이름/id만
        if isinstance(d, dict) and 'items' in d:
            names = [f"{i.get('nickname','?')}(id={i.get('id')})" for i in d['items'][:5]]
            print(f"총 {len(d['items'])}명: {', '.join(names)}")
        else:
            print(json.dumps(d, ensure_ascii=False)[:300])
    except:
        print(out[:200])
    return out

COUNSELOR_ID = 139   # 달시(qwerty)
MEMBER_ID    = 132   # 위대한(홍휴)

# 상태 확인
q('counselor_block 테이블 현재', f'SELECT COUNT(*) FROM counselor_block WHERE counselor_id={COUNSELOR_ID}')

# ── 1. 비로그인 상태로 상담사 목록 (달시가 보여야 함) ──
curl('1. 비로그인 상담사 목록 (달시 포함 예상)',
     f'curl -s "{BASE}/user/counselors?tab=all&limit=20"')

# ── 2. DB에 직접 차단 INSERT ──
q('2. 차단 추가 (DB 직접)',
  f"INSERT INTO counselor_block (counselor_id, member_id, reason) "
  f"VALUES ({COUNSELOR_ID},{MEMBER_ID},'E2E 테스트') "
  f"ON CONFLICT DO NOTHING RETURNING id")

q('차단 확인', f'SELECT id, counselor_id, member_id, reason FROM counselor_block WHERE counselor_id={COUNSELOR_ID}')

# ── 3. 로그인 회원으로 목록 조회 (달시 안 보여야 함) ──
# 홍휴 로그인 (카카오 소셜 계정 - 비밀번호 없음, jackee 사용)
JACKEE_COOKIE = '/tmp/test_jackee.txt'
curl('3. jackee 로그인 (사장님 계정)',
     f'curl -s -X POST {BASE}/user/auth/login '
     f'-H "Content-Type: application/json" '
     f'-d \'{{"mb_id":"jackee","password":"saju26moon@!"}}\' '
     f'-c {JACKEE_COOKIE}')

# jackee(id=91)를 member_id로 차단도 추가 테스트
q('jackee 차단도 추가',
  f"INSERT INTO counselor_block (counselor_id, member_id, reason) "
  f"VALUES ({COUNSELOR_ID},91,'jackee 테스트') "
  f"ON CONFLICT DO NOTHING RETURNING id")

curl('4. jackee 로그인 후 상담사 목록 (달시 안 보여야 함)',
     f'curl -s "{BASE}/user/counselors?tab=all&limit=20" -b {JACKEE_COOKIE}')

# ── 4. 차단 해제 ──
q('5. 차단 해제 (DELETE)',
  f'DELETE FROM counselor_block WHERE counselor_id={COUNSELOR_ID} RETURNING id, member_id')

# ── 5. 해제 후 목록 (달시 다시 보여야 함) ──
curl('6. 차단 해제 후 jackee 상담사 목록 (달시 다시 보여야 함)',
     f'curl -s "{BASE}/user/counselors?tab=all&limit=20" -b {JACKEE_COOKIE}')

q('최종 counselor_block 상태', f'SELECT COUNT(*) FROM counselor_block WHERE counselor_id={COUNSELOR_ID}')

client.close()
print('\n=== E2E 테스트 완료 ===')
