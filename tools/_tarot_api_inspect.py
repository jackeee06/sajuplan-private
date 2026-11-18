"""타로 라이브 api 배포 전 서버 환경 점검(read-only)."""
from __future__ import annotations
import sys
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

HOST = "104.64.128.103"


def load_pw(root: Path):
    f = root / ".env.local"
    for line in f.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("SSHPASS="):
            return line.split("=", 1)[1].strip("'\"")
    return None


def sh(c, cmd):
    _i, o, e = c.exec_command(cmd)
    return (o.read().decode("utf-8", "replace") + e.read().decode("utf-8", "replace")).strip()


def main():
    root = Path(__file__).resolve().parent.parent
    pw = load_pw(root)
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, timeout=20)
    for title, cmd in [
        ("node/npm", "node -v; npm -v"),
        ("pm2 존재?", "command -v pm2 && pm2 -v || echo 'no pm2'"),
        ("pm2 목록", "pm2 list 2>/dev/null | head -20 || echo none"),
        ("리스닝 포트(8000~9000대)", "ss -tlnp 2>/dev/null | grep -oE ':(8[0-9]{3}|9[0-9]{3})' | sort -u | head -40"),
        ("8790 사용중?", "ss -tlnp 2>/dev/null | grep ':8790' || echo 'free'"),
        ("메인 api 구동 방식", "pm2 jlist 2>/dev/null | head -c 400; echo; ps -eo args | grep -E 'node .*main|nest' | grep -v grep | head -3"),
        ("nginx upstream/proxy 예시(메인 api)", "grep -RIl 'proxy_pass' /usr/local/nginx/conf/vhost/ 2>/dev/null | head -2"),
        ("api.sajuplan vhost proxy 발췌", "sed -n '1,60p' /usr/local/nginx/conf/vhost/api.sajuplan.com.conf 2>/dev/null | grep -nE 'proxy_pass|location|upstream|listen|server_name' | head -20"),
    ]:
        print(f"\n===== {title} =====")
        print(sh(c, cmd))
    c.close()


if __name__ == "__main__":
    main()
