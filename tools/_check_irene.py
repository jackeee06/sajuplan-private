"""이아린 계정(탈퇴 옛것 + 재가입 새것) 상태 점검 (읽기전용)."""
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
def q(sql, x=False):
    _, o, e = c.exec_command(f'/usr/bin/psql "{dburl}" {"-x" if x else ""} -c "{sql}"')
    return o.read().decode()
print("[1] '이아린' 닉네임 모든 member (탈퇴 포함)")
print(q("SELECT id, mb_id, name, nickname, role, state, phone, dtmfno, csrid, left_at, created_at "
        "FROM member WHERE nickname LIKE '%이아린%' OR name LIKE '%이아린%' ORDER BY id;", x=True))
print("[2] 같은 전화번호로 묶이는 계정 (재가입 추적)")
print(q("SELECT id, mb_id, nickname, role, left_at, dtmfno, csrid, phone FROM member "
        "WHERE phone IN (SELECT phone FROM member WHERE nickname LIKE '%이아린%' AND phone IS NOT NULL) ORDER BY id;", x=True))
print("[3] counselor 신청/승인 관련 테이블 존재여부")
print(q("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%apply%' OR table_name LIKE '%csr%' OR table_name LIKE '%counselor%' ORDER BY table_name;"))
print("[4] dtmfno UNIQUE 인덱스 정의")
print(q("SELECT indexname, indexdef FROM pg_indexes WHERE tablename='member' AND indexdef ILIKE '%dtmfno%';"))
c.close()
