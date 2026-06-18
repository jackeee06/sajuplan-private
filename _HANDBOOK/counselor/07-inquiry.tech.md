# [AI 전용] 상담사 고객센터 문의 — 기술 상세

## 테이블 (단일 공유)
`counselor_inquiry` — 상담사 작성측(user)과 운영자 답변측(admin)이 **같은 테이블** 공유.
- 주요 컬럼: `id, member_id, mb_id, category, title, content, photos, status('pending'|'answered'), is_hidden, ip, created_at, updated_at`
- 답변 컬럼: `reply_content, reply_admin_id, reply_admin_name, replied_at`

## 코드 위치
| 구분 | 파일 |
|---|---|
| 상담사 작성/조회 | `api/src/user/counselor-mypage-inquiry/counselor-mypage-inquiry.{service,controller}.ts` |
| 운영자 답변 | `api/src/admin/counselor-inquiries/counselor-inquiries.{service,controller}.ts` |
| 관리자 화면 | `web/mng` → 라우트 `/counselor-inquiries` |

## 엔드포인트
**상담사(user):**
- `GET  /api/user/counselor-mypage-inquiry?category=` — 본인 문의 목록
- `GET  /api/user/counselor-mypage-inquiry/:id` — 상세
- `POST /api/user/counselor-mypage-inquiry` — 작성 (category/title/content/photos). 작성 시 운영자 알림 발송.
- 숨김: `is_hidden=true` (작성자 삭제 개념)

**운영자(admin):**
- `GET    /api/admin/counselor-inquiries?status=pending|answered` — 목록(상태 필터)
- `GET    /api/admin/counselor-inquiries/:id` — 상세
- `POST   /api/admin/counselor-inquiries/:id/reply` — 답변 등록/수정 → `status='answered'`, `reply_admin_name=OPERATOR_LABEL('운영팀')`, `replied_at=now()`
- `DELETE /api/admin/counselor-inquiries/:id/reply` — 답변 삭제 → `status='pending'` 복귀

## 흐름 요약
상담사 작성 → `counselor_inquiry` INSERT(status=pending) + 운영자 알림 → 운영자 reply → status=answered → 상담사 마이페이지에서 답변 확인.

## 함정
- **회원 문의(Q&A, `post_qa`)와 다른 테이블·다른 화면.** 섞지 말 것. (이건 상담사→운영팀, Q&A는 회원→상담사)
- 답변자명은 항상 `OPERATOR_LABEL`('운영팀') — 개인 관리자명 노출 안 함 (의도).
- 시안 단계 mock 이던 "상담사 문의하기"를 정식 연결한 기능.

## 관련
- 메모리 `project_counselor_inquiry_done`
- [상담사 마이페이지](counselor/06-mypage)
