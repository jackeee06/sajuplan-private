"""방치정산 새 게이트(고객 이탈 5분) 검증 + 레거시 NULL 백필. 시뮬은 BEGIN..ROLLBACK."""
import os, sys, paramiko
pw = os.environ.get('SSHPASS')
if not pw: sys.exit(2)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20, look_for_keys=False, allow_agent=False)
_, env, _ = c.exec_command('grep ^DATABASE_URL= /data/wwwroot/api.sajumoon.co.kr/.env')
db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")

def run(sql, t=30):
    _, o, e = c.exec_command(f'psql "{db_url}" -c "{sql}"', timeout=t)
    return o.read().decode(errors='replace') or e.read().decode(errors='replace')

print("### 1) 레거시 백필 — CNCH+이탈+left_at NULL 방에 now() 채움(영구제외 방지)")
print(run("UPDATE chat_room SET member_left_at = now() WHERE status='CNCH' AND member_try_out = TRUE AND member_left_at IS NULL"))

print("### 2) chat_room NOT NULL(default 없음) 컬럼 — 시뮬 INSERT 필수값 파악")
print(run("SELECT column_name FROM information_schema.columns WHERE table_name='chat_room' AND is_nullable='NO' AND column_default IS NULL ORDER BY ordinal_position"))

# 3) 새 게이트 시뮬 — BEGIN..ROLLBACK. 4 케이스 INSERT 후 게이트 SELECT.
SQL = r"""
BEGIN;
\echo '-- 테스트 방 4개 INSERT (member 289, counselor 123)'
INSERT INTO chat_room (member_id, counselor_id, status, charge_minutes, started_at, member_try_out, counselor_try_out, member_left_at, roomid)
VALUES
 (289,123,'CNCH',30, now()-interval '20 min', TRUE,  FALSE, now()-interval '6 min', 'SIM_A'),  -- 고객이탈 6분 → 걸려야
 (289,123,'CNCH',30, now()-interval '20 min', TRUE,  FALSE, now()-interval '3 min', 'SIM_B'),  -- 고객이탈 3분 → 안걸림
 (289,123,'CNCH',30, now()-interval '20 min', FALSE, TRUE,  NULL,                   'SIM_C'),  -- 상담사만이탈 → 안걸림
 (289,123,'CNCH',30, now()-interval '20 min', TRUE,  FALSE, NULL,                   'SIM_D'),  -- 고객이탈 but left_at NULL → 안걸림(백필전 레거시)
 (289,123,'CNCH',30, now()-interval '30 sec', TRUE,  FALSE, now()-interval '6 min', 'SIM_E'); -- 방금시작(1분미만) → 안걸림
\echo '-- 새 게이트 SELECT (걸리는 방 = SIM_A 만 이어야)'
SELECT roomid FROM chat_room cr
 WHERE cr.status='CNCH'
   AND cr.member_try_out = TRUE
   AND cr.member_left_at IS NOT NULL
   AND cr.member_left_at < NOW() - make_interval(mins => 5)
   AND cr.started_at < NOW() - INTERVAL '1 minute'
   AND cr.roomid LIKE 'SIM_%'
 ORDER BY roomid;
ROLLBACK;
"""
tmp = f'/tmp/vfy_gate_{os.getpid()}.sql'
i, o, _ = c.exec_command(f'cat > {tmp}')
i.write(SQL); i.channel.shutdown_write(); o.channel.recv_exit_status()
_, out, err = c.exec_command(f'psql "{db_url}" -f {tmp} && rm -f {tmp}', timeout=30)
print("### 3) 게이트 시뮬 (기대: SIM_A 만 걸림)")
print(out.read().decode(errors='replace') or err.read().decode(errors='replace'))
c.close()
