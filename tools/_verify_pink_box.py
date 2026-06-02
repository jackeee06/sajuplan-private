"""분홍 안내 박스 코드가 새 dist 에 들어갔는지 검증."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']

for label, host, web_remote in [
    ('test','172.235.211.75','/data/wwwroot/sajumoon.kr'),
    ('prod','104.64.128.103','/data/wwwroot/sajumoon.co.kr'),
]:
    print(f"\n{'='*70}\n[{label}] {host}\n{'='*70}")
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

    # 현재 JS 파일명
    _, o, _ = c.exec_command(
        f"grep -oE 'index-[A-Za-z0-9_-]+\\.js' {web_remote}/index.html"
    )
    js_file = o.read().decode().strip()
    print(f"\n  현재 index.html → {js_file}")

    # 새 분홍 박스 키워드
    checks = [
        ('#FFF7FA', '분홍 박스 배경색'),
        ('fce7f3', '분홍 박스 보더색'),
        ('9d174d', '진한 핑크 텍스트색'),
        ('회원·상담사 두 역할을 모두 사용하신다면', '안내 문구'),
        ('회원 ⇄ 상담사', '토글 라벨'),
        ('otherRoleCount', '프론트 변수명'),
    ]
    for kw, desc in checks:
        _, o, _ = c.exec_command(
            f"grep -cF '{kw}' {web_remote}/assets/{js_file} 2>/dev/null"
        )
        cnt = o.read().decode().strip() or "0"
        ok = int(cnt) >= 1
        mark = "✅" if ok else "❌"
        print(f"  {mark}  {desc} = {cnt}")

    # 파일 크기/시각 확인 (새 dist 인지)
    _, o, _ = c.exec_command(
        f"ls -la {web_remote}/assets/{js_file}"
    )
    print(f"\n  파일 정보: {o.read().decode().strip()}")

    c.close()

print(f"\n{'='*70}")
print("결론: 위 ✅ 가 모두 있으면 서버 배포는 100% 정상.")
print("사장님 앱이 안내 안 보이면 → 모바일 앱 메모리 캐시 (강제 종료 필요)")
print("="*70)
