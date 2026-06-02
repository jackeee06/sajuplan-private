"""동시 역할자 안내 적용 엄격 검증.

1. API dist: other_role_count 필드 + 카운트 SQL
2. Frontend dist: "두 역할을 모두 사용하신다면" 안내 텍스트
3. DB 시뮬레이션: 사장님(91, counselor 모드) 응답이 정확히 어떻게 나오는지
"""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']

TARGETS = [
    ('test','172.235.211.75','/data/wwwroot/api.sajumoon.kr','/data/wwwroot/sajumoon.kr','/usr/local/pgsql/bin/psql'),
    ('prod','104.64.128.103','/data/wwwroot/api.sajumoon.co.kr','/data/wwwroot/sajumoon.co.kr','/usr/bin/psql'),
]

overall_ok = True
for label, host, api_remote, web_remote, psql in TARGETS:
    print(f"\n{'='*70}\n[{label}] {host}\n{'='*70}")
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

    # ── [1] API dist: other_role_count 코드 ──
    print("\n  [1] API dist consult.service.js 에 other_role_count 코드")
    _, o, _ = c.exec_command(
        f"grep -cF 'other_role_count' {api_remote}/dist/user/consult/consult.service.js"
    )
    cnt = o.read().decode().strip() or "0"
    ok = int(cnt) >= 2
    mark = "✅" if ok else "❌"
    print(f"     {mark}  other_role_count 흔적 = {cnt}")
    overall_ok = overall_ok and ok

    _, o, _ = c.exec_command(
        f"grep -cF 'otherOwnerCol' {api_remote}/dist/user/consult/consult.service.js"
    )
    cnt = o.read().decode().strip() or "0"
    ok = int(cnt) >= 1
    mark = "✅" if ok else "❌"
    print(f"     {mark}  otherOwnerCol 변수 (반대 시점 SELECT) = {cnt}")
    overall_ok = overall_ok and ok

    # ── [2] Frontend dist: 안내 텍스트 ──
    print("\n  [2] Frontend dist 안내 텍스트")
    checks = [
        ("두 역할을 모두 사용하신다면", "안내 메인 멘트"),
        ("회원 ⇄ 상담사", "토글 라벨"),
        ("other_role_count", "API 필드 참조"),
        ("otherRoleCount", "프론트 변수명"),
    ]
    for kw, desc in checks:
        _, o, _ = c.exec_command(
            f"grep -cF '{kw}' {web_remote}/assets/index-*.js 2>/dev/null"
        )
        cnt = o.read().decode().strip() or "0"
        ok = int(cnt) >= 1
        mark = "✅" if ok else "❌"
        print(f"     {mark}  {desc} = {cnt}")
        overall_ok = overall_ok and ok

    # ── [3] DB 시뮬레이션: 사장님(member_id=91) counselor 모드 ──
    print("\n  [3] DB 시뮬레이션 — 사장님(id=91) counselor 시점")
    _, o, _ = c.exec_command('grep "^DATABASE_URL=" ' + api_remote + '/.env | head -1')
    dburl = o.read().decode().strip().split('=',1)[1].strip("'\"")

    # 사장님 counselor 시점 total (WHERE counselor_id=91)
    _, o, _ = c.exec_command(
        f'{psql} "{dburl}" -Atc '
        '"SELECT count(*) FROM consultation '
        'WHERE counselor_id = 91 '
        "AND reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL');\""
    )
    counselor_total = o.read().decode().strip() or "0"
    print(f"     counselor 시점 total = {counselor_total}")

    # 사장님 member 시점 (반대 카운트 — other_role_count 가 되어야)
    _, o, _ = c.exec_command(
        f'{psql} "{dburl}" -Atc '
        '"SELECT count(*) FROM consultation '
        'WHERE member_id = 91 '
        "AND reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL');\""
    )
    member_total = o.read().decode().strip() or "0"
    print(f"     member 시점 카운트 (= other_role_count) = {member_total}")

    if int(counselor_total) == 0 and int(member_total) > 0:
        print(f"     ✅ 사장님 counselor 모드 → 빈 화면 + 안내 노출 조건 만족")
    elif int(counselor_total) > 0:
        print(f"     ⚠️  counselor 시점에도 데이터 있음 → 빈 화면 안 됨 (안내 안 보임 정상)")
    else:
        print(f"     ❌ 양쪽 모두 0 — 안내 노출 안 됨 (정상)")

    # ── [4] pm2 에러 ──
    print("\n  [4] pm2 최근 에러 (consult 관련)")
    _, o, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 100 --err 2>/dev/null | "
        "grep -aE 'history|consult|other_role|count' | tail -5 || echo '(에러 없음)'"
    )
    body = o.read().decode().strip()
    if body and "(에러 없음)" not in body:
        print(f"     ⚠️ {body[:500]}")
    else:
        print(f"     ✅ 에러 없음")

    c.close()

print(f"\n{'='*70}")
print("✅ 전체 PASS" if overall_ok else "❌ 일부 FAIL")
print("="*70)
sys.exit(0 if overall_ok else 1)
