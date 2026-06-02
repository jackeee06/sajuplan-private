"""채팅 알림톡 + 자동취소 작업 엄격 검증.

A. 양 서버 dist 에 새 코드 반영 (autoCancelStaleChats, 새 템플릿 코드)
B. cron endpoint /api/cron/chat/auto-cancel 실 호출 동작
C. 모듈 로딩 정상 (NestJS 부팅 에러 없음 — pm2 상태)
D. STAY 상태 채팅방 점검 (운영 영향 없음)
E. 프론트 dist 에 visibilitychange 로직 반영
"""
import os
import sys
import paramiko

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
    except Exception:
        pass


def main() -> int:
    pw = os.environ["SSHPASS"]

    TARGETS = [
        ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr",
         "/data/wwwroot/sajumoon.kr", "/usr/local/pgsql/bin/psql",
         "https://api.sajumoon.kr"),
        ("prod", "104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr",
         "/data/wwwroot/sajumoon.co.kr", "/usr/bin/psql",
         "https://api.sajuplan.com"),
    ]

    for label, host, api_remote, web_remote, psql, api_base in TARGETS:
        print(f"\n{'='*70}\n[{label}] {host}\n{'='*70}")
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
        try:
            # ─── A. API dist 검증 ───
            print("\n  [A] API dist 새 코드 반영 검증")
            for kw in [
                "autoCancelStaleChats",
                "chat_request_to_counselor",
                "chat_auto_cancelled_to_member",
                "notifyMemberChatAutoCancelled",
                "chat/auto-cancel",
            ]:
                _, out, _ = c.exec_command(
                    f"grep -lr '{kw}' {api_remote}/dist/ 2>/dev/null | head -3"
                )
                files = out.read().decode().strip()
                marker = "✅" if files else "❌"
                count = len(files.splitlines()) if files else 0
                print(f"     {marker}  {kw:40s}  {count}개 파일")

            # ─── B. cron endpoint 실 호출 ───
            print("\n  [B] cron endpoint /api/cron/chat/auto-cancel 호출")
            _, out, _ = c.exec_command(
                f"grep '^CRON_TOKEN=' {api_remote}/.env | head -1"
            )
            token = out.read().decode().strip().split("=", 1)[1].strip("'\"")
            _, out, _ = c.exec_command(
                f"curl -s -m 15 '{api_base}/api/cron/chat/auto-cancel?token={token}'"
            )
            body = out.read().decode().strip()
            print(f"     응답: {body[:200]}")
            if '"cancelled"' in body:
                print(f"     ✅  endpoint 정상 응답")
            else:
                print(f"     ❌  endpoint 비정상")

            # ─── C. pm2 상태 (NestJS 부팅 에러 없는지) ───
            print("\n  [C] pm2 상태 — 모듈 로딩 에러 없는지")
            _, out, _ = c.exec_command(
                "pm2 list 2>/dev/null | grep sajumoon-api | head -1"
            )
            print(f"     {out.read().decode().strip()[:200]}")
            _, out, _ = c.exec_command(
                "pm2 logs sajumoon-api --nostream --lines 50 --err 2>/dev/null | grep -E 'Error|error' | head -3 || echo '(에러 없음)'"
            )
            err_lines = out.read().decode().strip()
            if err_lines and "(에러 없음)" not in err_lines:
                print(f"     ⚠️  에러 발견:\n     {err_lines[:500]}")
            else:
                print(f"     ✅  에러 없음")

            # ─── D. STAY 상태 채팅방 ───
            print("\n  [D] 현재 STAY 상태 채팅방 점검")
            _, out, _ = c.exec_command(
                f"grep '^DATABASE_URL=' {api_remote}/.env | head -1"
            )
            dburl = out.read().decode().strip().split("=", 1)[1].strip("'\"")
            _, out, _ = c.exec_command(
                f'{psql} "{dburl}" -c '
                '"SELECT COUNT(*) AS stay_rooms FROM chat_room WHERE status=\'STAY\';"'
            )
            for line in out.read().decode().strip().splitlines()[-3:]:
                print(f"     {line}")
            _, out, _ = c.exec_command(
                f'{psql} "{dburl}" -c '
                '"SELECT id, member_id, counselor_id, status, '
                "EXTRACT(EPOCH FROM (NOW() - created_at))::int AS age_sec "
                "FROM chat_room WHERE status='STAY' ORDER BY id DESC LIMIT 5;\""
            )
            for line in out.read().decode().strip().splitlines():
                print(f"     {line}")

            # ─── E. user 프론트 dist 검증 ───
            print("\n  [E] user 프론트 dist visibilitychange 자동 감지 반영")
            for kw in [
                "상담사를 기다리는 중",
                "visibilitychange",
            ]:
                _, out, _ = c.exec_command(
                    f"grep -o '{kw}' {web_remote}/assets/index-*.js 2>/dev/null | wc -l"
                )
                cnt = out.read().decode().strip()
                marker = "✅" if cnt != "0" else "❌"
                print(f"     {marker}  '{kw}' 매칭 {cnt}건")
        finally:
            c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
