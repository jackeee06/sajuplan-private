"""워터마크 심층 검증 — inline-style 문자열 + SVG 색상 확인."""
import os, sys, paramiko, re

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']

print("="*70)
print("[1] dist JS 에 워터마크 inline-style 문자열 매칭")
print("="*70)
for label, host, web_remote in [
    ('test','172.235.211.75','/data/wwwroot/sajumoon.kr'),
    ('prod','104.64.128.103','/data/wwwroot/sajumoon.co.kr'),
]:
    print(f"\n--- [{label}] {host} ---")
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

    # inline-style 의 backgroundImage 가 minified JS 에 그대로 들어있는지
    _, o, _ = c.exec_command(
        f"grep -oE 'backgroundImage:\"url..../img/logo_g.svg' "
        f"{web_remote}/assets/index-*.js 2>/dev/null | head -3"
    )
    body = o.read().decode().strip()
    print(f"  backgroundImage: {body or '(없음 ❌)'}")

    # absolute inset-0 z-0 와 함께 있는지
    _, o, _ = c.exec_command(
        f"grep -oE 'pointer-events-none absolute inset-0 z-0 opacity-\\[0\\.08\\]' "
        f"{web_remote}/assets/index-*.js 2>/dev/null | head -3"
    )
    body = o.read().decode().strip()
    print(f"  워터마크 div className: {body or '(없음 ❌)'}")

    # backgroundSize / backgroundRepeat 가 inline 으로 들어있는지
    _, o, _ = c.exec_command(
        f"grep -oE 'backgroundSize:\"200px auto\"' "
        f"{web_remote}/assets/index-*.js 2>/dev/null | head -1"
    )
    bsz = o.read().decode().strip()
    _, o, _ = c.exec_command(
        f"grep -oE 'backgroundRepeat:\"repeat\"' "
        f"{web_remote}/assets/index-*.js 2>/dev/null | head -1"
    )
    brep = o.read().decode().strip()
    print(f"  backgroundSize: {bsz or '(없음)'}")
    print(f"  backgroundRepeat: {brep or '(없음)'}")

    # 메시지 컨테이너의 relative 클래스 (워터마크 부모)
    _, o, _ = c.exec_command(
        f"grep -oE 'relative flex-1 overflow-y-auto px-4 pt-..60px..' "
        f"{web_remote}/assets/index-*.js 2>/dev/null | head -3"
    )
    body = o.read().decode().strip()
    print(f"  부모 컨테이너 (relative): {body or '(없음 ❌)'}")

    c.close()

print("\n" + "="*70)
print("[2] /img/logo_g.svg 파일 색상/투명도 분석")
print("="*70)
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
# SVG 파일의 fill / stroke 색상 추출 (최대 처음 20개)
_, o, _ = c.exec_command(
    "grep -oE 'fill=\"[^\"]+\"|stroke=\"[^\"]+\"|fill:#[0-9a-fA-F]+|color:#[0-9a-fA-F]+' "
    "/data/wwwroot/sajumoon.co.kr/img/logo_g.svg | sort -u | head -10"
)
print(f"\nlogo_g.svg 색상 토큰:")
print(o.read().decode() or "(추출 실패)")

# logo_b 와 비교
_, o, _ = c.exec_command(
    "grep -oE 'fill=\"[^\"]+\"|stroke=\"[^\"]+\"|fill:#[0-9a-fA-F]+' "
    "/data/wwwroot/sajumoon.co.kr/img/logo_b.svg | sort -u | head -10"
)
print(f"\nlogo_b.svg 색상 토큰 (비교):")
print(o.read().decode() or "(추출 실패)")
c.close()

print("\n" + "="*70)
print("진단 결론은 위 출력 보고 판단")
print("="*70)
