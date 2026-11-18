"""settlement_recovery 테이블 생성 + 회수 대상 5명 시드 (멱등)."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ.get('SSHPASS')
if not pw:
    envf = os.path.join(os.path.dirname(__file__), '..', '.env.local')
    for line in open(envf, encoding='utf-8'):
        if line.startswith('SSHPASS='):
            pw = line.split('=', 1)[1].strip().strip('"\''); break
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
_, o, _ = c.exec_command('grep "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | head -1')
dburl = o.read().decode().strip().split('=',1)[1].strip("'\"")
psql = '/usr/bin/psql'

# 회수 대상 5명 (member_id, amount)
TARGETS = [(112, 160793), (125, 9670), (134, 165551), (189, 105249), (249, 19340)]
REASON = '6월분 중복지급 환수 (정산하기 버튼 누락으로 2회 지급됨)'

ddl = """
CREATE TABLE IF NOT EXISTS settlement_recovery (
  id           serial PRIMARY KEY,
  member_id    integer NOT NULL REFERENCES member(id),
  amount       integer NOT NULL,
  reason       text,
  origin_month text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolved_by  integer,
  resolved_memo text
);
CREATE INDEX IF NOT EXISTS idx_settlement_recovery_open
  ON settlement_recovery (member_id) WHERE resolved_at IS NULL;
"""
seed_values = ",\n".join(
    f"({mid}, {amt}, '{REASON}', '2026-06')" for mid, amt in TARGETS
)
seed = f"""
INSERT INTO settlement_recovery (member_id, amount, reason, origin_month)
SELECT v.member_id, v.amount, v.reason, v.origin_month
FROM (VALUES {seed_values}) AS v(member_id, amount, reason, origin_month)
WHERE NOT EXISTS (
  SELECT 1 FROM settlement_recovery r
  WHERE r.member_id = v.member_id AND r.origin_month = v.origin_month
);
"""

def run(label, sql):
    _, o, e = c.exec_command(f'{psql} "{dburl}" -c "{sql}"')
    out = o.read().decode(); err = e.read().decode()
    print(f"--- {label} ---"); print(out.strip() or "(ok)")
    if err.strip(): sys.stderr.write(err)

run("DDL create table", ddl.replace('"', '\\"'))
run("SEED 5 targets", seed.replace('"', '\\"'))

# 확인
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c "SELECT r.id, r.member_id, m.name, r.amount, r.origin_month, r.resolved_at '
    'FROM settlement_recovery r JOIN member m ON m.id=r.member_id ORDER BY r.amount DESC;"')
print("="*60); print(o.read().decode())
c.close()
