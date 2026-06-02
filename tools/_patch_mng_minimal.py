#!/usr/bin/env python3
"""mng 핵심 파일만 SFTP — index.html + 활성 assets 만 전송 (외과 패치).

51MB 전체 tar.gz 대신 1.7MB 만 전송하여 느린 네트워크에서 hang 회피."""
import os, sys, re, paramiko
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DIST = Path(__file__).resolve().parent.parent / "web" / "mng" / "dist"

# index.html 에서 활성 js/css 파일명 추출
index_html_content = (DIST / "index.html").read_text(encoding="utf-8")
js_match = re.search(r'/assets/(index-[A-Za-z0-9_-]+\.js)', index_html_content)
css_match = re.search(r'/assets/(index-[A-Za-z0-9_-]+\.css)', index_html_content)
js_name = js_match.group(1)
css_name = css_match.group(1)

print(f"활성 번들: {js_name} + {css_name}")

FILES_TO_SEND = [
    (DIST / "index.html",            "index.html"),
    (DIST / "assets" / js_name,      f"assets/{js_name}"),
    (DIST / "assets" / css_name,     f"assets/{css_name}"),
]

TARGETS = [
    ("test", "172.235.211.75", "/data/wwwroot/sajumoon.kr/mng", "test"),
    ("prod", "104.64.128.103", "/data/wwwroot/sajumoon.co.kr/mng", "prod"),
]

pw = os.environ["SSHPASS"]
for label, host, remote_dir, env_value in TARGETS:
    print(f"\n[{label}] {host} → {remote_dir}")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    transport = ssh.get_transport()
    if transport: transport.set_keepalive(15)

    sftp = ssh.open_sftp()
    for local_path, remote_rel in FILES_TO_SEND:
        remote_path = f"{remote_dir}/{remote_rel}"
        # 부모 디렉토리 보장
        remote_parent = remote_path.rsplit('/', 1)[0]
        ssh.exec_command(f"mkdir -p '{remote_parent}'", timeout=10)[1].channel.recv_exit_status()
        size = local_path.stat().st_size
        print(f"  put {remote_rel}  ({size:,} bytes)")
        sftp.put(str(local_path), remote_path)
    sftp.close()

    # __SAJUMOON_ENV__ 치환
    stdin, stdout, stderr = ssh.exec_command(
        f"sed -i 's/__SAJUMOON_ENV__/{env_value}/g' '{remote_dir}/index.html' && echo '[env] → {env_value}'",
        timeout=10,
    )
    print(f"  {stdout.read().decode('utf-8', errors='replace').strip()}")
    rc = stdout.channel.recv_exit_status()
    if rc != 0:
        print(f"  ✗ env sed rc={rc}: {stderr.read().decode('utf-8', errors='replace')}")
    ssh.close()
    print(f"  ✓ done {host}")

print("\n✓ 양 서버 minimal 배포 완료")
