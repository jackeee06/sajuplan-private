"""admin2 E2E 계정 생성"""
import paramiko

HOST = '104.64.128.103'
DB_URL = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
PW_HASH = r'$2b$12$Ggj5sV93qu5KzPCNRceeIuU7CqsiQwh.BNRMnNMe49liSjXQSBx.i'


def ssh_run(client, cmd, timeout=15):
    chan = client.get_transport().open_session()
    chan.settimeout(timeout)
    chan.exec_command(cmd)
    chan.shutdown_write()
    out, err = b'', b''
    while not chan.exit_status_ready():
        if chan.recv_ready():
            out += chan.recv(4096)
        if chan.recv_stderr_ready():
            err += chan.recv_stderr(4096)
    while chan.recv_ready():
        out += chan.recv(4096)
    while chan.recv_stderr_ready():
        err += chan.recv_stderr(4096)
    code = chan.recv_exit_status()
    chan.close()
    return out.decode('utf-8', errors='replace'), err.decode('utf-8', errors='replace'), code


client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(HOST, 22, 'root', 'saju26moon@!!', timeout=15)
    print("SSH 연결 성공")

    check_cmd = f'psql "{DB_URL}" -c "SELECT COUNT(*) FROM admin_member WHERE mb_id=\'admin2\'"'
    o, e, _ = ssh_run(client, check_cmd)
    print("중복체크:", o.strip() or e.strip())

    exists = '1' in o and '0' not in o.split()[-2] if o else False

    if not exists:
        cols = "mb_id, password, name, nickname, role, level, is_super"
        vals = f"'admin2', '{PW_HASH}', 'E2E테스터', 'E2E', 'admin', 1, false"
        ins = f'psql "{DB_URL}" -c "INSERT INTO admin_member ({cols}) VALUES ({vals})"'
        o2, e2, rc = ssh_run(client, ins)
        print("INSERT:", o2.strip() or e2.strip(), "rc=", rc)
    else:
        upd = f'psql "{DB_URL}" -c "UPDATE admin_member SET password=\'{PW_HASH}\' WHERE mb_id=\'admin2\'"'
        o2, e2, rc = ssh_run(client, upd)
        print("UPDATE:", o2.strip() or e2.strip(), "rc=", rc)

    verify = f'psql "{DB_URL}" -c "SELECT id, mb_id, name, role, level, is_super FROM admin_member WHERE mb_id=\'admin2\'"'
    o3, e3, _ = ssh_run(client, verify)
    print("최종 확인:\n", o3.strip() or e3.strip())

except Exception as ex:
    print("오류:", ex)
finally:
    client.close()
print("완료")
