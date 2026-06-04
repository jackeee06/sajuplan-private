"""외과 배포 — web/mng dist를 sajuplan.com/mng 에만 SFTP (빌드 스킵)."""
import io, os, sys, tarfile, paramiko
from pathlib import Path
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

dist_dir = Path("c:/claudeworkspace/sajumoon/web/mng/dist")
if not dist_dir.exists():
    print("ERROR: dist 없음. npm run build 먼저.", file=sys.stderr); sys.exit(1)

# tar.gz 생성
buf = io.BytesIO()
with tarfile.open(fileobj=buf, mode="w:gz") as tar:
    for p in dist_dir.rglob("*"):
        if p.is_file():
            tar.add(str(p), arcname=p.relative_to(dist_dir).as_posix())
tar_bytes = buf.getvalue()
print(f"tar.gz: {len(tar_bytes):,} bytes")

remote_dir = "/data/wwwroot/sajuplan.com/mng"
host = "104.64.128.103"
pw = os.environ["SSHPASS"]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

tmp = "/tmp/_mng_sajuplan.tar.gz"
sftp = c.open_sftp()
sftp.putfo(io.BytesIO(tar_bytes), tmp)
sftp.close()

cmd = (f"mkdir -p '{remote_dir}'; "
       f"tar -xzf '{tmp}' -C '{remote_dir}'; "
       f"rm -f '{tmp}'; "
       f"sed -i 's/__SAJUMOON_ENV__/prod/g' '{remote_dir}/index.html'; "
       f"echo '[done] {remote_dir}'")
_, out, err = c.exec_command(f"bash -c {repr(cmd)}", timeout=60)
print(out.read().decode())
e = err.read().decode()
if e: print("ERR:", e, file=sys.stderr)
c.close()
