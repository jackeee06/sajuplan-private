"""채팅 시간 사전 선택 모델 엄격 검증.

1. API: chargeMinutes 받기 + alloc 제한
2. API: tickRoom STAY 차감 차단 안전망
3. User dist: ConsultModal 시간 카드 UI
4. User dist: 차감 코인 별도 박스
5. User dist: consultApi.chat 가 charge_minutes 전달
"""
import os, sys, paramiko

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']

TARGETS = [
    ('test','172.235.211.75','/data/wwwroot/api.sajumoon.kr','/data/wwwroot/sajumoon.kr'),
    ('prod','104.64.128.103','/data/wwwroot/api.sajumoon.co.kr','/data/wwwroot/sajumoon.co.kr'),
]

overall_ok = True
for label, host, api_remote, web_remote in TARGETS:
    print(f"\n{'='*70}\n[{label}] {host}\n{'='*70}")
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

    # ── [1] API: chargeMinutes 검증 (15/30/45/60 화이트리스트) ──
    print("\n  [1] API chargeMinutes 화이트리스트 + alloc 제한")
    _, o, _ = c.exec_command(
        f"grep -cE 'chargeMinutes|allowed.*15.*30.*45.*60' "
        f"{api_remote}/dist/user/consult/consult.service.js"
    )
    cnt = o.read().decode().strip() or "0"
    ok1 = int(cnt) >= 2
    mark = "✅" if ok1 else "❌"
    print(f"     {mark}  chargeMinutes 흔적 = {cnt}")
    overall_ok = overall_ok and ok1

    # alloc 계산 로직
    _, o, _ = c.exec_command(
        f"grep -cF 'params.chargeMinutes * 60' "
        f"{api_remote}/dist/user/consult/consult.service.js"
    )
    cnt = o.read().decode().strip() or "0"
    ok = int(cnt) >= 1
    mark = "✅" if ok else "❌"
    print(f"     {mark}  alloc = chargeMinutes * 60 = {cnt}")
    overall_ok = overall_ok and ok

    # ── [2] API: tickRoom STAY 안전망 ──
    print("\n  [2] tickRoom STAY 차감 차단 안전망")
    _, o, _ = c.exec_command(
        f"grep -cF 'awaiting_counselor' "
        f"{api_remote}/dist/user/chat/chat.service.js"
    )
    cnt = o.read().decode().strip() or "0"
    ok2 = int(cnt) >= 1
    mark = "✅" if ok2 else "❌"
    print(f"     {mark}  awaiting_counselor reason = {cnt}")
    overall_ok = overall_ok and ok2

    # ── [3] User dist: ConsultModal 시간 카드 ──
    print("\n  [3] ConsultModal 시간 카드 UI")
    checks = [
        ("CHAT_MINUTE_OPTIONS", "옵션 배열"),
        ('"ì´ë³´"', "초보 라벨 (인코딩 변환됨)"),  # cp949 이슈 회피
        ("relative h-[64px] rounded-[14px]", "카드 클래스"),
        ("보유 코인", "보유 코인 표기"),
        ("최대 차감", "최대 차감 표기"),
        ("최대 사용 시 잔여", "최대 사용 시 잔여"),
        ("실제 사용한 시간만 차감", "실사용분만 차감 멘트"),
        ("charge_minutes", "API 호출 시 charge_minutes 전달"),
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
    print("\n  [pm2] 배포 직후 에러 (최근 50라인)")
    _, o, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 50 --err 2>/dev/null | "
        "grep -aE 'PostgresError|TypeError|Cannot|chargeMinutes' | tail -3 || echo '(에러 없음)'"
    )
    body = o.read().decode().strip()
    if body and "(에러 없음)" not in body:
        print(f"     ⚠️  최근 에러:\n     {body[:400]}")
    else:
        print(f"     ✅  에러 없음")

    c.close()

print(f"\n{'='*70}")
print("✅ 전체 PASS" if overall_ok else "❌ 일부 항목 FAIL")
print("="*70)
sys.exit(0 if overall_ok else 1)
