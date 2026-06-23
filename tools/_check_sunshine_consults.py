"""선샤인 선생의 상담 건수를 양방향으로 조회 (읽기전용 SELECT).
 - 상담사로서 진행한 상담 (counselor_id = 선샤인)
 - 고객으로서 받은 상담 (member_id = 선샤인)
"""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

# .env.local 에서 SSHPASS 로드
if 'SSHPASS' not in os.environ:
    for line in open('.env.local', encoding='utf-8'):
        if line.startswith('SSHPASS='):
            os.environ['SSHPASS'] = line.split('=', 1)[1].strip().strip("'\"")
            break

pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
_, o, _ = c.exec_command('grep "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | head -1')
dburl = o.read().decode().strip().split('=', 1)[1].strip("'\"")
psql = '/usr/bin/psql'

def q(sql, x=False):
    flag = '-x' if x else ''
    _, o, e = c.exec_command(f'{psql} "{dburl}" {flag} -c "{sql}"')
    out = o.read().decode(); err = e.read().decode()
    return out + (('\n[ERR] ' + err) if err.strip() else '')

print("="*72)
print("[1] 선샤인 선생 식별 (nickname '선샤인' 포함 상담사)")
print("="*72)
print(q("SELECT id, mb_id, name, nickname, role, dtmfno, csrid, state "
        "FROM member WHERE nickname LIKE '%선샤인%' OR name LIKE '%선샤인%' ORDER BY id;"))

print("="*72)
print("[2] consultation 테이블 컬럼 (이름 확인용)")
print("="*72)
print(q("SELECT column_name FROM information_schema.columns "
        "WHERE table_name='consultation' ORDER BY ordinal_position;"))

# 선샤인 id 후보 (메모리상 112). 동적으로 다시 잡음.
SID = "(SELECT id FROM member WHERE nickname LIKE '%선샤인%' ORDER BY id LIMIT 1)"
print("="*72)
print("[3] 선샤인이 '상담사로서 진행한' 상담 — counselor_id 기준 (reason별 + 실과금 합)")
print("="*72)
print(q(
  "SELECT reason, count(*), "
  "sum(CASE WHEN roomid IS NOT NULL AND roomid<>'' THEN 1 ELSE 0 END) AS chat_cnt, "
  "sum(coalesce(amt,0)) AS sum_amt, max(created_at) AS last "
  f"FROM consultation WHERE counselor_id = {SID} "
  "GROUP BY reason ORDER BY count DESC;"))

print("="*72)
print("[4] 선샤인이 '고객으로서 받은' 상담 — member_id 기준 (reason별)")
print("="*72)
print(q(
  "SELECT reason, count(*), sum(coalesce(amt,0)) AS sum_amt, max(created_at) AS last "
  f"FROM consultation WHERE member_id = {SID} "
  "GROUP BY reason ORDER BY count DESC;"))

print("="*72)
print("[5] 총계 한 줄 요약")
print("="*72)
print(q(
  "SELECT "
  "(SELECT count(*) FROM consultation WHERE counselor_id=(SELECT id FROM member WHERE nickname LIKE '%선샤인%' ORDER BY id LIMIT 1)) AS as_counselor_total, "
  "(SELECT count(*) FROM consultation WHERE member_id=(SELECT id FROM member WHERE nickname LIKE '%선샤인%' ORDER BY id LIMIT 1)) AS as_customer_total;"))

c.close()
