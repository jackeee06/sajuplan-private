"""_patch_frontend.py 의 dist 경로를 인자로 받는 변종.
Windows 에서 dist 가 EBUSY 로 잠긴 경우 대안 outDir (dist2 등) 로 빌드 후 전송."""
from __future__ import annotations
import os, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _patch_frontend import make_tar, deploy, TARGETS_USER, TARGETS_MNG  # noqa: E402


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[1] not in ('user', 'mng'):
        print('usage: _patch_frontend_alt.py <user|mng> <dist_dir>', file=sys.stderr)
        return 2
    kind, dist_dir = sys.argv[1], sys.argv[2]
    pw = os.environ.get('SSHPASS')
    if not pw:
        print('SSHPASS env required', file=sys.stderr); return 1
    dist = Path(dist_dir).resolve()
    if not dist.is_dir():
        print(f'dist 폴더 없음: {dist}', file=sys.stderr); return 1
    tar_bytes = make_tar(dist)
    print(f'tar.gz {len(tar_bytes):,} bytes from {dist}')
    targets = TARGETS_USER if kind == 'user' else TARGETS_MNG
    rc = 0
    for label, host, remote in targets:
        r = deploy(label, host, remote, tar_bytes, pw)
        if r != 0:
            rc = r
    return rc


if __name__ == '__main__':
    sys.exit(main())
