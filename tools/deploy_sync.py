#!/usr/bin/env python3
"""
사주문 정적 자산(web/user 또는 web/mng) 원격 동기화 — Windows fallback.

deploy.sh 의 rsync 단계를 paramiko SFTP 로 대체. rsync/sshpass 가 없는 환경에서
사용한다. SSH 비밀번호는 환경변수 SSHPASS 로 전달.

사용:
  SSHPASS=... python tools/deploy_sync.py \
      --host root@HOST --src ABS_LOCAL_DIR --dst ABS_REMOTE_DIR \
      [--exclude name ...] [--dry-run]

동작:
  - src 디렉터리 전체를 dst 로 업로드 (재귀)
  - dst 에만 존재하는 파일/폴더는 삭제 (rsync --delete-during 등가)
  - --exclude 로 매칭되는 최상위 이름은 업로드/삭제 양쪽에서 무시
  - .env, .env.*, uploads, logs, secrets, .git, node_modules 는 기본 제외
"""

from __future__ import annotations

import argparse
import os
import posixpath
import stat
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from fnmatch import fnmatch
from pathlib import Path

# Windows 콘솔(cp949) 에서 유니코드 기호 출력 시 UnicodeEncodeError 가 나지 않도록.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

try:
    import paramiko
except ImportError:
    print("paramiko 가 설치되어 있지 않습니다. (pip install paramiko)", file=sys.stderr)
    sys.exit(2)


DEFAULT_EXCLUDES = [
    ".env", ".env.*",
    "node_modules", ".git",
    "uploads", "logs", "secrets",
    # deploy.sh substitute_env_in_index 가 index.html 옆에 만드는 백업
    "*.template",
]


def parse_host(host: str) -> tuple[str, str, int]:
    """user@host[:port] → (user, host, port)"""
    user = "root"
    port = 22
    if "@" in host:
        user, host = host.split("@", 1)
    if ":" in host:
        host, port_s = host.split(":", 1)
        port = int(port_s)
    return user, host, port


def should_exclude(name: str, patterns: list[str]) -> bool:
    return any(fnmatch(name, p) for p in patterns)


def connect(host_arg: str, password: str) -> paramiko.SSHClient:
    user, host, port = parse_host(host_arg)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=host, port=port, username=user, password=password,
        allow_agent=False, look_for_keys=False, timeout=20,
    )
    # SSH 채널을 오래 유지하기 위해 keepalive 활성화 (병렬 업로드 도중 끊김 방지)
    transport = client.get_transport()
    if transport is not None:
        transport.set_keepalive(30)
    return client


def upload_pool(client: paramiko.SSHClient, items: list[tuple[Path, str]], workers: int = 8) -> None:
    """병렬 SFTP 업로드. 각 워커 스레드가 자체 SFTP 채널을 보유.

    paramiko 의 SFTPClient 는 thread-safe 하지 않으므로 채널을 worker 당 하나씩 연다.
    """
    if not items:
        return
    transport = client.get_transport()
    if transport is None:
        raise RuntimeError("SSH transport 가 활성화되지 않음")
    n = min(workers, len(items))
    sftps: list[paramiko.SFTPClient] = []
    locks: list[threading.Lock] = []
    for _ in range(n):
        s = paramiko.SFTPClient.from_transport(transport)
        if s is None:
            raise RuntimeError("SFTPClient 채널 생성 실패")
        sftps.append(s)
        locks.append(threading.Lock())
    ensured_dirs: set[str] = set()
    ensured_lock = threading.Lock()

    def worker(idx: int, local: Path, remote: str) -> None:
        sftp = sftps[idx]
        parent = posixpath.dirname(remote)
        if parent:
            # 디렉터리 생성은 중복 방지: 이미 만든 디렉터리는 스킵
            with ensured_lock:
                need = parent not in ensured_dirs
                if need:
                    ensured_dirs.add(parent)
            if need:
                ensure_remote_dir(sftp, parent)
        sftp.put(str(local), remote)

    try:
        with ThreadPoolExecutor(max_workers=n) as ex:
            futures = []
            for i, (full, remote) in enumerate(items):
                futures.append(ex.submit(worker, i % n, full, remote))
            for fut in as_completed(futures):
                fut.result()  # 예외 재전파
    finally:
        for s in sftps:
            try:
                s.close()
            except Exception:
                pass


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote: str) -> None:
    """mkdir -p 등가."""
    parts = remote.strip("/").split("/")
    cur = ""
    for p in parts:
        cur = cur + "/" + p
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            sftp.mkdir(cur)


def walk_local(src: Path, excludes: list[str]) -> list[tuple[Path, str]]:
    """(절대 로컬 경로, 상대 posix 경로) 페어를 반환. 디렉터리는 제외, 파일만."""
    items: list[tuple[Path, str]] = []
    for root, dirs, files in os.walk(src):
        # 상대 경로 계산
        rel_root = Path(root).relative_to(src)
        # 디렉터리 가지치기 (제외 패턴 매칭되는 디렉터리는 안 들어감)
        dirs[:] = [d for d in dirs if not should_exclude(d, excludes)]
        for f in files:
            if should_exclude(f, excludes):
                continue
            full = Path(root) / f
            rel = (rel_root / f).as_posix() if str(rel_root) != "." else f
            items.append((full, rel))
    return items


