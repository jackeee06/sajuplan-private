"""상담사 신청 더미 샘플 10건 INSERT (test + prod 양쪽).

어드민 신청 내역 화면 확인용. 종류(application/inquiry/other) x 상태 조합으로
한눈에 보이게 분포.

사용: SSHPASS=<pw> python tools/_seed_apply_samples.py
"""
from __future__ import annotations

import base64
import json
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
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajuplan.com/.env"),
]

# 10건 샘플 — (title, content, category, status, phone, email, extras_dict, created_offset_days)
# extras 는 어드민 컬럼(예명/실명/분야/지역/사진/계약서)에 잡히는 키들.
SAMPLES = [
    # 1) application + pending (풀폼, 사진/계약서 포함)
    {
        "title": "사주 상담사로 지원합니다",
        "content": "<p>안녕하세요. 10년 경력의 사주 상담사 김민준입니다. 정성껏 상담드리겠습니다.</p>",
        "category": "application",
        "status": "pending",
        "phone": "01011112201",
        "email": "minjun@example.com",
        "extras": {
            "real_name": "김민준",
            "pen_name": "민준선생",
            "field": "사주",
            "region": "서울",
            "birth": "1985-03-12",
            "specialties": ["연애운", "재물운", "취업운"],
            "profile_photo_url": "/uploads/counselor-apply/sample_profile_1.jpg",
            "contract_files": [
                {"url": "/uploads/counselor-apply/sample_contract_1.pdf",
                 "original_name": "사업자등록증.pdf", "size": 102400}
            ],
            "mb_id": "minjun85",
            "password_hash": "$2a$10$SAMPLEHASHFORSEEDINGPURPOSEONLY00000000000000000",
        },
        "offset_days": 0,
    },
    # 2) application + pending (풀폼, 사진만)
    {
        "title": "타로 상담사 지원합니다",
        "content": "<p>15년 경력 타로 마스터입니다. 깊이 있는 상담 약속드립니다.</p>",
        "category": "application",
        "status": "pending",
        "phone": "01011112202",
        "email": "seoyeon@example.com",
        "extras": {
            "real_name": "이서연",
            "pen_name": "서연도사",
            "field": "타로",
            "region": "부산",
            "birth": "1980-07-22",
            "specialties": ["연애운", "결혼운"],
            "profile_photo_url": "/uploads/counselor-apply/sample_profile_2.jpg",
            "mb_id": "seoyeon80",
            "password_hash": "$2a$10$SAMPLEHASHFORSEEDINGPURPOSEONLY00000000000000000",
        },
        "offset_days": 1,
    },
    # 3) application + accepted (이미 승인된 케이스)
    {
        "title": "신점 상담 신청드립니다",
        "content": "<p>20년 경력의 신점 선생입니다.</p>",
        "category": "application",
        "status": "accepted",
        "phone": "01011112203",
        "email": "jiho@example.com",
        "extras": {
            "real_name": "박지호",
            "pen_name": "지호선녀",
            "field": "신점",
            "region": "대구",
            "birth": "1975-11-05",
            "specialties": ["건강운", "사업운"],
            "profile_photo_url": "/uploads/counselor-apply/sample_profile_3.jpg",
            "approved_at": "2026-05-10T10:30:00+09:00",
            "created_mb_id": "jiho75",
        },
        "offset_days": 7,
    },
    # 4) application + rejected (반려 — 사유 포함)
    {
        "title": "사주 상담 지원합니다",
        "content": "<p>경력 짧지만 열심히 하겠습니다.</p>",
        "category": "application",
        "status": "rejected",
        "phone": "01011112204",
        "email": "sua@example.com",
        "extras": {
            "real_name": "정수아",
            "pen_name": "수아선생",
            "field": "사주",
            "region": "인천",
            "birth": "1995-04-18",
            "specialties": ["연애운"],
            "profile_photo_url": "/uploads/counselor-apply/sample_profile_4.jpg",
            "rejection_reason": "경력 증빙 부족 — 추가 자료 확인 후 재신청 부탁드립니다.",
            "rejected_at": "2026-05-12T15:00:00+09:00",
        },
        "offset_days": 5,
    },
    # 5) application + cancelled (본인이 취소)
    {
        "title": "상담사 지원 (취소)",
        "content": "<p>다른 일정으로 취소합니다.</p>",
        "category": "application",
        "status": "cancelled",
        "phone": "01011112205",
        "email": "doyoon@example.com",
        "extras": {
            "real_name": "최도윤",
            "pen_name": "도윤도사",
            "field": "타로",
            "region": "광주",
            "birth": "1988-09-30",
            "specialties": ["취업운"],
        },
        "offset_days": 3,
    },
    # 6) application + superseded (같은 휴대폰으로 새 신청 들어와 자동 대체)
    {
        "title": "사주 상담사 지원 (구버전)",
        "content": "<p>처음 작성한 신청서</p>",
        "category": "application",
        "status": "superseded",
        "phone": "01011112206",
        "email": "jiwoo.old@example.com",
        "extras": {
            "real_name": "한지우",
            "pen_name": "지우선생",
            "field": "사주",
            "region": "서울",
            "birth": "1983-06-14",
            "specialties": ["재물운"],
        },
        "offset_days": 10,
    },
    # 7) inquiry + pending (간단 문의 — 풀폼 필드 없음)
    {
        "title": "상담사 지원 절차 문의드립니다",
        "content": "<p>지원 후 몇 일 정도 후에 결과를 받을 수 있나요? 또 필요한 서류가 사업자등록증 외에 더 있는지 궁금합니다.</p>",
        "category": "inquiry",
        "status": "pending",
        "phone": "01011112207",
        "email": "minseo@example.com",
        "extras": {"real_name": "강민서"},
        "offset_days": 0,
    },
    # 8) inquiry + pending (이메일 없음)
    {
        "title": "정산 정책 문의",
        "content": "<p>상담료 정산 주기와 수수료 비율이 어떻게 되는지 알 수 있을까요?</p>",
        "category": "inquiry",
        "status": "pending",
        "phone": "01011112208",
        "email": None,
        "extras": {"real_name": "윤하린"},
        "offset_days": 1,
    },
    # 9) other + pending (기타 문의)
    {
        "title": "광고 제휴 문의",
        "content": "<p>사주플랜 사이트와 광고 제휴를 진행하고 싶은데 담당자 연결 부탁드립니다.</p>",
        "category": "other",
        "status": "pending",
        "phone": "01011112209",
        "email": "dohyun@example.com",
        "extras": {"real_name": "임도현"},
        "offset_days": 0,
    },
    # 10) other + pending (앱 사용 관련 문의)
    {
        "title": "결제 오류 신고",
        "content": "<p>어제 충전 결제했는데 코인이 안 들어왔습니다. 확인 부탁드립니다.</p>",
        "category": "other",
        "status": "pending",
        "phone": "01011112210",
        "email": "aein@example.com",
        "extras": {"real_name": "노아인"},
        "offset_days": 0,
    },
]


