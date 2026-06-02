"""순이익 시뮬레이터 최종 엄격검증 (3단계 모두 포함)."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']
TARGETS = [
    ('test','172.235.211.75','/data/wwwroot/api.sajumoon.kr','/data/wwwroot/sajumoon.kr','https://api.sajumoon.kr'),
    ('prod','104.64.128.103','/data/wwwroot/api.sajumoon.co.kr','/data/wwwroot/sajumoon.co.kr','https://api.sajuplan.com'),
]

overall_ok = True
for label, host, api_remote, web_remote, api_base in TARGETS:
    print(f"\n{'='*70}\n[{label}] {host}\n{'='*70}")
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

    # [1] API endpoints
    print("\n[1] API endpoints (401 인증 가드)")
    for ep in ['/admin/profit-sim', '/admin/profit-sim/insights']:
        _, o, _ = c.exec_command(
            f"curl -s -w 'HTTP=%{{http_code}}' -m 10 '{api_base}/api{ep}'"
        )
        r = o.read().decode().strip()
        ok = 'HTTP=401' in r
        mark = "✅" if ok else "❌"
        print(f"     {mark}  GET {ep} → {r[-40:]}")
        overall_ok = overall_ok and ok

    # [2] API 핵심 코드 (3단계)
    print("\n[2] API 3단계 코드 (KPI / 시즌)")
    checks_api = [
        ('this_month_revenue', '이번달 매출 (KPI)'),
        ('best_dow', '시즌 최고 요일'),
        ('by_dow', '요일별 분포'),
        ('active_members_30d', '활성 회원 30일'),
    ]
    for kw, desc in checks_api:
        _, o, _ = c.exec_command(
            f"grep -cF '{kw}' {api_remote}/dist/admin/profit-sim/profit-sim.service.js"
        )
        cnt = o.read().decode().strip() or "0"
        ok = int(cnt) >= 1
        mark = "✅" if ok else "❌"
        print(f"     {mark}  {desc} = {cnt}")
        overall_ok = overall_ok and ok

    # [3] mng dist (3단계 신규 섹션)
    print("\n[3] mng 프론트 3단계 신규 섹션")
    _, o, _ = c.exec_command(
        f"grep -oE 'index-[A-Za-z0-9_-]+\\.js' {web_remote}/mng/index.html | head -1"
    )
    js_file = o.read().decode().strip()
    print(f"     현재 JS: {js_file}")

    web_checks = [
        ('이번달 매출', '⓪ KPI 헤더 - 이번달'),
        ('지난달 매출', '⓪ KPI 헤더 - 지난달'),
        ('활성 회원', '⓪ KPI 헤더 - 활성회원'),
        ('시나리오 비교', '⑩ 시나리오 비교'),
        ('🛡 보수', '⑩ 보수 시나리오'),
        ('🚀 낙관', '⑩ 낙관 시나리오'),
        ('요일별 시즌 패턴', '⑪ 시즌 패턴'),
        ('매출 최고 요일', '⑪ 최고 요일'),
        ('현재값 저장', '⑩ 시나리오 저장 버튼'),
    ]
    for kw, desc in web_checks:
        if not js_file: break
        _, o, _ = c.exec_command(
            f"grep -cF '{kw}' {web_remote}/mng/assets/{js_file}"
        )
        cnt = o.read().decode().strip() or "0"
        ok = int(cnt) >= 1
        mark = "✅" if ok else "❌"
        print(f"     {mark}  {desc} ({kw}) = {cnt}")
        overall_ok = overall_ok and ok

    # [4] 기존 1~2단계 섹션 유지 검증
    print("\n[4] 1~2단계 섹션 유지")
    legacy_checks = [
        '협상 가능 변수', '월별 시뮬레이션', '회원 LTV', '위험 신호',
        '3년 성장 로드맵', 'recharts',
    ]
    if js_file:
        for kw in legacy_checks:
            _, o, _ = c.exec_command(
                f"grep -cF '{kw}' {web_remote}/mng/assets/{js_file}"
            )
            cnt = o.read().decode().strip() or "0"
            ok = int(cnt) >= 1
            mark = "✅" if ok else "❌"
            print(f"     {mark}  {kw} = {cnt}")
            overall_ok = overall_ok and ok

    # [5] pm2 에러
    print("\n[5] pm2 최근 에러")
    _, o, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 30 --err 2>/dev/null | "
        "grep -aE 'profit-sim|UnknownDependencies' | tail -3 || echo '(에러 없음)'"
    )
    body = o.read().decode().strip()
    if body and '(에러 없음)' not in body:
        print(f"     ⚠️ {body[:300]}")
    else:
        print("     ✅ 에러 없음")

    c.close()

print(f"\n{'='*70}")
print("🎉 전체 PASS — 순이익 시뮬레이터 완전 배포" if overall_ok else "❌ 일부 FAIL")
print("="*70)
sys.exit(0 if overall_ok else 1)
