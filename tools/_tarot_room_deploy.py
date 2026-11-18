"""타로 라이브(상담) 배포 — tarotroom.sajuplan.com.
  - api: 번들(server.bundle.mjs) 업로드 + pm2 tarot-api(:8790) 기동
  - vhost: tarotroom.sajuplan.com (마케팅과 같은 webroot, /ws·/api/tarot 프록시, noindex) + SSL
안전: 기존 server block 무수정 additive. nginx -t 통과 후에만 reload.

사용:
  python tools/_tarot_room_deploy.py api     # api만 (pm2)
  python tools/_tarot_room_deploy.py vhost    # vhost+SSL만
  python tools/_tarot_room_deploy.py all      # 둘 다
"""
from __future__ import annotations
import sys
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

HOST = "104.64.128.103"
NGINX = "/usr/local/nginx/sbin/nginx"
ACME = "/root/.acme.sh/acme.sh"
WEBROOT = "/data/wwwroot/tarot"          # 마케팅과 동일(앱이 hostname으로 분기)
API_DIR = "/data/wwwroot/tarot-api"
API_PORT = 8790
VHOST = "/usr/local/nginx/conf/vhost/tarotroom.sajuplan.com.conf"
SSL_CRT = "/usr/local/nginx/conf/ssl/tarotroom.sajuplan.com.crt"
SSL_KEY = "/usr/local/nginx/conf/ssl/tarotroom.sajuplan.com.key"

VHOST_HTTP = f"""# 타로 라이브(상담) — tarotroom.sajuplan.com (additive)
server {{
  listen 80; listen [::]:80;
  server_name tarotroom.sajuplan.com;
  root {WEBROOT};
  location /.well-known/acme-challenge/ {{ root {WEBROOT}; }}
  location / {{ try_files $uri $uri/ /index.html; }}
}}
"""

VHOST_HTTPS = f"""# 타로 라이브(상담) — tarotroom.sajuplan.com (비공개·noindex, 마케팅과 같은 파일)
server {{
  listen 80; listen [::]:80;
  server_name tarotroom.sajuplan.com;
  location /.well-known/acme-challenge/ {{ root {WEBROOT}; }}
  location / {{ return 301 https://tarotroom.sajuplan.com$request_uri; }}
}}
server {{
  listen 443 ssl; listen [::]:443 ssl; http2 on;
  server_name tarotroom.sajuplan.com;
  ssl_certificate {SSL_CRT};
  ssl_certificate_key {SSL_KEY};
  ssl_protocols TLSv1.2 TLSv1.3;
  add_header X-Robots-Tag "noindex, nofollow" always;   # 비공개 — 검색 차단
  access_log /data/wwwlogs/tarotroom.sajuplan.com_nginx.log combined;
  root {WEBROOT};
  index index.html;
  # 라이브 동기화 API + WebSocket
  location /api/tarot/ {{
    proxy_pass http://127.0.0.1:{API_PORT};
    proxy_set_header Host $host;
  }}
  location /ws {{
    proxy_pass http://127.0.0.1:{API_PORT};
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
  }}
  location ~* \\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico|webp)$ {{ expires 30d; access_log off; try_files $uri =404; }}
  location / {{ try_files $uri $uri/ /index.html; }}
}}
"""


def load_pw(root: Path):
    for line in (root / ".env.local").read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("SSHPASS="):
            return line.split("=", 1)[1].strip("'\"")
    return None


def connect(pw):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, timeout=20)
    return c


def sh(c, cmd):
    _i, o, e = c.exec_command(cmd)
    code = o.channel.recv_exit_status()
    return code, (o.read().decode("utf-8", "replace") + e.read().decode("utf-8", "replace")).strip()


def put(c, local: Path, remote: str):
    sftp = c.open_sftp()
    sh(c, f"mkdir -p {remote.rsplit('/', 1)[0]}")
    sftp.put(str(local), remote)
    sftp.close()


def put_text(c, remote, content):
    sftp = c.open_sftp()
    with sftp.file(remote, "w") as fh:
        fh.write(content)
    sftp.close()


def nginx_reload(c):
    code, out = sh(c, f"{NGINX} -t 2>&1")
    print(out)
    if code != 0:
        print("  ⛔ nginx -t 실패 — reload 안 함", file=sys.stderr)
        return False
    sh(c, f"{NGINX} -s reload")
    print("  ✓ nginx reload")
    return True


def deploy_api(c, root: Path):
    bundle = root / "tarot" / "packages" / "api" / "dist" / "server.bundle.cjs"
    if not bundle.exists():
        print("api 번들 없음 — npm run bundle -w @tarot/api 먼저", file=sys.stderr)
        return False
    print("[api] 번들 업로드")
    put(c, bundle, f"{API_DIR}/server.cjs")
    print("[api] pm2 (재)기동 :8790")
    sh(c, "pm2 delete tarot-api 2>/dev/null")
    code, out = sh(c, f"cd {API_DIR} && PORT={API_PORT} pm2 start server.cjs --name tarot-api 2>&1 && pm2 save 2>&1")
    print(out[-600:])
    _c, h = sh(c, f"sleep 1; curl -s http://127.0.0.1:{API_PORT}/api/tarot/health")
    print(f"  health: {h}")
    return '"ok":true' in h


def deploy_vhost(c):
    print("[vhost] HTTP vhost → nginx -t → reload")
    put_text(c, VHOST, VHOST_HTTP)
    if not nginx_reload(c):
        sh(c, f"rm -f {VHOST}")
        return False
    print("[vhost] SSL 발급(acme)")
    code, out = sh(c, f"{ACME} --issue -d tarotroom.sajuplan.com -w {WEBROOT} --keylength ec-256 --server letsencrypt 2>&1")
    print(out[-900:])
    sh(c, f'{ACME} --install-cert -d tarotroom.sajuplan.com --ecc --key-file {SSL_KEY} --fullchain-file {SSL_CRT} --reloadcmd "{NGINX} -s reload" 2>&1')
    _c, ok = sh(c, f"test -f {SSL_CRT} && echo OK || echo NO")
    if "OK" not in ok:
        print("  SSL 미설치 — HTTP 유지", file=sys.stderr)
        return False
    print("[vhost] HTTPS vhost 교체")
    put_text(c, VHOST, VHOST_HTTPS)
    if not nginx_reload(c):
        put_text(c, VHOST, VHOST_HTTP)
        nginx_reload(c)
        return False
    _c, head = sh(c, "curl -skI https://tarotroom.sajuplan.com/ | head -1")
    _c, robots = sh(c, "curl -skI https://tarotroom.sajuplan.com/ | grep -i x-robots")
    print(f"  {head}\n  {robots}")
    return True


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    root = Path(__file__).resolve().parent.parent
    c = connect(load_pw(root))
    try:
        ok = True
        if mode in ("api", "all"):
            ok = deploy_api(c, root) and ok
        if mode in ("vhost", "all"):
            ok = deploy_vhost(c) and ok
        print("\n✅ 완료" if ok else "\n⚠️ 일부 실패 — 로그 확인", "→ https://tarotroom.sajuplan.com")
    finally:
        c.close()


if __name__ == "__main__":
    main()
