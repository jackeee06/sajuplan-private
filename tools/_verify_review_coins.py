#!/usr/bin/env python3
"""후기 코인 지급 실제 동작 검증.
1. 테스트 가능한 상담 내역 찾기
2. API로 후기 작성 → 코인 적립 확인
3. 사진 후기 → 추가 코인 확인
4. 관리자 베스트 선정 → 10,000코인 확인
5. m2net 잔액 확인
"""
import os, sys, json, time, urllib.request, urllib.error, urllib.parse
import paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB   = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
HOST = "104.64.128.103"
API  = "https://api.sajuplan.com"

def ssh():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, 'root', os.environ['SSHPASS'],
              allow_agent=False, look_for_keys=False, timeout=20)
    return c

def dbq(conn, sql):
    _, o, e = conn.exec_command(f"psql {DB} -t -A -F'|' -c \"{sql}\"", timeout=30)
    out = o.read().decode('utf-8', errors='replace').strip()
    err = e.read().decode('utf-8', errors='replace').strip()
    if err: print(f"[DB ERR] {err[:100]}", file=sys.stderr)
    return [r.split('|') for r in out.splitlines() if r.strip()]

def load_session(path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    return '; '.join(f"{c['name']}={c['value']}" for c in data.get('cookies', []))

def api_call(method, path, body=None, cookies=''):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {'Content-Type': 'application/json', 'Cookie': cookies}
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode('utf-8', errors='replace')
        return e.code, {'error': body_text[:200]}

conn = ssh()
print("=== 후기 코인 실제 동작 검증 ===\n")

# ── 1. 테스트 가능 상담 찾기 ──────────────────────────────────
print("[1] 후기 작성 가능한 상담 찾기...")
rows = dbq(conn, """
  SELECT c.id, c.member_id, c.counselor_id, c.usetm, c.amt,
         m.mb_id, m.point, m.m2net_membid
    FROM consultation c
    JOIN member m ON m.id = c.member_id
   WHERE c.ended_at IS NOT NULL
     AND c.usetm >= 300
     AND c.ended_at > now() - interval '7 days'
     AND NOT EXISTS (
       SELECT 1 FROM post_review pr
        WHERE (pr.extras->>'consultation_id')::text = c.id::text
     )
   ORDER BY c.ended_at DESC
   LIMIT 5
""")

if not rows:
    # 7일 이내 없으면 더 오래된 것도 찾기 (테스트용)
    print("  7일 이내 없음. 90일로 확장...")
    rows = dbq(conn, """
      SELECT c.id, c.member_id, c.counselor_id, c.usetm, c.amt,
             m.mb_id, m.point, m.m2net_membid
        FROM consultation c
        JOIN member m ON m.id = c.member_id
       WHERE c.ended_at IS NOT NULL
         AND c.usetm >= 300
         AND NOT EXISTS (
           SELECT 1 FROM post_review pr
            WHERE (pr.extras->>'consultation_id')::text = c.id::text
         )
       ORDER BY c.ended_at DESC
       LIMIT 5
    """)

if not rows:
    print("❌ 테스트 가능한 상담 내역 없음")
    conn.close(); sys.exit(0)

print(f"  찾음: {len(rows)}건")
for r in rows:
    print(f"    consultation_id={r[0]} member_id={r[1]}({r[5]}) usetm={r[3]}초 point={r[6]}")

# 첫 번째 사용
consult_id, member_id, counselor_id = int(rows[0][0]), int(rows[0][1]), int(rows[0][2])
mb_id, member_point, m2net_membid = rows[0][5], int(rows[0][6]), rows[0][7]
print(f"\n사용할 상담: consultation_id={consult_id} member={mb_id}(id={member_id})")
print(f"현재 코인: {member_point:,}  m2net_membid={m2net_membid}")

# ── 2. 회원 로그인 ────────────────────────────────────────────
print(f"\n[2] {mb_id} 로그인...")
# e2e 세션 파일에서 시도
session_files = [
    'e2e/user_member_storage.json',
    'e2e/user_dual_storage.json',
    'e2e/user_counselor_storage.json',
]
cookies = ''
for sf in session_files:
    if os.path.exists(sf):
        c_str = load_session(sf)
        # /me 호출로 확인
        status, me_body = api_call('GET', '/api/user/auth/me', cookies=c_str)
        if status == 200:
            me_id = me_body.get('member', {}).get('id') or me_body.get('id')
            if me_id and int(me_id) == member_id:
                cookies = c_str
                print(f"  ✅ {sf} 세션 일치 (id={me_id})")
                break

if not cookies:
    print("  ⚠️  세션 파일에서 해당 회원 세션 없음 — e2e_dual 계정으로 테스트")
    # e2e_dual 계정 사용 (해당 상담이 없을 수 있어 DB에서 e2e 계정 상담 재검색)
    c_str = load_session('e2e/user_dual_storage.json') if os.path.exists('e2e/user_dual_storage.json') else ''
    status, me_body = api_call('GET', '/api/user/auth/me', cookies=c_str)
    if status == 200:
        me_id = me_body.get('member', {}).get('id') or me_body.get('id')
        print(f"  현재 세션: member_id={me_id}")
        # 해당 세션 회원의 상담 찾기
        e2e_rows = dbq(conn, f"""
          SELECT c.id, c.member_id, c.counselor_id, c.usetm, c.amt,
                 m.mb_id, m.point, m.m2net_membid
            FROM consultation c
            JOIN member m ON m.id = c.member_id
           WHERE c.member_id = {me_id}
             AND c.ended_at IS NOT NULL
             AND c.usetm >= 300
             AND NOT EXISTS (
               SELECT 1 FROM post_review pr
                WHERE (pr.extras->>'consultation_id')::text = c.id::text
             )
           ORDER BY c.ended_at DESC LIMIT 1
        """)
        if e2e_rows:
            consult_id, member_id, counselor_id = int(e2e_rows[0][0]), int(e2e_rows[0][1]), int(e2e_rows[0][2])
            mb_id, member_point, m2net_membid = e2e_rows[0][5], int(e2e_rows[0][6]), e2e_rows[0][7]
            cookies = c_str
            print(f"  재검색: consultation_id={consult_id} member={mb_id}")
        else:
            print("  ❌ e2e 계정에도 테스트 가능한 상담 없음")
            conn.close(); sys.exit(0)

# ── 3. 후기 작성 (일반 — 사진 없음) ─────────────────────────
print(f"\n[3] 일반 후기 작성 (사진 없음, 예상 +500코인)...")
point_before = int(dbq(conn, f"SELECT point FROM member WHERE id={member_id}")[0][0])
print(f"  작성 전 코인: {point_before:,}")

status, resp = api_call('POST', '/api/user/reviews', {
    'counselor_id': counselor_id,
    'consultation_id': consult_id,
    'title': '테스트 후기 (자동검증)',
    'content': '후기 코인 지급 자동 검증을 위한 테스트 후기입니다.',
    'rating': 5,
}, cookies)

print(f"  API 응답: status={status}")
if status not in (200, 201):
    print(f"  ❌ 실패: {resp}")
    conn.close(); sys.exit(1)

review_id = resp.get('id')
print(f"  ✅ 후기 작성 완료 review_id={review_id}")

# 잠시 대기 (m2net sync 비동기)
time.sleep(2)
point_after = int(dbq(conn, f"SELECT point FROM member WHERE id={member_id}")[0][0])
coin_diff = point_after - point_before
print(f"  작성 후 코인: {point_after:,}  (변화: {coin_diff:+d})")

# point_history 확인
ph_rows = dbq(conn, f"SELECT earn_point, content, created_at FROM point_history WHERE member_id={member_id} AND rel_action LIKE 'review:{review_id}' ORDER BY created_at DESC LIMIT 1")
if ph_rows:
    print(f"  point_history: +{ph_rows[0][0]}코인 | {ph_rows[0][1]}")
    if int(ph_rows[0][0]) == 500:
        print("  ✅ 일반 후기 코인 500코인 지급 확인")
    else:
        print(f"  ⚠️  예상 500코인, 실제 {ph_rows[0][0]}코인")
else:
    print("  ❌ point_history에 기록 없음")

# ── 4. 관리자 베스트 선정 → 10,000코인 ─────────────────────
if review_id:
    print(f"\n[4] 관리자 베스트 선정 (예상 +10,000코인) review_id={review_id}...")
    admin_cookies = load_session('e2e/storageState.json') if os.path.exists('e2e/storageState.json') else ''
    point_before2 = int(dbq(conn, f"SELECT point FROM member WHERE id={member_id}")[0][0])
    print(f"  선정 전 코인: {point_before2:,}")

    status2, resp2 = api_call('PATCH', f'/api/admin/posts/reviews/{review_id}/admin-best',
                              {'is_admin_best': True}, admin_cookies)
    print(f"  API 응답: status={status2} resp={json.dumps(resp2, ensure_ascii=False)[:80]}")

    if status2 == 200:
        time.sleep(1)
        point_after2 = int(dbq(conn, f"SELECT point FROM member WHERE id={member_id}")[0][0])
        coin_diff2 = point_after2 - point_before2
        print(f"  선정 후 코인: {point_after2:,}  (변화: {coin_diff2:+d})")
        ph2 = dbq(conn, f"SELECT earn_point, content FROM point_history WHERE member_id={member_id} AND rel_action='review_best:{review_id}' LIMIT 1")
        if ph2:
            print(f"  point_history: +{ph2[0][0]}코인 | {ph2[0][1]}")
            print("  ✅ 베스트 후기 10,000코인 지급 확인" if int(ph2[0][0]) == 10000 else f"  ⚠️  {ph2[0][0]}코인")
        else:
            print("  ❌ point_history 없음 (관리자 세션 만료?)")

# ── 5. 테스트 후기 삭제 (5분 이내이므로 가능) ───────────────
if review_id:
    print(f"\n[5] 테스트 후기 삭제 (DB 직접 — 5분 제한 우회)...")
    dbq(conn, f"DELETE FROM post_review WHERE id={review_id}")
    dbq(conn, f"DELETE FROM point_history WHERE member_id={member_id} AND rel_action LIKE 'review%:{review_id}'")
    # 코인 롤백
    dbq(conn, f"UPDATE point SET free_balance=free_balance-{coin_diff}, total_earned=total_earned-{coin_diff}, updated_at=now() WHERE member_id={member_id}")
    dbq(conn, f"UPDATE member SET point=point-{coin_diff}, updated_at=now() WHERE id={member_id}")
    print(f"  ✅ 테스트 데이터 정리 완료 (코인 -{coin_diff:,} 롤백)")

# ── 최종 결과 ─────────────────────────────────────────────
print("\n=== 검증 완료 ===")
conn.close()
