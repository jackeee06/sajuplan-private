#!/usr/bin/env python
"""최신 번들(index-DUWWhnny.js)에서 수익 분해 필드 검증"""
import paramiko

host = "104.64.128.103"
root_pw = "saju26moon@!!"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username="root", password=root_pw, timeout=15)
print("SSH connected")

def run(cmd, timeout=25):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    return out.read().decode("utf-8", "replace"), err.read().decode("utf-8", "replace")

BUNDLE = "/data/wwwroot/sajumoon.co.kr/mng/assets/index-DUWWhnny.js"

print(f"=== 최신 번들: {BUNDLE} (Jun 2 18:01) ===\n")

fields = [
    "counselor_revenue_rate",
    "m2net_deduction",
    "counselor_earning",
    "sajuplan_revenue",
    "M2NET",
    "counselor_revenue",
]
results = []
for field in fields:
    cmd = f"grep -c '{field}' {BUNDLE} 2>/dev/null"
    out, _ = run(cmd)
    count = int(out.strip()) if out.strip().isdigit() else 0
    ok = count > 0
    results.append((field, count, ok))
    icon = "OK" if ok else "FAIL"
    print(f"  [{icon}] {field}: {count}회 등장")

# 컨텍스트 확인
print("\n=== counselor_revenue_rate 렌더링 ===")
out, _ = run(f"grep -o 'counselor_revenue_rate.\{{0,80\}}' {BUNDLE} 2>/dev/null | head -3")
print(out[:400])

print("\n=== m2net_deduction 렌더링 ===")
out, _ = run(f"grep -o 'm2net_deduction.\{{0,80\}}' {BUNDLE} 2>/dev/null | head -3")
print(out[:400])

print("\n=== counselor_earning 렌더링 ===")
out, _ = run(f"grep -o 'counselor_earning.\{{0,80\}}' {BUNDLE} 2>/dev/null | head -3")
print(out[:400])

print("\n=== sajuplan_revenue 렌더링 ===")
out, _ = run(f"grep -o 'sajuplan_revenue.\{{0,80\}}' {BUNDLE} 2>/dev/null | head -3")
print(out[:400])

# API dist 배포 상태 확인 (언제 배포됐는지)
print("\n=== dist API consultations.service.js 수정 시간 ===")
out, _ = run("ls -la /data/wwwroot/api.sajumoon.co.kr/dist/admin/consultations/consultations.service.js 2>/dev/null")
print(out[:200])

# 최종 요약
print("\n" + "=" * 60)
print("최종 검증 요약")
print("=" * 60)
all_ok = all(r[2] for r in results)
for field, count, ok in results:
    icon = "OK" if ok else "FAIL"
    print(f"  [{icon}] {field} ({count}회)")

print()
if all_ok:
    print(">>> 모든 수익 분해 필드 번들에 포함됨")
else:
    print(">>> 일부 필드 누락 - 재배포 필요")

ssh.close()
