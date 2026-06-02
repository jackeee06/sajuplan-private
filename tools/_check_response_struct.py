"""prod API dist 의 history 응답 구조 + 프론트 검증."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

print("=== API dist other_role_count 코드 context ===")
_, o, _ = c.exec_command(
    "grep -B2 -A5 'other_role_count' /data/wwwroot/api.sajumoon.co.kr/dist/user/consult/consult.service.js | head -40"
)
print(o.read().decode()[:3000])

print("\n=== 프론트 index.html 현재 JS 참조 ===")
_, o, _ = c.exec_command(
    "grep -oE 'index-[A-Za-z0-9_-]+\\.(js|css)' /data/wwwroot/sajumoon.co.kr/index.html"
)
print(o.read().decode())

print("\n=== 프론트 dist 안내 멘트 ===")
_, o, _ = c.exec_command(
    "grep -oF '두 역할을 모두 사용하신다면' /data/wwwroot/sajumoon.co.kr/assets/index-*.js | head -3"
)
print(o.read().decode())

print("\n=== 프론트 dist other_role_count 참조 ===")
_, o, _ = c.exec_command(
    "grep -oF 'other_role_count' /data/wwwroot/sajumoon.co.kr/assets/index-*.js | head -3"
)
print(o.read().decode())

print("\n=== 프론트 dist 빈상태 div 클래스 (안내 노출되는 wrapper) ===")
_, o, _ = c.exec_command(
    "grep -oE 'py-20 text-center flex flex-col items-center gap-3' /data/wwwroot/sajumoon.co.kr/assets/index-*.js | head -3"
)
print(o.read().decode())

c.close()
