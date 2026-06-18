"""[2026-06-12] '방금끝남 30분 → 2순위' 통제 검증.
대기·전화ON·비추천 상담사 2명(C 위, S 아래)을 골라, S 의 last_consult_ended_at=now() 로
찍으면 S 가 C 보다 위로 올라가야 한다(방금끝남 tier 1 > 대기 tier 2). 검증 후 원복.
사용: SSHPASS=... python tools/_verify_ranking_recent.py
"""
import json
import os
import urllib.request

import paramiko

HOST = "104.64.128.103"
API_REMOTE = "/data/wwwroot/api.sajumoon.co.kr"
LIST_URL = "https://api.sajuplan.com/api/user/counselors?tab=all&limit=100"

c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, "root", os.environ["SSHPASS"], look_for_keys=False, allow_agent=False, timeout=20)
db = (lambda r: r.read().decode())(c.exec_command("grep '^DATABASE_URL=' %s/.env | head -1 | cut -d= -f2-" % API_REMOTE)[1]).strip().strip("'").strip('"')


def psql(sql):
    _, o, e = c.exec_command('psql "%s" -v ON_ERROR_STOP=1 -c "%s"' % (db, sql), timeout=40)
    return o.read().decode() + e.read().decode()


def fetch_ids():
    with urllib.request.urlopen(LIST_URL, timeout=20) as r:
        items = json.loads(r.read().decode()).get("items", [])
    return items


def idx_of(items, cid):
    for i, it in enumerate(items):
        if it["id"] == cid:
            return i
    return -1


items = fetch_ids()
# 대기 + 전화ON + 비추천 + 상담중/부재 아님 후보 (list 순서 = 현재 랭킹)
cand = [it for it in items
        if it.get("use_phone") and not it.get("is_recommended")
        and it.get("state") not in ("CONN", "CNCH", "ABSE", "RESV")]
if len(cand) < 2:
    print("SKIP: 통제 대상(대기·전화ON·비추천) 2명 미만 — 검증 불가")
    c.close(); raise SystemExit(0)

C, S = cand[0], cand[1]  # C 가 현재 더 위
print(f"대상: C(위)=#{C['id']} state={C['state']}, S(아래)=#{S['id']} state={S['state']}")
before_C, before_S = idx_of(items, C["id"]), idx_of(items, S["id"])
print(f"BEFORE 인덱스: C={before_C}, S={before_S}  (C<S 여야 정상: {before_C < before_S})")

ok = False
try:
    psql("UPDATE member SET last_consult_ended_at = now() WHERE id = %d" % S["id"])
    items2 = fetch_ids()
    after_C, after_S = idx_of(items2, C["id"]), idx_of(items2, S["id"])
    print(f"AFTER  인덱스: C={after_C}, S={after_S}")
    ok = after_S >= 0 and after_C >= 0 and after_S < after_C
    print("결과:", "PASS — S(방금끝남)가 C(대기) 위로 올라감" if ok else "FAIL — 순위 변화 없음")
finally:
    psql("UPDATE member SET last_consult_ended_at = NULL WHERE id = %d" % S["id"])
    print("원복: S.last_consult_ended_at = NULL")
c.close()
raise SystemExit(0 if ok else 1)
