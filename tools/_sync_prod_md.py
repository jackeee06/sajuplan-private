"""MONEY_FLOW.md + ALERT_MAPPING.md prod 동기화 (최신 변경 반영)."""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)
s = c.open_sftp()
for name in ("MONEY_FLOW.md", "ALERT_MAPPING.md"):
    local = rf"C:\claudeworkspace\sajumoon\{name}"
    remote = f"/data/wwwroot/sajumoon.co.kr/{name}"
    s.put(local, remote)
    print(f"[{name}] size={s.stat(remote).st_size}")
s.close()
c.close()
