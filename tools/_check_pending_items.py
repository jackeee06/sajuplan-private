#!/usr/bin/env python3
import os, sys, paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB   = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
HOST = "104.64.128.103"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=15)

def q(sql, label=""):
    if label: print(f"\n[{label}]")
    _, o, _ = c.exec_command(f'psql {DB} -c "{sql}"', timeout=15)
    print(o.read().decode('utf-8', 'replace').strip())

# 1. 알림톡 3개 — 최근 발송 시도 기록 확인
q("""
  SELECT template_code, success, error_reason, COUNT(*) as cnt,
         MAX(sent_at)::date as last_sent
    FROM alimtalk_log
   WHERE template_code IN (
     'chat_request_to_counselor',
     'chat_auto_cancelled_to_member',
     'counselor_request_v1'
   )
   GROUP BY template_code, success, error_reason
   ORDER BY template_code, success DESC
""", "1. 알림톡 3개 최근 발송 기록")

# 2. alimtalk_template 테이블에 상태 컬럼이 있는지
q("""
  SELECT template_code, primary_btn_type,
         CASE WHEN created_at IS NOT NULL THEN '등록됨' ELSE '-' END
    FROM alimtalk_template
   WHERE template_code IN (
     'chat_request_to_counselor',
     'chat_auto_cancelled_to_member',
     'counselor_request_v1',
     'settlement_complete'
   )
   ORDER BY template_code
""", "2. alimtalk_template 등록 여부")

# 3. 후기 운영정책 모달 관련 setting 또는 notices 확인
q("""
  SELECT key, LEFT(value, 80) as value_preview
    FROM setting
   WHERE namespace = 'review'
   ORDER BY key
""", "3. 후기 관련 setting")

c.close()
