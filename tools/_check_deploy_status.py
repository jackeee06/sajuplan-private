"""Check if new favicon files have landed on prod user site."""
import os, sys, paramiko
pw = os.environ["SSHPASS"]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=10)
cmd = "ls -la /data/wwwroot/sajumoon.co.kr/ 2>&1 | grep -E 'favicon|apple-touch|android-chrome|webmanifest|index.html' | head -20"
_, out, _ = c.exec_command(cmd, get_pty=False)
sys.stdout.write(out.read().decode("utf-8", errors="replace"))
c.close()
