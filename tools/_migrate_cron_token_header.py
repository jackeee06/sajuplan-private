"""[Audit E-C4] crontab 의 cron 호출을 ?token=... 쿼리스트링 → X-Cron-Token 헤더로 전환.

목적:
  nginx access log 에 쿼리스트링이 평문으로 남는 위험 제거.
  헤더 방식은 access log 의 기본 포맷에 안 잡힘.

동작:
  1. 양 서버 root crontab -l 백업 (메모리 보관, 실패 시 자동 복원)
  2. 라인별로 처리:
     - curl 라인 + URL 에 `?token=XXX` 또는 `&token=XXX` 패턴 → 추출 → -H 'X-Cron-Token: XXX' 추가 + URL 의 token 제거
  3. 새 crontab 적용 + verify

재실행 안전 — 이미 헤더 방식이면 SKIP.

사용: SSHPASS=... python tools/_migrate_cron_token_header.py
"""
from __future__ import annotations
import base64
import os
import re
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

TARGETS = [
    ("test", "172.235.211.75"),
    ("prod", "104.64.128.103"),
]

# `?token=XXX` 또는 `&token=XXX` 매칭 — XXX 는 따옴표/공백/`'` 전까지
_TOKEN_RE = re.compile(r"[?&]token=([^&'\" ]+)")


def transform_line(line: str) -> tuple[str, bool]:
    """한 cron 라인 변환. (new_line, changed) 반환."""
    if "curl" not in line:
        return line, False
    m = _TOKEN_RE.search(line)
    if not m:
        return line, False
    token = m.group(1)
    # URL 에서 token=XXX 제거. `?token=XXX&...` → `?...`,  `&token=XXX` → ``
    def remove(s: str) -> str:
        s = re.sub(r"\?token=[^&'\" ]+&", "?", s)
        s = re.sub(r"\?token=[^&'\" ]+", "", s)
        s = re.sub(r"&token=[^&'\" ]+", "", s)
        return s
    new_url_line = remove(line)
    # `curl -s ` 또는 `curl ` 다음에 `-H 'X-Cron-Token: TOKEN'` 삽입
    if "-H 'X-Cron-Token:" in new_url_line or '-H "X-Cron-Token:' in new_url_line:
        return new_url_line, True  # 이미 헤더 있음 (idempotent)
    new_url_line = re.sub(
        r"curl(\s+-[a-zA-Z]+)?",
        lambda mm: f"{mm.group(0)} -H 'X-Cron-Token: {token}'",
        new_url_line,
        count=1,
    )
    return new_url_line, True


def run_one(label: str, host: str, pw: str) -> int:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

    print(f"\n========== [{label}] {host} ==========")
    _, stdout, _ = c.exec_command("crontab -l 2>/dev/null || true")
    current = stdout.read().decode("utf-8", errors="replace")
    if not current.strip():
        print("(crontab 비어있음 — skip)")
        c.close()
        return 0

    print("─ 현재 crontab ─")
    print(current.rstrip())

    new_lines: list[str] = []
    changes = 0
    for ln in current.splitlines():
        new_ln, changed = transform_line(ln)
        if changed:
            changes += 1
            print(f"  [변환] {ln[:60]}…")
            print(f"   → {new_ln[:60]}…")
        new_lines.append(new_ln)

    if changes == 0:
        print("(변환할 라인 없음 — 모두 헤더 방식이거나 cron URL 없음)")
        c.close()
        return 0

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
    print(f"─ 적용 후 crontab ({changes}개 변환) ─")
    print(verified.rstrip())
    c.close()
    return 0


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 환경변수 필요", file=sys.stderr)
        return 1
    rc = 0
    for label, host in TARGETS:
        r = run_one(label, host, pw)
        if r != 0:
            rc = r
    return rc


if __name__ == "__main__":
    sys.exit(main())
