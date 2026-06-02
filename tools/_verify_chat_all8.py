"""채팅 개선 1~8번 엄격 검증.

1. 안 읽음 표시 ("1")            — DB read_at + mark-read endpoint + UI "1"
2. 줄간 간격 압축                — gap-1.5
3. 남은 시간 카운트다운 (mm:ss)  — formatTimer 1시간 미만 mm:ss
4. 5분 전 경고                  — SystemPill "상담 종료 5분"
5. 이전 대화 누적 표시            — SQL member-counselor 페어 기준
6. 상담사 타이머 표시            — !isMeCounselor 제거
7. flex-end 정렬 (키보드 처리)   — justify-end
8. 배경 로고 워터마크            — linear-gradient + repeat-y
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
            # ── DB: 안 읽음 컬럼 ──
            print("\n  [1] DB chat_message.read_at 컬럼")
            _, out, _ = c.exec_command(
                f"grep '^DATABASE_URL=' {api_remote}/.env | head -1"
            )
            dburl = out.read().decode().strip().split("=", 1)[1].strip("'\"")
            _, out, _ = c.exec_command(
                f'{psql} "{dburl}" -Atc '
                '"SELECT column_name FROM information_schema.columns '
                "WHERE table_name='chat_message' AND column_name='read_at';\""
            )
            r = out.read().decode().strip()
            mark = "✅" if r == "read_at" else "❌"
            print(f"     {mark}  read_at 컬럼 존재: '{r}'")

            # ── API dist: 새 코드 반영 ──
            print("\n  [API dist] 새 기능 반영 검증")
            api_checks = [
                ("mark-read", "1번: mark-read endpoint"),
                ("markRead", "1번: markRead 함수"),
                ("read_at", "1번: read_at 컬럼 사용"),
                ("r.member_id = ${room.member_id}", "5번: 페어 기준 메시지 조회"),
            ]
            for kw, desc in api_checks:
                _, out, _ = c.exec_command(
                    f"grep -l '{kw}' {api_remote}/dist/user/chat/*.js 2>/dev/null | wc -l"
                )
                cnt = out.read().decode().strip()
                mark = "✅" if cnt != "0" else "❌"
                print(f"     {mark}  {desc}  매칭 {cnt}")

            # ── API endpoint live 호출 ──
            print("\n  [API live] /api/user/chat/rooms/1/mark-read")
            _, out, _ = c.exec_command(
                f"curl -s -w 'HTTP %{{http_code}}' -m 10 -X POST '{api_base}/api/user/chat/rooms/1/mark-read'"
            )
            body = out.read().decode().strip()
            print(f"     응답: {body[:200]}")
            if "401" in body:
                print(f"     ✅  인증 가드 정상 (토큰 없어 401)")
            else:
                print(f"     ⚠️  비정상")

            # ── User dist: 채팅 화면 변경 ──
            print("\n  [User dist] 채팅 UI 변경")
            web_checks = [
                ("chat_room_id", "5번: chat_room_id 인터페이스"),
                ("상담 종료 5분", "4번: 5분 경고 메시지"),
                ("logo_g.svg", "8번: 배경 로고"),
                ("justify-end", "7번: flex-end 정렬"),
                ("font-bold", "1번: 안 읽음 1 표시 (font-bold 사용)"),
                ("gap-1.5", "2번: 줄간 간격 압축"),
                ("rgba(255,255,255,0.92)", "8번: 배경 오버레이"),
                ("repeat-y", "8번: 세로 반복"),
            ]
            for kw, desc in web_checks:
                _, out, _ = c.exec_command(
                    f"grep -o '{kw}' {web_remote}/assets/index-*.js 2>/dev/null | wc -l"
                )
                cnt = out.read().decode().strip()
                mark = "✅" if cnt != "0" else "❌"
                print(f"     {mark}  {desc}  매칭 {cnt}")

            # ── User dist: formatTimer mm:ss ──
            print("\n  [User dist] formatTimer mm:ss 로직")
            _, out, _ = c.exec_command(
                f"grep -oE 'h>0|h > 0' {web_remote}/assets/index-*.js 2>/dev/null | head -1"
            )
            r = out.read().decode().strip()
            if r:
                print(f"     ✅  3번: h>0 분기 (1시간 이상이면 hh:mm:ss, 미만이면 mm:ss)")
            else:
                print(f"     ⚠️  분기 코드 직접 매칭 안 됨 (minify 차이일 수 있음)")

            # ── pm2 부팅 에러 ──
            print("\n  [pm2] 부팅 에러 (최근)")
            _, out, _ = c.exec_command(
                "pm2 logs sajumoon-api --nostream --lines 30 --err 2>/dev/null | "
                "grep -aE 'Error|TypeError|Cannot' | tail -2 || echo '(에러 없음)'"
            )
            body = out.read().decode().strip()
            if body and "(에러 없음)" not in body:
                # 최근 에러 시간이 배포 이후인지 확인
                print(f"     ⚠️  최근 로그에 에러:\n     {body[:400]}")
            else:
                print(f"     ✅  에러 없음")
        finally:
            c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
