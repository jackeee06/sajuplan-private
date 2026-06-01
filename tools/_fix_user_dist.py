"""user dist 전체 SFTP — CSS 404 긴급 fix."""
from __future__ import annotations
import os, sys, time, glob
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=30)
s = c.open_sftp()

LOCAL = r"C:\claudeworkspace\sajumoon\web\user\dist"
REMOTE = "/data/wwwroot/sajumoon.co.kr"

# 1. assets/* 전체 (특히 누락된 CSS)
asset_files = glob.glob(os.path.join(LOCAL, "assets", "*"))
print(f"[1] assets/ 업로드 ({len(asset_files)} files)")
for f in asset_files:
    name = os.path.basename(f)
    s.put(f, f"{REMOTE}/assets/{name}")
print(f"[1] done — 마지막: {os.path.basename(asset_files[-1])}")

# 2. index.html
s.put(os.path.join(LOCAL, "index.html"), f"{REMOTE}/index.html")
print("[2] index.html 업로드")
s.close()

# 3. env 치환
_, o, _ = c.exec_command(f"sed -i 's/__SAJUMOON_ENV__/prod/g' {REMOTE}/index.html && grep -c 'prod' {REMOTE}/index.html", get_pty=False)
print(f"[3] env 치환 (prod 매칭 카운트): {o.read().decode('utf-8', errors='replace').strip()}")

# 4. 검증 — CSS 가 200 응답인지
time.sleep(2)
_, o, _ = c.exec_command('CSS=$(curl -s https://sajuplan.com/ | grep -oE "index-[A-Za-z0-9_-]+\\.css" | head -1) && curl -s -o /dev/null -w "%{http_code} %{size_download}" "https://sajuplan.com/assets/$CSS"', get_pty=False)
print(f"[4] CSS 응답: {o.read().decode('utf-8', errors='replace').strip()}")

_, o, _ = c.exec_command('JS=$(curl -s https://sajuplan.com/ | grep -oE "index-[A-Za-z0-9_-]+\\.js" | head -1) && curl -s -o /dev/null -w "%{http_code} %{size_download}" "https://sajuplan.com/assets/$JS"', get_pty=False)
print(f"[4] JS 응답: {o.read().decode('utf-8', errors='replace').strip()}")

c.close()
