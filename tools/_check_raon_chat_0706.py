"""라온선생(박기수 123) 2026-07-06 채팅상담 27,600원 적립 검증 — 읽기전용 조사."""
import os, sys, paramiko
pw = os.environ.get('SSHPASS')
if not pw: sys.exit(2)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20, look_for_keys=False, allow_agent=False)
_, env, _ = c.exec_command('grep ^DATABASE_URL= /data/wwwroot/api.sajumoon.co.kr/.env')
db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")

def q(label, sql):
    _, out, err = c.exec_command(f'psql "{db_url}" -x -c "{sql}"', timeout=30)
    o = out.read().decode(errors='replace'); e = err.read().decode(errors='replace')
    print(f"\n===== {label} =====")
    print(o if o.strip() else ("[stderr] " + e))

# 1) 라온선생 신원·등급·단가
q("라온선생(123) 신원·등급·단가",
  "SELECT id, nickname, name, role, level, grade, chat_unit_cost, call_070_unit_cost, chat_unit_seconds, call_unit_seconds FROM member WHERE id=123")

# 2) 등급별 수익률 setting
q("등급 수익률(setting grade)",
  "SELECT namespace, key, value FROM setting WHERE namespace='grade' ORDER BY key")

# 3) 고객 꾸*잉
q("고객 꾸*잉",
  "SELECT id, nickname, mb_id, point FROM member WHERE nickname LIKE '꾸%' AND (role='member' OR role IS NULL) ORDER BY id")

# 4) 어제 라온선생 chat_room 전부(재접속 반복 흔적)
q("chat_room 2026-07-06 (counselor=123)",
  "SELECT id, member_id, status, charge_minutes, started_at, counselor_joined_at, ended_at, use_seconds, member_try_out, roomid FROM chat_room WHERE counselor_id=123 AND started_at::date='2026-07-06' ORDER BY started_at")

# 5) 상담사 123 point_history (수익 적립 27,600 근거)
q("point_history 상담사123 (07-06 19시~)",
  "SELECT id, kind, amount, balance, reason, rel_table, rel_id, rel_action, created_at FROM point_history WHERE member_id=123 AND created_at >= '2026-07-06 19:00' AND created_at < '2026-07-06 21:00' ORDER BY id")

# 6) consultation 어제 (라온선생 관련) — 컬럼 확인 위해 *
q("consultation 2026-07-06 (csr 관련 샘플)",
  "SELECT * FROM consultation WHERE created_at::date='2026-07-06' AND (csrid IN (SELECT csrid FROM member WHERE id=123) OR mb_id IN (SELECT mb_id FROM member WHERE id=123)) ORDER BY created_at LIMIT 20")

c.close()
