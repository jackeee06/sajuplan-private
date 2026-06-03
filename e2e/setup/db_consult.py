"""
E2E 전용 consultation 행 생성/삭제 스크립트.
인수:
  insert <member_id> <counselor_id>   → id 출력
  delete <consultation_id>            → 삭제
"""
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "104.64.128.103"
USER = "root"
SSH_PW = "saju26moon@!!"
DB_PW = "2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382"
DB = "sajumoon"
DB_USER = "sajumoon"


def run_sql(client: paramiko.SSHClient, sql: str) -> str:
    cmd = (
        f"PGPASSWORD='{DB_PW}' psql -h 127.0.0.1"
        f" -U {DB_USER} -d {DB} -tAc \"{sql}\""
    )
    _, stdout, _ = client.exec_command(cmd)
    return stdout.read().decode("utf-8", errors="replace").strip()


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=SSH_PW, timeout=20)

    if action == "insert":
        member_id = int(sys.argv[2])
        counselor_id = int(sys.argv[3])
        sql = (
            f"INSERT INTO consultation (member_id, counselor_id, usetm, amt, ended_at)"
            f" VALUES ({member_id}, {counselor_id}, 600, 0, NOW()) RETURNING id"
        )
        raw = run_sql(client, sql)
        # psql 이 id 행 + "INSERT 0 1" 같이 출력할 수 있음 — 숫자 행만 추출
        for line in raw.splitlines():
            line = line.strip()
            if line.isdigit():
                print(line)
                break
    elif action == "delete":
        consult_id = int(sys.argv[2])
        run_sql(client, f"DELETE FROM consultation WHERE id={consult_id}")
        print("deleted")
    else:
        print("usage: db_consult.py insert <member_id> <counselor_id>", file=sys.stderr)
        print("       db_consult.py delete <consultation_id>", file=sys.stderr)
        sys.exit(1)

    client.close()


if __name__ == "__main__":
    main()
