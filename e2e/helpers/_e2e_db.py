# -*- coding: utf-8 -*-
"""E2E 보조 — prod 서버 sms_auth 에서 인증번호 읽기 / 테스트 모집인·인증 정리.

실제 사용자가 카톡으로 받은 인증번호를 입력하는 것과 동일하게,
DB 에 저장된 auth_code 를 읽어 Playwright 가 화면에 입력하도록 돕는다.

usage:
  python _e2e_db.py otp 01000000001      -> 최근 발급 인증번호 6자리 출력
  python _e2e_db.py cleanup 01000000001  -> 해당 번호의 테스트 promoter/sms_auth 삭제
  python _e2e_db.py status 01000000001   -> 해당 번호 promoter 의 status 출력
"""
import os
import re
import sys
import io

import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HOST = "104.64.128.103"
ENV = "/data/wwwroot/api.sajumoon.co.kr/.env"


def _pw():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.abspath(os.path.join(here, "..", ".."))
    for cand in (".env.local", ".env"):
        p = os.path.join(root, cand)
        if os.path.exists(p):
            for line in open(p, encoding="utf-8", errors="replace"):
                m = re.match(r"\s*SSHPASS\s*=\s*(.+)\s*$", line)
                if m:
                    return m.group(1).strip().strip('"').strip("'")
    raise SystemExit("SSHPASS not found in .env.local/.env")


def _run(remote_sql_cmd):
    cli = paramiko.SSHClient()
    cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    cli.connect(HOST, 22, "root", _pw(), allow_agent=False, look_for_keys=False, timeout=25)
    bash = (
        'export $(grep -E "^DATABASE_URL=" %s | xargs) >/dev/null 2>&1; ' % ENV
    ) + remote_sql_cmd
    _, out, _ = cli.exec_command(bash)
    data = out.read().decode("utf-8", "replace").strip()
    cli.close()
    return data


def main():
    if len(sys.argv) < 3:
        raise SystemExit("usage: _e2e_db.py <otp|cleanup|status> <phone>")
    cmd, phone = sys.argv[1], re.sub(r"\D", "", sys.argv[2])
    if cmd == "otp":
        sql = (
            "psql \"$DATABASE_URL\" -At -c "
            "\"SELECT auth_code FROM sms_auth WHERE phone='%s' "
            "ORDER BY id DESC LIMIT 1\"" % phone
        )
        print(_run(sql))
    elif cmd == "status":
        sql = (
            "psql \"$DATABASE_URL\" -At -c "
            "\"SELECT status FROM promoter WHERE phone='%s' "
            "ORDER BY id DESC LIMIT 1\"" % phone
        )
        print(_run(sql))
    elif cmd == "cleanup":
        sql = (
            "psql \"$DATABASE_URL\" -q -c \"DELETE FROM promoter WHERE phone='%s'\" "
            ">/dev/null 2>&1; "
            "psql \"$DATABASE_URL\" -q -c \"DELETE FROM sms_auth WHERE phone='%s'\" "
            ">/dev/null 2>&1; echo cleaned" % (phone, phone)
        )
        print(_run(sql))
    else:
        raise SystemExit("unknown cmd: %s" % cmd)


if __name__ == "__main__":
    main()
