"""404 원인 진단:
  1. dist/admin/referrals 가 빌드됐는지
  2. dist/admin/admin.module.js 에 AdminReferralsModule import 가 있는지
  3. 실제 서비스 포트 확인 (ecosystem + process listen)
  4. 기존 잘 알려진 라우트 응답 확인 (예: /admin/auth/login POST)
  5. test 서버에 DATABASE_URL 검색
"""
import os, sys, paramiko

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass


def run(c, cmd, timeout=20):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", "replace"), e.read().decode("utf-8", "replace")


for label, host, domain in [
    ("test", "172.235.211.75", "api.sajumoon.kr"),
    ("prod", "104.64.128.103", "api.sajumoon.co.kr"),
]:
    print(f"\n========== [{label}] {host} ==========")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

    # 1. dist/admin/referrals 디렉토리
    o, _ = run(c, f"ls /data/wwwroot/{domain}/dist/admin/referrals/ 2>&1")
    print(f"\n[1] dist/admin/referrals/:")
    print(o.rstrip() or "(empty)")

    # 2. admin.module.js 에 AdminReferralsModule 있는지
    o, _ = run(c, f"grep -c 'AdminReferralsModule\\|referrals.module' /data/wwwroot/{domain}/dist/admin/admin.module.js 2>&1 || echo NOTFOUND")
    print(f"\n[2] admin.module.js 에 AdminReferralsModule grep count: {o.strip()}")

    # 3. 실제 listen 포트
    o, _ = run(c, f"ss -tlnp 2>/dev/null | grep -E 'node|sajumoon' || netstat -tlnp 2>/dev/null | grep node | head -5")
    print(f"\n[3] node listen ports:\n{o.rstrip() or '(none)'}")

    # 3b. ecosystem
    o, _ = run(c, f"cat /data/wwwroot/{domain}/ecosystem.config.js 2>/dev/null | head -30")
    print(f"\n[3b] ecosystem.config.js (top 30):\n{o.rstrip() or '(none)'}")

    # 4. 기존 라우트 응답 확인 — root /
    o, _ = run(c, f"curl -s -o /dev/null -w 'HTTP %{{http_code}}' http://127.0.0.1:3000/admin/auth/login -X POST -H 'Content-Type: application/json' -d '{{}}' --max-time 5")
    print(f"\n[4] localhost:3000 /admin/auth/login POST → {o.strip()}")

    # 4b. 다른 포트 시도 — 4000, 8080
    for p in [3000, 4000, 8080, 8000]:
        o, _ = run(c, f"curl -s -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{p}/admin/auth/login -X POST -H 'Content-Type: application/json' -d '{{}}' --max-time 3 2>&1")
        print(f"     port {p}: {o.strip()}")

    # 5. test 서버 DATABASE_URL 검색
    if label == "test":
        o, _ = run(c, f"grep -E '^DATABASE_URL=' /data/wwwroot/{domain}/.env 2>&1 | head -3")
        print(f"\n[5] test .env DATABASE_URL: {o.rstrip() or '(empty)'}")
        o, _ = run(c, f"ls /data/wwwroot/{domain}/.env* 2>&1")
        print(f"     .env files: {o.rstrip()}")
        o, _ = run(c, f"psql --version 2>&1")
        print(f"     psql: {o.rstrip()}")

    c.close()
