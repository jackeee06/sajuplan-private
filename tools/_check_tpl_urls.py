import paramiko
HOST='104.64.128.103'
DB='postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
def run(c,cmd,t=30):
    ch=c.get_transport().open_session();ch.settimeout(t);ch.exec_command(cmd);ch.shutdown_write()
    o=b'';e=b''
    while not ch.exit_status_ready():
        if ch.recv_ready():o+=ch.recv(4096)
        if ch.recv_stderr_ready():e+=ch.recv_stderr(4096)
    while ch.recv_ready():o+=ch.recv(4096)
    while ch.recv_stderr_ready():e+=ch.recv_stderr(4096)
    ch.recv_exit_status();ch.close();return o.decode('utf-8','replace'),e.decode('utf-8','replace')
def q(c,s,t):
    o,e=run(c,f'psql "{DB}" -c "{s}"');print(f"\n=== {t} ===\n"+(o.strip() or e.strip()))
c=paramiko.SSHClient();c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST,22,'root','saju26moon@!!',timeout=15)
try:
    # 전체 템플릿: 버튼타입/버튼URL + 본문에 url변수/주소 들어있는지 플래그
    q(c,"SELECT template_code, is_active, primary_btn_type AS btn, primary_btn_url AS btn_url, (message LIKE '%reviews/%' OR message LIKE '%후기 확인%' OR primary_btn_url LIKE '%reviews%') AS review_addr, (message LIKE '%#{url}%' OR message LIKE '%counselor-mypage%' OR message LIKE '%mypage/%' OR message LIKE '%/chat/%') AS body_has_addr FROM alimtalk_template ORDER BY review_addr DESC, body_has_addr DESC, template_code","알림톡 템플릿 전수 (후기주소/본문주소 플래그)")
    # 후기 주소가 있는 것 카운트
    q(c,"SELECT count(*) FILTER (WHERE message LIKE '%reviews/%' OR message LIKE '%후기 확인%' OR primary_btn_url LIKE '%reviews%') AS review_addr_cnt, count(*) FILTER (WHERE message LIKE '%#{url}%' OR message LIKE '%counselor-mypage%' OR message LIKE '%mypage/%' OR message LIKE '%/chat/%') AS body_addr_cnt, count(*) AS total FROM alimtalk_template","카운트: 후기주소 / 본문주소 / 전체")
finally:
    c.close()
print("done")
