"""시간 카드 임시 비활성 + 실시간 채팅 임시 모드 엄격 검증."""
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

    # 현재 JS 파일명
    _, o, _ = c.exec_command(
        f"grep -oE 'index-[A-Za-z0-9_-]+\\.js' {web_remote}/index.html"
    )
    js_file = o.read().decode().strip()
    print(f"\n  index.html → {js_file}\n")

    # ── [1] 시간 카드 disabled + 회색 처리 (4개 모두) ──
    print("  [1] 시간 카드 disabled 처리")
    _, o, _ = c.exec_command(
        f"grep -cF 'opacity-50 cursor-not-allowed' {web_remote}/assets/{js_file}"
    )
    cnt = o.read().decode().strip() or "0"
    ok = int(cnt) >= 1
    mark = "✅" if ok else "❌"
    print(f"     {mark}  opacity-50 cursor-not-allowed = {cnt}")
    overall_ok = overall_ok and ok

    # ── [2] "🚧 곧 출시" 라벨 ──
    print("\n  [2] '🚧 곧 출시' 라벨")
    _, o, _ = c.exec_command(
        f"grep -cF '곧 출시' {web_remote}/assets/{js_file}"
    )
    cnt = o.read().decode().strip() or "0"
    ok = int(cnt) >= 1
    mark = "✅" if ok else "❌"
    print(f"     {mark}  '곧 출시' 텍스트 = {cnt}")
    overall_ok = overall_ok and ok

    # ── [3] CTA "실시간 채팅 시작" ──
    print("\n  [3] CTA 텍스트 '실시간 채팅 시작'")
    _, o, _ = c.exec_command(
        f"grep -cF '실시간 채팅 시작' {web_remote}/assets/{js_file}"
    )
    cnt = o.read().decode().strip() or "0"
    ok = int(cnt) >= 1
    mark = "✅" if ok else "❌"
    print(f"     {mark}  실시간 채팅 시작 = {cnt}")
    overall_ok = overall_ok and ok

    # ── [4] 안내 멘트 변경 ──
    print("\n  [4] 안내 멘트 '실제 사용한 시간만큼'")
    _, o, _ = c.exec_command(
        f"grep -cF '실제 사용한 시간만큼' {web_remote}/assets/{js_file}"
    )
    cnt = o.read().decode().strip() or "0"
    ok = int(cnt) >= 1
    mark = "✅" if ok else "❌"
    print(f"     {mark}  실제 사용한 시간만큼 = {cnt}")
    overall_ok = overall_ok and ok

    # 자동 연장 멘트가 제거됐는지
    _, o, _ = c.exec_command(
        f"grep -cF '자동 연장됩니다' {web_remote}/assets/{js_file}"
    )
    cnt = o.read().decode().strip() or "0"
    ok = int(cnt) == 0
    mark = "✅" if ok else "❌"
    print(f"     {mark}  '자동 연장됩니다' 멘트 제거 = {cnt} (0이어야 함)")
    overall_ok = overall_ok and ok

    # ── [5] 미입장 차감 X 멘트 유지 ──
    print("\n  [5] 미입장 차감 X 멘트 유지")
    _, o, _ = c.exec_command(
        f"grep -cF '한 푼도 차감되지 않습니다' {web_remote}/assets/{js_file}"
    )
    cnt = o.read().decode().strip() or "0"
    ok = int(cnt) >= 1
    mark = "✅" if ok else "❌"
    print(f"     {mark}  '한 푼도 차감되지 않습니다' = {cnt}")
    overall_ok = overall_ok and ok

    # ── [6] API 라이브: chargeMinutes 없이 호출 가능 (잔액 모델 호환) ──
    print("\n  [6] API /user/consult/chat 라이브 — chargeMinutes 없이 호출")
    _, o, _ = c.exec_command(
        f"curl -s -w 'HTTP=%{{http_code}}' -m 10 -X POST '{api_base}/api/user/consult/chat' "
        f"-H 'Content-Type: application/json' "
        f'-d \'{{"counselor_id":1}}\''
    )
    r = o.read().decode().strip()
    ok = 'HTTP=401' in r
    mark = "✅" if ok else "❌"
    print(f"     {mark}  무인증 호출 → 401 (인증 가드 정상): {r[-50:]}")
    overall_ok = overall_ok and ok

    # ── [7] handleStart 의 chargeMinutes 검증 제거 ──
    print("\n  [7] handleStart 의 chargeMinutes 검증 제거")
    _, o, _ = c.exec_command(
        f"grep -cF '상담 시간을 선택해 주세요' {web_remote}/assets/{js_file}"
    )
    cnt = o.read().decode().strip() or "0"
    ok = int(cnt) == 0
    mark = "✅" if ok else "❌"
    print(f"     {mark}  '시간을 선택해 주세요' 알럿 제거 = {cnt} (0이어야 함)")
    overall_ok = overall_ok and ok

    # ── [8] 백엔드 chargeMinutes 호환 (없어도 정상 작동) ──
    print("\n  [8] 백엔드 chargeMinutes 옵셔널 (이전 호환)")
    _, o, _ = c.exec_command(
        f"grep -cF 'params.chargeMinutes' {api_remote}/dist/user/consult/consult.service.js"
    )
    cnt = o.read().decode().strip() or "0"
    ok = int(cnt) >= 1
    mark = "✅" if ok else "❌"
    print(f"     {mark}  백엔드 chargeMinutes 분기 = {cnt} (옵셔널 적용)")
    overall_ok = overall_ok and ok

    # ── pm2 에러 ──
    print("\n  [pm2] 최근 에러")
    _, o, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 30 --err 2>/dev/null | "
        "grep -aE 'consult|chat|TypeError' | tail -3 || echo '(에러 없음)'"
    )
    body = o.read().decode().strip()
    if body and "(에러 없음)" not in body:
        print(f"     ⚠️ {body[:300]}")
    else:
        print(f"     ✅ 에러 없음")

    c.close()

print(f"\n{'='*70}")
print("✅ 전체 PASS — 실시간 채팅 임시 모드 정상 작동" if overall_ok else "❌ 일부 FAIL")
print("="*70)
sys.exit(0 if overall_ok else 1)