def list_remote(sftp: paramiko.SFTPClient, remote: str, excludes: list[str]) -> tuple[set[str], set[str]]:
    """원격 트리를 순회. (파일 상대경로 set, 디렉터리 상대경로 set) 반환."""
    files: set[str] = set()
    dirs: set[str] = set()

    def _walk(rel: str) -> None:
        cur_remote = posixpath.join(remote, rel) if rel else remote
        try:
            entries = sftp.listdir_attr(cur_remote)
        except FileNotFoundError:
            return
        for e in entries:
            if should_exclude(e.filename, excludes):
                continue
            child_rel = posixpath.join(rel, e.filename) if rel else e.filename
            if stat.S_ISDIR(e.st_mode):
                dirs.add(child_rel)
                _walk(child_rel)
            else:
                files.add(child_rel)

    _walk("")
    return files, dirs


def upload_file(sftp: paramiko.SFTPClient, local: Path, remote: str) -> None:
    parent = posixpath.dirname(remote)
    if parent:
        ensure_remote_dir(sftp, parent)
    sftp.put(str(local), remote)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", required=True, help="user@host[:port]")
    ap.add_argument("--src", required=True, help="local source dir")
    ap.add_argument("--dst", required=True, help="remote destination dir (absolute)")
    ap.add_argument("--exclude", action="append", default=[], help="추가 제외 패턴")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    src = Path(args.src).resolve()
    if not src.is_dir():
        print(f"✗ src 디렉터리가 없습니다: {src}", file=sys.stderr)
        return 1

    # Git Bash 의 // 접두사 변환 차단 트릭을 정규화: '//data/...' → '/data/...'
    if args.dst.startswith("//"):
        args.dst = "/" + args.dst.lstrip("/")

    password = os.environ.get("SSHPASS")
    if not password:
        print("✗ SSHPASS 환경변수가 필요합니다.", file=sys.stderr)
        return 1

    excludes = DEFAULT_EXCLUDES + list(args.exclude)
    print(f"▶ sync {src} → {args.host}:{args.dst}")
    print(f"  excludes: {excludes}")

    client = connect(args.host, password)
    try:
        sftp = client.open_sftp()
        ensure_remote_dir(sftp, args.dst)

        local_items = walk_local(src, excludes)
        local_rel = {rel for _, rel in local_items}
        remote_files, remote_dirs = list_remote(sftp, args.dst, excludes)

        to_upload = []
        for full, rel in local_items:
            remote_path = posixpath.join(args.dst, rel)
            local_size = full.stat().st_size
            local_mtime = int(full.stat().st_mtime)
            try:
                rstat = sftp.stat(remote_path)
                if rstat.st_size == local_size and (rstat.st_mtime or 0) >= local_mtime:
                    continue
            except FileNotFoundError:
                pass
            to_upload.append((full, remote_path))

        to_delete_files = sorted(remote_files - local_rel, reverse=True)
        # 원격 디렉터리 중 로컬에 없는 것 (자식 처리 후 빈 디렉터리만 삭제)
        local_dirs = {posixpath.dirname(r) for r in local_rel if posixpath.dirname(r)}
        # 로컬 디렉터리의 모든 조상도 포함
        all_local_dirs: set[str] = set()
        for d in local_dirs:
            parts = d.split("/")
            for i in range(1, len(parts) + 1):
                all_local_dirs.add("/".join(parts[:i]))
        to_delete_dirs = sorted(remote_dirs - all_local_dirs, key=lambda x: -x.count("/"))

        print(f"  upload : {len(to_upload)} files")
        print(f"  delete : {len(to_delete_files)} files, {len(to_delete_dirs)} dirs")

        if args.dry_run:
            for f, r in to_upload[:20]:
                print(f"   + {r}")
            if len(to_upload) > 20:
                print(f"   ... (+{len(to_upload) - 20} more)")
            for r in to_delete_files[:20]:
                print(f"   - {r}")
            return 0

        # 병렬 업로드 (워커 8개) — 단일 채널 직렬 업로드 대비 3~6배 빠름
        if to_upload:
            # 우선 부모 디렉터리들을 직렬로 미리 만든다 (mkdir race 방지)
            parent_dirs = sorted({posixpath.dirname(r) for _, r in to_upload if posixpath.dirname(r)})
            for d in parent_dirs:
                ensure_remote_dir(sftp, d)
            upload_pool(client, to_upload, workers=8)

        for rel in to_delete_files:
            remote_path = posixpath.join(args.dst, rel)
            try:
                sftp.remove(remote_path)
            except IOError:
                pass

        for rel in to_delete_dirs:
            remote_path = posixpath.join(args.dst, rel)
            try:
                sftp.rmdir(remote_path)
            except IOError:
                pass

        print("✓ 동기화 완료")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
