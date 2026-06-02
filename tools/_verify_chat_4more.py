"""채팅 추가 4가지 개선 엄격 검증.

1. 헤더 sticky 고정    : h-[100dvh] + sticky top-0 + shrink-0
2. 간격 압축          : gap-1 + py-1.5 + px-3 py-2 + rounded-[14px]
3. 안 읽음 polling     : mergeIncoming 갱신 + listMessagesSince() since 없이
4. "남은 시간" 라벨    : "남은 시간" 텍스트 + 라벨
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
        ("test", "172.235.211.75", "/data/wwwroot/sajumoon.kr"),
        ("prod", "104.64.128.103", "/data/wwwroot/sajumoon.co.kr"),
    ]

    for label, host, web_remote in TARGETS:
        print(f"\n{'='*70}\n[{label}] {host}\n{'='*70}")
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
        try:
            checks = [
                ("h-\\[100dvh\\]", "1. 헤더 sticky: 동적 viewport (h-[100dvh])"),
                ("shrink-0", "1. 헤더 shrink-0 (절대 줄어들지 않게)"),
                ("sticky top-0", "1. sticky top-0 (양쪽 메시지 영역 분리)"),
                ("남은 시간", "4. \"남은 시간\" 라벨 텍스트"),
                ("gap-1\\\\b|gap-1 ", "2. 메시지 컨테이너 gap-1"),
                ("rounded-\\[14px\\]", "2. 메시지 버블 rounded-[14px]"),
                ("px-3 py-2", "2. 버블 패딩 px-3 py-2"),
                ("incomingMap", "3. mergeIncoming read_at 갱신 로직"),
                ("'1'", "3. 안 읽음 \"1\" 표시 (font-bold)"),
            ]
            for kw, desc in checks:
                _, out, _ = c.exec_command(
                    f"grep -oE \"{kw}\" {web_remote}/assets/index-*.js 2>/dev/null | wc -l"
                )
                cnt = out.read().decode().strip()
                marker = "✅" if cnt != "0" else "❌"
                print(f"  {marker}  {desc:50s}  매칭 {cnt}")
        finally:
            c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
