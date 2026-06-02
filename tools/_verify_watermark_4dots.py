"""워터마크 4개 지그재그 최종 검증."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']

for label, host, web_remote in [
    ('test','172.235.211.75','/data/wwwroot/sajumoon.kr'),
    ('prod','104.64.128.103','/data/wwwroot/sajumoon.co.kr'),
]:
    print(f"\n=== [{label}] {host} ===")
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

    # 새 워터마크 패턴들
    checks = [
        ("150px auto", "1. 사이즈 150px (4개 적당 크기)"),
        ("fixed inset-y-0", "2. fixed viewport 기준 (스크롤 무관)"),
        ("10% 18%, 90% 40%", "3. 4점 지그재그 좌표"),
        ('opacity:.08', "4. opacity 0.08 (inline)"),
        ("/img/logo_b.svg", "5. 검정 로고"),
    ]
    for pat, desc in checks:
        _, o, _ = c.exec_command(
            f"grep -oF '{pat}' {web_remote}/assets/index-*.js 2>/dev/null | wc -l"
        )
        cnt = o.read().decode().strip() or "0"
        mark = "✅" if int(cnt) >= 1 else "❌"
        print(f"  {mark}  {desc:40s} = {cnt}")

    c.close()
