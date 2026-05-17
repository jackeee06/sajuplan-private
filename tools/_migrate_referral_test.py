"""test 서버에 psql 이 없어 마이그레이션 skip 됐던 것을 보완.
test 서버에서 node + postgres.js 로 직접 DDL 실행."""
import os, sys, paramiko

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

DDL = """
CREATE TABLE IF NOT EXISTS counselor_referral (
  id BIGSERIAL PRIMARY KEY,
  referrer_id BIGINT NOT NULL REFERENCES member(id),
  referee_id BIGINT NOT NULL UNIQUE REFERENCES member(id),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','disabled')),
  memo TEXT,
  created_by_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_counselor_referral_referrer ON counselor_referral (referrer_id, status);
CREATE INDEX IF NOT EXISTS idx_counselor_referral_referee ON counselor_referral (referee_id);
CREATE TABLE IF NOT EXISTS counselor_referral_payment (
  id BIGSERIAL PRIMARY KEY,
  referral_id BIGINT NOT NULL REFERENCES counselor_referral(id),
  pay_month DATE NOT NULL,
  rate_pct NUMERIC(5,2) NOT NULL,
  referee_sales BIGINT NOT NULL,
  paid_amount BIGINT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_by_id BIGINT,
  point_history_id BIGINT,
  memo TEXT,
  UNIQUE (referral_id, pay_month)
);
CREATE INDEX IF NOT EXISTS idx_counselor_referral_payment_month ON counselor_referral_payment (pay_month);
"""

NODE_SCRIPT = """
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: false });
const ddl = `""" + DDL.replace("`", "\\`") + """`;
(async () => {
  try {
    await sql.unsafe(ddl);
    const rows = await sql`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'counselor_referral%' ORDER BY table_name`;
    console.log('tables:', JSON.stringify(rows.map(r => r.table_name)));
    await sql.end();
    process.exit(0);
  } catch (e) {
    console.error('ERR:', e.message);
    await sql.end({ timeout: 1 });
    process.exit(1);
  }
})();
"""

def main():
    pw = os.environ["SSHPASS"]
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("172.235.211.75", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=15)

    import base64
    b64 = base64.b64encode(NODE_SCRIPT.encode("utf-8")).decode("ascii")
    cmd = (
        f"set -e; cd /data/wwwroot/api.sajumoon.kr; "
        f"echo {b64} | base64 -d > ./_referral_mig.js; "
        f"set -a; source .env; set +a; "
        f"node ./_referral_mig.js 2>&1; "
        f"rm -f ./_referral_mig.js"
    )
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=60)
    print(out.read().decode("utf-8", "replace"))
    e = err.read().decode("utf-8", "replace")
    if e.strip(): print("stderr:", e)
    c.close()

if __name__ == "__main__":
    main()
