"""상담사 추천 시스템 — 양 서버 백엔드 엄격검증.

검증 항목:
  1. PM2 sajumoon-api 가 errored 가 아닌 online 인지
  2. 최근 PM2 로그에 ReferralsModule 관련 에러 없는지
  3. /admin/referrals 가 라우트 등록되어 401 응답하는지 (404 가 아니라)
  4. /admin/referrals/counselor-search 가 라우트 등록되어 401 응답하는지
  5. counselor_referral / counselor_referral_payment 테이블 존재 + 컬럼 검증
"""
import os, sys, paramiko, json

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

SERVERS = [
    ("test", "172.235.211.75", "api.sajumoon.kr"),
    ("prod", "104.64.128.103", "api.sajuplan.com"),
]

ROUTES = [
    "GET    /admin/referrals",
    "GET    /admin/referrals/counselor-search",
    "POST   /admin/referrals",
    "POST   /admin/referrals/123/pay",
    "POST   /admin/referrals/123/disable",
]


def exec_cmd(c, cmd, timeout=30):
    _, out, err = c.exec_command(cmd, timeout=timeout)
    o = out.read().decode("utf-8", "replace")
    e = err.read().decode("utf-8", "replace")
    rc = out.channel.recv_exit_status()
    return rc, o, e


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 필요", file=sys.stderr)
        return 1

    fail = 0
    for label, host, domain in SERVERS:
        print(f"\n========== [{label}] {host} ({domain}) ==========")
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

        # 1) PM2 상태
        rc, o, _ = exec_cmd(c, "pm2 jlist 2>/dev/null", timeout=15)
        pm2 = []
        try:
            pm2 = json.loads(o or "[]")
        except Exception:
            print(f"  ✗ pm2 jlist 파싱 실패")
            fail += 1
        target = [p for p in pm2 if p.get("name") == "sajumoon-api"]
        if not target:
            print(f"  ✗ sajumoon-api 프로세스 없음")
            fail += 1
        else:
            st = target[0].get("pm2_env", {}).get("status")
            mem = target[0].get("monit", {}).get("memory", 0)
            unstable = target[0].get("pm2_env", {}).get("unstable_restarts", 0)
            print(f"  PM2 sajumoon-api: status={st} memory={mem//1024//1024}MB unstable_restarts={unstable}")
            if st != "online":
                print(f"  ✗ status != online")
                fail += 1
            if unstable > 0:
                print(f"  ✗ unstable_restarts={unstable} (재시작 루프 의심)")
                fail += 1

        # 2) 최근 로그에 referral 관련 에러
        rc, o, _ = exec_cmd(c,
            f"pm2 logs sajumoon-api --lines 50 --nostream --raw 2>&1 | "
            f"grep -iE 'referral|Nest can.t resolve|Module.*not found|UnknownDependencies' | tail -10",
            timeout=15)
        if o.strip():
            print(f"  ⚠ 최근 로그 의심 라인:")
            for ln in o.strip().split("\n"):
                print(f"     {ln}")
            # ReferralsService 라는 단어가 정상 부팅 로그에 한 번 나올 수도 있음 (nest LOG)
            # Nest can't / UnknownDependencies 가 있을 때만 fail
            if "can't" in o or "UnknownDependencies" in o or "not found" in o.lower():
                fail += 1
        else:
            print(f"  ✓ 최근 로그에 의심 라인 없음")

        # 3~7) /admin/referrals 라우트 응답
        # localhost 에서 curl. 401 (UnauthorizedException) 면 라우트 등록 OK. 404 면 라우트 없음.
        # ecosystem.config.js 에 PORT=3001 박혀있음 (양 서버 동일)
        # main.ts: setGlobalPrefix('api') → 모든 라우트가 /api/ 접두어
        url_base = "http://127.0.0.1:3001/api"

        for route in ROUTES:
            method, path = route.split(None, 1)
            method = method.strip()
            path = path.strip()
            if method == "POST":
                curl_cmd = f"curl -s -o /dev/null -w '%{{http_code}}' -X POST -H 'Content-Type: application/json' -d '{{}}' '{url_base}{path}'"
            else:
                curl_cmd = f"curl -s -o /dev/null -w '%{{http_code}}' '{url_base}{path}'"
            rc, code, _ = exec_cmd(c, curl_cmd, timeout=15)
            code = code.strip()
            # 401 = 라우트 등록 + 인증 거부 (정상)
            # 404 = 라우트 없음 (배포 누락 또는 모듈 등록 안됨)
            # 5xx = 서버 에러
            mark = "✓" if code == "401" else "✗"
            print(f"  {mark} [{code}] {method:6s} {path}")
            if code != "401":
                fail += 1

        # 8) DB 테이블 검증
        # test 서버에는 psql 미설치 → node + postgres.js 로 검증 (cwd=프로젝트)
        rc, has_psql, _ = exec_cmd(c, "command -v psql || echo NONE", timeout=5)
        use_node = "NONE" in has_psql or not has_psql.strip()
        rc, url_out, _ = exec_cmd(c,
            f"grep '^DATABASE_URL=' /data/wwwroot/{domain}/.env | head -1 | cut -d= -f2- | tr -d \"'\\\"\"",
            timeout=10)
        db_url = url_out.strip()

        def run_sql(query: str) -> str:
            """psql 있으면 psql, 없으면 node 로 실행. -At 단일컬럼 출력 모방."""
            if use_node:
                node_src = (
                    "const postgres=require('postgres');"
                    "const sql=postgres(process.env.DATABASE_URL,{max:1,ssl:false});"
                    f"(async()=>{{try{{const r=await sql.unsafe({repr(query)});"
                    "process.stdout.write(r.map(x=>Object.values(x)[0]).join('\\n'));"
                    "await sql.end();}catch(e){process.stderr.write('ERR:'+e.message);"
                    "await sql.end({timeout:1});process.exit(1);}})();"
                )
                import base64
                b64 = base64.b64encode(node_src.encode('utf-8')).decode('ascii')
                cmd = (f"set -e; cd /data/wwwroot/{domain}; "
                       f"echo {b64} | base64 -d > ./_q.js; "
                       f"set -a; source .env; set +a; "
                       f"node ./_q.js; rm -f ./_q.js")
                _, o, _ = exec_cmd(c, f"bash -lc {repr(cmd)}", timeout=20)
                return o
            else:
                _, o, _ = exec_cmd(c, f"psql '{db_url}' -At -c \"{query}\"", timeout=15)
                return o

        if db_url:
            tbls = run_sql(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_name IN ('counselor_referral','counselor_referral_payment') ORDER BY 1"
            )
            t = [x for x in tbls.strip().split("\n") if x]
            if set(t) == {"counselor_referral", "counselor_referral_payment"}:
                print(f"  ✓ DB 테이블 2개 존재: {t}")
            else:
                print(f"  ✗ DB 테이블 누락: 발견={t}")
                fail += 1

            cols = run_sql(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='counselor_referral' ORDER BY 1"
            )
            cset = set(x for x in cols.strip().split("\n") if x)
            required = {"id", "referrer_id", "referee_id", "registered_at", "expires_at", "status", "memo"}
            missing = required - cset
            if missing:
                print(f"  ✗ counselor_referral 누락 컬럼: {missing}")
                fail += 1
            else:
                print(f"  ✓ counselor_referral 필수 컬럼 OK (총 {len(cset)}개)")

            cols2 = run_sql(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='counselor_referral_payment' ORDER BY 1"
            )
            cset2 = set(x for x in cols2.strip().split("\n") if x)
            required2 = {"id", "referral_id", "pay_month", "rate_pct", "referee_sales", "paid_amount", "point_history_id"}
            missing2 = required2 - cset2
            if missing2:
                print(f"  ✗ counselor_referral_payment 누락 컬럼: {missing2}")
                fail += 1
            else:
                print(f"  ✓ counselor_referral_payment 필수 컬럼 OK (총 {len(cset2)}개)")

            uniq2 = run_sql(
                "SELECT conname FROM pg_constraint "
                "WHERE conrelid='counselor_referral_payment'::regclass AND contype='u'"
            )
            if uniq2.strip():
                print(f"  ✓ UNIQUE constraint 존재: {uniq2.strip()}")
            else:
                print(f"  ✗ UNIQUE 제약 없음 — 멱등성 위험")
                fail += 1

        c.close()

    print(f"\n========== 결과 ==========")
    if fail == 0:
        print(f"✓ 모든 검증 통과")
        return 0
    print(f"✗ {fail} 개 항목 실패")
    return 1


if __name__ == "__main__":
    sys.exit(main())
