"""테스트가 dllyn(176)에게 잘못 지급한 베스트후기 10,000코인 회수.
node 트랜잭션으로 처리(쉘 $ 확장 회피)."""
import paramiko
HOST='104.64.128.103'
DB='postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
API_DIR='/data/wwwroot/api.sajumoon.co.kr'

NODE_JS = """
const postgres = require('postgres');
const sql = postgres('%s');
const MID = 176, AMT = 10000, REL = 'review_best:223';
(async () => {
  try {
    const ph = await sql`SELECT id FROM point_history WHERE rel_action=${REL} AND member_id=${MID}`;
    if (!ph.length) { console.log('no review_best:223 history — nothing to revert'); await sql.end(); return; }
    await sql.begin(async (tx) => {
      await tx`UPDATE point SET free_balance=GREATEST(0,free_balance-${AMT}), total_earned=GREATEST(0,total_earned-${AMT}), updated_at=now() WHERE member_id=${MID}`;
      await tx`UPDATE member SET point=GREATEST(0,COALESCE(point,0)-${AMT}), updated_at=now() WHERE id=${MID}`;
      await tx`DELETE FROM point_history WHERE rel_action=${REL} AND member_id=${MID}`;
    });
    const v = await sql`SELECT free_balance, total_earned FROM point WHERE member_id=${MID}`;
    console.log('REVERTED — dllyn free_balance='+v[0].free_balance+' total_earned='+v[0].total_earned);
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
    tgt=f"{API_DIR}/_revert_dllyn.js"
    run(c,f"cat > {tgt} <<'SAJUEOF'\n"+NODE_JS+"\nSAJUEOF")
    o,e=run(c,f"cd {API_DIR} && node {tgt}")
    print(o.strip())
    if e.strip(): print("stderr:", e.strip())
    run(c,f"rm -f {tgt}")
finally:
    c.close()
print("완료")
