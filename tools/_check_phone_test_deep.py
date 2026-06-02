"""전화 테스트 동기화 심층 점검 — 시각 무관 최근 데이터."""
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
print("[1] consultation 최근 5건 (timezone 무관, 사장님(id=91) 또는 라온선생(id=123) 관련)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT id, member_id, counselor_id, csrid, callee_phone, '
    'amt, amt_free, amt_pro, usetm, reason, '
    'started_at::timestamp AS started, '
    'ended_at::timestamp AS ended '
    'FROM consultation '
    'WHERE (member_id = 91 OR counselor_id = 123) '
    'ORDER BY id DESC LIMIT 5;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[2] point_history 최근 5건 (사장님 = member_id=91)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT id, member_id, content, earn_point, use_point, balance_after, '
    'rel_table, rel_id, rel_action, created_at::timestamp '
    'FROM point_history WHERE member_id = 91 ORDER BY id DESC LIMIT 5;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[3] DB 서버 timezone 확인")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -Atc "SHOW timezone;"'
)
tz = o.read().decode().strip()
print(f"  DB timezone: {tz}")

_, o, _ = c.exec_command(f'{psql} "{dburl}" -Atc "SELECT NOW(), NOW() AT TIME ZONE \'Asia/Seoul\';"')
print(f"  DB NOW: {o.read().decode().strip()}")

print("\n" + "="*70)
print("[4] m2net push handleCallPush 로그 (최근 200줄)")
print("="*70)
_, o, _ = c.exec_command(
    "pm2 logs sajumoon-api --nostream --lines 500 --raw 2>/dev/null | "
    "grep -aE 'handleCallPush|callback|END_CALL|CALL_END|/api/pg-callbacks|m2net-push' | tail -20"
)
body = o.read().decode().strip()
print(body[:3000] if body else "  (관련 로그 없음 — push 도착 안 했을 가능성)")

print("\n" + "="*70)
print("[5] 사주플랜 측 m2net push 엔드포인트 응답 확인")
print("="*70)
# m2net 콜백 endpoint 검색
_, o, _ = c.exec_command(
    f"grep -rE '@Post.*callback|@Post.*push|@Post.*end' "
    f"/data/wwwroot/api.sajumoon.co.kr/dist/pg-callbacks/ 2>/dev/null | head -10"
)
print(o.read().decode()[:2000])

print("\n" + "="*70)
print("[6] m2net push 가 도착했을 nginx access 로그 (POST 요청)")
print("="*70)
_, o, _ = c.exec_command(
    "tail -500 /var/log/nginx/access.log 2>/dev/null | grep -aE 'POST.*pg-callback|POST.*m2net|POST.*push' | tail -10"
)
print(o.read().decode()[:2000] or "  (nginx access 로그에 m2net POST 흔적 없음)")

c.close()
