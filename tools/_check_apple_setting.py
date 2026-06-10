#!/usr/bin/env python3
import os, sys
import paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB   = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
HOST = "104.64.128.103"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=15)

def q(sql):
    _, o, _ = c.exec_command(f'psql {DB} -c "{sql}"', timeout=15)
    return o.read().decode('utf-8', errors='replace').strip()

# 애플 설정값 DB 확인
print("[애플 로그인 설정 DB 현황]")
print(q("""
  SELECT key, CASE WHEN value IS NULL OR value='' THEN '(미설정)' ELSE '(설정됨)' END AS status
    FROM setting
   WHERE namespace='social' AND key LIKE 'apple%'
   ORDER BY key
"""))

# 카카오/네이버 비교
print("\n[소셜 로그인 전체 설정 현황]")
print(q("""
  SELECT key, CASE WHEN value IS NULL OR value='' THEN '❌ 미설정' ELSE '✅ 설정됨' END AS status
    FROM setting
   WHERE namespace='social'
   ORDER BY key
"""))

# 애플 가입 회원 있는지
print("\n[애플로 가입된 회원 수]")
print(q("SELECT COUNT(*) FROM member WHERE social_provider='apple'"))

c.close()
