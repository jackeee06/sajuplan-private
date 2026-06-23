"""천신영타로(rudgml1315)의 역할 + 상담사/고객 활동 구분 점검 (읽기전용)."""
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
print("[1] 천신영타로 신원/역할")
print(q("SELECT id, mb_id, name, nickname, role, state, created_at FROM member WHERE mb_id='rudgml1315' OR nickname='천신영타로';", x=True))
ID = "(SELECT id FROM member WHERE mb_id='rudgml1315' LIMIT 1)"
print("[2] '상담사로서 진행한' 상담 (counselor_id=본인) — 최근 7일")
print(q(f"SELECT count(*) FROM consultation WHERE counselor_id={ID} AND created_at >= NOW()-INTERVAL '7 days';"))
print("[2b] '상담사로서 진행한' 상담 전체 + 마지막 시점")
print(q(f"SELECT count(*) total, max(created_at) last FROM consultation WHERE counselor_id={ID};"))
print("[3] '고객으로서' 받은 상담 (member_id=본인) — 최근 7일 reason별")
print(q(f"SELECT reason, count(*), max(created_at) last FROM consultation WHERE member_id={ID} AND created_at >= NOW()-INTERVAL '7 days' GROUP BY reason ORDER BY count DESC;"))
print("[4] 오늘 충전 결제(payment) — 본인")
print(q(f"SELECT id, amount, status, created_at FROM payment WHERE member_id={ID} AND created_at::date=CURRENT_DATE ORDER BY created_at;"))
c.close()
