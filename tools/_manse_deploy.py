"""만세력 독립 배포 — manse.sajuplan.com (사주플랜과 별개 server block).

머니크리티컬 prod 박스(104.64.128.103)를 건드리므로 안전 원칙:
  - 기존 server block 절대 수정 X. manse 전용 server block만 추가(additive).
  - 변경 후 반드시 `nginx -t` 통과 확인 후에만 reload(restart 아님).
  - SSL 은 기존 acme.sh 사용.

사용:
  python tools/_manse_deploy.py inspect     # read-only: nginx 구조/SSL/경로 파악
  python tools/_manse_deploy.py deploy       # (다음 단계) server block + 파일 + SSL
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

HOST = "104.64.128.103"


def load_sshpass(root: Path) -> str | None:
    env_local = root / ".env.local"
    if env_local.exists():
        for line in env_local.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("SSHPASS="):
                return line.split("=", 1)[1].strip("'\"")
    return None


def sh(client, cmd: str) -> str:
    _in, out, err = client.exec_command(cmd)
    o = out.read().decode("utf-8", "replace")
    e = err.read().decode("utf-8", "replace")
    return (o + (("\n[stderr] " + e) if e.strip() else "")).strip()


def connect(pw: str) -> paramiko.SSHClient:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, timeout=20)
    return c


def inspect(client) -> None:
    checks = [
        ("nginx 버전", "nginx -v 2>&1"),
        ("nginx include 구조", "grep -Rn 'include' /etc/nginx/nginx.conf | head -20"),
        ("conf.d 목록", "ls -1 /etc/nginx/conf.d/ 2>/dev/null; ls -1 /etc/nginx/sites-enabled/ 2>/dev/null"),
        ("sajuplan/sajumoon server_name 들", "grep -RIl 'sajumoon\\|sajuplan' /etc/nginx/ 2>/dev/null"),
        ("메인 server block (server_name+root+ssl 발췌)",
         "grep -RIn -E 'server_name|root |ssl_certificate|listen ' /etc/nginx/conf.d/ /etc/nginx/sites-enabled/ 2>/dev/null | grep -i 'sajumoon\\|sajuplan\\|443\\|ssl_cert\\|root ' | head -40"),
        ("웹 루트 목록", "ls -la /data/wwwroot/ | head"),
        ("manse 관련 기존 설정 존재?", "grep -RIn 'manse' /etc/nginx/ 2>/dev/null | head; ls -d /data/wwwroot/manse 2>/dev/null || echo 'no /data/wwwroot/manse'"),
        ("acme.sh 설치 여부", "ls -d ~/.acme.sh 2>/dev/null && ~/.acme.sh/acme.sh --version 2>/dev/null | head -3 || echo 'acme.sh 없음'"),
        ("기존 발급 인증서 목록", "~/.acme.sh/acme.sh --list 2>/dev/null | head -20 || echo 'list 불가'"),
        ("manse.sajuplan.com 이 서버로 오나(호스트 자체확인)", "curl -s -o /dev/null -w '%{http_code}' -H 'Host: manse.sajuplan.com' http://127.0.0.1/ ; echo ''"),
    ]
    for title, cmd in checks:
        print(f"\n===== {title} =====")
        print(sh(client, cmd))


def deep(client) -> None:
    checks = [
        ("웹서버 프로세스", "ps -eo comm,args | grep -E 'nginx|httpd|litespeed|lsws|apache|openrest' | grep -v grep | head"),
        ("리스닝 80/443", "ss -tlnp 2>/dev/null | grep -E ':80 |:443 ' | head"),
        ("nginx 바이너리 위치", "ls -l /usr/local/nginx/sbin/nginx /usr/local/openresty/nginx/sbin/nginx /www/server/nginx/sbin/nginx 2>/dev/null; command -v nginx"),
        ("nginx 메인 conf 위치", "ls -l /usr/local/nginx/conf/nginx.conf 2>/dev/null"),
        ("vhost 디렉토리", "ls -1 /usr/local/nginx/conf/vhost/ 2>/dev/null || ls -1 /www/server/panel/vhost/nginx/ 2>/dev/null"),
        ("sajuplan vhost 전문(모델로 삼을 것)", "cat /usr/local/nginx/conf/vhost/sajuplan.com.conf 2>/dev/null | head -80"),
    ]
    for title, cmd in checks:
        print(f"\n===== {title} =====")
        print(sh(client, cmd))


NGINX = "/usr/local/nginx/sbin/nginx"
VHOST = "/usr/local/nginx/conf/vhost/manse.sajuplan.com.conf"
WEBROOT = "/data/wwwroot/manse"
SSL_CRT = "/usr/local/nginx/conf/ssl/manse.sajuplan.com.crt"
SSL_KEY = "/usr/local/nginx/conf/ssl/manse.sajuplan.com.key"
ACME = "/root/.acme.sh/acme.sh"

VHOST_HTTP = f"""# 만세력 독립 제품 — manse.sajuplan.com (사주플랜과 별개, additive)
server {{
  listen 80; listen [::]:80;
  server_name manse.sajuplan.com;
  root {WEBROOT};
  index index.html;
  location /.well-known/acme-challenge/ {{ root {WEBROOT}; }}
  location ~* \\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico)$ {{ expires 30d; access_log off; try_files $uri =404; }}
  location / {{ try_files $uri $uri/ /index.html; }}
}}
"""

VHOST_HTTPS = f"""# 만세력 독립 제품 — manse.sajuplan.com (사주플랜과 별개, additive). 기존 vhost 무수정.
server {{
  listen 80; listen [::]:80;
  server_name manse.sajuplan.com;
  location /.well-known/acme-challenge/ {{ root {WEBROOT}; }}
  location / {{ return 301 https://manse.sajuplan.com$request_uri; }}
}}
server {{
  listen 443 ssl; listen [::]:443 ssl; http2 on;
  server_name manse.sajuplan.com;
  ssl_certificate {SSL_CRT};
  ssl_certificate_key {SSL_KEY};
  ssl_protocols TLSv1.2 TLSv1.3;
  add_header Strict-Transport-Security max-age=15768000 always;
  access_log /data/wwwlogs/manse.sajuplan.com_nginx.log combined;
  root {WEBROOT};
  index index.html;
  client_max_body_size 10m;
  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;
  gzip_min_length 1024;
  location ~ \\.html$ {{ add_header Cache-Control "no-cache, must-revalidate" always; expires off; }}
  location ~* \\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico)$ {{ expires 30d; access_log off; try_files $uri =404; }}
  location / {{ try_files $uri $uri/ /index.html; }}
}}
"""


def sh_status(client, cmd: str):
    _in, out, err = client.exec_command(cmd)
    code = out.channel.recv_exit_status()
    return code, out.read().decode("utf-8", "replace"), err.read().decode("utf-8", "replace")


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


def upload_only(client, root: Path) -> int:
    """정적 파일만 동기화(nginx 무변경). 재배포 시 사용. 옛 assets 정리 포함."""
    dist = root / "manse" / "packages" / "web" / "dist"
    if not (dist / "index.html").exists():
        print("web dist 없음 — 먼저 빌드 필요", file=sys.stderr)
        return 1
    import posixpath
    sftp = client.open_sftp()
    # dist 전체 재귀 업로드 (assets·img·index.html 등 모두)
    files = [p for p in dist.rglob("*") if p.is_file()]
    rels = [p.relative_to(dist).as_posix() for p in files]
    dirs = sorted({posixpath.dirname(f"{WEBROOT}/{r}") for r in rels})
    for d in dirs:
        sh_status(client, f"mkdir -p {d}")
    new_assets = set()
    for p, rel in zip(files, rels):
        if rel == "index.html":
            put_text(sftp, f"{WEBROOT}/index.html", p.read_text(encoding="utf-8"))
        else:
            sftp.put(str(p), f"{WEBROOT}/{rel}")
        if rel.startswith("assets/"):
            new_assets.add(rel.split("/", 1)[1])
        print(f"  + {rel}")
    # 옛 assets 정리(새 빌드에 없는 것)
    try:
        for fn in sftp.listdir(f"{WEBROOT}/assets"):
            if fn not in new_assets:
                sftp.remove(f"{WEBROOT}/assets/{fn}")
                print(f"  - (old) assets/{fn}")
    except Exception:
        pass
    sftp.close()
    # 검증
    _c, o, _ = sh_status(client, "curl -sk https://manse.sajuplan.com/ | grep -o 'assets/index-[A-Za-z0-9_-]*\\.js'")
    print(f"\n  서버 index.html 참조 JS: {o.strip()}")
    print("✅ 재배포 완료 → https://manse.sajuplan.com")
    return 0


def deploy(client, root: Path) -> int:
    dist = root / "manse" / "packages" / "web" / "dist"
    if not (dist / "index.html").exists():
        print("web dist 없음 — 먼저 빌드 필요", file=sys.stderr)
        return 1
    sftp = client.open_sftp()

    print("\n[1] 웹 루트 생성 + 파일 업로드")
    sh_status(client, f"mkdir -p {WEBROOT}/assets")
    put_text(sftp, f"{WEBROOT}/index.html", (dist / "index.html").read_text(encoding="utf-8"))
    for f in (dist / "assets").iterdir():
        sftp.put(str(f), f"{WEBROOT}/assets/{f.name}")
        print(f"  + assets/{f.name}")

    print("\n[2] HTTP vhost 추가(새 파일) → nginx -t → reload")
    put_text(sftp, VHOST, VHOST_HTTP)
    if not nginx_test_reload(client):
        sh_status(client, f"rm -f {VHOST}")
        print("  롤백: vhost 제거", file=sys.stderr)
        return 1

    print("\n[3] HTTP 응답 확인")
    code, o, _ = sh_status(client, "curl -s -o /dev/null -w '%{http_code}' -H 'Host: manse.sajuplan.com' http://127.0.0.1/")
    print(f"  http_code={o.strip()}")

    print("\n[4] SSL 발급(acme.sh, LetsEncrypt, HTTP-01 webroot)")
    code, o, e = sh_status(
        client,
        f"{ACME} --issue -d manse.sajuplan.com -w {WEBROOT} --keylength ec-256 --server letsencrypt 2>&1",
    )
    print((o + e).strip()[-1500:])
    if code != 0 and "Cert success" not in o and "Domains not changed" not in o:
        print("  ⚠ 발급 단계 경고/실패 — HTTP 로는 이미 보임. SSL 재시도 가능.", file=sys.stderr)

    print("\n[5] 인증서 설치 → nginx reloadcmd")
    sh_status(
        client,
        f'{ACME} --install-cert -d manse.sajuplan.com --ecc '
        f'--key-file {SSL_KEY} --fullchain-file {SSL_CRT} '
        f'--reloadcmd "{NGINX} -s reload" 2>&1',
    )
    code, o, _ = sh_status(client, f"test -f {SSL_CRT} && echo OK || echo NO")
    print(f"  cert 설치: {o.strip()}")
    if "OK" not in o:
        print("  SSL 설치 안 됨 — HTTP vhost 유지(http로 접속 가능). 종료.", file=sys.stderr)
        sftp.close()
        return 0

    print("\n[6] HTTPS vhost 로 교체 → nginx -t → reload")
    put_text(sftp, VHOST, VHOST_HTTPS)
    if not nginx_test_reload(client):
        put_text(sftp, VHOST, VHOST_HTTP)
        nginx_test_reload(client)
        print("  롤백: HTTP vhost 로 복귀", file=sys.stderr)
        return 1

    print("\n[7] 최종 검증 (https)")
    _c, o, _ = sh_status(client, "curl -skI https://manse.sajuplan.com/ | head -1")
    print(f"  {o.strip()}")
    _c, o, _ = sh_status(client, "curl -sk https://manse.sajuplan.com/ | grep -o '무료 만세력' | head -1")
    print(f"  타이틀 포함: {o.strip() or '(확인 실패)'}")
    sftp.close()
    print("\n✅ 배포 완료 → https://manse.sajuplan.com")
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
        elif mode == "deep":
            deep(client)
        elif mode == "deploy":
            return deploy(client, root)
        elif mode == "upload":
            return upload_only(client, root)
        else:
            print(f"미구현 모드: {mode}")
            return 2
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
