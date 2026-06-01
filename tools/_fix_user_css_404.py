"""prod user index.html 의 CSS 404 긴급 진단."""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

print("=== /data/wwwroot/sajumoon.co.kr/index.html 파일 시점 ===")
_, o, _ = c.exec_command("ls -la /data/wwwroot/sajumoon.co.kr/index.html /data/wwwroot/sajumoon.co.kr/index.html.bak* 2>&1 | head -5", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

print("=== index.html 안의 assets 참조 ===")
_, o, _ = c.exec_command("grep -oE 'index-[A-Za-z0-9_-]+\\.(css|js)' /data/wwwroot/sajumoon.co.kr/index.html | sort -u", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

print("=== /data/wwwroot/sajumoon.co.kr/assets/ 최근 파일 5개 (시점 순) ===")
_, o, _ = c.exec_command("ls -lt /data/wwwroot/sajumoon.co.kr/assets/ | head -10", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

print("=== index-D1MZfZFe.css 존재 확인 ===")
_, o, _ = c.exec_command("ls -la /data/wwwroot/sajumoon.co.kr/assets/index-D1MZfZFe.css 2>&1", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

print("=== 가장 최근 css 파일 (실제 사용 가능한 것) ===")
_, o, _ = c.exec_command("ls -t /data/wwwroot/sajumoon.co.kr/assets/index-*.css | head -3", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

c.close()
