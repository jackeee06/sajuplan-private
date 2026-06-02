"""테스트용 문의 더미 데이터 삽입 (jackee=91, ubub1234=136 양쪽)."""
import base64, os, sys, paramiko

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"],
          allow_agent=False, look_for_keys=False, timeout=15)


def run(sql: str) -> str:
    b64 = base64.b64encode(sql.encode()).decode()
    cmd = (
        'export DATABASE_URL=$(grep -E "^DATABASE_URL=" '
        '/data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=30)
    result = out.read().decode()
    error = err.read().decode()
    if error:
        print("ERR:", error, file=sys.stderr)
    return result


# 1) 더미 문의 삽입 (has_reply 컬럼 없음 — reply 테이블로 판별)
print(run("""
INSERT INTO counselor_qna (member_id, counselor_id, title, content, is_secret, created_at)
VALUES
  (91,  102, '[테스트] 답변 전 문의 — ⋮ 수정·삭제 가능',
   '이 문의는 답변이 없습니다. ⋮ 버튼을 클릭해 수정·삭제 메뉴를 확인하세요.', false, NOW()),
  (91,  102, '[테스트] 비밀글 문의 — 수정·삭제 가능',
   '비밀글 문의입니다. ⋮ 버튼으로 수정·삭제 가능합니다.', true, NOW() - interval '5 minutes'),
  (91,  102, '[테스트] 답변 완료 — ⋮ 메뉴 없음',
   '상담사 답변이 달린 문의입니다. ⋮ 버튼이 표시되지 않습니다.', false, NOW() - interval '1 hour'),
  (136, 91,  '[테스트] 답변 전 문의 — ⋮ 수정·삭제 가능',
   '이 문의는 답변이 없습니다. ⋮ 버튼을 클릭해 수정·삭제 메뉴를 확인하세요.', false, NOW()),
  (136, 91,  '[테스트] 답변 완료 — ⋮ 메뉴 없음',
   '상담사 답변이 달린 문의입니다. ⋮ 버튼이 표시되지 않습니다.', false, NOW() - interval '1 hour')
RETURNING id, member_id, title;
"""))

# 2) reply 테이블 컬럼 확인 후 삽입
print(run(
    "SELECT column_name FROM information_schema.columns "
    "WHERE table_name='counselor_qna_reply' ORDER BY ordinal_position;"
))

print(run("""
INSERT INTO counselor_qna_reply (qna_id, counselor_id, content, created_at)
SELECT q.id, q.counselor_id, '테스트 답변입니다. 답변이 달린 문의는 수정·삭제할 수 없습니다.', NOW()
FROM counselor_qna q
WHERE q.title = '[테스트] 답변 완료 — ⋮ 메뉴 없음'
  AND q.member_id IN (91, 136)
ON CONFLICT DO NOTHING
RETURNING qna_id;
"""))

print("완료")
c.close()
