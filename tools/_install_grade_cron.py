"""양 서버 root crontab 에 운영 cron 라인 일괄 등록 (Phase 6 운영 액션).

등록 라인 (순서 중요):
  1. 매월 1일 KST 0시 5분 — grade 재산정 API 호출
  2. 매월 1일 KST 4시 — settlement (정산) API 호출
     → grade 재산정이 먼저 끝난 뒤 정산이 새 등급 + revenue_rate 로 계산

라인 중복 방지: 동일 패턴(URL substring) 이미 있으면 SKIP.
재실행 안전 — 무한히 다시 돌려도 중복 없음.

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

    # CRON_TOKEN 조회 — 모든 cron URL 에 포함
    _, out, _ = c.exec_command(
        f"grep '^CRON_TOKEN=' /data/wwwroot/api.{api_domain.split('.', 1)[1] if api_domain.startswith('api.') else api_domain}/.env"
        " 2>/dev/null | head -1 | cut -d= -f2-"
    )
    token = out.read().decode("utf-8", errors="replace").strip().strip('"').strip("'")
    if not token:
        print(f"  ⚠ CRON_TOKEN .env 에서 못 찾음 — 헤더 없이 등록됨 (가드 거부될 것)")
    # [Audit E-C4] 헤더 방식 — 쿼리스트링은 nginx access log 노출 위험. -H 'X-Cron-Token: ...' 사용.
    token_h = f"-H 'X-Cron-Token: {token}' " if token else ""

    # 현재 crontab 조회 (없으면 빈 문자열)
    _, stdout, _ = c.exec_command("crontab -l 2>/dev/null || true")
    current = stdout.read().decode("utf-8", errors="replace")

    # (라인, 매칭_패턴, 라벨) 튜플 목록 — 순서대로 검사/추가
    cron_jobs = [
        (
            f"5 0 1 * * curl -s {token_h}'https://{api_domain}/api/cron/grade/recalculate' >> /var/log/sajumoon_grade.log 2>&1",
            "grade/recalculate",
            "등급 재산정 (1일 00:05 KST)",
        ),
        (
            f"0 4 1 * * curl -s {token_h}'https://{api_domain}/api/cron/settlement/monthly' >> /var/log/sajumoon_settlement.log 2>&1",
            "settlement/monthly",
            "월별 정산 (1일 04:00 KST)",
        ),
        # [Audit C-#9] 채팅 정산 재시도 — 10분 간격 (M2NET 일시 장애 대응)
        (
            f"5,15,25,35,45,55 * * * * curl -s {token_h}'https://{api_domain}/api/cron/retry/chat-settle' >> /var/log/sajumoon_retry.log 2>&1",
            "retry/chat-settle",
            "채팅 정산 재시도 (10분 간격)",
        ),
        # [Audit C-#10] M2NET 적립 재시도 — 10분 간격
        (
            f"0,10,20,30,40,50 * * * * curl -s {token_h}'https://{api_domain}/api/cron/retry/payment-m2net' >> /var/log/sajumoon_retry.log 2>&1",
            "retry/payment-m2net",
            "M2NET 결제 적립 재시도 (10분 간격)",
        ),
        # [Phase G] DB 일관성 health-check — 매시간 정각
        (
            f"0 * * * * curl -s {token_h}'https://{api_domain}/api/cron/health-check' >> /var/log/sajumoon_health.log 2>&1",
            "health-check",
            "DB 일관성 health-check (매시간)",
        ),
    ]

    print(f"\n========== [{label}] {host} ==========")
    print("─ 현재 crontab ─")
    print(current.rstrip() or "(비어 있음)")

    new_lines = current.splitlines()
    added: list[str] = []

    for line, pattern, label_kr in cron_jobs:
        if any(pattern in ln for ln in new_lines):
            print(f"✓ {label_kr} — 이미 등록됨")
        else:
            new_lines.append(line)
            added.append(label_kr)
            print(f"+ {label_kr} — 신규 추가")

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
    print(f"─ 적용 후 crontab (추가: {', '.join(added)}) ─")
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
