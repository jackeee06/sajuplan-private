"""타로 독립 배포 — tarot.sajuplan.com (사주플랜과 별개 server block, 만세력과 동일 패턴).

머니크리티컬 prod 박스(104.64.128.103)를 건드리므로 안전 원칙:
  - 기존 server block 절대 수정 X. tarot 전용 server block만 추가(additive).
  - 변경 후 반드시 `nginx -t` 통과 확인 후에만 reload(restart 아님).
  - SSL 은 기존 acme.sh 사용.

사용:
  python tools/_tarot_deploy.py inspect   # read-only: nginx/SSL/경로 파악
  python tools/_tarot_deploy.py deploy     # vhost + 파일(dist 전체) + SSL
  python tools/_tarot_deploy.py upload      # 정적 파일만 재동기화(nginx 무변경)
"""
from __future__ import annotations
import sys
import posixpath
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

HOST = "104.64.128.103"
NGINX = "/usr/local/nginx/sbin/nginx"
VHOST = "/usr/local/nginx/conf/vhost/tarot.sajuplan.com.conf"
WEBROOT = "/data/wwwroot/tarot"
SSL_CRT = "/usr/local/nginx/conf/ssl/tarot.sajuplan.com.crt"
SSL_KEY = "/usr/local/nginx/conf/ssl/tarot.sajuplan.com.key"
ACME = "/root/.acme.sh/acme.sh"

VHOST_HTTP = f"""# 타로 독립 제품 — tarot.sajuplan.com (사주플랜과 별개, additive)
server {{
  listen 80; listen [::]:80;
  server_name tarot.sajuplan.com;
  root {WEBROOT};
  index index.html;
  location /.well-known/acme-challenge/ {{ root {WEBROOT}; }}
  location ~* \\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico|webp)$ {{ expires 30d; access_log off; try_files $uri =404; }}
  location / {{ try_files $uri $uri/ /index.html; }}
}}
"""

VHOST_HTTPS = f"""# 타로 독립 제품 — tarot.sajuplan.com (사주플랜과 별개, additive). 기존 vhost 무수정.
server {{
  listen 80; listen [::]:80;
  server_name tarot.sajuplan.com;
  location /.well-known/acme-challenge/ {{ root {WEBROOT}; }}
  location / {{ return 301 https://tarot.sajuplan.com$request_uri; }}
}}
server {{
  listen 443 ssl; listen [::]:443 ssl; http2 on;
  server_name tarot.sajuplan.com;
  ssl_certificate {SSL_CRT};
  ssl_certificate_key {SSL_KEY};
  ssl_protocols TLSv1.2 TLSv1.3;
  add_header Strict-Transport-Security max-age=15768000 always;
  access_log /data/wwwlogs/tarot.sajuplan.com_nginx.log combined;
  root {WEBROOT};
  index index.html;
  client_max_body_size 10m;
  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;
  gzip_min_length 1024;
  location ~ \\.html$ {{ add_header Cache-Control "no-cache, must-revalidate" always; expires off; }}
  location ~* \\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico|webp)$ {{ expires 30d; access_log off; try_files $uri =404; }}
  location / {{ try_files $uri $uri/ /index.html; }}
}}
"""


def load_sshpass(root: Path) -> str | None:
    env_local = root / ".env.local"
    if env_local.exists():
        for line in env_local.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("SSHPASS="):
                return line.split("=", 1)[1].strip("'\"")
    return None


def connect(pw: str) -> paramiko.SSHClient:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, timeout=20)
    return c


def sh_status(client, cmd: str):
    _in, out, err = client.exec_command(cmd)
    code = out.channel.recv_exit_status()
    return code, out.read().decode("utf-8", "replace"), err.read().decode("utf-8", "replace")


def sh(client, cmd: str) -> str:
    _c, o, e = sh_status(client, cmd)
    return (o + (("\n[stderr] " + e) if e.strip() else "")).strip()


def put_text(sftp, remote: str, content: str) -> None:
    with sftp.file(remote, "w") as fh:
        fh.write(content)


def nginx_test_reload(client) -> bool:
    code, o, e = sh_status(client, f"{NGINX} -t 2>&1")
    print((o + e).strip())
    if code != 0:
        print("  ⛔ nginx -t 실패 — reload 안 함(안전).", file=sys.stderr)
        return False
    sh_status(client, f"{NGINX} -s reload")
    print("  ✓ nginx reload 완료")
    return True


def sync_dist(client, dist: Path) -> bool:
    """dist 전체(assets·tarot 이미지·index.html) 재귀 업로드 + 옛 파일 정리."""
    if not (dist / "index.html").exists():
        print("web dist 없음 — 먼저 빌드 필요(npm run build -w @tarot/web)", file=sys.stderr)
        return False
    sftp = client.open_sftp()
    files = [p for p in dist.rglob("*") if p.is_file()]
    rels = [p.relative_to(dist).as_posix() for p in files]
    for d in sorted({posixpath.dirname(f"{WEBROOT}/{r}") for r in rels}):
        sh_status(client, f"mkdir -p {d}")
    new_assets = set()
    for p, rel in zip(files, rels):
        if rel == "index.html":
            put_text(sftp, f"{WEBROOT}/index.html", p.read_text(encoding="utf-8"))
        else:
            sftp.put(str(p), f"{WEBROOT}/{rel}")
        if rel.startswith("assets/"):
            new_assets.add(rel.split("/", 1)[1])
    print(f"  + {len(files)}개 파일 업로드(이미지 포함)")
    try:  # 옛 assets 정리
        for fn in sftp.listdir(f"{WEBROOT}/assets"):
            if fn not in new_assets:
                sftp.remove(f"{WEBROOT}/assets/{fn}")
                print(f"  - (old) assets/{fn}")
    except Exception:
        pass
    sftp.close()
    return True


