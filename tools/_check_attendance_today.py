"""출석 진단: 정책 enabled 값 + 최근 출석 row + 출석 point_history 확인."""
import paramiko

HOST = '104.64.128.103'
DB_URL = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'


def ssh_run(client, cmd, timeout=30):
    chan = client.get_transport().open_session()
    chan.settimeout(timeout)
    chan.exec_command(cmd)
    chan.shutdown_write()
    out, err = b'', b''
    while not chan.exit_status_ready():
        if chan.recv_ready(): out += chan.recv(4096)
        if chan.recv_stderr_ready(): err += chan.recv_stderr(4096)
    while chan.recv_ready(): out += chan.recv(4096)
    while chan.recv_stderr_ready(): err += chan.recv_stderr(4096)
    chan.recv_exit_status(); chan.close()
    return out.decode('utf-8', 'replace'), err.decode('utf-8', 'replace')


def q(client, sql, title):
    o, e = ssh_run(client, f'psql "{DB_URL}" -c "{sql}"')
    print(f"\n=== {title} ===")
    print(o.strip() or e.strip())


client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(HOST, 22, 'root', 'saju26moon@!!', timeout=15)

    q(client, "SELECT (now() AT TIME ZONE 'Asia/Seoul')::date AS kst_today, now() AS server_now", "현재 KST 날짜")
    q(client, "SELECT key, value FROM setting WHERE namespace='attendance' ORDER BY key", "출석 정책 setting (enabled 핵심)")
    q(client, "SELECT COUNT(*) AS total_rows, MAX(attended_date) AS last_date FROM member_attendance", "member_attendance 전체 건수/최근일")
    q(client, "SELECT target_kind, attended_date, COUNT(*) FROM member_attendance GROUP BY target_kind, attended_date ORDER BY attended_date DESC LIMIT 10", "최근 출석 일자별 건수")
    q(client, "SELECT id, member_id, target_kind, attended_date, base_coin, bonus_coin, consecutive_days FROM member_attendance ORDER BY attended_date DESC, id DESC LIMIT 10", "최근 출석 row 10건")
    q(client, "SELECT COUNT(*) AS att_history_rows, MAX(reg_date) AS last FROM point_history WHERE rel_action LIKE 'attendance:%'", "출석 point_history 건수")
    q(client, "SELECT member_id, content, earn_point, rel_action, reg_date FROM point_history WHERE rel_action LIKE 'attendance:%' ORDER BY id DESC LIMIT 5", "최근 출석 적립 내역 5건")

finally:
    client.close()
print("\n완료")
