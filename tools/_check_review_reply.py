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

# post_review_reply 컬럼 구조
q("SELECT column_name FROM information_schema.columns WHERE table_name='post_review_reply' ORDER BY ordinal_position", "post_review_reply 컬럼")

# 모든 reply 데이터
q("SELECT * FROM post_review_reply ORDER BY id DESC LIMIT 10", "post_review_reply 전체 데이터")

# 컨트롤러에서 호출하는 deleteMine 엔드포인트 확인용 - reviews 컨트롤러
c.close()
