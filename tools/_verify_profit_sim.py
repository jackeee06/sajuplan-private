"""순이익 시뮬레이터 엄격검증."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']
TARGETS = [
    ('test','172.235.211.75','/data/wwwroot/api.sajumoon.kr','/data/wwwroot/sajumoon.kr','https://api.sajumoon.kr','/usr/local/pgsql/bin/psql'),
    ('prod','104.64.128.103','/data/wwwroot/api.sajumoon.co.kr','/data/wwwroot/sajumoon.co.kr','https://api.sajuplan.com','/usr/bin/psql'),
]

overall_ok = True
for label, host, api_remote, web_remote, api_base, psql in TARGETS:
    print(f"\n{'='*70}\n[{label}] {host}\n{'='*70}")
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

    # [1] DB 테이블
    print("\n  [1] DB profit_simulator_config 테이블")
    _, o, _ = c.exec_command(f'grep "^DATABASE_URL=" {api_remote}/.env | head -1')
    dburl = o.read().decode().strip().split('=',1)[1].strip("'\"")
    _, o, _ = c.exec_command(
        f'{psql} "{dburl}" -Atc '
        '"SELECT count(*) FROM information_schema.tables WHERE table_name=\'profit_simulator_config\';"'
    )
    cnt = o.read().decode().strip()
    ok = cnt == '1'
    mark = "✅" if ok else "❌"
    print(f"     {mark}  테이블 = {cnt}")
    overall_ok = overall_ok and ok

    # [2] API endpoints
    print("\n  [2] API endpoints 가드")
    for ep, expect in [('/admin/profit-sim', 401), ('/admin/profit-sim/insights', 401)]:
        _, o, _ = c.exec_command(
            f"curl -s -w 'HTTP=%{{http_code}}' -m 10 '{api_base}/api{ep}'"
        )
        r = o.read().decode().strip()
        ok = f'HTTP={expect}' in r
        mark = "✅" if ok else "❌"
        print(f"     {mark}  GET {ep} → {r[-50:]}")
        overall_ok = overall_ok and ok

    # [3] API dist — profit-sim 모듈
    print("\n  [3] API dist 모듈")
    for f in ['profit-sim.service.js', 'profit-sim.controller.js', 'profit-sim.module.js']:
        _, o, _ = c.exec_command(f"ls {api_remote}/dist/admin/profit-sim/{f} 2>&1")
        r = o.read().decode().strip()
        ok = 'No such' not in r and '.js' in r
        mark = "✅" if ok else "❌"
        print(f"     {mark}  {f}")
        overall_ok = overall_ok and ok

    # [4] API dist — 핵심 로직
    print("\n  [4] API 핵심 코드")
    checks = [
        ('other_role_count', '안내용 카운트 (이전 작업 호환)'),
        ('profit_simulator_config', '시뮬 테이블 참조'),
        ('getInsights', 'insights 메서드'),
        ('LTV', 'LTV 주석'),
    ]
    for kw, desc in checks:
        _, o, _ = c.exec_command(
            f"grep -cF '{kw}' {api_remote}/dist/admin/profit-sim/profit-sim.service.js"
        )
        cnt = o.read().decode().strip() or "0"
        ok = int(cnt) >= 1
        mark = "✅" if ok else "❌"
        print(f"     {mark}  {desc} ({kw}) = {cnt}")
        overall_ok = overall_ok and ok

    # [5] mng dist
    print("\n  [5] mng 프론트 dist")
    _, o, _ = c.exec_command(
        f"grep -oE 'index-[A-Za-z0-9_-]+\\.js' {web_remote}/mng/index.html | head -1"
    )
    js_file = o.read().decode().strip()
    print(f"     현재 JS: {js_file}")

    web_checks = [
        ('순이익 시뮬레이터', '메뉴 제목'),
        ('협상 가능 변수', '1단 헤더'),
        ('어디를 건드리면', '5단 민감도 헤더'),
        ('월별 시뮬레이션', '6단 헤더'),
        ('회원 LTV', '7단 LTV 헤더'),
        ('위험 신호', '8단 위험 헤더'),
        ('3년 성장 로드맵', '9단 로드맵 헤더'),
        ('recharts', 'recharts 라이브러리'),
        ('DB 원본 등급률 복원', '리셋 버튼'),
        ('곧 출시', '아래에 시뮬과 무관 — 다른 페이지 검증'),  # 다른 페이지지만 같이 들어있음
    ]
    for kw, desc in web_checks:
        if not js_file: continue
        _, o, _ = c.exec_command(
            f"grep -cF '{kw}' {web_remote}/mng/assets/{js_file}"
        )
        cnt = o.read().decode().strip() or "0"
        ok = int(cnt) >= 1
        mark = "✅" if ok else "❌"
        # '곧 출시'는 user 사이트라 mng 에는 없을 수 있음 — 무시
        if kw == '곧 출시':
            continue
        print(f"     {mark}  {desc} ({kw}) = {cnt}")
        overall_ok = overall_ok and ok

    # [6] pm2 에러
    print("\n  [6] pm2 최근 에러")
    _, o, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 30 --err 2>/dev/null | "
        "grep -aE 'profit-sim|profit_simulator' | tail -3 || echo '(에러 없음)'"
    )
    body = o.read().decode().strip()
    if body and '(에러 없음)' not in body:
        print(f"     ⚠️ {body[:400]}")
    else:
        print("     ✅ 에러 없음")

    c.close()

print(f"\n{'='*70}")
print("✅ 전체 PASS — 순이익 시뮬레이터 정상 배포" if overall_ok else "❌ 일부 FAIL")
print("="*70)
sys.exit(0 if overall_ok else 1)
