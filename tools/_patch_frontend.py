"""web/user 또는 web/mng 의 dist/ 를 paramiko 로 양 서버 전송 (rsync 대체).

사용:
  python tools/_patch_frontend.py user
  python tools/_patch_frontend.py mng

원격 경로:
  user: /data/wwwroot/sajumoon.kr (test) / /data/wwwroot/sajumoon.co.kr (prod)
  mng:  /data/wwwroot/mng.sajumoon.kr / /data/wwwroot/mng.sajuplan.com

전략:
  1. 로컬 dist/ 를 tar.gz 으로 묶기
  2. paramiko 로 원격 /tmp 에 업로드
  3. 원격에서 tar -xzf 로 풀어 운영 디렉토리 덮어쓰기
  4. /tmp 의 tar 삭제

운영 영향: 정적 파일 덮어쓰기. nginx 가 즉시 새 파일 서빙.
"""
from __future__ import annotations
import base64
import os
import sys
import tarfile
import io
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

TARGETS_USER = [
    # test 서버 폐기 (2026-05-29) — prod 단일 배포
    # sajumoon.co.kr 과 sajuplan.com 은 별도 폴더 — 둘 다 배포 필수 (2026-06-03)
    ("prod-sajumoon", "104.64.128.103", "/data/wwwroot/sajumoon.co.kr"),
    ("prod-sajuplan", "104.64.128.103", "/data/wwwroot/sajuplan.com"),
]

TARGETS_MNG = [
    # test 서버 폐기 (2026-05-29) — prod 단일 배포
    # sajuplan.com 이 실제 사장님이 보는 도메인 — 둘 다 필수 (2026-06-04 누락 발견)
    ("prod-sajumoon", "104.64.128.103", "/data/wwwroot/sajumoon.co.kr/mng"),
    ("prod-sajuplan",  "104.64.128.103", "/data/wwwroot/sajuplan.com/mng"),
]


def make_tar(dist_dir: Path) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for p in dist_dir.rglob("*"):
            if p.is_file():
                rel = p.relative_to(dist_dir).as_posix()
                tar.add(str(p), arcname=rel)
    return buf.getvalue()


def deploy(label: str, host: str, remote_dir: str, tar_bytes: bytes, pw: str) -> int:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    print(f"\n[{label}] {host} → {remote_dir} ({len(tar_bytes):,} bytes)")

    # 1) tar 업로드 (cat > 우회)
    tmp_path = f"/tmp/frontend_{label}_{os.getpid()}.tar.gz"
    stdin, stdout, _ = c.exec_command(f"cat > '{tmp_path}'", timeout=120)
    stdin.write(tar_bytes)
    stdin.channel.shutdown_write()
    rc = stdout.channel.recv_exit_status()
    if rc != 0:
        print(f"  ✗ tar 업로드 실패 rc={rc}")
        c.close()
        return rc

    # 2) 원격에서 풀기 + 정리 + __SAJUMOON_ENV__ placeholder 치환
    #   deploy.sh 와 동등 — runtime-env.ts 가 window.__SAJUMOON_CONFIG.env 를 읽어 API URL 결정.
    #   치환 누락 시 'Failed to fetch' 발생.
    env_value = "prod" if "104.64.128.103" in host else "test"
    cmd = (
        f"set -e; "
        f"mkdir -p '{remote_dir}'; "
        f"tar -xzf '{tmp_path}' -C '{remote_dir}'; "
        f"rm -f '{tmp_path}'; "
        f"if [ -f '{remote_dir}/index.html' ]; then "
        f"  sed -i 's/__SAJUMOON_ENV__/{env_value}/g' '{remote_dir}/index.html'; "
        f"  echo '[env] __SAJUMOON_ENV__ → {env_value}'; "
        f"fi; "
        f"echo '[done] {remote_dir}'"
    )
    stdin, stdout, stderr = c.exec_command(f"bash -lc {repr(cmd)}", timeout=120)
    stdin.close()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    rc = stdout.channel.recv_exit_status()
    if out: print(f"  {out.rstrip()}")
    if err: print(f"  stderr: {err.rstrip()}", file=sys.stderr)
    c.close()
    return rc


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in ("user", "mng"):
        print("usage: _patch_frontend.py <user|mng>", file=sys.stderr)
        return 2
    kind = sys.argv[1]
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 필요", file=sys.stderr)
        return 1
    root = Path(__file__).resolve().parent.parent
    # dist2 우선 (Windows EBUSY 우회용 대체 빌드 경로), 없으면 dist 사용
    dist = root / "web" / kind / "dist2"
    if not dist.is_dir():
        dist = root / "web" / kind / "dist"
    if not dist.is_dir():
        print(f"dist/ 또는 dist2/ 없음. 먼저 'npm run build'.", file=sys.stderr)
        return 1
    print(f"배포 폴더: {dist.name}")
    tar_bytes = make_tar(dist)
    print(f"tar.gz 생성: {len(tar_bytes):,} bytes")
    targets = TARGETS_USER if kind == "user" else TARGETS_MNG
    rc = 0
    for label, host, remote in targets:
        r = deploy(label, host, remote, tar_bytes, pw)
        if r != 0:
            rc = r
    return rc


if __name__ == "__main__":
    sys.exit(main())
