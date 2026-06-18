"""prod setting.app.ios_latest_version 값 변경 (iOS 강제 업데이트 기준 버전).

GET /api/app/version 이 setting(namespace='app') 을 그대로 읽어 앱에 내려준다.
앱은 자기 버전 < ios_latest_version 이면 강제 업데이트 모달을 띄운다.
→ 이 값을 새 버전으로 올리면 옛 버전 iOS 사용자가 강제 업데이트된다.

사용: SSHPASS=... python tools/_set_ios_latest_version.py 1.2.0
주의: 앱스토어에 해당 버전이 실제 노출된 뒤에만 올릴 것. (안 그러면 사용자가 갇힘)
"""
from __future__ import annotations
import os, re, sys
import paramiko

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SSH_HOST = "104.64.128.103"
ENV_FILE = "/data/wwwroot/api.sajumoon.co.kr/.env"


def run(client, sql):
    cmd = f"bash -c 'set -a; . {ENV_FILE}; set +a; psql \"$DATABASE_URL\" -t -A -F \"|\"'"
    stdin, out, err = client.exec_command(cmd, get_pty=False)
    stdin.write(sql + "\n")
    stdin.channel.shutdown_write()
    o = out.read().decode("utf-8", errors="replace")
    e = err.read().decode("utf-8", errors="replace")
    sys.stdout.write(o)
    if e.strip():
        sys.stderr.write(e)
    return o


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: _set_ios_latest_version.py <new_version>", file=sys.stderr)
        return 2
    new_ver = sys.argv[1].strip()
    if not re.fullmatch(r"[0-9]+(\.[0-9]+)*", new_ver):
        print(f"refuse: bad version {new_ver!r}", file=sys.stderr)
        return 2
    pw = os.environ["SSHPASS"]
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(SSH_HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    print("=== BEFORE ===")
    run(client, "SELECT key, value FROM setting WHERE namespace='app' AND key='ios_latest_version';")
    print(f"=== UPDATE ios_latest_version -> {new_ver} ===")
    run(client, f"UPDATE setting SET value='{new_ver}' WHERE namespace='app' AND key='ios_latest_version';")
    print("=== AFTER ===")
    run(client, "SELECT key, value FROM setting WHERE namespace='app' AND key='ios_latest_version';")
    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
