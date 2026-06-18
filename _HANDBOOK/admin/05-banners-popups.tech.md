# [AI 전용] 배너·팝업 — 기술 상세

## DB

```
banner
- id, image_url, link_url, valid_from, valid_until, is_active, order_no

popup_layer
- id, content (HTML), valid_from, valid_until, is_active
- display_rule — '매번' / '하루1회' / '7일1회'
```

## 컴포넌트

### 사용자 측 (회원 화면)
- 홈 배너 슬라이드
- `web/user/src/components/MaintenanceBanner.tsx` (점검)
- `FavoriteCounselorBanner.tsx` (단골)
- `CounselorIncomingBanner.tsx` (incoming)

### 운영자 측 (배너 등록)
- `/mng/banners`, `/mng/popup-layers`
- 코드: `api/src/admin/banners/banners.service.ts`, `popup-layers/popup-layers.service.ts`

## WebView 외부 URL

배너 클릭 → 외부 사이트 → `openExternalUrl()` 필요 (메모리 `[[webview-external-url]]`)

## localStorage 키 (팝업 노출 제한)

- `popup_seen_{popupId}_{YYYYMMDD}` — 하루 1회
- `popup_dont_show_{popupId}` — 영구 안 보기 (사용자 선택)

## ⚠️ 현실 점검 (2026-06-12 5순위 정밀검증) — 문서 vs 실제

위 "localStorage 팝업 노출 제한" 설명은 **설계안일 뿐 실제로는 미구현**이다. 코드 정독 결과:

- ✅ **팝업레이어(popup_notice) 사용자 노출 — 2026-06-12 신설 완료.** (이전엔 사용자 노출 API·렌더가 0건이라 관리자 등록해도 고객 화면에 안 떴음)
  - 백엔드: `api/src/user/popups/` (controller+service+module, `GET /api/user/popups` 공개) — `is_active=true` + 기간 내 + `device IN ('both','mobile')` 만 반환.
  - 프론트: `web/user/src/components/PopupLayer.tsx` — 홈(`Home.tsx`) 진입 시 활성 팝업을 모달로 순차 노출. content(HTML) `sanitizeIntroHtml` 정화, 이미지/링크 클릭 `openExternalUrl`(WebView 안전).
  - "오늘 하루 보지 않기": `localStorage popup_hide_until_{id}` = now + `disable_hours`×3600s. 만료 전엔 숨김.
  - 검증: `e2e/tests/71-popup-layer.spec.ts` (API 200 + 홈 렌더 무예외).
- 🟠 **배너 위치 2종 미노출** — admin 등록 가능 position 3종 중 사용자측은 `메인-상단배너`만 소비. `메인-중앙배너`·`회원가입완료` 는 등록해도 안 보임.
- ✅ **배너 외부링크 WebView 수정(2026-06-12)** — 홈 배너 `http(s)` 링크가 `target="_blank"`(앱 먹통)였던 것 → `openExternalUrl()` 로 교체(`web/user/src/pages/Home.tsx`).
- 🟡 admin 배너목록 "진행중" 필터가 is_active 미반영(표시 혼동), UploadedImage onError 폴백 없음(깨진 이미지 그대로) — 보고.
- ✅ 견고: 노출 스케줄(timestamptz `now()` 비교), CRUD 가드(AdminAuthGuard+sub정규화), 정렬(display_order), 업로드 검증.

## 팝업 — 대상 구분 + 에디터 + 이미지 업로드 수정 (2026-06-12)

- ✅ **이미지 업로드 404 fix**: 폼이 이미지를 `FILE_BASE`(/api 없는 origin)로 POST → "Cannot POST /admin/popup-layers/:id/image". 표준 `API_BASE`(/api 포함)로 교체(`PopupLayerForm.tsx`). 검증 spec 73(옛 경로 404 / 새 경로 200).
- ✅ **대상(audience) 구분 신설**: `popup_notice.audience` 컬럼(`all`/`member`/`counselor`, 기본 `all`). 마이그레이션 `20260612010000_popup_audience.sql`.
  - 노출 규칙(사용자 `GET /api/user/popups?area=home|counselor`, OptionalUser 로 role 판별):
    - `area=home`(홈): 비로그인 → `all` / 로그인 → `all`+`member`
    - `area=counselor`(상담사 마이페이지): 상담사 계정만 → `all`+`counselor`, 그 외 → 없음
  - 프론트: `Home.tsx` `<PopupLayer area="home" />`, `CounselorMyPage.tsx` `<PopupLayer area="counselor" />`.
  - 검증 spec 74(전체/회원/상담사 × 익명/상담사계정 노출 매트릭스).
- ✅ **본문 에디터**: textarea → `HtmlEditor`(Toast UI, 공지/이벤트 폼과 동일 컴포넌트). 굵게·이미지·링크 WYSIWYG. 저장 시 `getHTML()` → content, `is_html=true` 고정. 노출 시 `sanitizeIntroHtml` 정화(XSS 방어).
- 관리자 폼 "대상" 셀렉트 추가(대상 기기 아래).

## 관련 메모리

- `[[webview-external-url]]`
