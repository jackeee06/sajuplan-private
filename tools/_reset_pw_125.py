"""상담사 id=125(aabbcc1) 임시비번 재설정 + Git Bash 오배포 쓰레기 디렉터리 정리.
해시는 node 파일 내부에서 생성/UPDATE (셸 $/!! 함정 회피)."""
import base64, json, paramiko

HOST='104.64.128.103'
DB='postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
API_DIR='/data/wwwroot/api.sajumoon.co.kr'
MEMBER_ID=125
TEMP_PW='saju1234'   # 영문+숫자 8자, 정책(8~20, 영문+숫자) 충족
B64=base64.b64encode(TEMP_PW.encode()).decode()
REMOTE_JS=f'{API_DIR}/_reset125.js'

JS=f"""
const bcrypt=require('bcrypt');const postgres=require('postgres');
(async()=>{{
  const pw=Buffer.from('{B64}','base64').toString('utf8');
  const hash=bcrypt.hashSync(pw,12);
  const sql=postgres('{DB}');
  await sql`UPDATE member SET password=${{hash}}, updated_at=now() WHERE id={MEMBER_ID}`;
  const cmp=await bcrypt.compare(pw,hash);
  const row=await sql`SELECT id,mb_id,role,left(password,4) pw4 FROM member WHERE id={MEMBER_ID}`;
  console.log(JSON.stringify({{compare:cmp,row:row[0]}}));
  await sql.end();
}})().catch(e=>console.log(JSON.stringify({{err:String(e)}})));
"""

c=paramiko.SSHClient();c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST,22,'root','saju26moon@!!',timeout=15)

sftp=c.open_sftp()
with sftp.open(REMOTE_JS,'w') as f: f.write(JS)
sftp.close()

ch=c.get_transport().open_session();ch.settimeout(40)
ch.exec_command(f'cd {API_DIR} && node {REMOTE_JS}');ch.shutdown_write()
out=b''
while not ch.exit_status_ready() or ch.recv_ready():
    if ch.recv_ready(): out+=ch.recv(4096)
    elif ch.exit_status_ready(): break
print("reset:",out.decode('utf-8','replace').strip())

# 정리: 임시 js + Git Bash 오배포로 생긴 /root/C: 쓰레기
_,o,_=c.exec_command(f'rm -f {REMOTE_JS}; rm -rf "/root/C:"; ls -d "/root/C:" 2>&1; echo CLEANED')
print("cleanup:",o.read().decode('utf-8','replace').strip())
c.close()
"""완료"""
print("완료")
