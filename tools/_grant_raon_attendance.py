"""박기수(라온선생, id=123) 오늘 출석 100코인 소급 지급 — checkIn 트랜잭션 동일 로직.
쉘 $ 확장 회피 위해 node 스크립트를 API 디렉터리에서 실행."""
import paramiko
HOST='104.64.128.103'
DB='postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
API_DIR='/data/wwwroot/api.sajumoon.co.kr'

NODE_JS = """
const postgres = require('postgres');
const sql = postgres('%s');
const MID = 123;            // 박기수
const TARGET = 'counselor';
const BASE = 100;           // counselor.day1
(async () => {
  try {
    const t = await sql`SELECT (now() AT TIME ZONE 'Asia/Seoul')::date::text AS d`;
    const today = t[0].d;
    // 이미 오늘 출석 있으면 중단 (멱등)
    const ex = await sql`SELECT id FROM member_attendance WHERE member_id=${MID} AND attended_date=${today}::date`;
    if (ex.length) { console.log('ALREADY today row id='+ex[0].id+' — skip'); await sql.end(); return; }
    await sql.begin(async (tx) => {
      await tx`INSERT INTO member_attendance (member_id, target_kind, attended_date, base_coin, bonus_coin, consecutive_days)
               VALUES (${MID}, ${TARGET}, ${today}::date, ${BASE}, 0, 1)`;
      await tx`INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
               VALUES (${MID},0,0,0,0) ON CONFLICT (member_id) DO NOTHING`;
      const pt = await tx`SELECT free_balance, paid_balance FROM point WHERE member_id=${MID} FOR UPDATE`;
      const after = Number(pt[0].free_balance)+Number(pt[0].paid_balance)+BASE;
      await tx`UPDATE member SET point = COALESCE(point,0)+${BASE}, updated_at=now() WHERE id=${MID}`;
      await tx`UPDATE point SET free_balance=free_balance+${BASE}, total_earned=total_earned+${BASE}, updated_at=now() WHERE member_id=${MID}`;
      await tx`INSERT INTO point_history (member_id, content, earn_point, use_point, balance_after, is_paid, is_expired, rel_action, actor_type, balance_kind)
               VALUES (${MID}, ${'출석 코인 (1일 연속)'}, ${BASE}, 0, ${after}, false, false, ${'attendance:'+today}, 'system', 'consumer')`;
      console.log('GRANTED today='+today+' +'+BASE+' balance_after='+after);
    });
    const v = await sql`SELECT free_balance, total_earned FROM point WHERE member_id=${MID}`;
    console.log('after free_balance='+v[0].free_balance+' total_earned='+v[0].total_earned);
  } catch(e){ console.error('ERR', e.message); }
  finally { await sql.end(); }
})();
""" % DB

def run(c,cmd,t=40):
    ch=c.get_transport().open_session();ch.settimeout(t);ch.exec_command(cmd);ch.shutdown_write()
    o=b'';e=b''
    while not ch.exit_status_ready():
        if ch.recv_ready():o+=ch.recv(4096)
        if ch.recv_stderr_ready():e+=ch.recv_stderr(4096)
    while ch.recv_ready():o+=ch.recv(4096)
    while ch.recv_stderr_ready():e+=ch.recv_stderr(4096)
    ch.recv_exit_status();ch.close();return o.decode('utf-8','replace'),e.decode('utf-8','replace')

c=paramiko.SSHClient();c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST,22,'root','saju26moon@!!',timeout=15)
try:
    target=f"{API_DIR}/_grant_raon.js"
    run(c,f"cat > {target} <<'SAJUEOF'\n"+NODE_JS+"\nSAJUEOF")
    o,e=run(c,f"cd {API_DIR} && node {target}")
    print(o.strip())
    if e.strip(): print("stderr:", e.strip())
    run(c,f"rm -f {target}")
finally:
    c.close()
print("완료")
