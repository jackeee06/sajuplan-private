"""서버 실제 배포물 + DB 스키마 대조.
   1) 소스 counselors.service.ts 에 원자 claim(UPDATE..RETURNING) 반영됐나
   2) 컴파일된 dist(실제 실행물)에도 반영됐나
   3) counselor_request_alert 전체 스키마 (NOT NULL 제약 = INSERT 누락 컬럼 500 위험 점검)"""
import os, sys, paramiko
pw = os.environ.get('SSHPASS')
if not pw: sys.exit(2)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20,
          look_for_keys=False, allow_agent=False)

def run(cmd, t=25):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

BASE = '/data/wwwroot/api.sajumoon.co.kr'
print("### 1) 소스에 원자 claim(RETURNING) 반영 여부")
out, _ = run(f"grep -n 'RETURNING id, member_id, channel' {BASE}/src/user/counselors/counselors.service.ts")
print(out or "  (없음! 소스 미반영)")
print("### 1b) 옛 2단계 마킹(끝 일괄 UPDATE) 잔재 없어야")
out, _ = run(f"grep -n '발송한 요청들 콜백 마킹' {BASE}/src/user/counselors/counselors.service.ts")
print(out or "  (없음 = 옛 코드 제거됨 OK)")

print("\n### 2) 컴파일된 dist(실제 실행물)에 RETURNING 반영 여부")
# nest build 산출물 위치 탐색
loc, _ = run(f"ls -la {BASE}/dist/src/user/counselors/counselors.service.js 2>/dev/null; ls -la {BASE}/dist/user/counselors/counselors.service.js 2>/dev/null")
print("  dist 파일:", loc.strip() or "(경로탐색 필요)")
out, _ = run(f"grep -rn 'RETURNING id, member_id, channel' {BASE}/dist/ 2>/dev/null | head -3")
print("  dist grep:", out.strip() or "(dist에 없음 — 빌드 확인 필요)")

print("\n### 3) counselor_request_alert 전체 스키마 (NOT NULL & default)")
_, env, _ = c.exec_command('grep ^DATABASE_URL= /data/wwwroot/api.sajumoon.co.kr/.env')
db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")
SQL = ("SELECT column_name, data_type, is_nullable, column_default "
       "FROM information_schema.columns WHERE table_name='counselor_request_alert' "
       "ORDER BY ordinal_position;")
out, err = run(f'psql "{db_url}" -A -F "|" -c "{SQL}"')
print(out or err)

print("### 3b) NOT NULL 인데 default 없는 컬럼(코드가 INSERT 안하면 500 위험)")
SQL2 = ("SELECT column_name FROM information_schema.columns "
        "WHERE table_name='counselor_request_alert' AND is_nullable='NO' "
        "AND column_default IS NULL ORDER BY ordinal_position;")
out, err = run(f'psql "{db_url}" -A -t -c "{SQL2}"')
print("  →", (out.strip() or "(없음)"))

print("\n### 4) 최근 [availableCallback] 로그 (실환경 발동 흔적)")
out, _ = run("pm2 logs sajumoon-api --nostream --lines 2000 2>/dev/null | grep -i 'availableCallback' | tail -5")
print(out.strip() or "  (아직 실발동 로그 없음 — 정상, 상담사가 부재→활성 토글해야 남음)")

c.close()
