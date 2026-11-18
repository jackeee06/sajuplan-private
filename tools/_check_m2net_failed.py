"""채팅 m2net 차감전송 실패 방 실태 — 매일 뜨는 알림의 진짜 원인 규명."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
_, o, _ = c.exec_command('grep "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | head -1')
dburl = o.read().decode().strip().split('=',1)[1].strip("'\"")
psql = '/usr/bin/psql'
def q(label, sql):
    print("="*72); print(label); print("="*72)
    _, o, e = c.exec_command(f'{psql} "{dburl}" -c "{sql}"')
    print(o.read().decode()); err=e.read().decode().strip()
    if err: print("ERR:", err)

q("[1] settle_status 분포 (전체)",
  "SELECT settle_status, COUNT(*) FROM chat_room GROUP BY settle_status ORDER BY 2 DESC;")

q("[2] 현재 m2net_failed 방 상세 (알림이 세는 대상)",
  "SELECT id, roomid, use_seconds, settle_retry_count AS retry, "
  "to_char(started_at,'MM-DD HH24:MI') AS started, to_char(ended_at,'MM-DD HH24:MI') AS ended, "
  "to_char(settle_last_retry_at,'MM-DD HH24:MI') AS last_retry, "
  "LEFT(COALESCE(settle_failure_reason,'-'),40) AS reason "
  "FROM chat_room WHERE settle_status='m2net_failed' ORDER BY ended_at DESC LIMIT 20;")

q("[3] permanently_failed (진짜 수동개입 필요)",
  "SELECT id, roomid, use_seconds, settle_retry_count AS retry, "
  "to_char(ended_at,'MM-DD HH24:MI') AS ended, LEFT(COALESCE(settle_failure_reason,'-'),50) AS reason "
  "FROM chat_room WHERE settle_status='permanently_failed' ORDER BY ended_at DESC LIMIT 20;")

q("[4] 최근 3일 채팅 종료 방의 최종 정산상태 (실패율 감)",
  "SELECT date_trunc('day', ended_at)::date AS day, settle_status, COUNT(*) "
  "FROM chat_room WHERE ended_at > NOW() - interval '3 days' "
  "GROUP BY 1,2 ORDER BY 1 DESC, 3 DESC;")
c.close()
