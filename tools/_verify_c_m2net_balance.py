"""검증 C — m2net ↔ 사주플랜 외부 잔액 일치 검증.

prod 서버에서 직접 m2net API 호출 (read-only, 안전).
대조:
  - 회원: m2net_membid 보유자의 m2net amt vs 사주플랜 (free+paid)
  - 상담사: csrid 보유자의 m2net amt vs 사주플랜 earning_balance
"""
import os
import sys
import json
import paramiko

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
    except Exception:
        pass

HOST = "104.64.128.103"
API_REMOTE = "/data/wwwroot/api.sajumoon.co.kr"
PSQL = "/usr/bin/psql"


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("ERROR: SSHPASS env var required.")
        return 2
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    try:
        # .env 에서 m2net 설정 읽기 (key=value 파싱)
        env = {}
        for key in ("DATABASE_URL", "M2NET_API_URL", "M2NET_CPID", "M2NET_HEADER_KEY"):
            _, out, _ = c.exec_command(
                f"grep '^{key}=' {API_REMOTE}/.env | head -1"
            )
            raw = out.read().decode().strip()
            if raw.startswith(f"{key}="):
                v = raw[len(key) + 1:]
                if (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
                    v = v[1:-1]
                env[key] = v
        dburl = env.get("DATABASE_URL", "")
        m2net_url = env.get("M2NET_API_URL", "")
        cpid = env.get("M2NET_CPID", "")
        headerkey = env.get("M2NET_HEADER_KEY", "")
        print(f"m2net_url={m2net_url}  cpid={cpid}  headerkey={headerkey[:4]}***")

        # 1) 사주플랜 측 — m2net 측 ID 보유자 인벤토리
        print("\n[STEP 1] 사주플랜 측 인벤토리")
        _, out, _ = c.exec_command(
            f'{PSQL} "{dburl}" -Atc '
            '"SELECT id, mb_id, name, role, m2net_membid, csrid, '
            'COALESCE((SELECT free_balance+paid_balance FROM point WHERE member_id=member.id), 0) AS consume_balance, '
            'COALESCE((SELECT earning_balance FROM point WHERE member_id=member.id), 0) AS earning_balance '
            'FROM member '
            "WHERE (m2net_membid IS NOT NULL AND m2net_membid <> '') "
            "   OR (csrid IS NOT NULL AND csrid <> '') "
            'ORDER BY id;"'
        )
        rows = []
        for line in out.read().decode().strip().splitlines():
            parts = line.split('|')
            if len(parts) >= 8:
                rows.append({
                    "id": parts[0], "mb_id": parts[1], "name": parts[2], "role": parts[3],
                    "m2net_membid": parts[4], "csrid": parts[5],
                    "consume": int(parts[6]), "earning": int(parts[7]),
                })
        print(f"  대상자 {len(rows)}명")
        for r in rows:
            print(f"  id={r['id']:>4} {r['role']:>9} {r['name']:<10} "
                  f"membid={r['m2net_membid']:<10} csrid={r['csrid']:<10} "
                  f"consume={r['consume']:>10,}  earning={r['earning']:>10,}")

        # 2) m2net 측 회원 잔액 조회 (모든 m2net_membid 보유자)
        print("\n[STEP 2] m2net 측 회원 잔액 조회 (membid → amt)")
        membids = [r for r in rows if r['m2net_membid']]
        for r in membids:
            mb = r['m2net_membid'].zfill(6)
            jsonarg = json.dumps({"list": [{"membid": mb}]})
            # curl 직접 호출 (prod 서버에서, M2NET_HEADER_KEY 사용)
            curl_cmd = (
                f"curl -s -m 15 "
                f"-H 'Authorization: {headerkey}' "
                f"'{m2net_url}/memb-mgrp/{cpid}/{jsonarg}'"
            )
            _, out, err = c.exec_command(curl_cmd)
            body = out.read().decode().strip()
            err_text = err.read().decode().strip()
            m2net_amt = "?"
            req_result = "?"
            try:
                data = json.loads(body)
                req_result = data.get("req_result", "?")
                if isinstance(data.get("list"), list) and data["list"]:
                    m2net_amt = data["list"][0].get("amt", "?")
            except Exception:
                pass
            saju_consume = r['consume']
            diff = (int(m2net_amt) - saju_consume) if isinstance(m2net_amt, (int, float)) else "N/A"
            mark = "✅" if diff == 0 else ("⚠️" if diff != "N/A" else "❓")
            print(f"  {mark} id={r['id']:>4} {r['name']:<10} m2net_amt={m2net_amt:>10} "
                  f"saju(free+paid)={saju_consume:>10,}  diff={diff}  req={req_result}")

        # 3) m2net 측 상담사 잔액 조회 (csrid 보유자) — csr-mgr 엔드포인트 추정
        print("\n[STEP 3] m2net 측 상담사 잔액은 별도 엔드포인트 필요 (csr-mgr)")
        csrs = [r for r in rows if r['csrid']]
        print(f"  csrid 보유 상담사 {len(csrs)}명 — m2net 측 csr 잔액 API 가 있는지 확인 필요")
        for r in csrs:
            print(f"  - id={r['id']} {r['name']} csrid={r['csrid']} "
                  f"sajumoon_earning={r['earning']:,}")
    finally:
        c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
