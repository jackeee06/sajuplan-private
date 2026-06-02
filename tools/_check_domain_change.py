"""대표 도메인 변경 직후 점검 (prod 만)."""
import os, sys, paramiko, ssl, socket
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']
HOST = '104.64.128.103'

print(f"\n{'='*70}\n[prod] {HOST} — 대표 도메인 변경 후 점검\n{'='*70}")
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

# ── ① 디렉토리 변동 여부 ──
print("\n[1] /data/wwwroot/ 디렉토리 목록")
_, o, _ = c.exec_command("ls -la /data/wwwroot/ 2>/dev/null | grep -E '^d' | awk '{print $NF}' | head -20")
dirs = o.read().decode().strip()
print(f"  현재:\n{dirs}")
sajumoon_exists = 'sajumoon.co.kr' in dirs
sajuplan_exists = 'sajuplan.com' in dirs
if sajumoon_exists and not sajuplan_exists:
    print(f"  ✅ sajumoon.co.kr 디렉토리 그대로 (sajuplan.com 디렉토리 자동 생성 X)")
elif sajuplan_exists:
    print(f"  ⚠️ sajuplan.com 디렉토리도 생성됨 — 카페24가 디렉토리 자동 변경 가능성")
else:
    print(f"  ❌ sajumoon.co.kr 디렉토리 없음 — 위험! 즉시 원복 필요")

# ── ② nginx 설정 server_name 확인 ──
print("\n[2] nginx server_name 설정")
_, o, _ = c.exec_command("nginx -T 2>/dev/null | grep -E 'server_name' | sort -u | head -20")
ng = o.read().decode().strip()
print(ng[:1500] if ng else "  ❌ nginx -T 실행 실패")

# ── ③ pm2 sajumoon-api 상태 ──
print("\n[3] pm2 sajumoon-api 프로세스")
_, o, _ = c.exec_command("pm2 status sajumoon-api 2>/dev/null | grep -E 'sajumoon-api|online|errored' | head -3")
pm2 = o.read().decode().strip()
print(pm2[:500] if pm2 else "  ❌ pm2 응답 없음")

# ── ④ 사이트 접속 (양쪽) — 서버에서 curl ──
print("\n[4] 사이트 HTTP 응답 (서버에서 curl)")
for label, url in [
    ('sajuplan.com (메인)', 'https://sajuplan.com/'),
    ('sajumoon.co.kr (옛, 유지중)', 'https://sajumoon.co.kr/'),
    ('api.sajuplan.com', 'https://api.sajuplan.com/'),
    ('api.sajumoon.co.kr', 'https://api.sajumoon.co.kr/'),
]:
    _, o, _ = c.exec_command(f"curl -sI -m 8 -o /dev/null -w '%{{http_code}} (size=%{{size_download}})' '{url}'")
    code = o.read().decode().strip() or "(timeout)"
    print(f"  {label:35s} → {code}")

# ── ⑤ SSL 인증서 양쪽 도메인 ──
print("\n[5] SSL 인증서 도메인 매칭")
for d in ['sajuplan.com', 'sajumoon.co.kr', 'api.sajuplan.com', 'api.sajumoon.co.kr']:
    _, o, _ = c.exec_command(
        f"echo | openssl s_client -servername {d} -connect {d}:443 2>/dev/null | "
        f"openssl x509 -noout -subject -dates 2>/dev/null | head -3"
    )
    cert = o.read().decode().strip()
    if cert:
        print(f"  {d:35s} → {cert[:200]}")
    else:
        print(f"  {d:35s} → ❌ SSL 응답 없음")

# ── ⑥ 로컬 호스팅 디렉토리의 .env 환경변수 ──
print("\n[6] api 디렉토리 SAJUMOON_ENV 확인")
_, o, _ = c.exec_command(
    "grep '^SAJUMOON_ENV=' /data/wwwroot/api.sajumoon.co.kr/.env 2>/dev/null | head -1"
)
env = o.read().decode().strip()
print(f"  api.sajumoon.co.kr/.env: {env or '(없음)'}")

# ── ⑦ DNS resolve 확인 (서버 측에서) ──
print("\n[7] DNS resolve (서버에서)")
for d in ['sajuplan.com', 'sajumoon.co.kr', 'api.sajuplan.com', 'api.sajumoon.co.kr']:
    _, o, _ = c.exec_command(f"getent hosts {d} | head -1")
    r = o.read().decode().strip()
    print(f"  {d:35s} → {r or '(미해석)'}")

c.close()
print(f"\n{'='*70}\n점검 완료. 위 결과 종합 판단:\n{'='*70}")
