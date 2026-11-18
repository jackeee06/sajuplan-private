"""채팅 5분 재연결 현상 분석 — ①재연결이 새 START_CHAT(이중차감) 만드나 ②5분 주기 패턴. 읽기전용."""
import os, sys, paramiko
pw = os.environ.get('SSHPASS')
if not pw: sys.exit(2)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20, look_for_keys=False, allow_agent=False)
_, env, _ = c.exec_command('grep ^DATABASE_URL= /data/wwwroot/api.sajumoon.co.kr/.env')
db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")

def q(label, sql):
    _, out, err = c.exec_command(f'psql "{db_url}" -c "{sql}"', timeout=30)
    o = out.read().decode(errors='replace'); e = err.read().decode(errors='replace')
    print(f"\n===== {label} =====")
    print(o if o.strip() else ("[stderr] " + e))

# 1) ★ 최근 3일 채팅 이벤트 — 같은 membid+csrid 에 START_CHAT 이 여러 번? (재연결이 새 선결제 세션 만들면 이중차감)
q("최근3일 채팅 이벤트 흐름 (membid,reason,roomid,시각)",
  "SELECT membid, csrid, reason, roomid, to_char(eventtm,'MM-DD HH24:MI:SS') AS t, usetm, (mrtn->>'amt') AS m2net_amt FROM consultation WHERE reason IN ('START_CHAT','END_CHAT','TRYING') AND created_at > now() - interval '3 days' ORDER BY membid, csrid, eventtm")

# 2) ★ START_CHAT 중복 탐지 — 같은 base roomid 로 START_CHAT 2회 이상 = 재연결 세션 재생성(이중차감 위험)
q("동일 base roomid START_CHAT 중복 (이중차감 위험 신호)",
  "SELECT split_part(roomid,'__',1) AS base_room, count(*) FILTER (WHERE reason='START_CHAT') AS start_cnt, count(*) FILTER (WHERE reason='END_CHAT') AS end_cnt, min(eventtm) AS first_ev, max(eventtm) AS last_ev FROM consultation WHERE reason IN ('START_CHAT','END_CHAT') AND created_at > now() - interval '3 days' GROUP BY split_part(roomid,'__',1) HAVING count(*) FILTER (WHERE reason='START_CHAT') > 1 ORDER BY start_cnt DESC")

# 3) 라온선생 방(id 93) chat_message 시각 — 5분 간격 gap / 시스템메시지(type=3) 있나
q("라온선생방 chat_message 시각(gap·시스템메시지)",
  "SELECT to_char(created_at,'HH24:MI:SS') AS t, sender_id, message_type, left(message,24) AS msg FROM chat_message WHERE chat_room_id=93 ORDER BY created_at LIMIT 80")

# 4) 어제 채팅방들 상태 — 재연결로 status 변동 흔적
q("chat_room 최근3일 (status/시간)",
  "SELECT id, member_id, counselor_id, status, charge_minutes, to_char(started_at,'MM-DD HH24:MI') AS started, to_char(ended_at,'MM-DD HH24:MI') AS ended, roomid FROM chat_room WHERE started_at > now() - interval '3 days' ORDER BY started_at DESC LIMIT 20")

c.close()