def build_sql() -> str:
    rows = []
    for s in SAMPLES:
        title = s["title"].replace("'", "''")
        content = s["content"].replace("'", "''")
        extras_json = json.dumps(s["extras"], ensure_ascii=False).replace("'", "''")
        email = f"'{s['email']}'" if s.get("email") else "NULL"
        phone = s["phone"]
        category = s["category"]
        status = s["status"]
        offset_days = s.get("offset_days", 0)
        rows.append(
            f"(NULL, NULL, '{title}', '{content}', '{category}', "
            f"'{phone}', {email}, '{status}', false, "
            f"'{extras_json}'::jsonb, 0, "
            f"now() - interval '{offset_days} days', "
            f"now() - interval '{offset_days} days')"
        )
    values_sql = ',\n  '.join(rows)
    return f"""
INSERT INTO post_apply
  (member_id, mb_id, title, content, category, applicant_phone, applicant_email,
   status, is_secret, extras, view_count, created_at, updated_at)
VALUES
  {values_sql};

-- 확인 — 종류/상태별 카운트
SELECT category, status, count(*)
  FROM post_apply
 WHERE category IN ('application','inquiry','other')
 GROUP BY category, status
 ORDER BY category, status;

-- 전체 건수
SELECT count(*) AS total FROM post_apply WHERE category IS DISTINCT FROM 'notice';
"""


def apply_one(label: str, host: str, env_file: str, pw: str, sql: str) -> int:
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
    print(f"========== {label} ({host}) ==========")
    sys.stdout.write(out)
    if err.strip():
        sys.stderr.write(err)
    rc = stdout.channel.recv_exit_status()
    c.close()
    return rc


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 환경변수 필요", file=sys.stderr)
        return 1
    sql = build_sql()
    rc_total = 0
    for label, host, env_file in TARGETS:
        rc = apply_one(label, host, env_file, pw, sql)
        if rc != 0:
            rc_total = rc
    return rc_total


if __name__ == "__main__":
    sys.exit(main())
