"""양 서버 root crontab 에 등급 재산정 라인 등록 (Phase 6 운영 액션).

- 매월 1일 KST 0시 5분 — grade 재산정 API 호출
- 라인 중복 방지: 동일 패턴(grade/recalculate) 이미 있으면 SKIP
- 정산 라인(settlement/monthly)도 누락 시 보충

사용: SSHPASS=... python tools/_install_grade_cron.py
"""
from __future__ import annotations
import base64
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

TARGETS = [
    # (label, host, api_domain)
    ("test", "172.235.211.75", "api.sajumoon.kr"),
    ("prod", "104.64.128.103", "api.sajumoon.co.kr"),
]


def install_one(label: str, host: str, api_domain: str, pw: str) -> int:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

    # 현재 crontab 조회 (없으면 빈 문자열)
    _, stdout, _ = c.exec_command("crontab -l 2>/dev/null || true")
    current = stdout.read().decode("utf-8", errors="replace")

    grade_line = f"5 0 1 * * curl -s 'https://{api_domain}/api/cron/grade/recalculate' >> /var/log/sajumoon_grade.log 2>&1"

    print(f"\n========== [{label}] {host} ==========")
    print("─ 현재 crontab ─")
    print(current.rstrip() or "(비어 있음)")

    new_lines = current.splitlines()
    added: list[str] = []

    if any("grade/recalculate" in ln for ln in new_lines):
        print("✓ 등급 재산정 라인 이미 존재 — SKIP")
    else:
        new_lines.append(grade_line)
        added.append("grade/recalculate")

    if not added:
        print("(추가할 항목 없음)")
        c.close()
        return 0

    # 새 crontab 적용 (base64 로 따옴표 이스케이프 우회)
    new_content = "\n".join(ln for ln in new_lines if ln.strip()) + "\n"
    b64 = base64.b64encode(new_content.encode("utf-8")).decode("ascii")
    inner = f"echo {b64} | base64 -d | crontab -"
    _, stdout, stderr = c.exec_command(f"bash -lc {repr(inner)}")
    rc = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace")
    if rc != 0:
        print(f"✗ crontab 적용 실패 rc={rc}: {err}")
        c.close()
        return rc

    # 검증
    _, stdout, _ = c.exec_command("crontab -l")
    verified = stdout.read().decode("utf-8", errors="replace")
    print(f"─ 적용 후 crontab ({', '.join(added)} 추가) ─")
    print(verified.rstrip())
    c.close()
    return 0


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 환경변수 필요", file=sys.stderr)
        return 1
    rc = 0
    for label, host, api_domain in TARGETS:
        r = install_one(label, host, api_domain, pw)
        if r != 0:
            rc = r
    return rc


if __name__ == "__main__":
    sys.exit(main())
