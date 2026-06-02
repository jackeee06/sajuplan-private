"""정확한 사이트 응답 확인 (GET 요청 + 본문 일부)."""
import os, sys, paramiko

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']
HOST = '104.64.128.103'

c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

print(f"\n[1] GET 요청으로 사이트 본문 확인")
for label, url in [
    ('sajuplan.com (메인 GET)', 'https://sajuplan.com/'),
    ('sajumoon.co.kr (메인 GET)', 'https://sajumoon.co.kr/'),
]:
    _, o, _ = c.exec_command(f"curl -s -m 8 -w '\\nHTTP=%{{http_code}}|size=%{{size_download}}' '{url}' | head -30")
    body = o.read().decode().strip()
    # 본문 첫 200자 + 마지막 메타
    lines = body.split('\n')
    meta = lines[-1] if lines else ''
    head = '\n'.join(lines[:-1])[:400] if len(lines) > 1 else ''
    print(f"  {label}")
    print(f"    {meta}")
    if head:
        print(f"    본문(첫 400자): {head[:400]!r}")

print(f"\n[2] API 경로 응답 (실제 endpoint)")
for label, url in [
    ('api.sajuplan.com /api/health', 'https://api.sajuplan.com/api/health'),
    ('api.sajumoon.co.kr /api/health', 'https://api.sajumoon.co.kr/api/health'),
    ('api.sajuplan.com 루트 GET', 'https://api.sajuplan.com/'),
]:
    _, o, _ = c.exec_command(f"curl -s -m 8 -w '\\nHTTP=%{{http_code}}|size=%{{size_download}}' '{url}'")
    body = o.read().decode().strip()
    lines = body.split('\n')
    meta = lines[-1] if lines else ''
    head = '\n'.join(lines[:-1])[:300] if len(lines) > 1 else ''
    print(f"  {label}")
    print(f"    {meta}")
    if head:
        print(f"    본문: {head[:300]!r}")

print(f"\n[3] sajuplan.com 디렉토리 내용 확인 (빈 폴더? 우리 콘텐츠?)")
_, o, _ = c.exec_command("ls -la /data/wwwroot/sajuplan.com/ 2>/dev/null | head -15")
print(o.read().decode())

print(f"\n[4] sajumoon.co.kr 디렉토리 (우리 콘텐츠) — 비교용")
_, o, _ = c.exec_command("ls -la /data/wwwroot/sajumoon.co.kr/ 2>/dev/null | head -15")
print(o.read().decode())

print(f"\n[5] index.html 또는 assets 디렉토리 존재 여부 — sajuplan.com")
_, o, _ = c.exec_command(
    "ls -la /data/wwwroot/sajuplan.com/index.html /data/wwwroot/sajuplan.com/assets 2>&1 | head -5"
)
print(o.read().decode())

print(f"\n[6] nginx 응답 헤더 비교 (vhost root 확인)")
_, o, _ = c.exec_command(
    "curl -s -m 8 -I https://sajuplan.com/ | head -15"
)
print(o.read().decode())

c.close()
