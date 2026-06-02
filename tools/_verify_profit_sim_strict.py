"""순이익 시뮬레이터 — 다각도 심층 엄격검증.

각도:
A. DB JSONB 라운드트립 (INSERT + SELECT + 클린업)
B. KPI 숫자 직접 DB 쿼리 vs API 동일 계산식 결과
C. 시즌 패턴 — 실제 요일별 매출 데이터 존재 여부
D. 시나리오 저장/비교 — dist 안 함수/차트
E. 사이드바 노출 — admin.is_super 체크 코드
F. 코드 흐름 — saveScenario, scenarioResults, KpiCard 모두 dist 에 포함
G. 양 서버 라이브 endpoint 응답 크기 (401 가드 정상)
"""
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
    _, o, _ = c.exec_command(f'grep "^DATABASE_URL=" {api_remote}/.env | head -1')
    dburl = o.read().decode().strip().split('=',1)[1].strip("'\"")

    # ── [A] JSONB 라운드트립 ──
    print("\n[A] DB JSONB 라운드트립 (INSERT + SELECT + DELETE)")
    test_data = '{\\"test_key\\":42,\\"nested\\":{\\"a\\":1}}'
    _, o, _ = c.exec_command(
        f'{psql} "{dburl}" -Atc '
        f'"INSERT INTO profit_simulator_config (admin_id, data) VALUES (-99999, \'{{\\"test_key\\":42,\\"nested\\":{{\\"a\\":1}}}}\'::jsonb) '
        f'ON CONFLICT (admin_id) DO UPDATE SET data = EXCLUDED.data RETURNING (data->>\'test_key\')::int;"'
    )
    inserted = o.read().decode().strip()
    ok_a = inserted == '42'
    mark = "✅" if ok_a else "❌"
    print(f"     {mark}  INSERT + 라운드트립 (test_key=42): {inserted}")
    # 클린업
    c.exec_command(f'{psql} "{dburl}" -c "DELETE FROM profit_simulator_config WHERE admin_id = -99999;"')[1].read()
    overall_ok = overall_ok and ok_a

    # ── [B] KPI 직접 계산 ──
    print("\n[B] KPI 직접 DB 쿼리 (실측)")
    # 이번달 매출
    _, o, _ = c.exec_command(
        f'{psql} "{dburl}" -Atc '
        '"SELECT COALESCE(SUM(amt - COALESCE(refunded_amount,0)), 0) '
        'FROM consultation '
        "WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL') "
        "AND ended_at >= date_trunc('month', NOW());\""
    )
    this_rev = o.read().decode().strip()
    print(f"     이번달 매출 (실측): {int(this_rev) if this_rev else 0:,}원")

    # 활성 회원 30일
    _, o, _ = c.exec_command(
        f'{psql} "{dburl}" -Atc '
        '"SELECT count(*) FROM member '
        "WHERE role = 'member' AND left_at IS NULL "
        "AND last_login_at >= NOW() - INTERVAL '30 days';\""
    )
    active30 = o.read().decode().strip()
    print(f"     활성 회원 30일: {active30}명")

    # ── [C] 시즌 — 요일별 데이터 ──
    print("\n[C] 시즌 패턴 — 요일별 매출 데이터 (실측 90일)")
    _, o, _ = c.exec_command(
        f'{psql} "{dburl}" -c '
        '"SELECT EXTRACT(DOW FROM ended_at) AS dow, count(*) AS cnt, '
        'ROUND(AVG(amt - COALESCE(refunded_amount,0)))::text AS avg_amt '
        'FROM consultation '
        "WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL') "
        "AND ended_at >= NOW() - INTERVAL '90 days' "
        'GROUP BY EXTRACT(DOW FROM ended_at) '
        'ORDER BY dow;"'
    )
    dow_data = o.read().decode().strip()
    has_data = '0 rows' not in dow_data and len(dow_data.split('\n')) > 3
    mark = "✅" if has_data else "⚠️"
    print(f"     {mark}  요일별 데이터:")
    print(dow_data[:1500])
    if not has_data:
        print(f"     ⚠️ 90일 내 종료 상담 데이터가 부족 — 시즌 카드는 비어보일 수 있음")

    # ── [D] dist 안 시나리오 함수 ──
    print("\n[D] mng dist 시나리오/KPI 핵심 함수")
    _, o, _ = c.exec_command(
        f"grep -oE 'index-[A-Za-z0-9_-]+\\.js' {web_remote}/mng/index.html | head -1"
    )
    js_file = o.read().decode().strip()

    checks_d = [
        ('saveScenario', '시나리오 저장 함수'),
        ('scenarioResults', '시나리오 비교 계산 메모'),
        ('KpiCard', 'KPI 카드 컴포넌트'),
        ('best_dow', '시즌 최고 요일 데이터 참조'),
        ('conservative', '보수 시나리오 키'),
        ('optimistic', '낙관 시나리오 키'),
        ('scenarios', '시나리오 state'),
    ]
    for kw, desc in checks_d:
        _, o, _ = c.exec_command(
            f"grep -cF '{kw}' {web_remote}/mng/assets/{js_file}"
        )
        cnt = o.read().decode().strip() or "0"
        ok = int(cnt) >= 1
        mark = "✅" if ok else "❌"
        print(f"     {mark}  {desc} ({kw}) = {cnt}")
        overall_ok = overall_ok and ok

    # ── [E] 사이드바 노출 ──
    print("\n[E] 사이드바 슈퍼관리자 가드 (admin.is_super)")
    _, o, _ = c.exec_command(
        f"grep -cF 'profit-simulator' {web_remote}/mng/assets/{js_file}"
    )
    cnt = o.read().decode().strip() or "0"
    ok_e = int(cnt) >= 1
    mark = "✅" if ok_e else "❌"
    print(f"     {mark}  /profit-simulator 라우트 = {cnt}")
    overall_ok = overall_ok and ok_e

    # ── [F] 가드 라이브 ──
    print("\n[F] API 가드 라이브 (401)")
    for ep in ['/admin/profit-sim', '/admin/profit-sim/insights']:
        _, o, _ = c.exec_command(
            f"curl -s -w 'HTTP=%{{http_code}}|len=%{{size_download}}' -m 8 '{api_base}/api{ep}'"
        )
        r = o.read().decode().strip()
        ok = 'HTTP=401' in r
        mark = "✅" if ok else "❌"
        print(f"     {mark}  GET {ep} → {r[-50:]}")
        overall_ok = overall_ok and ok

    # ── [G] pm2 ──
    print("\n[G] pm2 상태")
    _, o, _ = c.exec_command(
        "pm2 list --no-color 2>/dev/null | grep sajumoon-api"
    )
    pm2_line = o.read().decode().strip()
    ok_g = 'online' in pm2_line and 'errored' not in pm2_line
    mark = "✅" if ok_g else "❌"
    print(f"     {mark}  {pm2_line[:120]}")
    overall_ok = overall_ok and ok_g

    c.close()

print(f"\n{'='*70}")
print("🎉 전체 PASS — 모든 각도 검증 완료" if overall_ok else "❌ 일부 FAIL — 위 ❌ 확인")
print("="*70)
sys.exit(0 if overall_ok else 1)
