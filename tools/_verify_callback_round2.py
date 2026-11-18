"""2차 정밀검증: 배포된 실제 코드(소스+dist) 반영 확인 + 멱등 원자 INSERT 실동작(BEGIN..ROLLBACK)."""
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
SRC = f'{BASE}/src/user/counselors/counselors.service.ts'

print("### A) 소스 4개 수정 반영 여부")
for label, pat in [
    ("RESV 콜백 트리거(wasOffline)", "const wasOffline = c.state === 'ABSE' || c.state === 'RESV'"),
    ("available 반환 정합", "available: target !== 'ABSE', state: target"),
    ("멱등 원자 INSERT", "WHERE NOT EXISTS"),
    ("상세 is_requested 조회", "isRequested = reqRows.length > 0"),
    ("상세 반환 is_requested", "is_requested: isRequested,"),
]:
    out, _ = run(f"grep -c \"{pat}\" {SRC}")
    n = out.strip()
    print(f"  [{'OK' if n not in ('0','') else '누락!'}] {label}: {n}건")

print("\n### B) 컴파일된 dist(실제 실행물) 반영 여부")
DIST = f'{BASE}/dist/user/counselors/counselors.service.js'
for label, pat in [
    ("wasOffline", "state === 'ABSE' || c.state === 'RESV'"),
    ("WHERE NOT EXISTS", "WHERE NOT EXISTS"),
    ("is_requested 반환", "is_requested:"),
]:
    out, _ = run(f"grep -c \"{pat}\" {DIST}")
    n = out.strip()
    print(f"  [{'OK' if n not in ('0','') else '누락!'}] dist {label}: {n}건")

print("\n### C) 멱등 원자 INSERT 실동작 (BEGIN..ROLLBACK, member=91 찬물선생, 실DB 무오염)")
_, env, _ = c.exec_command('grep ^DATABASE_URL= /data/wwwroot/api.sajumoon.co.kr/.env')
db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")
SQL = r"""
BEGIN;
\echo '-- 1차 요청: 없으니 INSERT 성공(1행) 이어야'
INSERT INTO counselor_request_alert (counselor_id, member_id, requested_at, channel)
SELECT 91, 91, now(), 'phone'
WHERE NOT EXISTS (
  SELECT 1 FROM counselor_request_alert
   WHERE member_id = 91 AND counselor_id = 91 AND requested_at > now() - interval '24 hours'
) RETURNING id;
\echo '-- 2차 요청(다기기 재시도 시뮬): 이미 있으니 0행 이어야(멱등, 알림톡 이중과금 방지)'
INSERT INTO counselor_request_alert (counselor_id, member_id, requested_at, channel)
SELECT 91, 91, now(), 'chat'
WHERE NOT EXISTS (
  SELECT 1 FROM counselor_request_alert
   WHERE member_id = 91 AND counselor_id = 91 AND requested_at > now() - interval '24 hours'
) RETURNING id;
\echo '-- 최종 행 수: 정확히 1개 이어야'
SELECT count(*) AS rows_for_91 FROM counselor_request_alert WHERE counselor_id=91 AND member_id=91 AND requested_at > now() - interval '24 hours';
ROLLBACK;
"""
tmp = f'/tmp/vfy_r2_{os.getpid()}.sql'
i, o, _ = c.exec_command(f'cat > {tmp}')
i.write(SQL); i.channel.shutdown_write(); o.channel.recv_exit_status()
out, err = run(f'psql "{db_url}" -f {tmp} && rm -f {tmp}')
print(out or err)

c.close()
