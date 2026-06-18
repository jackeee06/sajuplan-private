"""현재 iOS 사용자에게만 '업데이트 안내' 인앱알림 1회 발송.

- notification_log 에 개별(category='개별') row INSERT → 해당 회원의 알림함(종모양)에 표시.
- 대상: 탈퇴 안 한 회원 중 ios push token 보유자(=현재 iOS 앱 사용자).
- 미래 신규 사용자는 대상 아님(지금 토큰 있는 사람만). 안드로이드 제외.
- 인앱알림이라 사용자가 X로 닫기 가능(강제 아님).

사용:
  (미리보기)  SSHPASS=... python tools/_send_ios_update_notice.py
  (실발송)    SSHPASS=... python tools/_send_ios_update_notice.py --send
"""
from __future__ import annotations
import os, sys
import paramiko

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SSH_HOST = "104.64.128.103"
ENV_FILE = "/data/wwwroot/api.sajumoon.co.kr/.env"

TITLE = "업데이트 안내"
CONTENT = (
    "사주플랜이 더 안정적으로 개선되었습니다.\n"
    "일부 iOS 사용자에게 가끔 발생하던, 알림톡 버튼 클릭 시 앱이 닫히는 현상을 개선했습니다.\n"
    "앱스토어에서 최신 버전으로 업데이트해 주세요."
)
LINK_URL = "https://apps.apple.com/kr/app/id6761353255"

# 현재 iOS 사용자 정의: 탈퇴 안 한 회원 중 ios push token 보유
RECIPIENT_PRED = (
    "m.left_at IS NULL AND EXISTS ("
    "SELECT 1 FROM member_push_token t WHERE t.member_id = m.id AND t.platform = 'ios')"
)

PREVIEW = [
    f"SELECT m.role AS role, count(*) AS n FROM member m WHERE {RECIPIENT_PRED} GROUP BY m.role ORDER BY m.role;",
    f"SELECT m.id, m.mb_id, m.role FROM member m WHERE {RECIPIENT_PRED} ORDER BY m.role, m.id;",
]


def run(client, sql):
    cmd = f"bash -c 'set -a; . {ENV_FILE}; set +a; psql \"$DATABASE_URL\" -t -A -F \"|\"'"
    stdin, out, err = client.exec_command(cmd, get_pty=False)
    stdin.write(sql + "\n")
    stdin.channel.shutdown_write()
    o = out.read().decode("utf-8", errors="replace")
    e = err.read().decode("utf-8", errors="replace")
    sys.stdout.write(o)
    if e.strip():
        sys.stderr.write(e)
    return o


def main() -> int:
    do_send = "--send" in sys.argv[1:]
    pw = os.environ["SSHPASS"]
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(SSH_HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    print("=== 수신 대상 미리보기 (현재 iOS 사용자) ===")
    for q in PREVIEW:
        print(f"\n--- {q[:70]} ---")
        run(client, q)
    if not do_send:
        print("\n[DRY-RUN] 실제 발송하려면 --send 옵션을 붙이세요.")
        client.close()
        return 0
    print("\n=== 인앱알림 INSERT (개별 발송) ===")
    insert_sql = (
        "INSERT INTO notification_log (member_id, mb_id, title, content, link_url, category, code) "
        f"SELECT m.id, m.mb_id, '{TITLE}', '{CONTENT}', '{LINK_URL}', '개별', 'alim_notice' "
        f"FROM member m WHERE {RECIPIENT_PRED};"
    )
    run(client, insert_sql)
    print("\n=== 발송 확인 (최근 5분 내 넣은 '업데이트 안내') ===")
    run(
        client,
        "SELECT count(*) FROM notification_log WHERE code='alim_notice' "
        "AND title='업데이트 안내' AND created_at > NOW() - INTERVAL '5 min';",
    )
    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
