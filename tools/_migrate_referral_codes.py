#!/usr/bin/env python3
"""기존 OAuth 상담사 referral_code 마이그레이션"""
import os, sys
import paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB   = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
HOST = "104.64.128.103"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=20)

def q(sql, label=""):
    if label: print(f"\n[{label}]")
    _, o, _ = c.exec_command(f'psql {DB} -c "{sql}"', timeout=20)
    print(o.read().decode('utf-8', errors='replace').strip())

# 현재 상태 확인
q("""
  SELECT id, mb_id, nickname, referral_code,
    CASE WHEN mb_id ~ '^[a-zA-Z0-9]{3,20}$' THEN 'clean' ELSE 'oauth' END AS mb_id_type
  FROM member
  WHERE role = 'counselor' AND left_at IS NULL
  ORDER BY id
""", "1. 현재 상담사 referral_code 현황")

# OAuth 상담사 referral_code 마이그레이션
q("""
  UPDATE member
     SET referral_code = CASE
       WHEN mb_id ~ '^[a-zA-Z0-9]{3,20}$' THEN mb_id
       ELSE 'A' || LPAD(id::text, 4, '0')
     END
   WHERE role = 'counselor'
     AND left_at IS NULL
     AND (referral_code IS NULL
       OR referral_code NOT LIKE '%A___%'
       AND referral_code !~ '^[a-zA-Z0-9]{3,20}$')
  RETURNING id, mb_id, referral_code
""", "2. 마이그레이션 실행")

# 결과 확인
q("""
  SELECT id, mb_id, nickname, referral_code
  FROM member
  WHERE role = 'counselor' AND left_at IS NULL
  ORDER BY id
""", "3. 마이그레이션 후 결과")

c.close()
