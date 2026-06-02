#!/usr/bin/env python3
"""더미 상담사 '이당직' 등록 — test + prod 양 서버 동시.

- 사진: web/user/public/img/이상담.jpg → 양 서버 uploads/member/ 로 SFTP
- DB: member + post_counselor + member_file 트랜잭션 INSERT
- m2net 등록 X (더미)

사용:
  set -a; source .env.local; set +a
  python tools/_register_dummy_counselor_dangjik.py
"""
from __future__ import annotations
import os, sys, time, secrets
from pathlib import Path
import paramiko

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

SSHPASS = os.environ.get("SSHPASS")
if not SSHPASS:
    print("✗ SSHPASS 환경변수 필요 — set -a; source .env.local; set +a", file=sys.stderr)
    sys.exit(2)

LOCAL_IMG = Path(r"C:\claudeworkspace\sajumoon\web\user\public\img\이상담.jpg")
if not LOCAL_IMG.exists():
    print(f"✗ 이미지 없음: {LOCAL_IMG}", file=sys.stderr)
    sys.exit(2)

# 양 서버 공통 stored_name (운영 컨벤션 <13ms>_<6char>.jpg)
STORED_NAME = f"{int(time.time()*1000)}_{secrets.token_hex(3)}.jpg"

TARGETS = [
    # (env, host, api_remote, psql_path)
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr",      "/usr/local/pgsql/bin/psql"),
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr",   "/usr/bin/psql"),
]

# 더미 상담사 데이터 — 임의값
MB_ID = "이당직"
NAME = "이당직"
NICKNAME = "이당직"
GENDER = "M"
CATEGORY = "사주"  # 타로/신점/사주/심리
HEADLINE = "국방의 의무를 다하며 인생 상담 드립니다"
HASHTAG1 = "포병전문상담"
HASHTAG2 = "K9상담"
BIO = "현역 군인이며 부대에서 후임들의 고민 상담을 도맡아 처리한 경험이 풍부합니다. 군 생활, 진로 고민, 인생 방향에 대한 조언을 드립니다."
INTRO = "안녕하세요. 포병으로 복무 중인 이당직입니다. K9 자주포 운용 경험과 인생 경험을 바탕으로 따뜻한 상담을 드리겠습니다."
SPECIALTY = "진로|군생활|인간관계"  # | 로 join
CALL_UNIT_COST = 1500  # 070 분당
CHAT_UNIT_COST = 1500
ROYALTY_PCT = 70

def run_target(env: str, host: str, api_remote: str, psql_path: str, filesize: int) -> bool:
    print(f"\n=== [{env}] {host}  ({api_remote}) ===", flush=True)
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username="root", password=SSHPASS,
                look_for_keys=False, allow_agent=False, timeout=30)
    transport = ssh.get_transport()
    if transport: transport.set_keepalive(15)

    try:
        # 1) 이미지 SFTP put
        sftp = ssh.open_sftp()
        remote_img = f"{api_remote}/uploads/member/{STORED_NAME}"
        print(f"  ▶ SFTP put → {remote_img} ({filesize:,} bytes)", flush=True)
        sftp.put(str(LOCAL_IMG), remote_img)
        sftp.close()

        # 2) SQL INSERT — PL/pgSQL DO 블록으로 단순화 (중복검사 포함)
        sql = f"""
\\set ON_ERROR_STOP on
DO $$
DECLARE
  v_id     bigint;
  v_dtmf   int;
BEGIN
  IF EXISTS (SELECT 1 FROM member WHERE mb_id = '{MB_ID}') THEN
    RAISE NOTICE '⚠ 이미 존재 — 건너뜀 (mb_id={MB_ID})';
    RETURN;
  END IF;

  SELECT COALESCE(MAX(dtmfno::int), 0) + 1 INTO v_dtmf
    FROM member WHERE dtmfno ~ '^[0-9]+$';

  INSERT INTO member (
    mb_id, password, name, nickname, gender,
    role, level, state, counselor_category,
    dtmfno, counselor_priority,
    call_unit_seconds, call_070_unit_cost, call_060_unit_cost,
    chat_unit_seconds, chat_unit_cost, preflag,
    paid_royalty_pct, free_royalty_pct,
    use_phone, use_chat, is_rising
  ) VALUES (
    '{MB_ID}', 'DUMMY_NO_LOGIN_HASH', '{NAME}', '{NICKNAME}', '{GENDER}',
    'counselor', 5, 'IDLE', '{CATEGORY}',
    v_dtmf::text, 1,
    30, {CALL_UNIT_COST}, 0,
    30, {CHAT_UNIT_COST}, 'P',
    {ROYALTY_PCT}, {ROYALTY_PCT},
    true, true, false
  )
  RETURNING id INTO v_id;

  INSERT INTO post_counselor (
    member_id, title, headline, hashtag1, hashtag2, specialty, bio, intro
  ) VALUES (
    v_id, '{NICKNAME}', '{HEADLINE}', '{HASHTAG1}', '{HASHTAG2}',
    '{SPECIALTY}', '{BIO}', '{INTRO}'
  );

  INSERT INTO member_file (
    member_id, no, kind, source_name, stored_name, filesize, file_type
  ) VALUES (
    v_id, 1, 'profile', '이상담.jpg', '{STORED_NAME}', {filesize}, 1
  );

  RAISE NOTICE '✓ 등록 완료 — member.id=%, dtmfno=%', v_id, v_dtmf;
END $$;
"""
        # SQL 파일 업로드 후 psql 로 실행
        sftp = ssh.open_sftp()
        tmp_sql = f"{api_remote}/.tmp_register_dangjik.sql"
        with sftp.file(tmp_sql, "w") as f:
            f.write(sql)
        sftp.close()

        cmd = (
            f"cd '{api_remote}' && "
            f"DB_URL=\"$(grep ^DATABASE_URL .env | sed 's/DATABASE_URL=//;s/^\"//;s/\"$//')\" && "
            f"{psql_path} \"$DB_URL\" -f .tmp_register_dangjik.sql; "
            f"rc=$?; rm -f .tmp_register_dangjik.sql; exit $rc"
        )
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        rc = stdout.channel.recv_exit_status()
        print(out, end="")
        if err.strip():
            print("STDERR:", err, file=sys.stderr)
        if rc != 0:
            print(f"  ✗ psql rc={rc}", file=sys.stderr)
            return False

        # 확인 쿼리
        verify_cmd = (
            f"cd '{api_remote}' && "
            f"DB_URL=\"$(grep ^DATABASE_URL .env | sed 's/DATABASE_URL=//;s/^\"//;s/\"$//')\" && "
            f"{psql_path} \"$DB_URL\" -c \"SELECT m.id, m.mb_id, m.nickname, m.dtmfno, pc.hashtag1, pc.hashtag2, mf.stored_name FROM member m LEFT JOIN post_counselor pc ON pc.member_id=m.id LEFT JOIN member_file mf ON mf.member_id=m.id AND mf.kind='profile' WHERE m.mb_id='{MB_ID}'\""
        )
        stdin, stdout, stderr = ssh.exec_command(verify_cmd, timeout=30)
        print("\n  --- 확인 ---")
        print(stdout.read().decode("utf-8", errors="replace"))
        return True
    finally:
        ssh.close()

def main() -> int:
    filesize = LOCAL_IMG.stat().st_size
    print(f"▸ stored_name: {STORED_NAME}")
    print(f"▸ filesize: {filesize:,}")
    ok = True
    for env, host, api_remote, psql_path in TARGETS:
        if not run_target(env, host, api_remote, psql_path, filesize):
            ok = False
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
