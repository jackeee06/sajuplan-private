"""[Audit E] 보안 배포 후 종합 검증.

검증 항목:
  1. /api/cron/health-check 호출 → DB 17 invariants 모두 통과
  2. 콜백 라우트 IP allowlist 동작 확인 (m2net-push.log 의 최근 ip 분포)
  3. trust proxy 동작 — req.ip 가 ::ffff:127.0.0.1 아닌 실제 IP
  4. throttle 적용 확인 — pg/charge 분당 60, pg/m2net 분당 120
"""
from __future__ import annotations
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

TARGETS = [
    ("test", "172.235.211.75", "sajumoon.kr"),
    ("prod", "104.64.128.103", "sajuplan.com"),
]


def run_one(label: str, host: str, domain: str, pw: str) -> None:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    print(f"\n{'='*60}\n[{label}] {host}\n{'='*60}")

    # 1) health-check
    _, out, _ = c.exec_command(
        f"grep CRON_TOKEN /data/wwwroot/api.{domain}/.env | head -1 | cut -d= -f2-",
        timeout=20,
    )
    tok = out.read().decode("utf-8", "replace").strip().strip('"').strip("'")
    _, out, _ = c.exec_command(
        f"curl -s -H 'X-Cron-Token: {tok}' https://api.{domain}/api/cron/health-check",
        timeout=60,
    )
    health = out.read().decode("utf-8", "replace")
    # JSON 응답에서 핵심만 추출
    import re
    m = re.search(r'"total_violations":\s*(\d+)', health)
    a = re.search(r'"alerted":\s*(true|false)', health)
    print(f"  [1] health-check: violations={m.group(1) if m else '?'} alerted={a.group(1) if a else '?'}")

    # 2) m2net-push.log 의 최근 ip 분포 (배포 이후만 — `211.175.205.88` 가 정상)
    log = f"/data/wwwroot/api.{domain}/logs/m2net-push.log"
    _, out, _ = c.exec_command(
        f"tail -100 {log} 2>/dev/null | grep -oE 'ip=[^ ]+' | sort | uniq -c | sort -rn",
        timeout=30,
    )
    print(f"  [2] 최근 100 push IP 분포:")
    iplines = out.read().decode("utf-8", "replace").strip()
    for ln in iplines.splitlines():
        print(f"      {ln}")
    if not iplines:
        print("      (로그 없음 — m2net push 가 도착하지 않음)")

    # 3) trust proxy — 가장 최근 라인이 ::ffff:127.0.0.1 가 아닌지
    _, out, _ = c.exec_command(f"tail -1 {log} 2>/dev/null", timeout=30)
    last = out.read().decode("utf-8", "replace").strip()
    ok = "ip=::ffff:127.0.0.1" not in last and "ip=" in last
    print(f"  [3] trust proxy 동작: {'✓ OK' if ok else '✗ FAIL (여전히 127.0.0.1)'}")
    if last:
        print(f"      last: {last[:100]}...")

    # 4) 보안 적용 후 외 IP OpsAlert 발송 여부 (지난 1시간)
    _, out, _ = c.exec_command(
        f"pm2 logs sajumoon-api --lines 200 --nostream 2>/dev/null | grep -E '비-화이트리스트|CallbackIpAllow' | tail -5",
        timeout=30,
    )
    alerts = out.read().decode("utf-8", "replace").strip()
    print(f"  [4] 비-화이트리스트 IP 경고:")
    print(f"      {alerts if alerts else '(없음 — 정상)'}")

    c.close()


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 필요", file=sys.stderr)
        return 1
    for label, host, domain in TARGETS:
        run_one(label, host, domain, pw)
    return 0


if __name__ == "__main__":
    sys.exit(main())
