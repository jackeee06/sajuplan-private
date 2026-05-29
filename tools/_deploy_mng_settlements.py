"""mng dist → prod 배포 (SettlementList status UI 포함)."""
from __future__ import annotations
import os, sys, time, glob
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=30)
s = c.open_sftp()

LOCAL_DIST = r"C:\claudeworkspace\sajumoon\web\mng\dist"
REMOTE_MNG = "/data/wwwroot/sajumoon.co.kr/mng"

# 1. index.html
local_idx = os.path.join(LOCAL_DIST, "index.html")
s.put(local_idx, f"{REMOTE_MNG}/index.html")
print(f"[1] index.html uploaded ({os.path.getsize(local_idx)} bytes)")

# 2. assets/*
asset_files = glob.glob(os.path.join(LOCAL_DIST, "assets", "*"))
for f in asset_files:
    name = os.path.basename(f)
    s.put(f, f"{REMOTE_MNG}/assets/{name}")
    print(f"[2] assets/{name} ({os.path.getsize(f)} bytes)")

# 3. img/ 같은 정적 (있다면)
for sub in ("img", "fonts", "icons"):
    sub_dir = os.path.join(LOCAL_DIST, sub)
    if os.path.isdir(sub_dir):
        for f in glob.glob(os.path.join(sub_dir, "*")):
            name = os.path.basename(f)
            try:
                s.put(f, f"{REMOTE_MNG}/{sub}/{name}")
                print(f"[3] {sub}/{name}")
            except Exception as e:
                print(f"  skip {sub}/{name}: {e}")

s.close()

# 4. env 치환 (__SAJUMOON_ENV__ → prod)
print()
print("[4] env substitute (__SAJUMOON_ENV__ → prod)")
_, o, _ = c.exec_command(f"sed -i 's/__SAJUMOON_ENV__/prod/g' {REMOTE_MNG}/index.html && grep -c 'prod' {REMOTE_MNG}/index.html", get_pty=False)
print(f"  prod 매칭 카운트: {o.read().decode('utf-8', errors='replace').strip()}")

# 5. 외부 검증
time.sleep(2)
_, o, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" https://sajuplan.com/mng/', get_pty=False)
print(f"[5] ext https://sajuplan.com/mng/ → {o.read().decode('utf-8', errors='replace').strip()}")

c.close()
