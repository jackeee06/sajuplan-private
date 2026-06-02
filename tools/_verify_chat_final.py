"""채팅 최종 4가지 엄격 검증.

1. 이전 채팅 안 보이게      : API chat.service.js 가 단일 chat_room_id 만 사용
2. 헤더 fixed (밀려 올라감 X) : user dist 에 'fixed top-0 left-1/2' 포함
3. 배경 로고 워터마크         : user dist 에 logo_g.svg + opacity 0.08 포함
4. 글자 크기 카카오톡 동등    : user dist 에 text-[16px] 또는 16px 메시지 본문
"""
from __future__ import annotations
import os
import sys
import paramiko

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
    except Exception:
        pass


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 필요", file=sys.stderr)
        return 2

    TARGETS = [
        ("test", "172.235.211.75",
         "/data/wwwroot/api.sajumoon.kr",
         "/data/wwwroot/sajumoon.kr"),
        ("prod", "104.64.128.103",
         "/data/wwwroot/api.sajumoon.co.kr",
         "/data/wwwroot/sajumoon.co.kr"),
    ]

    overall_ok = True
    for label, host, api_remote, web_remote in TARGETS:
        print(f"\n{'='*70}\n[{label}] {host}\n{'='*70}")
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
        try:
            # ── [1] API chat.service.js : 단일 chat_room_id 만 사용 ──
            print("\n  [1] 이전 채팅 안 보이게 (단일 chat_room_id 기준)")

            # 페어 SQL 흔적 (있으면 ❌)
            _, out, _ = c.exec_command(
                f"grep -c 'r.member_id = .room.member_id' "
                f"{api_remote}/dist/user/chat/chat.service.js 2>/dev/null"
            )
            pair_cnt = out.read().decode().strip() or "0"

            # 단일 SQL 흔적 (있어야 ✅) — `WHERE chat_room_id = ${params.chatRoomId}` 패턴
            _, out, _ = c.exec_command(
                f"grep -c 'WHERE chat_room_id' "
                f"{api_remote}/dist/user/chat/chat.service.js 2>/dev/null"
            )
            single_cnt = out.read().decode().strip() or "0"

            ok1 = pair_cnt == "0" and int(single_cnt) >= 1
            mark = "✅" if ok1 else "❌"
            print(f"     {mark}  페어 SQL 흔적 (0이어야 함) = {pair_cnt}")
            print(f"     {mark}  단일 chat_room_id 매칭 = {single_cnt}")
            overall_ok = overall_ok and ok1

            # mark-read 도 단일 방인지
            _, out, _ = c.exec_command(
                f"grep -c 'SET read_at = NOW()' "
                f"{api_remote}/dist/user/chat/chat.service.js 2>/dev/null"
            )
            markread_cnt = out.read().decode().strip() or "0"
            print(f"     ℹ️  read_at NOW 사용 = {markread_cnt}")

            # ── [2] 헤더 fixed ──
            print("\n  [2] 헤더 fixed top-0 left-1/2 (밀려 올라감 차단)")
            _, out, _ = c.exec_command(
                f"grep -oE 'fixed top-0 left-1/2' "
                f"{web_remote}/assets/index-*.js 2>/dev/null | wc -l"
            )
            cnt = out.read().decode().strip() or "0"
            ok2 = int(cnt) >= 1
            mark = "✅" if ok2 else "❌"
            print(f"     {mark}  매칭 = {cnt}")
            overall_ok = overall_ok and ok2

            # 보조: max-w-[560px] (헤더 폭) 확인
            _, out, _ = c.exec_command(
                f"grep -oE 'max-w-\\[560px\\]' "
                f"{web_remote}/assets/index-*.js 2>/dev/null | wc -l"
            )
            cnt = out.read().decode().strip() or "0"
            print(f"     ℹ️  max-w-[560px] 매칭 = {cnt}")

            # 보조: pt-[60px] (헤더 가림 방지)
            _, out, _ = c.exec_command(
                f"grep -oE 'pt-\\[60px\\]' "
                f"{web_remote}/assets/index-*.js 2>/dev/null | wc -l"
            )
            cnt = out.read().decode().strip() or "0"
            print(f"     ℹ️  pt-[60px] 매칭 = {cnt}")

            # ── [3] 배경 로고 워터마크 ──
            print("\n  [3] 배경 로고 워터마크 (logo_g.svg + opacity)")
            _, out, _ = c.exec_command(
                f"grep -oE '/img/logo_g.svg' "
                f"{web_remote}/assets/index-*.js 2>/dev/null | wc -l"
            )
            logo_cnt = out.read().decode().strip() or "0"
            ok3a = int(logo_cnt) >= 1
            mark = "✅" if ok3a else "❌"
            print(f"     {mark}  logo_g.svg 참조 = {logo_cnt}")

            _, out, _ = c.exec_command(
                f"grep -oE 'opacity-\\[0\\.08\\]' "
                f"{web_remote}/assets/index-*.js 2>/dev/null | wc -l"
            )
            opa_cnt = out.read().decode().strip() or "0"
            ok3b = int(opa_cnt) >= 1
            mark = "✅" if ok3b else "❌"
            print(f"     {mark}  opacity-[0.08] 매칭 = {opa_cnt}")

            # 실제 SVG 파일이 서버에 있는지
            _, out, _ = c.exec_command(
                f"ls -la {web_remote}/img/logo_g.svg 2>/dev/null | head -1"
            )
            ls = out.read().decode().strip()
            ok3c = "logo_g.svg" in ls
            mark = "✅" if ok3c else "❌"
            print(f"     {mark}  서버 파일 존재: {ls[:80] or '(없음)'}")

            overall_ok = overall_ok and ok3a and ok3b and ok3c

            # ── [4] 글자 크기 16px ──
            print("\n  [4] 채팅 본문 16px (카카오톡 동등)")
            _, out, _ = c.exec_command(
                f"grep -oE 'text-\\[16px\\]' "
                f"{web_remote}/assets/index-*.js 2>/dev/null | wc -l"
            )
            cnt = out.read().decode().strip() or "0"
            ok4 = int(cnt) >= 1
            mark = "✅" if ok4 else "❌"
            print(f"     {mark}  text-[16px] 매칭 = {cnt}")
            overall_ok = overall_ok and ok4

            # 보조: 14px 가 본문에 안 남아있는지 (참고용 — 다른 곳도 쓰니 0 은 아님)
            _, out, _ = c.exec_command(
                f"grep -oE 'leading-\\[150%\\]' "
                f"{web_remote}/assets/index-*.js 2>/dev/null | wc -l"
            )
            cnt = out.read().decode().strip() or "0"
            print(f"     ℹ️  leading-[150%] 매칭 = {cnt} (본문 가독성 보강)")

            # ── pm2 에러 (배포 직후 30라인) ──
            print("\n  [pm2] 배포 직후 에러 확인")
            _, out, _ = c.exec_command(
                "pm2 logs sajumoon-api --nostream --lines 30 --err 2>/dev/null | "
                "grep -aE 'Error|TypeError|Cannot' | tail -3 || echo '(에러 없음)'"
            )
            body = out.read().decode().strip()
            if body and "(에러 없음)" not in body:
                print(f"     ⚠️  최근 에러:\n     {body[:400]}")
            else:
                print(f"     ✅  에러 없음")
        finally:
            c.close()

    print(f"\n{'='*70}")
    if overall_ok:
        print("✅ 전체 4가지 모두 PASS — 라온선생/사장님 앱 캐시 비우면 즉시 반영")
    else:
        print("❌ 일부 항목 FAIL — 위 ❌ 줄 확인 필요")
    print("="*70)
    return 0 if overall_ok else 1


if __name__ == "__main__":
    sys.exit(main())
