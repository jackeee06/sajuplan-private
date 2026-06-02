"""사주플랜 mng 프론트 외과 배포 — index.html + JS/CSS + logo.png 만 푸시.

사용:
  python tools/_patch_mng_bundle.py <prod|prod-sajuplan|test>
"""
from __future__ import annotations
import os, sys
from pathlib import Path
import paramiko

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

DIST = Path(r"C:\claudeworkspace\sajumoon\web\mng\dist2")

# (host, remote root, env-substitution value)
TARGETS = {
    "prod":          ("104.64.128.103", "/data/wwwroot/sajumoon.co.kr/mng", "prod"),
    "prod-sajuplan": ("104.64.128.103", "/data/wwwroot/sajuplan.com/mng",   "prod"),
    "test":          ("172.235.211.75", "/data/wwwroot/sajumoon.kr/mng",    "test"),
}


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in TARGETS:
        print(f"usage: _patch_mng_bundle.py <{'|'.join(TARGETS)}>", file=sys.stderr); return 2
    target = sys.argv[1]
    host, remote, env = TARGETS[target]
    pw = os.environ["SSHPASS"]

    assets_dir = DIST / "assets"
    assets = sorted(assets_dir.glob("index-*.js")) + sorted(assets_dir.glob("index-*.css"))
    print(f"▶ mng/{target} → {host}:{remote}")
    for a in assets: print(f"  asset: {a.name}")

    # index.html with env substitution
    idx_local = DIST / "index.html"
    idx_html = idx_local.read_text(encoding="utf-8").replace("__SAJUMOON_ENV__", env)
    idx_bytes = idx_html.encode("utf-8")

    # logo.png
    logo_local = DIST / "logo.png"
    if not logo_local.exists():
        # public file may not have been copied to dist root; check public
        logo_local = Path(r"C:\claudeworkspace\sajumoon\web\mng\public\logo.png")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

    try:
        # Upload assets
        for a in assets:
            data = a.read_bytes()
            remote_path = f"{remote}/assets/{a.name}"
            print(f"  put assets/{a.name} ({len(data):,}B)")
            stdin, stdout, _ = ssh.exec_command(f"cat > '{remote_path}'", timeout=120)
            stdin.write(data); stdin.channel.shutdown_write()
            stdout.channel.recv_exit_status()

        # Upload logo.png
        data = logo_local.read_bytes()
        print(f"  put logo.png ({len(data):,}B)")
        stdin, stdout, _ = ssh.exec_command(f"cat > '{remote}/logo.png'", timeout=60)
        stdin.write(data); stdin.channel.shutdown_write()
        stdout.channel.recv_exit_status()

        # Upload index.html (env-substituted)
        print(f"  put index.html (env='{env}', {len(idx_bytes):,}B)")
        stdin, stdout, _ = ssh.exec_command(f"cat > '{remote}/index.html'", timeout=30)
        stdin.write(idx_bytes); stdin.channel.shutdown_write()
        stdout.channel.recv_exit_status()

        # Verify
        _, out, _ = ssh.exec_command(f"grep SAJUMOON_CONFIG {remote}/index.html")
        print(f"  verify env: {out.read().decode('utf-8', errors='replace').strip()}")
        _, out, _ = ssh.exec_command(f"stat -c '%s' {remote}/logo.png")
        print(f"  verify logo: {out.read().decode('utf-8', errors='replace').strip()}B")
        print(f"✓ mng/{target} done")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    sys.exit(main())
