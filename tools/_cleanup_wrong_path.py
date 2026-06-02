"""prod 의 잘못된 경로 폴더 (/data/wwwroot/api.sajuplan.com) 완전 삭제.
   실제 prod 코드는 /data/wwwroot/api.sajumoon.co.kr 에 있음.
   확인: package.json 이 없음 + 옛 .env.defaults 만 잔존 → 안전하게 폴더 자체 삭제."""
from __future__ import annotations
import os, sys
import paramiko

pw = os.environ.get('SSHPASS')
if not pw:
    print('SSHPASS env var required', file=sys.stderr); sys.exit(2)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20,
          look_for_keys=False, allow_agent=False)

# 1) 안전 확인: 폴더 안에 package.json 이 없어야 함 (운영 코드 아님)
_, out, _ = c.exec_command(
    "find /data/wwwroot/api.sajuplan.com -name 'package.json' 2>/dev/null | wc -l",
    timeout=15,
)
n_pkg = out.read().decode().strip()
print(f'package.json count in target folder: {n_pkg}')
if n_pkg != '0':
    print('❌ ABORT — package.json found. 진짜 운영 코드일 가능성. 삭제 안 함.',
          file=sys.stderr)
    c.close(); sys.exit(1)

# 2) 폴더 자체 삭제
_, out, err = c.exec_command(
    "rm -rf /data/wwwroot/api.sajuplan.com 2>&1 && "
    "ls -la /data/wwwroot/ | grep -E 'sajuplan|sajumoon'",
    timeout=30,
)
print('--- after cleanup ---')
print(out.read().decode())
e = err.read().decode()
if e: print('STDERR:', e)

c.close()
