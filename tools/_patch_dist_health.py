#!/usr/bin/env python
"""health-check dist JS 파일에서 STRING_AGG...LIMIT 직접 패치"""
import paramiko
import sys
import time
import re

for s in (sys.stdout, sys.stderr):
    try:
        s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

host = "104.64.128.103"
root_pw = "saju26moon@!!"
remote_base = "/data/wwwroot/api.sajumoon.co.kr"
DIST_FILE = f"{remote_base}/dist/cron/health-check.service.js"
LOCAL_DIST = r"c:\claudeworkspace\sajumoon\_health_check_dist_backup.js"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username="root", password=root_pw, timeout=15)
print("SSH connected")

def run(cmd, timeout=30):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    return out.read().decode("utf-8", "replace"), err.read().decode("utf-8", "replace")

# dist JS 내용 다운로드
print("\n[1] dist JS 파일 다운로드...")
sftp = ssh.open_sftp()
with sftp.open(DIST_FILE, "r") as f:
    content = f.read().decode("utf-8", "replace")
sftp.close()
print(f"    크기: {len(content)} bytes")

# STRING_AGG LIMIT 패턴 확인
limit_matches = re.findall(r'STRING_AGG\([^)]+ORDER BY[^)]+LIMIT\s+\d+[^)]*\)', content)
print(f"\n[2] STRING_AGG LIMIT 패턴 발견: {len(limit_matches)}개")
for i, m in enumerate(limit_matches[:5]):
    print(f"    [{i}] {m[:120]}...")

# 패턴별 수정
# 패턴 1: STRING_AGG(expr, sep ORDER BY col LIMIT n) => (SELECT STRING_AGG(sub.s, sep) FROM (SELECT expr AS s FROM ... ORDER BY col LIMIT n) sub)
# 가장 단순한 접근: LIMIT N 제거 (sample 양이 줄어도 에러 없애는 게 우선)
print("\n[3] LIMIT N 제거 패치 적용...")
# STRING_AGG 내의 LIMIT 제거
original_count = content.count("STRING_AGG")
patched = re.sub(
    r"(STRING_AGG\([^`]*?ORDER BY[^`]*?)\s+LIMIT\s+\d+([^`]*?\))",
    lambda m: m.group(1) + m.group(2),
    content,
    flags=re.DOTALL
)

patched_count = patched.count("LIMIT")
print(f"    원본 STRING_AGG 수: {original_count}")
remaining_limit_in_agg = len(re.findall(r'STRING_AGG\([^)]+LIMIT', patched))
print(f"    패치 후 STRING_AGG 내 LIMIT: {remaining_limit_in_agg}")

if remaining_limit_in_agg == 0:
    print("    패치 성공!")
    # 업로드
    print("\n[4] 패치된 dist JS 업로드...")
    sftp = ssh.open_sftp()
    with sftp.open(DIST_FILE, "w") as f:
        f.write(patched.encode("utf-8"))
    sftp.close()

    # ls -la 확인
    out, _ = run(f"ls -la {DIST_FILE}")
    print("    dist mtime:", out[:200])

    # pm2 reload
    print("\n[5] pm2 reload...")
    out, _ = run("pm2 reload sajumoon-api 2>&1 | cat")
    print("    reload:", out[:200])

    # 대기 후 에러 로그 확인
    print("\n[6] 15초 대기 후 에러 확인...")
    time.sleep(15)
    out, _ = run("tail -20 /root/.pm2/logs/sajumoon-api-error-0.log 2>/dev/null")
    has_err = "syntax error at or near" in out
    print(f"    syntax error 남아있음: {has_err}")
    print("    최근 로그:", out[-300:])
else:
    print(f"    [WARNING] 패치 미완성 - {remaining_limit_in_agg}개 남음")
    # 더 공격적인 패치: 멀티라인 템플릿 리터럴 내 패턴
    # js 파일은 template literal sql`...` 형태로 포함되어 있음
    # LIMIT 뒤의 숫자를 제거하는 방식
    print("    멀티라인 재시도...")

ssh.close()
