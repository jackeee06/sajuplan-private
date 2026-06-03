"""프론트 빠른 외과 배포 — 변경된 파일만 SFTP 업로드.

전체 tar.gz(186MB) 대신 서버에 없는 파일 + index.html만 올림.
평균 소요: 10~30초 (기존 3~10분 → 90% 단축)

사용:
  SSHPASS=xxx python tools/_patch_frontend_fast.py user
  SSHPASS=xxx python tools/_patch_frontend_fast.py mng
"""
from __future__ import annotations
import os, sys, hashlib
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import paramiko

TARGETS = {
    'user': [
        ('104.64.128.103', '/data/wwwroot/sajumoon.co.kr'),
        ('104.64.128.103', '/data/wwwroot/sajuplan.com'),
    ],
    'mng': [
        ('104.64.128.103', '/data/wwwroot/sajumoon.co.kr/mng'),
        ('104.64.128.103', '/data/wwwroot/sajuplan.com/mng'),  # TODO: 확인 필요
    ],
}


def get_remote_files(sftp, remote_dir: str) -> set[str]:
    """서버의 assets 파일 목록 (파일명만)"""
    try:
        return {f.filename for f in sftp.listdir_attr(f'{remote_dir}/assets')}
    except Exception:
        return set()


def deploy_fast(host: str, remote_dir: str, dist: Path, pw: str) -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, 22, 'root', pw, timeout=20)
    sftp = client.open_sftp()

    remote_files = get_remote_files(sftp, remote_dir)

    uploaded = 0
    skipped = 0

    # assets 폴더: 서버에 없는 파일만 업로드
    assets_dir = dist / 'assets'
    if assets_dir.exists():
        for f in assets_dir.iterdir():
            if f.is_file():
                if f.name not in remote_files:
                    sftp.put(str(f), f'{remote_dir}/assets/{f.name}')
                    print(f'  + {f.name}')
                    uploaded += 1
                else:
                    skipped += 1

    # index.html 항상 업로드 + env 치환
    index = dist / 'index.html'
    if index.exists():
        content = index.read_text(encoding='utf-8')
        content = content.replace('__SAJUMOON_ENV__', 'prod')
        tmp = '/tmp/_fe_index.html'
        with sftp.file(tmp, 'w') as fh:
            fh.write(content)
        stdin, stdout, stderr = client.exec_command(f'mv {tmp} {remote_dir}/index.html')
        stdout.channel.recv_exit_status()
        print(f'  index.html → prod')
        uploaded += 1

    print(f'  완료: {uploaded}개 업로드, {skipped}개 스킵')
    sftp.close()
    client.close()


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in ('user', 'mng'):
        print('usage: _patch_frontend_fast.py <user|mng>', file=sys.stderr)
        return 2
    kind = sys.argv[1]
    pw = os.environ.get('SSHPASS')
    if not pw:
        print('SSHPASS 필요', file=sys.stderr)
        return 1

    root = Path(__file__).resolve().parent.parent
    dist = root / 'web' / kind / 'dist2'
    if not dist.is_dir():
        dist = root / 'web' / kind / 'dist'
    if not dist.is_dir():
        print('dist/ 또는 dist2/ 없음', file=sys.stderr)
        return 1

    print(f'[빠른 배포] {kind} ← {dist.name}')
    for host, remote in TARGETS[kind]:
        print(f'\n→ {host}:{remote}')
        deploy_fast(host, remote, dist, pw)
    return 0


if __name__ == '__main__':
    sys.exit(main())
