#!/usr/bin/env python3
"""후기 시스템 DB 설정 + 컬럼 추가."""
import os, sys
import paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
HOST = "104.64.128.103"

def ssh():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, 'root', os.environ['SSHPASS'],
              allow_agent=False, look_for_keys=False, timeout=20)
    return c

def run(conn, sql, label=""):
    _, o, e = conn.exec_command(f"psql {DB} -c \"{sql}\"", timeout=30)
    out = o.read().decode('utf-8', errors='replace').strip()
    err = e.read().decode('utf-8', errors='replace').strip()
    rc = o.channel.recv_exit_status()
    tag = f"[{label}] " if label else ""
    if out: print(f"{tag}{out}")
    if err and rc != 0: print(f"{tag}ERR: {err}", file=sys.stderr)
    return rc == 0

conn = ssh()

print("=== 1. review 설정값 추가 ===")
sql1 = (
    "INSERT INTO setting (namespace, key, value) VALUES "
    "('review','payout_enabled','1'),"
    "('review','payout_amount','500'),"
    "('review','payout_photo_bonus','500'),"
    "('review','payout_min_used','0') "
    "ON CONFLICT (namespace,key) DO UPDATE SET value=EXCLUDED.value"
)
ok = run(conn, sql1, "settings")
print("✅ settings OK" if ok else "❌ settings FAIL")

print("\n=== 2. post_review 컬럼 추가 (is_admin_best, admin_best_at) ===")
sql2 = (
    "ALTER TABLE post_review "
    "ADD COLUMN IF NOT EXISTS is_admin_best boolean NOT NULL DEFAULT false,"
    "ADD COLUMN IF NOT EXISTS admin_best_at timestamptz"
)
ok2 = run(conn, sql2, "migration")
print("✅ migration OK" if ok2 else "❌ migration FAIL")

print("\n=== 3. 확인 ===")
run(conn, "SELECT namespace,key,value FROM setting WHERE namespace='review' ORDER BY key", "verify")
run(conn, "SELECT column_name,data_type FROM information_schema.columns WHERE table_name='post_review' AND column_name IN ('is_best','is_admin_best','admin_best_at') ORDER BY column_name", "columns")

conn.close()
print("\n완료")
