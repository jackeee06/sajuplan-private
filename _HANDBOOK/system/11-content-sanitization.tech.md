# [AI 전용] 콘텐츠 XSS 정화 — 기술 상세

## 핵심 함수

- `web/user/src/lib/sanitizeHtml.ts` → `sanitizeIntroHtml(raw)`
- `web/mng/src/lib/sanitizeHtml.ts` → 동일 (관리자 미리보기용)
- 구현: `DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })`
  - 2026-06-12 정규식 블랙리스트(`script`·`iframe`·`on이벤트`·`javascript:` URL 제거) → **DOMPurify 화이트리스트**로 전환.
  - 의존성 설치: `npm i dompurify --legacy-peer-deps` (기존 toast-editor react@17 peer 충돌 회피).

## 적용 지점 (dangerouslySetInnerHTML 호출부 전수)

모든 `dangerouslySetInnerHTML={{ __html: ... }}` 는 반드시 `sanitizeIntroHtml()` 를 거친다.

| 화면 | 파일:라인(±) |
|---|---|
| 알림 상세 | `web/user/src/pages/NotificationDetail.tsx:127` |
| 공지 상세 | `web/user/src/pages/NoticeDetail.tsx:107` |
| 이벤트 상세 | `web/user/src/pages/EventDetail.tsx:103` |
| 상담사 공지 상세 | `web/user/src/pages/CounselorMyNoticeDetail.tsx:104` |
| 상담사 소개글 | `web/user/src/components/CounselorDetailLayout.tsx:254` |
| 약관·처리방침 | `web/user/src/components/TermsModal.tsx:93` |
| 상담사 신청서 | `CounselorApplyDetail` (user + mng 양쪽) |
| 팝업 본문 | `web/user/src/components/PopupLayer.tsx` |
| **채팅(활성)** | `web/user/src/pages/ChatRoom.tsx:1510` |
| **채팅(다시보기)** | `web/user/src/pages/ChatLog.tsx:243` |

## 채팅 XSS (가장 위험했던 경로)

- 메시지 렌더 분기: `message_type` — `1`=text, `2`=HTML/이미지플래그, `3`=system.
- `message_type === 2` && `[img]` 접두 아님 → `dangerouslySetInnerHTML` 경로 → **사용자 주입 가능**.
- 전송 API `api/src/user/chat/chat.service.ts:493` — `VALUES (..., ${params.messageType ?? 1})` 로 **클라이언트가 보낸 message_type을 검증 없이 저장** (취약점 근원).
  - 회원이 직접 `{message:'<img onerror=...>', message_type:2}` POST → 201 (실증됨).
  - **방어는 현재 "렌더 직전 정화"(sanitizeIntroHtml)로 완결.** 차단 확인됨.
  - 🟡 (선택 후속) 서버단에서 사용자 message_type을 1로 클램프하면 근원 차단 가능 — `[img]` 이미지 경로(2 사용) 영향 확인 후 적용 검토. 미적용.

## 검증

- `e2e/tests/77-chat-xss.spec.ts` — 일회성 손가락 테스트(사전 시드 방+message_type=2 악성메시지 필요, 미시드 시 graceful skip).
  - 회원이 `<img src=x onerror="window.__XSS_FIRED__=true">악성HTML` 전송 → 상담사(`user_counselor_storage`)가 `/chat-log/{room}` 열람.
  - 단언: `__XSS_FIRED__ !== true` (스크립트 미실행) + 텍스트 노출 + img onerror 속성 0건.
  - 결과: PASS. 검증 후 prod 테스트 데이터(chat_room/chat_message) 즉시 삭제.

## 함정

- API_BASE/FILE_BASE 혼동(별개 이슈)과 무관 — 정화는 순수 프론트 렌더 단계.
- 정화는 **렌더 직전**에만 하면 충분 (저장값은 원본 보존 → 정책 바뀌어도 재정화 가능). 저장 시 정화하지 않는다.
- 새 `dangerouslySetInnerHTML` 추가 시 **반드시 `sanitizeIntroHtml` 경유** — 누락이 곧 XSS 구멍.

## 관련 메모리
- `[[reference-jwt-sub-string-compare]]` (같은 2026-06 보안점검 묶음)
