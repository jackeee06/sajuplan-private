import paramiko, time, sys

DB = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'

def run(c, sql):
    chan = c.get_transport().open_session()
    chan.exec_command(f'psql "{DB}" -c "{sql}"')
    chan.shutdown_write()
    time.sleep(3)
    out = b''
    while chan.recv_ready(): out += chan.recv(4096)
    while chan.recv_stderr_ready(): out += chan.recv_stderr(4096)
    chan.recv_exit_status(); chan.close()
    return out.decode('utf-8', errors='replace')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', 'saju26moon@!!', timeout=10)

print("=== jackee 최신 문의 ===")
print(run(c, "SELECT q.id, q.title, q.content, q.counselor_id, q.created_at FROM counselor_qna q INNER JOIN member m ON m.id=q.member_id WHERE m.mb_id='jackee' ORDER BY q.created_at DESC LIMIT 3"))

print("=== 알림톡 발송 로그 (qa_ask) ===")
print(run(c, "SELECT id, template_code, phone, success, response_code, error_reason, sent_at FROM alimtalk_log WHERE template_code LIKE 'qa_ask%' ORDER BY sent_at DESC LIMIT 5"))

c.close()
