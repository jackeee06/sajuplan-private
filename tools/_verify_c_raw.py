"""m2net API 응답 raw 확인 — URL encoding + verbose."""
import os
import sys
import urllib.parse
import paramiko

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
    except Exception:
        pass


def main() -> int:
    pw = os.environ["SSHPASS"]
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

    _, out, _ = c.exec_command("grep -E '^(M2NET_API_URL|M2NET_CPID|M2NET_HEADER_KEY)=' /data/wwwroot/api.sajumoon.co.kr/.env")
    raw = out.read().decode().strip()
    env = {}
    for line in raw.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            env[k] = v.strip("'\"")

    headerkey = env["M2NET_HEADER_KEY"]
    cpid = env["M2NET_CPID"]
    url_base = env["M2NET_API_URL"]

    # JSON 을 URL encode
    j = '{"list":[{"membid":"295138"}]}'
    encoded = urllib.parse.quote(j, safe='')
    url = f"{url_base}/memb-mgrp/{cpid}/{encoded}"
    print(f"URL: {url}\n")

    print("=== 시도 1: -v + Authorization header ===")
    cmd = f"curl -sv -m 15 -H 'Authorization: {headerkey}' '{url}' 2>&1"
    _, out, _ = c.exec_command(cmd)
    print(out.read().decode()[:3000])

    print("\n=== 시도 2: m2net 호스트 직접 ping/connectivity ===")
    cmd = "curl -sv -m 10 http://passcall.co.kr:25205/ 2>&1"
    _, out, _ = c.exec_command(cmd)
    print(out.read().decode()[:1500])

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
