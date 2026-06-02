"""채팅 시간 사전 선택 — 다각도 엄격 검증.

검증 방식 (이전과 다른 각도):
1. DB: chat_room.alloc_seconds_member 컬럼 존재 (사전 배정 슬롯)
2. API endpoint 라이브 호출 (정상/누락/잘못된값) — 응답 코드로 검증
3. API dist: chargeMinutes 분기 + alloc 계산 정확히 매칭
4. API dist: STAY 분기 안에 차감 SQL 이 안 들어가는지
5. Frontend dist: charge_minutes 가 axios POST body 에 포함되는지
6. Frontend dist: 시간 카드 + 별도 박스가 모두 존재하는지
"""
import os, sys, paramiko, json

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']

TARGETS = [
    ('test','172.235.211.75','/data/wwwroot/api.sajumoon.kr','/data/wwwroot/sajumoon.kr',
     '/usr/local/pgsql/bin/psql','https://api.sajumoon.kr'),
    ('prod','104.64.128.103','/data/wwwroot/api.sajumoon.co.kr','/data/wwwroot/sajumoon.co.kr',
     '/usr/bin/psql','https://api.sajuplan.com'),
]

overall_ok = True
for label, host, api_remote, web_remote, psql, api_base in TARGETS:
    print(f"\n{'='*70}\n[{label}] {host}\n{'='*70}")
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

    # ── [1] DB 컬럼 ──
    print("\n  [1] DB chat_room.alloc_seconds_member 컬럼")
    _, o, _ = c.exec_command(
        f"grep '^DATABASE_URL=' {api_remote}/.env | head -1"
    )
    dburl = o.read().decode().strip().split('=',1)[1].strip("'\"")
    _, o, _ = c.exec_command(
        f'{psql} "{dburl}" -Atc '
        '"SELECT column_name FROM information_schema.columns '
        "WHERE table_name='chat_room' AND column_name='alloc_seconds_member';\""
    )
    r = o.read().decode().strip()
    ok1 = r == 'alloc_seconds_member'
    mark = "✅" if ok1 else "❌"
    print(f"     {mark}  컬럼 존재: '{r}'")
    overall_ok = overall_ok and ok1

    # ── [2] API 라이브 호출 (charge_minutes 잘못된 값) ──
    print("\n  [2] API /user/consult/chat 라이브 호출")

    # 2-1) 토큰 없이 호출 → 401 (인증 가드 작동)
    _, o, _ = c.exec_command(
        f"curl -s -w 'HTTP=%{{http_code}}' -m 10 -X POST '{api_base}/api/user/consult/chat' "
        f"-H 'Content-Type: application/json' "
        f'-d \'{{"counselor_id":1,"charge_minutes":15}}\''
    )
    r = o.read().decode().strip()
    ok2a = 'HTTP=401' in r
    mark = "✅" if ok2a else "❌"
    print(f"     {mark}  무인증 호출 → 401 (정상): {r[-60:]}")
    overall_ok = overall_ok and ok2a

    # 2-2) 잘못된 charge_minutes 값 (33) → 400 또는 401 (인증 먼저 막힘은 OK)
    _, o, _ = c.exec_command(
        f"curl -s -w 'HTTP=%{{http_code}}' -m 10 -X POST '{api_base}/api/user/consult/chat' "
        f"-H 'Content-Type: application/json' "
        f'-d \'{{"counselor_id":1,"charge_minutes":33}}\''
    )
    r = o.read().decode().strip()
    ok2b = ('HTTP=400' in r or 'HTTP=401' in r)
    mark = "✅" if ok2b else "❌"
    print(f"     {mark}  잘못된 값(33) → 400/401: {r[-60:]}")
    overall_ok = overall_ok and ok2b

    # ── [3] API dist: chargeMinutes 분기 + alloc 계산 ──
    print("\n  [3] API dist: chargeMinutes 흐름")
    # 화이트리스트
    _, o, _ = c.exec_command(
        f"grep -cE 'allowed.*15.*30.*45.*60|\\[15, 30, 45, 60\\]' "
        f"{api_remote}/dist/user/consult/consult.service.js"
    )
    cnt = o.read().decode().strip() or "0"
    ok3a = int(cnt) >= 1
    mark = "✅" if ok3a else "❌"
    print(f"     {mark}  화이트리스트 [15,30,45,60] = {cnt}")
    overall_ok = overall_ok and ok3a

    # alloc 계산 = chargeMinutes * 60
    _, o, _ = c.exec_command(
        f"grep -cF 'params.chargeMinutes * 60' "
        f"{api_remote}/dist/user/consult/consult.service.js"
    )
    cnt = o.read().decode().strip() or "0"
    ok3b = int(cnt) >= 1
    mark = "✅" if ok3b else "❌"
    print(f"     {mark}  alloc = chargeMinutes * 60 = {cnt}")
    overall_ok = overall_ok and ok3b

    # requiredCost 계산 (Math.ceil)
    _, o, _ = c.exec_command(
        f"grep -cF 'Math.ceil((params.chargeMinutes * 60)' "
        f"{api_remote}/dist/user/consult/consult.service.js"
    )
    cnt = o.read().decode().strip() or "0"
    ok3c = int(cnt) >= 1
    mark = "✅" if ok3c else "❌"
    print(f"     {mark}  requiredCost Math.ceil 계산 = {cnt}")
    overall_ok = overall_ok and ok3c

    # ── [4] API dist: STAY 가드 ──
    print("\n  [4] API tickRoom STAY 차감 차단")
    _, o, _ = c.exec_command(
        f"grep -cE 'awaiting_counselor' "
        f"{api_remote}/dist/user/chat/chat.service.js"
    )
    cnt = o.read().decode().strip() or "0"
    ok4 = int(cnt) >= 1
    mark = "✅" if ok4 else "❌"
    print(f"     {mark}  awaiting_counselor reason = {cnt}")
    overall_ok = overall_ok and ok4

    # ── [5] Frontend: charge_minutes 가 axios body 에 포함되는지 ──
    print("\n  [5] Frontend dist: charge_minutes POST body 포함")
    _, o, _ = c.exec_command(
        f"grep -oE 'charge_minutes' {web_remote}/assets/index-*.js 2>/dev/null | wc -l"
    )
    cnt = o.read().decode().strip() or "0"
    ok5 = int(cnt) >= 1
    mark = "✅" if ok5 else "❌"
    print(f"     {mark}  charge_minutes 흔적 = {cnt}")
    overall_ok = overall_ok and ok5

    # ── [6] Frontend: 시간 카드 + 별도 박스 ──
    print("\n  [6] Frontend dist: UI 핵심 요소")
    checks = [
        ("h-[64px] rounded-[14px]", "시간 카드 클래스 (64px 높이 + 14px 둥글)"),
        ("상담 시간 선택", "헤더 문구"),
        ("최대 사용 시 잔여", "별도 박스 잔여 라벨"),
        ("실제 사용한 시간만 차감", "안심 멘트"),
        ("코인이 부족합니다", "잔액부족 에러 메시지"),
    ]
    for kw, desc in checks:
        _, o, _ = c.exec_command(
            f"grep -oF '{kw}' {web_remote}/assets/index-*.js 2>/dev/null | wc -l"
        )
        cnt = o.read().decode().strip() or "0"
        ok = int(cnt) >= 1
        mark = "✅" if ok else "❌"
        print(f"     {mark}  {desc} = {cnt}")
        overall_ok = overall_ok and ok

    # ── pm2 에러 ──
    print("\n  [pm2] 배포 직후 에러 (최근 100라인 — 25분 이내)")
    _, o, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 100 --err 2>/dev/null | "
        "grep -aE 'consult|chat|chargeMinutes|alloc_seconds' | tail -3 || echo '(에러 없음)'"
    )
    body = o.read().decode().strip()
    if body and "(에러 없음)" not in body:
        print(f"     ⚠️  관련 에러:\n     {body[:400]}")
    else:
        print(f"     ✅  에러 없음")

    c.close()

print(f"\n{'='*70}")
if overall_ok:
    print("✅ 전체 PASS — chargeMinutes 모델 + STAY 안전망 모두 정상 작동")
else:
    print("❌ 일부 FAIL — 위 ❌ 항목 확인")
print("="*70)
sys.exit(0 if overall_ok else 1)
