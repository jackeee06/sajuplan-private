"""이아린 복구 실행 — 267 탈퇴해제(상담사 복구) + 273 중복 새계정 정리.
 둘 다 left_at 토글이라 되돌릴 수 있음(돈/식별자 변경 없음)."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
if 'SSHPASS' not in os.environ:
    for line in open('.env.local', encoding='utf-8'):
        if line.startswith('SSHPASS='):
            os.environ['SSHPASS'] = line.split('=', 1)[1].strip().strip("'\""); break
pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
_, o, _ = c.exec_command('grep "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | head -1')
dburl = o.read().decode().strip().split('=', 1)[1].strip("'\"")
def q(sql):
    _, o, e = c.exec_command(f'/usr/bin/psql "{dburl}" -c "{sql}"')
    return o.read().decode() + (lambda e: ('\n[ERR] '+e) if e.strip() else '')(e.read().decode())

print("[BEFORE — 되돌림용 스냅샷]")
print(q("SELECT id, mb_id, role, state, dtmfno, csrid, left_at FROM member WHERE id IN (267,273) ORDER BY id;"))

print("[복구 1) 267 탈퇴해제 — 상담사 복구]")
print(q("UPDATE member SET left_at = NULL WHERE id = 267 AND left_at IS NOT NULL;"))

print("[정리 2) 273 중복 새계정 탈퇴 처리]")
print(q("UPDATE member SET left_at = NOW() WHERE id = 273 AND left_at IS NULL;"))

print("[AFTER]")
print(q("SELECT id, mb_id, role, state, dtmfno, csrid, left_at FROM member WHERE id IN (267,273) ORDER BY id;"))
print("[검증 — 같은 전화 활성계정은 267 하나만 남아야 정상]")
print(q("SELECT id, mb_id, role, left_at FROM member WHERE phone='01038136752' AND left_at IS NULL;"))
c.close()
