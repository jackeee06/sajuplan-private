"""[프로모션] 상담사 추천 수당 정책 — counselor_referral 테이블 생성.

정책:
  - 추천자(A)가 피추천자(B)를 추천 → B 가입 후 6개월 한정 수당
  - 가입 후 1~3개월: B 매출의 2% → A 포인트
  - 4~6개월: B 매출의 1% → A 포인트
  - 6개월 이후 종료

운영:
  - 등록: 어드민에서 운영자 수동 등록 (B 가입 후 운영자가 A 지정)
  - 지급: 매월 1~5일 운영자가 어드민에서 "이번 달 지급" 클릭
  - 지급 방식: 추천자(A) 포인트 적립 (point_history INSERT)
"""
import os, sys, paramiko

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

DDL = """
CREATE TABLE IF NOT EXISTS counselor_referral (
  id              BIGSERIAL PRIMARY KEY,
  referrer_id     BIGINT NOT NULL REFERENCES member(id),
  referee_id      BIGINT NOT NULL UNIQUE REFERENCES member(id),
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','disabled')),
  memo            TEXT,
  created_by_id   BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_counselor_referral_referrer
  ON counselor_referral (referrer_id, status);
CREATE INDEX IF NOT EXISTS idx_counselor_referral_referee
  ON counselor_referral (referee_id);

COMMENT ON TABLE counselor_referral IS
  '상담사 추천 관계 — 운영자가 어드민에서 수동 등록. 가입 후 6개월 한정 수당.';

CREATE TABLE IF NOT EXISTS counselor_referral_payment (
  id              BIGSERIAL PRIMARY KEY,
  referral_id     BIGINT NOT NULL REFERENCES counselor_referral(id),
  pay_month       DATE NOT NULL,
  rate_pct        NUMERIC(5,2) NOT NULL,
  referee_sales   BIGINT NOT NULL,
  paid_amount     BIGINT NOT NULL,
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_by_id      BIGINT,
  point_history_id BIGINT,
  memo            TEXT,
  UNIQUE (referral_id, pay_month)
);

CREATE INDEX IF NOT EXISTS idx_counselor_referral_payment_month
  ON counselor_referral_payment (pay_month);

COMMENT ON TABLE counselor_referral_payment IS
  '추천 수당 매월 지급 이력 — 같은 referral_id + pay_month UNIQUE 멱등';
"""


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 필요", file=sys.stderr)
        return 1
    for label, host, domain in [
        ("test", "172.235.211.75", "api.sajumoon.kr"),
        ("prod", "104.64.128.103", "api.sajumoon.co.kr"),
    ]:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
        _, out, _ = c.exec_command(
            f"grep '^DATABASE_URL=' /data/wwwroot/{domain}/.env | head -1 | cut -d= -f2- | tr -d \"'\\\"\"",
            timeout=15,
        )
        url = out.read().decode().strip()
        if not url:
            if label == "test":
                print(f"[{label}] DATABASE_URL 못 찾음 — skip (test 는 psql 없음 가능)")
                c.close()
                continue
            print(f"[{label}] DATABASE_URL 없음", file=sys.stderr)
            c.close()
            return 1

        # DDL 을 임시 파일에 저장 후 psql -f 로 실행
        ddl_b64 = __import__("base64").b64encode(DDL.encode("utf-8")).decode("ascii")
        cmd = (
            f"set -e; "
            f"echo {ddl_b64} | base64 -d > /tmp/_referral_ddl.sql; "
            f"psql '{url}' -f /tmp/_referral_ddl.sql 2>&1; "
            f"rm -f /tmp/_referral_ddl.sql"
        )
        _, stdout, _ = c.exec_command(f"bash -lc {repr(cmd)}", timeout=60)
        result = stdout.read().decode("utf-8", "replace")
        print(f"\n=== [{label}] {host} ===")
        print(result.rstrip())

        # 확인
        _, out, _ = c.exec_command(
            f"psql '{url}' -At -c \"SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'counselor_referral%' ORDER BY table_name\"",
            timeout=30,
        )
        print(f"등록된 테이블: {out.read().decode('utf-8', 'replace').strip()}")
        c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
