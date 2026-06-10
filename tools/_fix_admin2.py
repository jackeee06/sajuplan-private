"""admin2 level 수정 + admin_e2e E2E 전용 계정 생성"""
import paramiko, io, time, sys

DB = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
# bcrypt('E2eAdmin1!')
E2E_HASH = '$2b$12$Ggj5sV93qu5KzPCNRceeIuU7CqsiQwh.BNRMnNMe49liSjXQSBx.i'  # 1234! — E2E 전용

def run(c, sql):
    chan = c.get_transport().open_session()
    chan.exec_command(f'psql "{DB}" -c "{sql}"')
    chan.shutdown_write(); time.sleep(3)
    out = b''
    while chan.recv_ready(): out += chan.recv(4096)
    while chan.recv_stderr_ready(): out += chan.recv_stderr(4096)
    chan.recv_exit_status(); chan.close()
    return out.decode('utf-8', errors='replace')

def run_file(c, sql_content, fname='/tmp/admin_fix.sql'):
    sftp = c.open_sftp()
    sftp.putfo(io.BytesIO(sql_content.encode()), fname)
    sftp.close()
    chan = c.get_transport().open_session()
    chan.exec_command(f'psql "{DB}" -f {fname}')
    chan.shutdown_write(); time.sleep(3)
    out = b''
    while chan.recv_ready(): out += chan.recv(4096)
    while chan.recv_stderr_ready(): out += chan.recv_stderr(4096)
    chan.recv_exit_status(); chan.close()
    return out.decode('utf-8', errors='replace')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', 'saju26moon@!!', timeout=15)

# 1. admin2 level=10으로 수정
print('=== admin2 level 수정 ===')
print(run(c, "UPDATE member SET level=10 WHERE mb_id='admin2'"))

# 2. admin_e2e 중복 확인 후 생성
print('=== admin_e2e 존재 확인 ===')
exists = run(c, "SELECT COUNT(*) FROM member WHERE mb_id='admin_e2e'")
print(exists)

if '0' in exists:
    sql = f"""INSERT INTO member (mb_id, password, name, nickname, role, level, is_super, email, phone, created_at)
VALUES ('admin_e2e', '{E2E_HASH}', 'E2E관리자', 'E2E', 'admin', 10, false, 'e2e_admin@sajuplan.com', '01000000001', now());"""
    print('=== admin_e2e INSERT ===')
    print(run_file(c, sql))
else:
    print('이미 존재 — 비밀번호만 업데이트')
    print(run_file(c, f"UPDATE member SET password='{E2E_HASH}', level=10 WHERE mb_id='admin_e2e';"))

# 3. 최종 확인
print('=== 최종 admin 계정 목록 ===')
print(run(c, "SELECT mb_id, role, level, is_super FROM member WHERE role='admin' ORDER BY id"))

c.close()
print('완료')