def inspect(client) -> None:
    for title, cmd in [
        ("tarot DNS→서버 도달", "curl -s -o /dev/null -w '%{http_code}' -H 'Host: tarot.sajuplan.com' http://127.0.0.1/ ; echo ''"),
        ("기존 tarot 설정 존재?", "grep -RIl 'tarot' /etc/nginx/ /usr/local/nginx/conf/ 2>/dev/null | head; ls -d /data/wwwroot/tarot 2>/dev/null || echo 'no webroot'"),
        ("manse vhost(모델)", "ls -l /usr/local/nginx/conf/vhost/manse.sajuplan.com.conf 2>/dev/null"),
        ("acme.sh", f"ls -d /root/.acme.sh 2>/dev/null && {ACME} --version 2>/dev/null | head -2 || echo '없음'"),
    ]:
        print(f"\n===== {title} =====")
        print(sh(client, cmd))


def deploy(client, root: Path) -> int:
    dist = root / "tarot" / "packages" / "web" / "dist"

    print("\n[1] 웹 루트 생성 + dist 전체 업로드")
    sh_status(client, f"mkdir -p {WEBROOT}/assets")
    if not sync_dist(client, dist):
        return 1

    print("\n[2] HTTP vhost 추가 → nginx -t → reload")
    sftp = client.open_sftp()
    put_text(sftp, VHOST, VHOST_HTTP)
    if not nginx_test_reload(client):
        sh_status(client, f"rm -f {VHOST}")
        print("  롤백: vhost 제거", file=sys.stderr)
        return 1

    code, o, _ = sh_status(client, "curl -s -o /dev/null -w '%{http_code}' -H 'Host: tarot.sajuplan.com' http://127.0.0.1/")
    print(f"\n[3] HTTP 응답: {o.strip()}")

    print("\n[4] SSL 발급(acme.sh, LetsEncrypt, HTTP-01 webroot)")
    code, o, e = sh_status(
        client,
        f"{ACME} --issue -d tarot.sajuplan.com -w {WEBROOT} --keylength ec-256 --server letsencrypt 2>&1",
    )
    print((o + e).strip()[-1200:])

    print("\n[5] 인증서 설치")
    sh_status(
        client,
        f'{ACME} --install-cert -d tarot.sajuplan.com --ecc '
        f'--key-file {SSL_KEY} --fullchain-file {SSL_CRT} '
        f'--reloadcmd "{NGINX} -s reload" 2>&1',
    )
    _c, o, _ = sh_status(client, f"test -f {SSL_CRT} && echo OK || echo NO")
    print(f"  cert: {o.strip()}")
    if "OK" not in o:
        print("  SSL 미설치 — HTTP vhost 유지(http 접속 가능). 종료.", file=sys.stderr)
        sftp.close()
        return 0

    print("\n[6] HTTPS vhost 교체 → nginx -t → reload")
    put_text(sftp, VHOST, VHOST_HTTPS)
    if not nginx_test_reload(client):
        put_text(sftp, VHOST, VHOST_HTTP)
        nginx_test_reload(client)
        print("  롤백: HTTP vhost 복귀", file=sys.stderr)
        return 1

    print("\n[7] 최종 검증(https)")
    print("  " + sh(client, "curl -skI https://tarot.sajuplan.com/ | head -1"))
    print("  타이틀: " + (sh(client, "curl -sk https://tarot.sajuplan.com/ | grep -o '무료 타로' | head -1") or "(실패)"))
    sftp.close()
    print("\n✅ 배포 완료 → https://tarot.sajuplan.com")
    return 0


def upload(client, root: Path) -> int:
    if not sync_dist(client, root / "tarot" / "packages" / "web" / "dist"):
        return 1
    print("  " + sh(client, "curl -sk https://tarot.sajuplan.com/ | grep -o 'assets/index-[A-Za-z0-9_-]*\\.js' | head -1"))
    print("✅ 재배포 완료 → https://tarot.sajuplan.com")
    return 0


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "inspect"
    root = Path(__file__).resolve().parent.parent
    pw = load_sshpass(root)
    if not pw:
        print("SSHPASS 없음(.env.local)", file=sys.stderr)
        return 1
    client = connect(pw)
    try:
        if mode == "inspect":
            inspect(client)
        elif mode == "deploy":
            return deploy(client, root)
        elif mode == "upload":
            return upload(client, root)
        else:
            print(f"미구현 모드: {mode}")
            return 2
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
