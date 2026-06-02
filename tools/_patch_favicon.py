"""사주플랜 파비콘 외과 배포 — 새 파비콘 6개 + manifest 업로드,
서버의 index.html 은 sed 로 favicon 참조만 in-place 패치 (JS 번들 보존).

사용:
  python tools/_patch_favicon.py <user|mng> <prod|test>
"""
from __future__ import annotations
import os, sys
from pathlib import Path
import paramiko

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

# host, remote root, app prefix path (e.g. mng under /mng/favicon)
TARGETS = {
    ("user", "prod"): ("104.64.128.103", "/data/wwwroot/sajumoon.co.kr", ""),
    ("user", "test"): ("172.235.211.75", "/data/wwwroot/sajumoon.kr",    ""),
    ("mng",  "prod"): ("104.64.128.103", "/data/wwwroot/sajumoon.co.kr/mng", "favicon/"),
    ("mng",  "test"): ("172.235.211.75", "/data/wwwroot/sajumoon.kr/mng",    "favicon/"),
    # sajuplan.com 도메인도 같은 mng 디렉터리를 갖고 있음 (병행 운영 중)
    ("mng",  "prod-sajuplan"): ("104.64.128.103", "/data/wwwroot/sajuplan.com/mng", "favicon/"),
}

# Source files (uniform — same 6 + manifest for user and mng)
SRC_DIR = Path(r"C:\claudeworkspace\sajumoon\web\user\public\img\favicon_io")
FILES = [
    "favicon.ico",
    "favicon-16x16.png",
    "favicon-32x32.png",
    "apple-touch-icon.png",
    "android-chrome-192x192.png",
    "android-chrome-512x512.png",
]

# index.html sed edits (per app — user vs mng have different favicon paths)
INDEX_PATCH_USER = (
    r"sed -i "
    r"-e 's|type=\"image/svg+xml\" href=\"/favicon.svg\"|type=\"image/x-icon\" href=\"/favicon.ico\"|' "
    r"-e 's|sizes=\"180x180\" href=\"/favicon-180x180.png\"|sizes=\"180x180\" href=\"/apple-touch-icon.png\"|' "
)
INDEX_PATCH_MNG = (
    r"sed -i "
    r"-e 's|sizes=\"180x180\" href=\"/mng/favicon/favicon-180x180.png\"|sizes=\"180x180\" href=\"/mng/favicon/apple-touch-icon.png\"|' "
    # mng already has favicon.ico so just ensure
)

OLD_FILES_TO_DELETE = [
    "favicon-180x180.png",
    "favicon-192x192.png",
    "favicon-512x512.png",
    "favicon.svg",
]


def main():
    if len(sys.argv) != 3:
        print("usage: _patch_favicon.py <user|mng> <prod|test>", file=sys.stderr); return 2
    app, target = sys.argv[1], sys.argv[2]
    if (app, target) not in TARGETS:
        print(f"unknown target: {app}/{target}", file=sys.stderr); return 2
    host, remote_root, sub = TARGETS[(app, target)]
    pw = os.environ["SSHPASS"]
    print(f"▶ {app}/{target} → {host}:{remote_root}/{sub}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

    try:
        # 1. Upload 6 favicons via cat >
        for fn in FILES:
            local = SRC_DIR / fn
            remote = f"{remote_root}/{sub}{fn}"
            data = local.read_bytes()
            print(f"  put {fn} ({len(data):,}B)")
            remote_dir = remote.rsplit('/', 1)[0]
            ssh.exec_command(f"mkdir -p '{remote_dir}'")[1].channel.recv_exit_status()
            stdin, stdout, _ = ssh.exec_command(f"cat > '{remote}'", timeout=60)
            stdin.write(data); stdin.channel.shutdown_write()
            rc = stdout.channel.recv_exit_status()
            if rc != 0:
                print(f"  ✗ put 실패 rc={rc}", file=sys.stderr); return rc

        # 2. Upload site.webmanifest (use local file with manifest content)
        if app == "user":
            mf_local = Path(r"C:\claudeworkspace\sajumoon\web\user\public\site.webmanifest")
        else:
            mf_local = Path(r"C:\claudeworkspace\sajumoon\web\mng\public\favicon\site.webmanifest")
        mf_remote = f"{remote_root}/{sub}site.webmanifest"
        data = mf_local.read_bytes()
        print(f"  put site.webmanifest ({len(data):,}B)")
        stdin, stdout, _ = ssh.exec_command(f"cat > '{mf_remote}'", timeout=30)
        stdin.write(data); stdin.channel.shutdown_write()
        stdout.channel.recv_exit_status()

        # 3. Patch index.html on server (favicon links only)
        index_path = f"{remote_root}/index.html"
        sed_cmd = INDEX_PATCH_USER if app == "user" else INDEX_PATCH_MNG
        cmd = f"{sed_cmd} '{index_path}' && echo OK || echo SED_FAIL"
        print(f"  patch index.html")
        _, out, err = ssh.exec_command(cmd, get_pty=False)
        out_text = out.read().decode("utf-8", errors="replace")
        err_text = err.read().decode("utf-8", errors="replace")
        print(f"    {out_text.strip()}")
        if err_text.strip(): print(f"    stderr: {err_text}", file=sys.stderr)

        # 4. Delete old favicon files (user only — mng path differs)
        if app == "user":
            for fn in OLD_FILES_TO_DELETE:
                ssh.exec_command(f"rm -f '{remote_root}/{fn}'")[1].channel.recv_exit_status()
            print(f"  delete old: {', '.join(OLD_FILES_TO_DELETE)}")
        else:
            for fn in OLD_FILES_TO_DELETE:
                ssh.exec_command(f"rm -f '{remote_root}/{sub}{fn}'")[1].channel.recv_exit_status()
            print(f"  delete old in {sub}: {', '.join(OLD_FILES_TO_DELETE)}")

        print(f"✓ {app}/{target} done")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    sys.exit(main())
