"""채팅 모달 알림 엄격 검증.

A. 양 서버 dist 새 코드 반영
B. /api/user/consult/incoming endpoint 응답 (인증 필요 — 401 정상)
C. 라온선생 입장의 STAY 방 직접 조회 (현재 상태)
D. pm2 로그 부팅 에러 없는지
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
            # ── A. API dist 검증 ──
            print("\n  [A] API dist 새 코드 반영")
            for kw, desc in [
                ("listIncomingChats", "Service 함수"),
                ("user/consult/incoming", "Controller endpoint"),
            ]:
                _, out, _ = c.exec_command(
                    f"grep -l '{kw}' {api_remote}/dist/user/consult/*.js 2>/dev/null | wc -l"
                )
                cnt = out.read().decode().strip()
                marker = "✅" if cnt != "0" else "❌"
                print(f"     {marker}  {desc:20s}  ({kw})  {cnt}건")

            # ── B. endpoint 호출 (인증 없이 — 401 기대) ──
            print("\n  [B] endpoint /api/user/consult/incoming 호출")
            _, out, _ = c.exec_command(
                f"curl -s -w 'HTTP %{{http_code}}' -m 10 '{api_base}/api/user/consult/incoming'"
            )
            body = out.read().decode().strip()
            print(f"     응답: {body[:200]}")
            if "401" in body or "Unauthorized" in body:
                print(f"     ✅  401 응답 정상 (인증 가드 작동 — 토큰 있어야 접근)")
            else:
                print(f"     ⚠️  예상과 다름")

            # ── C. 라온선생 STAY 방 직접 조회 ──
            print("\n  [C] 라온선생(counselor_id=123) STAY 방 현황")
            _, out, _ = c.exec_command(
                f"grep '^DATABASE_URL=' {api_remote}/.env | head -1"
            )
            dburl = out.read().decode().strip().split("=", 1)[1].strip("'\"")
            _, out, _ = c.exec_command(
                f'{psql} "{dburl}" -c '
                '"SELECT id AS chat_room_id, member_id, status, started_at, '
                "EXTRACT(EPOCH FROM (NOW() - started_at))::int AS waited_sec "
                "FROM chat_room WHERE counselor_id = 123 ORDER BY id DESC LIMIT 5;\""
            )
            for line in out.read().decode().strip().splitlines():
                print(f"     {line}")

            # ── D. user 프론트 dist 검증 ──
            print("\n  [D] user 프론트 dist 글로벌 모달 컴포넌트")
            for kw, desc in [
                ("CounselorIncomingChatWatcher", "컴포넌트명(원본)"),
                ("채팅 상담 요청", "모달 헤드라인"),
                ("지금 응답", "모달 응답 버튼"),
                ("user/consult/incoming", "API 호출 경로"),
            ]:
                _, out, _ = c.exec_command(
                    f"grep -o '{kw}' {web_remote}/assets/index-*.js 2>/dev/null | wc -l"
                )
                cnt = out.read().decode().strip()
                marker = "✅" if cnt != "0" else "❌"
                print(f"     {marker}  {desc:20s}  ({kw})  매칭 {cnt}")

            # ── E. pm2 부팅 에러 확인 ──
            print("\n  [E] pm2 최근 부팅 에러 (없어야 함)")
            _, out, _ = c.exec_command(
                "pm2 logs sajumoon-api --nostream --lines 30 --err 2>/dev/null | "
                "grep -E 'Cannot|undefined|TypeError|Error' | tail -3 || echo '(에러 없음)'"
            )
            body = out.read().decode().strip()
            if body and "(에러 없음)" not in body:
                print(f"     ⚠️  최근 에러:")
                for line in body.splitlines()[:3]:
                    print(f"       {line[:300]}")
            else:
                print(f"     ✅  부팅 에러 없음")

        finally:
            c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
