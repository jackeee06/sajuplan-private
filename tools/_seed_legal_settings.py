"""Phase 14 — 약관/개인정보처리방침 setting 시드.

namespace='legal' 에 4개 키 — 어드민이 수정 가능, 사용자 가입 화면에서 노출.
"""
from __future__ import annotations
import base64
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import paramiko

TARGETS = [
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr/.env"),
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajuplan.com/.env"),
]

DEFAULT_TERMS = """제1조 (목적)
본 약관은 사주플랜(이하 "회사")이 제공하는 사주/타로/신점 상담 서비스(이하 "서비스")의 이용과 관련하여 회사와 회원의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "회원"이란 본 약관에 동의하고 서비스 이용 자격을 부여받은 자를 말합니다.
2. "상담사"란 회사의 심사를 통해 서비스 내 상담을 제공할 수 있는 자격을 부여받은 자를 말합니다.

제3조 (이용계약의 성립)
이용계약은 회원이 약관에 동의하고 회원가입을 신청한 후 회사가 승낙함으로써 성립합니다.

(※ 본 본문은 초안입니다. 정식 약관은 법무 검토 후 어드민 → 설정 → 약관 탭에서 교체하세요.)"""

DEFAULT_PRIVACY = """제1조 (개인정보의 수집 및 이용 목적)
회사는 다음의 목적을 위해 개인정보를 수집·이용합니다.
1. 서비스 회원가입 및 본인 확인
2. 상담 서비스 제공 및 결제 처리
3. 고객 문의 응대 및 분쟁 처리

제2조 (수집하는 개인정보 항목)
- 필수: 아이디, 비밀번호, 휴대전화번호, 닉네임
- 선택: 이메일, 생년월일

제3조 (개인정보의 보유 및 이용 기간)
회원 탈퇴 시까지 보유. 단, 관계 법령에 따라 보존이 필요한 경우는 해당 기간 동안 보유.

(※ 본 본문은 초안입니다. 정식 처리방침은 법무 검토 후 어드민 → 설정 → 개인정보 탭에서 교체하세요.)"""


def make_seed_sql():
    terms_q = DEFAULT_TERMS.replace("'", "''")
    privacy_q = DEFAULT_PRIVACY.replace("'", "''")
    return f"""
INSERT INTO setting (namespace, key, value) VALUES
  ('legal', 'terms.title',   '회원가입약관'),
  ('legal', 'terms.body',    '{terms_q}'),
  ('legal', 'privacy.title', '개인정보처리방침'),
  ('legal', 'privacy.body',  '{privacy_q}')
ON CONFLICT (namespace, key) DO NOTHING;

SELECT '=== legal settings ===' AS section;
SELECT key, LEFT(value, 60) AS preview, LENGTH(value) AS len
  FROM setting WHERE namespace='legal' ORDER BY key;
"""


def apply_one(label: str, host: str, env_file: str, pw: str) -> int:
    sql = make_seed_sql()
    b64 = base64.b64encode(sql.encode("utf-8")).decode("ascii")
    inner = (
        f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" {env_file} | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    _, stdout, _ = c.exec_command(f"bash -lc {repr(inner)}", get_pty=False)
    out = stdout.read().decode("utf-8", errors="replace")
    rc = stdout.channel.recv_exit_status()
    print(f"\n========== {label} ({host}) ==========")
    print(out)
    c.close()
    return rc


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        return 1
    rc = 0
    for label, host, env_file in TARGETS:
        r = apply_one(label, host, env_file, pw)
        if r != 0:
            rc = r
    return rc


if __name__ == "__main__":
    sys.exit(main())
