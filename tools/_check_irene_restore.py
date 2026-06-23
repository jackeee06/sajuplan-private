"""이아린 복구 전 안전 점검 — 267(옛 상담사) 이력 + 273(새 계정) 활동 (읽기전용)."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
if 'SSHPASS' not in os.environ:
    for line in open('.env.local', encoding='utf-8'):
        if line.startswith('SSHPASS='):
            os.environ['SSHPASS'] = line.split('=', 1)[1].strip().strip("'\""); break
pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
_, o, _ = c.exec_command('grep "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | head -1')
dburl = o.read().decode().strip().split('=', 1)[1].strip("'\"")
def q(sql, x=False):
    _, o, e = c.exec_command(f'/usr/bin/psql "{dburl}" {"-x" if x else ""} -c "{sql}"')
    return o.read().decode()

print("=== 옛 계정 267 (IARIN) — 복구 대상, 이력 보존 가치 ===")
print("[267 현재 멤버 상태(복구 전 스냅샷)]")
print(q("SELECT id, mb_id, nickname, role, state, dtmfno, csrid, left_at FROM member WHERE id=267;", x=True))
print("[267 코인/수익금 잔액]")
print(q("SELECT * FROM point WHERE member_id=267;", x=True))
print("[267 상담사로 진행한 상담 / 받은 후기 / 단골수]")
print(q("SELECT (SELECT count(*) FROM consultation WHERE counselor_id=267) AS as_counselor_consults, "
        "(SELECT count(*) FROM post_review WHERE counselor_id=267) AS reviews_received, "
        "(SELECT count(*) FROM member_favorite_counselor WHERE counselor_id=267) AS fans;"))

print("=== 새 계정 273 (IARIN87) — 정리 대상, 활동 있으면 신중 ===")
print("[273 코인 잔액]")
print(q("SELECT * FROM point WHERE member_id=273;", x=True))
print("[273 충전/상담 활동]")
print(q("SELECT (SELECT count(*) FROM payment WHERE member_id=273) AS payments, "
        "(SELECT count(*) FROM consultation WHERE member_id=273) AS consults_as_customer, "
        "(SELECT coalesce(point,0) FROM member WHERE id=273) AS member_point;"))

print("=== 같은 전화 활성계정 (복구 후 중복 활성 여부 확인용) ===")
print(q("SELECT id, mb_id, role, left_at FROM member WHERE phone='01038136752' ORDER BY id;"))
c.close()
