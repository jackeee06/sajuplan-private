"""사주플랜 user 프론트 외과 배포 — 새 JS 번들 + index.html (env 치환) 만 푸시.

사용:
  python tools/_patch_user_bundle.py <prod|test>
"""
from __future__ import annotations
import os, sys
from pathlib import Path
import paramiko

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

DIST = Path(r"C:\claudeworkspace\sajumoon\web\user\dist5")

TARGETS = {
    "prod": ("104.64.128.103", "/data/wwwroot/sajumoon.co.kr", "prod"),
    "test": ("172.235.211.75", "/data/wwwroot/sajumoon.kr",    "test"),
}


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in TARGETS:
        print("usage: _patch_user_bundle.py <prod|test>", file=sys.stderr); return 2
    target = sys.argv[1]
    host, remote, env = TARGETS[target]
    pw = os.environ["SSHPASS"]

    # Discover new JS/CSS asset files from local dist2/
    assets_dir = DIST / "assets"
    assets = sorted(assets_dir.glob("index-*.js")) + sorted(assets_dir.glob("index-*.css"))
    print(f"▶ {target} → {host}:{remote}")
    for a in assets: print(f"  asset: {a.name}")

    # Load + substitute env in index.html
    idx_local = DIST / "index.html"
    idx_html = idx_local.read_text(encoding="utf-8").replace("__SAJUMOON_ENV__", env)
    idx_bytes = idx_html.encode("utf-8")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

    try:
        # Upload assets (cat > to bypass SFTP quirks)
        for a in assets:
            data = a.read_bytes()
            remote_path = f"{remote}/assets/{a.name}"
            print(f"  put assets/{a.name} ({len(data):,}B)")
            stdin, stdout, _ = ssh.exec_command(f"cat > '{remote_path}'", timeout=120)
            stdin.write(data); stdin.channel.shutdown_write()
            rc = stdout.channel.recv_exit_status()
            if rc != 0:
                print(f"  ✗ rc={rc}", file=sys.stderr); return rc

        # Upload index.html (already env-substituted)
        print(f"  put index.html (env='{env}', {len(idx_bytes):,}B)")
        stdin, stdout, _ = ssh.exec_command(f"cat > '{remote}/index.html'", timeout=30)
        stdin.write(idx_bytes); stdin.channel.shutdown_write()
        stdout.channel.recv_exit_status()

        # Verify env
        _, out, _ = ssh.exec_command(f"grep SAJUMOON_CONFIG {remote}/index.html")
        print(f"  verify: {out.read().decode('utf-8', errors='replace').strip()}")
        print(f"✓ {target} done")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    sys.exit(main())
