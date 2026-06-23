"""야라선생 오늘 상담 — TOP5 '12건'이 행수인지 실제건수인지 (읽기전용)."""
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
    return o.read().decode()
ID = "(SELECT id FROM member WHERE nickname='야라선생' AND role='counselor' ORDER BY id LIMIT 1)"
print("[야라선생 식별]")
print(q("SELECT id, mb_id, nickname FROM member WHERE nickname='야라선생' AND role='counselor';"))
print("[오늘 consultation 행 수 (TOP5가 세는 값 = COUNT(*))]")
print(q(f"SELECT count(*) AS all_rows FROM consultation WHERE counselor_id={ID} AND created_at::date=CURRENT_DATE;"))
print("[오늘 reason별 분해]")
print(q(f"SELECT reason, count(*) FROM consultation WHERE counselor_id={ID} AND created_at::date=CURRENT_DATE GROUP BY reason ORDER BY count DESC;"))
print("[오늘 실제 통화수 = distinct callid / 완료수 = DISCONNECT·END_CHAT 행]")
print(q(f"SELECT count(DISTINCT callid) AS distinct_calls, count(*) FILTER (WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')) AS completed FROM consultation WHERE counselor_id={ID} AND created_at::date=CURRENT_DATE;"))
c.close()
