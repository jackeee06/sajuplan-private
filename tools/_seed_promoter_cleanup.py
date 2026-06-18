# -*- coding: utf-8 -*-
"""모집인(jackee, promoter id=5) 가상 시딩 데이터 정리 — 검증 끝나면 실행해 흔적 0 삭제.

가상 데이터 표식:
  - 회원: member.nickname LIKE '[SEED]모집테스트%' (phone 0100002xxxx 대역)
  - 적립: promoter_reward.source_id 91000001~91000020 (promoter_id=5)

usage: python tools/_seed_promoter_cleanup.py
"""
import os
import re
import sys
import io

import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

pw = None
for c in (".env.local", ".env"):
    if os.path.exists(c):
        for l in open(c, encoding="utf-8", errors="replace"):
            m = re.match(r"\s*SSHPASS\s*=\s*(.+)\s*$", l)
            if m:
                pw = m.group(1).strip().strip('"').strip("'")
                break
    if pw:
        break

s = paramiko.SSHClient()
s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=25)
b = r"""export $(grep -E "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env|xargs)>/dev/null 2>&1
psql "$DATABASE_URL" -q -c "DELETE FROM promoter_reward WHERE promoter_id=5 AND source_id BETWEEN 91000001 AND 91000020"
psql "$DATABASE_URL" -q -c "DELETE FROM promoter_referral WHERE promoter_id=5 AND member_id IN (SELECT id FROM member WHERE nickname LIKE '[SEED]모집테스트%')"
psql "$DATABASE_URL" -q -c "DELETE FROM member WHERE nickname LIKE '[SEED]모집테스트%'"
echo "정리 완료. 남은: 회원=$(psql "$DATABASE_URL" -At -c "SELECT COUNT(*) FROM member WHERE nickname LIKE '[SEED]모집테스트%'") 적립=$(psql "$DATABASE_URL" -At -c "SELECT COUNT(*) FROM promoter_reward WHERE promoter_id=5 AND source_id BETWEEN 91000001 AND 91000020")"
"""
i, o, e = s.exec_command(b)
sys.stdout.write(o.read().decode("utf-8", "replace"))
s.close()
