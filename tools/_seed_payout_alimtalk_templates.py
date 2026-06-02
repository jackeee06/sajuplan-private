"""선지급 시스템 카톡 알림톡 템플릿 시드 (2026-05-21).

명세: memory/project_payout_system_plan.md (카톡 알림 3단)
  - payout_request_received : 신청 접수
  - payout_request_rejected : 반려
  - payout_request_paid     : 지급 완료

⚠️ 중요:
  - DB 에 INSERT 한 본문은 **BizM 콘솔에 등록한 본문과 100% 동일** 해야 발송 가능.
  - 1글자라도 다르면 BizM 이 친구톡 → SMS 강등 시키며, 최악의 경우 거부됨.
  - 따라서 이 스크립트는 **DB 시드만 한다**. BizM 콘솔 등록은 사장님이 별도로 하셔야 함.
  - 등록 후 1~3일 승인 대기.

ON CONFLICT (template_code) DO NOTHING — 재실행 안전.
"""
from __future__ import annotations
import base64
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

TARGETS = [
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr/.env"),
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr/.env"),
]

# 각 항목: (template_code, subject, message)
# message 의 #{var} 는 sendAlimtalkByCode 가 vars 객체로 치환.
TEMPLATES = [
    (
        'payout_request_received',
        '선지급 신청 접수',
        '[사주플랜 선지급]\n\n선지급 신청이 접수되었습니다.\n\n신청금액: #{amount}원\n\n오늘 일과 종료 후 처리 예정입니다.\n계좌로 입금되면 추가 알림을 드립니다.',
    ),
    (
        'payout_request_rejected',
        '선지급 신청 반려',
        '[사주플랜 선지급]\n\n선지급 신청이 반려되었습니다.\n\n신청금액: #{amount}원\n반려사유: #{reason}\n\n문의: 운영팀',
    ),
    (
        'payout_request_paid',
        '선지급 입금 완료',
        '[사주플랜 선지급]\n\n선지급 입금이 완료되었습니다.\n\n신청금액: #{amount}원\n수수료: #{fee}원\n원천징수: #{withholding}원\n실지급액: #{actual}원\n\n입금계좌: #{bank}',
    ),
]


def build_sql() -> str:
    rows = []
    for code, subject, msg in TEMPLATES:
        # SQL 문자열에 ' 가 있으면 ''로 escape
        msg_esc = msg.replace("'", "''")
        sub_esc = subject.replace("'", "''")
        rows.append(
            f"  ('{code}', '{sub_esc}', '{msg_esc}', '[]'::jsonb, true)"
        )
    values = ',\n'.join(rows)
    return f"""
INSERT INTO alimtalk_template (template_code, subject, message, buttons, is_active)
VALUES
{values}
ON CONFLICT (template_code) DO NOTHING;

SELECT '=== payout templates ===' AS section;
SELECT template_code, is_active, LEFT(message, 50) AS preview
  FROM alimtalk_template
 WHERE template_code LIKE 'payout_%'
 ORDER BY template_code;

SELECT '=== count ===' AS section;
SELECT COUNT(*)::int AS total
  FROM alimtalk_template
 WHERE template_code LIKE 'payout_%';
"""


def apply_one(label: str, host: str, env_file: str, pw: str) -> int:
    sql = build_sql()
    b64 = base64.b64encode(sql.encode("utf-8")).decode("ascii")
    inner = (
        f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" {env_file} | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    _, stdout, stderr = c.exec_command(f"bash -lc {repr(inner)}", get_pty=False)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(f"\n========== {label} ({host}) ==========")
    sys.stdout.write(out)
    if err.strip():
        sys.stderr.write(err)
    rc = stdout.channel.recv_exit_status()
    c.close()
    return rc


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS env var required", file=sys.stderr)
        return 1
    rc_total = 0
    for label, host, env_file in TARGETS:
        rc = apply_one(label, host, env_file, pw)
        if rc != 0:
            rc_total = rc
    return rc_total


if __name__ == "__main__":
    sys.exit(main())
