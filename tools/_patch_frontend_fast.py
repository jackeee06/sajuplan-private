"""프론트 빠른 외과 배포 — 변경된 파일만 SFTP 업로드.

전체 tar.gz(186MB) 대신 서버에 없는 파일 + index.html만 올림.
평균 소요: 10~30초

사용:
  python tools/_patch_frontend_fast.py user
  python tools/_patch_frontend_fast.py mng

SSHPASS: 환경변수 없으면 .env.local 자동 로드 (수동 설정 불필요)
dist 폴더: dist/dist2/dist3 중 index.html이 가장 최근인 것 자동 선택
배포 경로: /data/wwwroot/sajumoon.co.kr[/mng] 단일 (sajuplan.com 폴더는 nginx 미사용 — 배포 안 함)
"""
from __future__ import annotations
import os, sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import paramiko

# nginx가 실제 서빙하는 경로만 — /data/wwwroot/sajuplan.com 은 죽은 폴더(nginx 미사용), 절대 배포 금지
TARGETS = {
    'user': [
        ('104.64.128.103', '/data/wwwroot/sajumoon.co.kr'),
    ],
    'mng': [
        ('104.64.128.103', '/data/wwwroot/sajumoon.co.kr/mng'),
    ],
}


def load_sshpass(root: Path) -> str | None:
    """SSHPASS 우선순위: 환경변수 → .env.local 자동 로드"""
    pw = os.environ.get('SSHPASS')
    if pw:
        return pw
    env_local = root / '.env.local'
    if env_local.exists():
        for line in env_local.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line.startswith('SSHPASS='):
                return line.split('=', 1)[1].strip("'\"")
    return None


def find_latest_dist(root: Path, kind: str) -> Path | None:
    """dist/dist2/dist3 중 index.html이 가장 최근에 빌드된 폴더 반환.

    고정 순서가 아닌 mtime 기준 → EBUSY로 dist3에 빌드해도 자동으로 dist3 선택.
    """
    best: tuple[float, Path] | None = None
    for name in ['dist', 'dist2', 'dist3']:
        idx = root / 'web' / kind / name / 'index.html'
        if idx.exists():
            mtime = idx.stat().st_mtime
            if best is None or mtime > best[0]:
                best = (mtime, idx.parent)
    return best[1] if best else None


def get_remote_files(sftp, remote_dir: str) -> set[str]:
    """서버 assets 파일 목록 (파일명만)"""
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

    # assets: 서버에 없는 파일만 업로드
    assets_dir = dist / 'assets'
    if assets_dir.exists():
        for f in sorted(assets_dir.iterdir()):
            if f.is_file():
                if f.name not in remote_files:
                    sftp.put(str(f), f'{remote_dir}/assets/{f.name}')
                    print(f'  + {f.name}')
                    uploaded += 1
                else:
                    skipped += 1

    # index.html 항상 업로드 + __SAJUMOON_ENV__ → prod 치환
    index = dist / 'index.html'
    if index.exists():
        content = index.read_text(encoding='utf-8')
        content = content.replace('__SAJUMOON_ENV__', 'prod')
        tmp = '/tmp/_fe_index.html'
        with sftp.file(tmp, 'w') as fh:
            fh.write(content)
        client.exec_command(f'mv {tmp} {remote_dir}/index.html')[1].channel.recv_exit_status()
        print(f'  index.html → prod')
        uploaded += 1

    print(f'  완료: {uploaded}개 업로드, {skipped}개 스킵')

    # 배포 검증: 서버에 새 index.html의 JS 해시가 실제로 존재하는지 확인
    _verify(client, sftp, remote_dir, dist)

    sftp.close()
    client.close()


def _verify(client, sftp, remote_dir: str, dist: Path) -> None:
    """서버 index.html이 참조하는 JS 파일이 서버 assets에 실제로 존재하는지 검증."""
    try:
        index = dist / 'index.html'
        content = index.read_text(encoding='utf-8')
        # Vite 빌드 산출물의 JS 해시 파일명 추출 (예: index-B68NAIEP.js)
        import re
        js_files = re.findall(r'assets/(index-[A-Za-z0-9]+\.js)', content)
        if not js_files:
            return
        js_name = js_files[0]
        stdin, stdout, stderr = client.exec_command(
            f'test -f {remote_dir}/assets/{js_name} && echo OK || echo MISSING'
        )
        result = stdout.read().decode().strip()
        if result == 'OK':
            print(f'  ✓ 검증: {js_name} 서버 확인')
        else:
            print(f'  ⚠ 검증 실패: {js_name} 서버에 없음 — 배포 재확인 필요', file=sys.stderr)
    except Exception as e:
        print(f'  검증 스킵: {e}')


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in ('user', 'mng'):
        print('usage: python tools/_patch_frontend_fast.py <user|mng>', file=sys.stderr)
        return 2
    kind = sys.argv[1]

    root = Path(__file__).resolve().parent.parent

    pw = load_sshpass(root)
    if not pw:
        print('SSHPASS 없음 — .env.local에 SSHPASS=xxx 추가 필요', file=sys.stderr)
        return 1

    dist = find_latest_dist(root, kind)
    if not dist:
        print(f'빌드 폴더 없음 — 먼저 빌드 필요: cd web/{kind} && npx vite build', file=sys.stderr)
        return 1

    print(f'[빠른 배포] {kind} ← {dist.name}  (가장 최근 빌드 자동 선택)')
    for host, remote in TARGETS[kind]:
        print(f'\n→ {host}:{remote}')
        deploy_fast(host, remote, dist, pw)
    return 0


if __name__ == '__main__':
    sys.exit(main())
