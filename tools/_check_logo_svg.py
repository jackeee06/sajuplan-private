"""Compare local vs prod logo_b.svg size + check Cache-Control headers."""
import os, sys, paramiko
from pathlib import Path

local = Path(r"C:\claudeworkspace\sajumoon\web\user\public\img\logo_b.svg")
print(f"local logo_b.svg: {local.stat().st_size}B")

pw = os.environ["SSHPASS"]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=10)
_, out, _ = c.exec_command("ls -la /data/wwwroot/sajumoon.co.kr/img/logo*.svg 2>&1 | head -10")
print("\nprod /data/wwwroot/sajumoon.co.kr/img/:")
print(out.read().decode("utf-8", errors="replace"))
_, out, _ = c.exec_command("ls -la /data/wwwroot/sajuplan.com/img/logo*.svg 2>&1 | head -10")
print("\nprod /data/wwwroot/sajuplan.com/img/:")
print(out.read().decode("utf-8", errors="replace"))
c.close()
