"""강원구(member_id=251)의 상담/코인 기록 점검 (읽기전용).
 '상담내역 1건'이 맞는지 — 숨김/누락 가능성 확인."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

if 'SSHPASS' not in os.environ:
    for line in open('.env.local', encoding='utf-8'):
        if line.startswith('SSHPASS='):
            os.environ['SSHPASS'] = line.split('=', 1)[1].strip().strip("'\"")
            break

pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
_, o, _ = c.exec_command('grep "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | head -1')
dburl = o.read().decode().strip().split('=', 1)[1].strip("'\"")
psql = '/usr/bin/psql'

def q(sql, x=False):
    flag = '-x' if x else ''
    _, o, e = c.exec_command(f'{psql} "{dburl}" {flag} -c "{sql}"')
    out = o.read().decode(); err = e.read().decode()
    return out + (('\n[ERR] ' + err) if err.strip() else '')

print("="*72); print("[1] 강원구(251) consultation 전체 — reason별 집계")
print("="*72)
print(q("SELECT reason, count(*), sum(coalesce(amt,0)) sum_amt, "
        "sum(coalesce(usetm,0)) sum_sec, min(created_at) first, max(created_at) last "
        "FROM consultation WHERE member_id=251 GROUP BY reason ORDER BY count DESC;"))

print("="*72); print("[2] 강원구(251) consultation 행 전체 (상담사·시간·금액)")
print("="*72)
print(q("SELECT cs.id, cs.counselor_id, mc.nickname AS counselor, cs.reason, "
        "cs.usetm, cs.amt, cs.roomid IS NOT NULL AS is_chat, cs.refund_status, "
        "cs.started_at, cs.ended_at "
        "FROM consultation cs LEFT JOIN member mc ON mc.id=cs.counselor_id "
        "WHERE cs.member_id=251 ORDER BY cs.created_at;"))

print("="*72); print("[3] 화면 '상담내역'에 보일 건수 = 종료완료(DISCONNECT/END_CHAT) & counselor_id NOT NULL & usetm>0")
print("="*72)
print(q("SELECT count(*) AS shown_in_history "
        "FROM consultation WHERE member_id=251 "
        "AND reason IN ('DISCONNECT','END_CHAT') AND counselor_id IS NOT NULL "
        "AND coalesce(usetm,0) > 0;"))

print("="*72); print("[4] 강원구 코인 잔액 + 회원정보")
print("="*72)
print(q("SELECT mm.id, mm.name, mm.nickname, mm.phone, mm.point, "
        "p.free_balance, p.paid_balance "
        "FROM member mm LEFT JOIN point p ON p.member_id=mm.id WHERE mm.id=251;", x=True))

print("="*72); print("[5] 강원구 충전(payment) 내역 — 최근")
print("="*72)
print(q("SELECT id, amount, status, created_at FROM payment "
        "WHERE member_id=251 ORDER BY created_at DESC LIMIT 10;"))

c.close()
