#!/usr/bin/env python
"""prod 서버에서 health-check SQL을 직접 실행해 STRING_AGG LIMIT 에러 없는지 확인"""
import paramiko
import sys
import json

for s in (sys.stdout, sys.stderr):
    try:
        s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

host = "104.64.128.103"
root_pw = "saju26moon@!!"
db_user = "sajumoon"
db_pass = "2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382"
db_name = "sajumoon"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username="root", password=root_pw, timeout=15)

def run(cmd, timeout=30):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    return out.read().decode("utf-8", "replace"), err.read().decode("utf-8", "replace")

def psql(sql):
    cmd = f"PGPASSWORD={db_pass} psql -h 127.0.0.1 -U {db_user} -d {db_name} -c \"{sql}\" 2>&1"
    out, _ = run(cmd)
    return out

print("=== C-1 음수 포인트 잔액 (STRING_AGG 서브쿼리 방식) ===")
r = psql(
    "SELECT COUNT(*)::text AS cnt, "
    "(SELECT STRING_AGG(sub.s, ', ') FROM "
    "(SELECT m2.mb_id || '(무료' || p2.free_balance || '/' || p2.paid_balance || '/' || p2.earning_balance || ')' AS s "
    "FROM point p2 JOIN member m2 ON m2.id = p2.member_id "
    "WHERE p2.free_balance < 0 OR p2.paid_balance < 0 OR p2.earning_balance < 0 "
    "ORDER BY p2.member_id LIMIT 3) sub) AS sample "
    "FROM point p JOIN member m ON m.id = p.member_id "
    "WHERE p.free_balance < 0 OR p.paid_balance < 0 OR p.earning_balance < 0;"
)
print(r[:300])

print("=== C-2 member.point 음수 ===")
r = psql(
    "SELECT COUNT(*)::text AS cnt, "
    "(SELECT STRING_AGG(sub.s, ', ') FROM "
    "(SELECT mb_id || '(' || point || 'coin)' AS s FROM member WHERE point < 0 ORDER BY id LIMIT 3) sub) AS sample "
    "FROM member WHERE point < 0;"
)
print(r[:200])

print("=== C-6 환불 분배 불일치 (기존 에러 원인) ===")
r = psql(
    "SELECT COUNT(*)::text AS cnt, "
    "(SELECT STRING_AGG(sub.s, ', ') FROM "
    "(SELECT 'refund' || id::text || '(' || amount || ')' AS s "
    "FROM refund_request WHERE (amount_free + amount_pro) != amount ORDER BY id LIMIT 3) sub) AS sample "
    "FROM refund_request WHERE (amount_free + amount_pro) != amount;"
)
print(r[:200])

# dist JS에서 실제 쿼리 확인 (C-7이 원본 에러 위치였을 것)
print("\n=== dist의 STRING_AGG 쿼리 현황 ===")
out, _ = run("grep 'STRING_AGG' /data/wwwroot/api.sajumoon.co.kr/dist/cron/health-check.service.js | grep 'LIMIT' | wc -l")
print(f"STRING_AGG with LIMIT: {out.strip()} (0이어야 함)")

out, _ = run("grep 'STRING_AGG' /data/wwwroot/api.sajumoon.co.kr/dist/cron/health-check.service.js | wc -l")
print(f"STRING_AGG 총 수: {out.strip()}")

# 에러 로그의 마지막 타임스탬프 확인 (패치 이후 새 에러 없는지)
out, _ = run("grep 'ExceptionsHandler' /root/.pm2/logs/sajumoon-api-error-0.log 2>/dev/null | tail -3")
print("\n에러 로그 마지막 타임스탬프:")
print(out[:300])
print("=> 마지막 에러가 05:39 이전이면 패치 성공")

ssh.close()
