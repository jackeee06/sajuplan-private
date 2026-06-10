#!/usr/bin/env python3
"""balance_kind 컬럼 마이그레이션 + 백필 실행"""
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
    _, o, e = c.exec_command(f'psql {DB} -c "{sql}"', timeout=20)
    out = o.read().decode('utf-8', errors='replace').strip()
    err = e.read().decode('utf-8', errors='replace').strip()
    if err and 'already exists' not in err: print(f"STDERR: {err}")
    print(out)
    return out

q("ALTER TABLE point_history ADD COLUMN IF NOT EXISTS balance_kind VARCHAR(10) NOT NULL DEFAULT 'consumer'",
  "1. 컬럼 추가")

q("UPDATE point_history SET balance_kind = 'earning' WHERE rel_action LIKE '%@상담코인 증가@%' OR rel_action LIKE '%@채팅코인 증가@%'",
  "2. 상담 수익 백필")

q("UPDATE point_history SET balance_kind = 'earning' WHERE rel_table = 'settlement_monthly'",
  "3. 정산 차감 백필")

q("UPDATE point_history SET balance_kind = 'earning' WHERE rel_table = 'counselor_referral'",
  "4. 추천 수당 백필")

q("SELECT balance_kind, COUNT(*) as cnt FROM point_history GROUP BY balance_kind ORDER BY balance_kind",
  "5. 결과 검증")

q("SELECT m.mb_id, m.nickname, ph.balance_kind, ph.earn_point, ph.content, ph.created_at::date FROM point_history ph JOIN member m ON m.id=ph.member_id WHERE ph.balance_kind='earning' ORDER BY ph.created_at DESC LIMIT 10",
  "6. earning 행 샘플")

c.close()
print("\n완료")
