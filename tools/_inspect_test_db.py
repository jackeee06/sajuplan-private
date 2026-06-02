"""test 환경의 DB schema 정밀 점검.

목적: prod 와 test 의 schema 차이를 정확히 파악. test 의 post_counselor 누락 의심 검증.

수정 X — 보고만.
"""
from __future__ import annotations
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko


def fetch(c, cmd: str, timeout: int = 60) -> str:
    _, out, err = c.exec_command(cmd, timeout=timeout)
    o = out.read().decode("utf-8", "replace")
    e = err.read().decode("utf-8", "replace")
    return (o + (e if e.strip() else "")).rstrip()


def inspect(label: str, host: str, domain: str, pw: str) -> dict:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

    # DATABASE_URL 추출 (정밀, 따옴표 보존)
    cmd = f"grep '^DATABASE_URL=' /data/wwwroot/{domain}/.env | head -1 | cut -d= -f2-"
    url = fetch(c, cmd, 15).strip().strip('"').strip("'")

    print(f"\n{'='*70}\n[{label}] {host} ({domain})\n{'='*70}")
    print(f"DATABASE_URL length={len(url)}, prefix={url[:40] if url else '(empty)'}...")

    # psql 의 출력을 JSON 형태로 받아 파싱
    # 1) 현재 DB 이름
    db = fetch(c, f"psql '{url}' -At -c \"SELECT current_database()\"", 15)
    print(f"current_database: {db}")

    # 2) 검색 경로
    sp = fetch(c, f"psql '{url}' -At -c \"SHOW search_path\"", 15)
    print(f"search_path: {sp}")

    # 3) 모든 schema 목록
    schemas = fetch(
        c,
        f"psql '{url}' -At -c \"SELECT schema_name FROM information_schema.schemata ORDER BY schema_name\"",
        15,
    )
    print(f"schemas: {schemas.splitlines()}")

    # 4) public schema 의 모든 테이블 수
    tab_cnt = fetch(
        c,
        f"psql '{url}' -At -c \"SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'\"",
        15,
    )
    print(f"public.tables count: {tab_cnt}")

    # 5) post_counselor 존재 여부 (정확한 결과)
    pc = fetch(
        c,
        f"psql '{url}' -At -c \"SELECT count(*) FROM information_schema.tables WHERE table_name='post_counselor'\"",
        15,
    )
    print(f"post_counselor exists (any schema): {pc}")

    # 6) prod 핵심 테이블 일부 누락 여부 — 비교용
    core_tables = [
        "member", "consultation", "payment", "point", "point_history",
        "settlement_monthly", "post_counselor", "alimtalk_template",
        "chat_room", "refund_request",
    ]
    print("\n핵심 테이블 존재 여부:")
    for tbl in core_tables:
        res = fetch(
            c,
            f"psql '{url}' -At -c \"SELECT to_regclass('public.{tbl}') IS NOT NULL\"",
            10,
        )
        print(f"  {tbl}: {res}")

    # 7) member 의 row 개수 (DB 가 비어있는지 확인)
    mc = fetch(c, f"psql '{url}' -At -c \"SELECT count(*) FROM member\"", 15)
    print(f"\nmember row count: {mc}")

    c.close()
    return {"label": label}


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 필요", file=sys.stderr)
        return 1
    for label, host, domain in [
        ("test", "172.235.211.75", "api.sajumoon.kr"),
        ("prod", "104.64.128.103", "api.sajuplan.com"),
    ]:
        try:
            inspect(label, host, domain, pw)
        except Exception as e:
            print(f"[{label}] error: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
