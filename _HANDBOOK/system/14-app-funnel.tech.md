# [AI 전용] 앱 유입 깔때기 + 상담사 링크 공유 — 기술 상세

## 정책 (2026-06-25, 사장님 확정)
목표: 웹 사용 최소화·앱 유도. **단 검색 페널티 행동 금지.**
- 금지 ①클로킹(봇=콘텐츠 / 사람=벽) ②전면 설치 인터스티셜(본문 가림).
- 기존 하드 게이트 `WebAppGate`(`WEB_OPEN=false`)는 위 둘 동시 위반 → **켜지 않음**(현행 `WEB_OPEN=true` 유지).
- 채택: **콘텐츠/행동 분리** — 공개 프로필은 봇과 동일 노출(클로킹 아님), 행동(전화·채팅)만 앱 유도(콘텐츠 안 가리니 SEO 무관).

## 행동 게이트 (전화·채팅) — 전부 웹만, 앱 재빌드 불필요

### 판정 헬퍼 `web/user/src/lib/app-gate.ts`
```ts
shouldGateAppAction(): boolean
  // false(통과): isNativeApp() | navigator.webdriver(E2E) | localStorage.__allow_web__='1'
  // true(앱 유도): 그 외 일반 웹 브라우저
detectMobileOS(): 'ios'|'android'|'other'
STORE_FALLBACK_AOS = 'https://play.google.com/store/apps/details?id=com.dmonster.sajumoon'
STORE_FALLBACK_IOS = 'https://apps.apple.com/kr/app/id6761353255'
```
- 예외 규칙은 `WebAppGate.shouldGate()` 와 동일하게 맞춤 → **기존 상담 E2E 불변**(자동화는 게이트 통과해 기존 모달 경로 유지).

### 단일 choke point — `web/user/src/lib/consult-context.tsx`
- `openConsult(counselor, variant)` 는 카드(`CounselorCard`)·상세(`CounselorDetailLayout`) **공통 진입점**. 여기 1곳만 막아 전화·채팅 전부 커버.
```ts
if (shouldGateAppAction()) { setAppGateOpen(true); return }  // 웹 → 앱 유도 시트
setOpen(true)                                                // 앱/E2E → 기존 ConsultModal
```
- 렌더: `<ConsultModal>` 옆에 `<AppRequiredSheet>` 동시 마운트.

### 앱 유도 시트 `web/user/src/components/AppRequiredSheet.tsx`
- ShareBottomSheet 동일 바텀시트 골격(slideUp, max-w 600). 앱 아이콘 + 상담사 미리보기 + OS별 스토어 버튼.
- 스토어 URL = `appVersionApi.get()`(setting namespace='app') 실값, 실패 시 STORE_FALLBACK.
- testid: `app-required-sheet`, `app-required-store-btn`.

## 상담사 "내 상담실 링크 공유하기" — `web/user/src/pages/CounselorMyPage.tsx`
- 위치: **"상담사 관리" 섹션 바로 위**, 가로 풀폭 핑크 버튼. testid `counselor-share-room-btn`.
- 동작: 기존 `ShareBottomSheet` 오픈, `shareUrl = ${origin}/counselors/${member.id}`.
- 공유 설명 동적 구성: `counselorsApi.detail(member.id)` 로드 → `setShareInfo({desc,title})`.
  - `lead = (headline?.trim() || stripHtml(intro) || stripHtml(bio)).slice(0,60)`
  - `desc = [lead, fields(4), traits(3)].join(' · ').slice(0,90)` (fallback `${cat} 상담사`)
  - `title = ${displayName} (${cat} 상담사)`. effect deps `[member]`, displayName 은 클로저 캡처(콜백 실행 시점 정의됨).

## 공유 시트 — `web/user/src/components/ShareBottomSheet.tsx`
- **링크복사 1순위 재배치**: 미리보기 카드 아래 가로 풀폭 "링크 복사하기"(testid `share-copy-primary`) + 안내 "💡 카톡엔 링크복사가 가장 확실해요 — 복사 후 원하는 채팅방에 붙여넣기". 그 아래 "다른 방법으로 공유" 캡션 + 기존 4채널(카톡/인스타/페북/링크복사) 그리드 유지.
- 이유: 카카오 SDK `sendDefault` 는 ①PC 공유창이 받는 사람 미리 선택(오발송) ②안드 카톡 실패 이력. 링크복사=받는 사람 직접 선택 + 서버 OG 스크랩(풍성) + 무조건 도착.
- ⚠️ 이 컴포넌트는 상담사 마이페이지 + 일반 상담사 상세페이지 공유에 **공용** → 변경 시 양쪽 영향.

## 서버 OG 풍성화 (링크복사 카드) — `api/src/user/seo/seo.service.ts`
- `renderCounselorDetail` 의 `og:description` 을 클라 SDK 카드와 동일 구성으로:
```ts
const lead = (c.headline?.trim() || stripHtml(c.intro||'') || stripHtml(c.bio||'')).slice(0,60)
const descSrc = [lead, c.fields.slice(0,4).join(', '), c.traits.slice(0,3).join(', ')]
                  .filter(Boolean).join(' · ') || fallback
truncate(descSrc, 155)
```
- 배경: 링크복사 카드는 **서버 OG 스크랩** → 기존엔 headline 만이라 단조로웠음. SDK 카드(클라 props)는 이미 풍성 → 양쪽 일치시킴.
- 배포: `_patch_api.py`(FILES 에 seo.service 포함) → pm2 `sajumoon-api`, 경로 `/data/wwwroot/api.sajumoon.co.kr`. 렌더 캐시 10분(pm2 reload 시 클리어).
- ⚠️ **카카오 OG 스크랩 캐시** — 이미 공유된 링크는 옛 설명 잔존 가능. 강제 갱신=카카오 개발자 콘솔 캐시 초기화(사장님 계정) or 자연 만료.

## 검증
- `e2e/tests/117-app-funnel-and-share.spec.ts` 4/4:
  1. webdriver=false 덮어쓰기(`addInitScript`) → 일반 웹 흉내 → 전화상담 클릭 → 콘텐츠 보임 + `app-required-sheet` 노출 + 상담 모달 미노출.
  2. 채팅상담 동일(채팅 가능 상담사 없으면 skip).
  3. webdriver=true(기본) → 게이트 통과(시트 미노출) = 기존 상담 흐름 보호.
  4. 상담사 storageState → /counselor/mypage → 공지 팝업 닫고 → 공유 버튼 → dialog '공유하기' + `share-copy-primary` + 안내문구.
- `114-seo-rendering` 6/6 회귀 통과(OG 태그 존재만 검사 → 풍성화 무영향).

## 미구현 (의도적)
- 상시 앱설치 배너(레이아웃 리스크) / 코인충전 게이트(매출·머니크리티컬 인접, 명시확인 후) / 딥링크 자동 앱열기(앱 재빌드+스토어, 설계 `_APP_DEEPLINK_SPEC.md`).

## 앱 식별자 / 관련
- iOS·Android 공통 `com.dmonster.sajumoon`. 인앱 감지 `isNativeApp()` = `window.SajumoonBridge?.isNative`(앱이 주입, UA suffix 도 부여).
- `[[project-app-funnel-seo-safe]]` `[[project-seo-dynamic-rendering]]` `[[project-mobile-deep-link-status]]` `[[project-kakao-button-deeplink-backlog]]`
