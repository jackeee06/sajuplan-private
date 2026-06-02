"""[Audit E-C1] 콜백 발신 IP 수집/분석 — v3.

데이터 소스 확정:
  - prod 의 /data/wwwroot/api.sajuplan.com/logs/m2net-push.log (2.8MB+)
  - 카페24 호스팅 — Apache/nginx 어느 쪽이 frontend 인지 자동 탐지

req.ip 가 nginx 뒷단이면 127.0.0.1 일 수 있어 trust proxy 설정 함께 확인.
"""
from __future__ import annotations
import os
import re
import sys
from collections import Counter

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

TARGETS = [
    ("test", "172.235.211.75", "api.sajumoon.kr"),
    ("prod", "104.64.128.103", "api.sajuplan.com"),
]


def exec_cmd(c, cmd: str, timeout: int = 60) -> str:
    _, out, err = c.exec_command(cmd, timeout=timeout)
    return out.read().decode("utf-8", "replace")


def run_one(label: str, host: str, api_domain: str, pw: str) -> None:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

    print(f"\n{'='*70}\n[{label}] {host} ({api_domain})\n{'='*70}")

    # 0) 80/443 으로 들어오는 frontend 웹서버 확인
    print("\n[0] frontend 웹서버 (80/443 listening process)")
    print(exec_cmd(c, "ss -tlnp 2>/dev/null | grep -E ':80 |:443 ' | head -5"))

    # 1) Apache access log 위치
    print("\n[1] Apache access log 후보")
    print(exec_cmd(c, "ls -la /var/log/httpd/ /var/log/apache2/ 2>/dev/null | head -20"))

    # 2) nginx access log 가 활성인지
    print("\n[2] nginx access log 후보")
    print(exec_cmd(c, "ls -la /var/log/nginx/ 2>/dev/null | head -10"))

    # 3) 우리 app file log 의 IP 분포
    log_path = f"/data/wwwroot/{api_domain}/logs/m2net-push.log"
    print(f"\n[3] {log_path} 분포")
    sz_cmd = f"[ -f {log_path} ] && du -h {log_path}"
    print(exec_cmd(c, sz_cmd))

    # 우리 file log 포맷: `2026-05-17T01:07:00.000Z [call-push] ip=X.X.X.X body={...}`
    ip_count_cmd = f"awk '{{for(i=1;i<=NF;i++) if($i ~ /^ip=/) print $i}}' {log_path} | sort | uniq -c | sort -rn"
    print("\n[4] m2net-push.log 의 req.ip 분포 (우리 app 측 view)")
    print(exec_cmd(c, ip_count_cmd, timeout=60))

    # 5) call-push 종류별 IP
    print("\n[5] kind 별 IP 분포 (top 20)")
    kind_ip_cmd = (
        f"awk '{{ "
        f"kind=\"\"; ip=\"\"; "
        f"for(i=1;i<=NF;i++){{ "
        f"  if($i ~ /^\\[/) kind=$i; "
        f"  if($i ~ /^ip=/) ip=$i; "
        f"}} "
        f"if(kind && ip) print kind, ip "
        f"}}' {log_path} | sort | uniq -c | sort -rn | head -20"
    )
    print(exec_cmd(c, kind_ip_cmd, timeout=60))

    # 6) 최근 100건의 시각/IP 추세
    print("\n[6] 최근 30건 (시각/IP)")
    print(exec_cmd(c,
        f"tail -30 {log_path} | awk '{{print $1, $2, $3}}'",
        timeout=30,
    ))

    # 7) X-Forwarded-For 가 body 가 아닌 headers 에 들어왔다면 — 우리 app 가 헤더 사용 여부
    print("\n[7] body 중 forwarded-for 흔적 (있다면)")
    print(exec_cmd(c,
        f"grep -o 'forwarded[^,}}]*' {log_path} 2>/dev/null | head -5",
        timeout=30,
    ))

    # 8) autopay-push.log 도 있다면 별도 확인
    autopay_log = f"/data/wwwroot/{api_domain}/logs/autopay-push.log"
    print(f"\n[8] {autopay_log}")
    print(exec_cmd(c,
        f"[ -f {autopay_log} ] && du -h {autopay_log} && "
        f"awk '{{for(i=1;i<=NF;i++) if($i ~ /^ip=/) print $i}}' {autopay_log} | sort | uniq -c | sort -rn || echo '(없음)'",
        timeout=30,
    ))

    c.close()


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 환경변수 필요", file=sys.stderr)
        return 1
    for label, host, domain in TARGETS:
        run_one(label, host, domain, pw)
    return 0


if __name__ == "__main__":
    sys.exit(main())
