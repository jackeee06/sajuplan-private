"""[Audit E-C1] M2NET/AG9 콜백 IP 분석 — final 검증.

prod 의 nginx access log 7일치를 통째로 SSH 로 받아와 로컬에서 정밀 파싱.
정확한 IP 분포 + path 별 분리 + 시간 범위 + User-Agent.
"""
from __future__ import annotations
import os
import re
import sys
from collections import Counter, defaultdict

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

# 분석할 path 패턴
TARGETS = [
    "/api/pg/m2net/call-push",
    "/api/pg/m2net/state-push",
    "/api/pg/charge/callback",
    "/api/pg/charge/vbank-callback",
    "/api/pg/charge/autopay-push",
    "/api/pg/charge/complete",
]

# nginx combined 포맷: $remote_addr - - [time] "METHOD URL HTTP/x.x" status size "ref" "ua"
LINE_RE = re.compile(
    r'^(?P<ip>\S+) \S+ \S+ \[(?P<time>[^\]]+)\] "(?P<method>\S+) (?P<url>\S+) (?P<proto>[^"]+)" (?P<status>\d+) \S+ "[^"]*" "(?P<ua>[^"]*)"'
)


def fetch_logs(host: str, domain: str, pw: str) -> str:
    """양 서버 도메인별 nginx log 전부 받기 (gz 풀어서)."""
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    base = f"/data/wwwlogs/{domain}_nginx.log"
    cmd = f"cat {base} 2>/dev/null; zcat {base}-*.gz 2>/dev/null"
    _, out, _ = c.exec_command(cmd, timeout=120)
    data = out.read().decode("utf-8", errors="replace")
    c.close()
    return data


def analyze(label: str, raw: str) -> None:
    print(f"\n{'='*70}\n[{label}] 분석 결과\n{'='*70}")
    print(f"총 라인 수: {len(raw.splitlines()):,}")

    # path 별 IP/UA 집계
    by_path_ip: dict[str, Counter] = defaultdict(Counter)
    by_path_ua: dict[str, Counter] = defaultdict(Counter)
    time_range: dict[str, list[str]] = defaultdict(list)
    matched = 0

    for line in raw.splitlines():
        m = LINE_RE.match(line)
        if not m:
            continue
        url = m.group("url")
        for t in TARGETS:
            if url.startswith(t):
                ip = m.group("ip")
                ua = m.group("ua")
                tm = m.group("time")
                by_path_ip[t][ip] += 1
                by_path_ua[t][ua] += 1
                time_range[t].append(tm)
                matched += 1
                break

    print(f"콜백 매칭 라인 수: {matched:,}")
    if matched == 0:
        return

    for path in TARGETS:
        if path not in by_path_ip:
            continue
        ips = by_path_ip[path]
        uas = by_path_ua[path]
        times = sorted(time_range[path])
        print(f"\n── {path} (총 {sum(ips.values()):,}건) ──")
        print(f"  unique IP 수: {len(ips)}")
        for ip, cnt in ips.most_common(10):
            print(f"    {cnt:>6} × {ip}")
        print(f"  unique UA 수: {len(uas)}")
        for ua, cnt in uas.most_common(3):
            print(f"    {cnt:>6} × {ua}")
        if times:
            print(f"  시간 범위: {times[0]}  ~  {times[-1]}")


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 필요", file=sys.stderr)
        return 1
    for label, host, domain in [
        ("prod", "104.64.128.103", "api.sajumoon.co.kr"),
        ("test", "172.235.211.75", "api.sajumoon.kr"),
    ]:
        try:
            raw = fetch_logs(host, domain, pw)
            analyze(label, raw)
        except Exception as e:
            print(f"[{label}] 오류: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
