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
    _, o, _ = c.exec_command(f'psql {DB} -c "{sql}"', timeout=15)
    print(o.read().decode('utf-8','replace').strip())

# 전체 QnA 목록 + 답변 여부
q("""
  SELECT cq.id, m.mb_id AS writer, cm.mb_id AS counselor,
         LEFT(cq.title,20) AS title, LEFT(cq.content,15) AS content,
         cq.created_at::date,
         EXISTS(SELECT 1 FROM counselor_qna_reply r WHERE r.qna_id=cq.id) AS has_reply
  FROM counselor_qna cq
  JOIN member m ON m.id=cq.member_id
  JOIN member cm ON cm.id=cq.counselor_id
  ORDER BY cq.created_at DESC LIMIT 20
""", "QnA 전체 + 답변 여부")

# 답변 내용
q("""
  SELECT r.id, r.qna_id, m.mb_id AS counselor, LEFT(r.content,30) AS reply
  FROM counselor_qna_reply r
  JOIN member m ON m.id=r.counselor_id
  ORDER BY r.created_at DESC LIMIT 10
""", "QnA 답변 목록")

c.close()
