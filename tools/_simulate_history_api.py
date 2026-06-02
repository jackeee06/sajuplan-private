"""사장님(id=91) counselor 시점 + 각 탭별 API 응답 정확히 시뮬레이션.

백엔드 dist 코드 그대로 따라가서 어떤 응답이 사장님 앱에 가는지 추적.
"""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
_, o, _ = c.exec_command('grep "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | head -1')
dburl = o.read().decode().strip().split('=',1)[1].strip("'\"")
psql = '/usr/bin/psql'

print("="*70)
print("사장님 counselor 시점, 각 탭의 정확한 API 응답 예상")
print("="*70)

for tab_name, type_where in [
    ('전체(all)', ''),
    ('전화상담(call)', "AND (c.roomid IS NULL OR c.roomid = '')"),
    ('채팅상담(chat)', "AND c.roomid IS NOT NULL AND c.roomid <> ''"),
]:
    # main total
    sql_main = f"""
      SELECT count(*) FROM consultation c
       WHERE c.counselor_id = 91
         AND c.reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
         {type_where}
    """
    _, o, _ = c.exec_command(f'{psql} "{dburl}" -Atc "{sql_main.strip()}"')
    main_total = int(o.read().decode().strip() or "0")

    # other_role_count (백엔드 코드대로 total === 0 일 때만 계산)
    if main_total == 0:
        sql_other = """
          SELECT count(*) FROM consultation c
           WHERE c.member_id = 91
             AND c.reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
        """
        _, o, _ = c.exec_command(f'{psql} "{dburl}" -Atc "{sql_other.strip()}"')
        other_role = int(o.read().decode().strip() or "0")
    else:
        other_role = 0  # 백엔드에서 계산 안 함 (성능 위해)

    print(f"\n  📱 [{tab_name} 탭]")
    print(f"     total = {main_total}")
    print(f"     other_role_count = {other_role}")
    if main_total == 0 and other_role > 0:
        print(f"     → ✅ 빈 화면 + 안내 노출되어야 정상")
    elif main_total == 0 and other_role == 0:
        print(f"     → ⚠️ 빈 화면이지만 안내 없음 (양쪽 모두 0)")
    else:
        print(f"     → ℹ️ 데이터 {main_total}건 표시 (안내 없음 정상)")

print("\n" + "="*70)
print("결론")
print("="*70)
print("사장님이 본 화면이 [전화상담] 탭이었다면 → 안내 노출되어야 함")
print("[전체] 탭이었다면 → counselor 시점 1건이 보임 (id=67, 자기 자신 채팅)")
print()
print("→ 사장님 앱이 새 JS 받았는지 확인 필요.")
print("→ Chrome 등 PC 브라우저에서 https://sajuplan.com 접속 후 Ctrl+Shift+R 하면 즉시 확인 가능.")

c.close()
