"""settlements API (markPaid + markVoided) prod 배포 + 검증."""
from __future__ import annotations
import os, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=30)
s = c.open_sftp()
files = [
    "admin/settlements/settlements.service.js",
    "admin/settlements/settlements.controller.js",
]
for rel in files:
    local = f"C:/claudeworkspace/sajumoon/api/dist/{rel}"
    remote = f"/data/wwwroot/api.sajumoon.co.kr/dist/{rel}"
    s.put(local, remote)
    print(f"[uploaded] {rel} size={os.path.getsize(local)}")
s.close()

_, o, _ = c.exec_command("pm2 restart sajumoon-api > /tmp/pm2.log 2>&1; echo done", get_pty=False)
print("[restart]", o.read().decode("utf-8", errors="replace").strip())
time.sleep(5)

_, o, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" https://api.sajuplan.com/api/health', get_pty=False)
print("[ext health]", o.read().decode("utf-8", errors="replace").strip())

# 인증 없이 PATCH 호출 → 401 기대
print()
print("=== 인증 없이 호출 검증 (401 기대) ===")
for path in ["/api/admin/settlements/999/mark-paid", "/api/admin/settlements/999/mark-voided"]:
    _, o, _ = c.exec_command(f'curl -s -o /dev/null -w "%{{http_code}}" -X PATCH https://api.sajuplan.com{path}', get_pty=False)
    print(f"PATCH {path} → {o.read().decode('utf-8', errors='replace').strip()}")

c.close()
