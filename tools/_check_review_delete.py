#!/usr/bin/env python3
import os, sys, paramiko
for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=15)

def q(sql, label=""):
    if label: print(f"\n[{label}]")
    _, o, e = c.exec_command(f'psql {DB} -c "{sql}"', timeout=20)
    out = o.read().decode('utf-8','replace').strip()
    err = e.read().decode('utf-8','replace').strip()
    if out: print(out)
    if err and 'NOTICE' not in err: print("ERR:", err[:200])

# post_review_reply 테이블 존재 여부
q("SELECT table_name FROM information_schema.tables WHERE table_name = 'post_review_reply'", "post_review_reply 테이블 존재 여부")

# e2e_member 최근 후기
q("""
  SELECT id, member_id, counselor_id, created_at, NOW() - created_at AS age
  FROM post_review WHERE member_id = 140
  ORDER BY created_at DESC LIMIT 5
""", "e2e_member 최근 후기")

# 후기 삭제 테스트 (직접 삭제 가능 여부 확인)
q("""
  SELECT id, member_id, NOW() - created_at AS age,
         (NOW() - created_at) < interval '5 minutes' AS within_5min
  FROM post_review WHERE member_id = 140 ORDER BY id DESC LIMIT 3
""", "5분 이내 삭제 가능 여부")

c.close()
