-- 한 사용자가 같은 게시물을 중복 신고할 수 없도록 unique index 추가
-- reporter_id IS NOT NULL 조건: 탈퇴 회원(NULL) 행은 제외

CREATE UNIQUE INDEX IF NOT EXISTS uq_post_report_one_per_user
  ON post_report (board_slug, post_id, reporter_id)
  WHERE reporter_id IS NOT NULL;
