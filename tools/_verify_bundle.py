#!/usr/bin/env python
"""프론트엔드 번들에서 수익 분해 컬럼 레이블 검증"""
import paramiko
import re

host = "104.64.128.103"
root_pw = "saju26moon@!!"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username="root", password=root_pw, timeout=15)
print("SSH connected")

def run(cmd, timeout=30):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    return out.read().decode("utf-8", "replace"), err.read().decode("utf-8", "replace")

# 최신 번들 파일들
print("=== 최신 번들 (최근 수정) ===")
out, _ = run("ls -lt /data/wwwroot/sajumoon.co.kr/mng/assets/*.js 2>/dev/null | head -15")
print(out[:600])

# ConsultationList 포함 번들 찾기
print("\n=== ConsultationList 번들 ===")
out, _ = run("grep -rl 'ConsultationList' /data/wwwroot/sajumoon.co.kr/mng/assets/ 2>/dev/null | head -5")
print(out[:300])

# 수익 분해 관련 번들에서 컨텍스트 확인 (index-CiWf_H2s.js)
print("\n=== index-CiWf_H2s.js 컬럼 레이블 컨텍스트 ===")
# grep -oP 대신 python에서 직접 처리
out, _ = run("cat /data/wwwroot/sajumoon.co.kr/mng/assets/index-CiWf_H2s.js 2>/dev/null | grep -o '.\\{0,40\\}M2NET.\\{0,40\\}' | head -5")
print("M2NET context:", out[:500])

out, _ = run("cat /data/wwwroot/sajumoon.co.kr/mng/assets/index-CiWf_H2s.js 2>/dev/null | grep -o '.\\{0,40\\}counselor_revenue_rate.\\{0,40\\}' | head -5")
print("counselor_revenue_rate context:", out[:500])

out, _ = run("cat /data/wwwroot/sajumoon.co.kr/mng/assets/index-CiWf_H2s.js 2>/dev/null | grep -o '.\\{0,40\\}sajuplan_revenue.\\{0,40\\}' | head -5")
print("sajuplan_revenue context:", out[:500])

# 수익 분해 컬럼 헤더 텍스트 확인 (한글)
print("\n=== 컬럼 헤더 한글 텍스트 (index-DbYsGb5X.js) ===")
out, _ = run("cat /data/wwwroot/sajumoon.co.kr/mng/assets/index-DbYsGb5X.js 2>/dev/null | grep -o '.\\{0,50\\}counselor_earning.\\{0,50\\}' | head -5")
print("counselor_earning context:", out[:500])

out, _ = run("cat /data/wwwroot/sajumoon.co.kr/mng/assets/index-DbYsGb5X.js 2>/dev/null | grep -o '.\\{0,50\\}m2net_deduction.\\{0,50\\}' | head -5")
print("m2net_deduction context:", out[:500])

# 어드민 ConsultationList.tsx 소스에서 컬럼 헤더 확인
print("\n=== 소스 ConsultationList.tsx 컬럼 헤더 ===")
out, _ = run("find /data/wwwroot/api.sajumoon.co.kr -name 'ConsultationList.tsx' 2>/dev/null | head -3")
print("ConsultationList.tsx path:", out[:200])

# 로컬 소스에서 확인
out, _ = run("grep -n '상담사%\\|M2NET\\|상담사수익금\\|영업이익' /data/wwwroot/api.sajumoon.co.kr/src/admin/consultations/*.tsx 2>/dev/null | head -20")
print("src column headers:", out[:500])

# web 빌드 소스 확인 (sajumoon.co.kr wwwroot에 원본 없음 → 로컬 소스 직접)
out, _ = run("find /data/wwwroot -name 'ConsultationList.tsx' -o -name 'ConsultationList.ts' 2>/dev/null | head -5")
print("ConsultationList files:", out[:300])

# 현재 배포된 관리자 페이지 HTML index 확인
print("\n=== mng/index.html (어떤 번들 로드?) ===")
out, _ = run("cat /data/wwwroot/sajumoon.co.kr/mng/index.html 2>/dev/null | grep -o 'assets/index-[^\"]*' | head -10")
print("loaded bundles:", out[:300])

ssh.close()
