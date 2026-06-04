# 🐛 버그 백로그

> **목적**: 발견된 버그를 잊지 않고 기록. 우선순위별 일괄 처리.
> **원칙**: 즉시 fix 안 해도 OK. 큰 흐름 막지 않기.
> **검토 주기**: 정식 운영 준비 시점에 일괄 리뷰.

## ✅ B-008 — 상담사 상세 공지사항 HTML 태그 노출 + 탭 scroll — RESOLVED (2026-06-04)

**발견**: 2026-06-04 사장님 스크린샷 리포트
**심각도**: 🟠 High (사용자 화면에서 `<p><br></p>` 노출)
**상태**: ✅ 해결

### 버그 3가지
1. **공지사항 `<p><br></p>` 노출** — `whitespace-pre-line` 텍스트 렌더로 HTML 태그 그대로 출력
2. **탭 첫 클릭 시 히어로 이미지 위치까지 scroll top** — `ScrollToTop.tsx` 의 `navigationType` 의존성이 POP→REPLACE 전환 시 scroll=0 강제
3. **탭 중간에서 클릭해도 sticky 이동 안 됨** — scroll 로직 없음

### 수정 내용
- `CounselorDetail.tsx`: `noticeContent` 도 `sanitizeIntroHtml()` 적용
- `CounselorDetailLayout.tsx`:
  - 공지사항 `dangerouslySetInnerHTML` 렌더 전환 (HTML 태그 렌더링)
  - `DetailTabs`: `<Link>` → `<button>` + `useNavigate` 교체
  - `useEffect([activeTab])` — 탭 전환 시 `window.scrollTo(탭위치, smooth)` 추가
  - `data-testid="counselor-tab-area"` 추가 (E2E 기준점)
- `ScrollToTop.tsx`: deps `[pathname, navigationType]` → `[pathname]` (navigationType 변화 단독으론 scroll 리셋 안 함)
- `main.tsx`: `window.history.scrollRestoration = 'manual'` 추가 (브라우저 자동 scroll 복원 차단)

### E2E 검증
- `e2e/tests/28-counselor-detail-tabs.spec.ts` 신설 — 4/4 통과
  - 공지사항 HTML 태그 미노출
  - 탭 3개 버튼 존재 + 활성 전환
  - scrollTo 호출 의도 검증 (탭 위치 향)
  - URL 파라미터 변경 확인

### 관련 파일
- `web/user/src/pages/CounselorDetail.tsx`
- `web/user/src/components/CounselorDetailLayout.tsx`
- `web/user/src/components/ScrollToTop.tsx`
- `web/user/src/main.tsx`

---

## ✅ B-007 — CounselorReviewNew.tsx dead route — RESOLVED (2026-06-04 코드 확인)

**발견**: 2026-05-27 후기 5분 정책 엄격검증
**심각도**: 🟢 Low
**상태**: ✅ 해결 — 옵션 C 적용됨

### 해결 내용
`CounselorReviewNew.tsx` 가 폼 컴포넌트 → redirect 컴포넌트로 교체됨:
```tsx
export default function CounselorReviewNew() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/mypage/my-reviews/new?counselor_id=${id ?? ''}`} replace />
}
```
진입 즉시 `/mypage/my-reviews/new` 로 redirect → `MyReviewNew.tsx` 가 실제 저장 처리.

---

## 심각도 분류
- 🔴 **Critical** — 사용자 데이터 손실 / 결제 사고 / 사용자 광범위 영향. 즉시 fix.
- 🟠 **High** — 잦은 사용자 신고 / 핵심 기능 일부 작동 X. 빠른 시일 내 fix.
- 🟡 **Medium** — 가끔 발생 / 우회 가능. 정식 운영 전 fix.
- 🟢 **Low** — 코드 품질 / 엣지 케이스. 시간 날 때 fix.

---

## 🟡 B-006 — 5분 알림 기능 잔여 개선 사항 (2026-05-27 엄격 검증 1·2·3차)

**발견**: 2026-05-27 엄격 검증 후 (1차 → 2차 → 3차 누적)
**심각도**: 🟡 Medium
**상태**: 3차까지 누적 9건 발견 / 7건 해결 / 2건 잔존 (충전 시 재계산, iOS 호환성)

### ✅ 3차 검증에서 해결된 항목 (2026-05-27)

5. **chat_message [ALERT_5MIN] 멱등성이 채팅방 평생 1회** (T-1) — 결제 흐름의 결정적 누락
   → `NOT EXISTS LIKE '[ALERT_5MIN]%'` 제거. tick 트랜잭션 (FOR UPDATE) 가 한 tick = 한 번 진입 보장.
   → 충전 후 다시 5분 진입 시 두 번째 알림 정상 발화.

6. **alerts.enqueue 가 트랜잭션 안에서 호출** (T-2) — tx rollback 시 정합성 깨짐
   → tx 안에선 데이터만 채취 (`pendingFiveMinMemberId/CounselorId`), commit 후 `.then` 에서 enqueue.
   → consult_id 에 timestamp suffix (`${chatRoomId}-${Date.now()}`) — 같은 방 재진입 시 dedup 충돌 회피.

7. **ChatRoom fiveMinAlertSeen 이 ref 라 페이지 이동 후 reset** (T-3) — 재진입 시 중복 발화
   → sessionStorage 기반 (`chat5min_seen_${chatRoomId}`) — 같은 탭 내 페이지 이동 후 복귀 시 중복 모달/사운드/TTS/진동 차단.

8. **GlobalAlerts 가 401 무한 polling** (T-4) — 토큰 만료 시 백엔드 로그 + CPU 낭비
   → 401 응답 시 `pausedUntil = now + 5분` — 5분 동안 polling 일시 중단. 토큰 갱신 대기.

### ✅ 2차 검증에서 해결된 항목 (2026-05-27)

1. **ChatRoom 5분 모달이 상담사에게도 충전 버튼 표시** (1차 fix 빈틈)
   → ChatRoom.tsx 의 5분 모달에 `isMeCounselor` 분기 추가. 상담사는 "회원 5분 남았어요" + "마무리 멘트 안내" + [확인] 1버튼.
   → TTS 메시지도 분기 (`'5분 남았어요. 마무리 멘트를 안내해주세요.'`)

2. **전화 alert dedup key 누락** (연속 통화 시 두 번째 알림 누락 위험)
   → schedulePhoneFiveMinAlert(memberId, counselorId, callid) 로 callid 인자 추가.
   → alerts payload `data.consult_id = callid` 추가 → dedup 충돌 방지.

3. **전화 setTimeout 미정리** (통화 5분 안 종료 시 잘못된 알림)
   → `Map<callid, NodeJS.Timeout> phoneAlertTimers` 도입.
   → `cancelPhoneFiveMinAlert(callid)` 추가 + DISCONNECT/END_CHAT/NO_ANSWER_CSR 분기에서 호출.

4. **CONNECT_CSR 중복 콜백 시 setTimeout 중복 등록** (m2net retry 방어)
   → phoneAlertTimers.has(callid) 체크 → 같은 callid 면 두 번째 등록 skip.

### 잔여 이슈 2가지 (정식 운영 전 fix 권장)

1. **통화 중 충전 시 setTimeout 재계산 X**
   - 사용자 충전 → 종료 예상 시각 뒤로 미뤄지지만 알림은 처음 계산 기준 → 너무 빨리 발화
   - fix: 충전 callback (m2net-push 의 잔액 적립 분기) 시 해당 회원 active 통화의 phoneAlertTimers entry 들 cancel + reschedule
   - 영향: 사용자 충전 후 5분 알림이 실제 잔여보다 빨리 도착 — 약간 일찍 알리는 정도 (사용자 혼란 낮음)

2. **iOS Safari WebView 호환성**
   - AudioContext 자동 발화 차단 (사용자 인터랙션 후만 작동)
   - SpeechSynthesisUtterance 제한적 (iOS 13+ 권한 X)
   - navigator.vibrate iOS 미지원
   - iOS 사용자는 **시각 모달만** 받음
   - fix 옵션: FCM 푸시 발화 (앱 빌드 후), 또는 사용자 첫 인터랙션 시 AudioContext.resume() 시도

### 관련 파일
- api/src/pg-callbacks/m2net-push.service.ts (schedulePhoneFiveMinAlert/cancelPhoneFiveMinAlert)
- api/src/user/chat/chat.service.ts (tickRoom 5분 진입 감지)
- api/src/shared/alerts/alerts.service.ts (dedup 로직)
- web/user/src/pages/ChatRoom.tsx (5분 모달 + TTS)
- web/user/src/components/GlobalAlerts.tsx (triggerSensoryAlert)

---

## ✅ B-005 — TEST 서버 (172.235.211.75) 폐기 결정 — RESOLVED (2026-05-29)

**발견**: 2026-05-27 (자율 진행 중)
**심각도**: 🔴 → ⚪
**상태**: ✅ 해결 — TEST 서버 폐기 결정으로 이슈 자체 종결

### 경위
- 2026-05-27: 172.235.211.75 무응답 발견 (ping 100% 손실)
- 2026-05-29: **TEST 서버(sajumoon.kr) 폐기 공식 결정** (메모리 `project_test_server_sunset`)
- 2026-06-04: E2E TARGET 기본값 `test → prod` 변경 커밋 (`097d67a6`) 으로 완전 전환

### 현재 운영 방식
- **PROD 단일 배포** — sajuplan.com 만 운영
- E2E 전체 prod 대상 실행
- TEST 서버 복구 계획 없음

---

## ✅ B-001 — /mypage 비로그인 가드 발동 지연 — RESOLVED (false positive)

**발견**: 2026-05-25 (E2E 자동화 테스트)
**해결**: 2026-05-25 (분석 결과 spec 의 기대 오류)
**심각도**: 🟡 → ⚪ false positive
**상태**: ✅ 해결

### 진짜 원인
`/mypage` 는 **의도적으로 비로그인 시 환영 페이지를 노출** (MyPageEntry.tsx):
```ts
if (loading) return <loading UI>
if (!member) return <MyPage />   // 환영 + 로그인 버튼
return <MemberMyPage />
```
즉 비로그인 사용자에게 /login 으로 redirect 가 아니라 **환영 페이지를 노출하는 게 의도된 동작**. spec 08 의 기대가 잘못됐던 것.

### 실제 보호 페이지 가드는 정상
- `/mypage/charge` (Charge.tsx:244): `if (!member) <Navigate to="/login?redirect=/mypage/charge" replace />` → 정상
- `/counselor/mypage` (CounselorMyPage.tsx:232): 동일 패턴 → 정상

### Fix (2026-05-25)
spec 08 의 protectedPaths 에서 `/mypage` 제거. `/mypage/charge`, `/counselor/mypage` 만 가드 검증 — 양쪽 모두 정상 통과.

### 교훈
페이지 진입 가드 ≠ 모든 페이지가 /login 으로 redirect. UX 차원에서 일부 페이지는 환영/로그인 유도 fallback 을 노출하기로 한 설계 결정. E2E 가 그걸 알고 검증해야 함.

---

## 🟢 B-002 — E2E 06-spec flaky (단독 OK / 묶음 fail)

**발견**: 2026-05-25
**심각도**: 🟢 Low
**상태**: 미해결

### 재현
- `tests/06-user-mode-routing.spec.ts` 의 "공개 페이지 정상 로드" 시나리오
- 단독 실행: 통과
- 06+07+08 묶음 실행: 실패

### 추정 원인
- `page.on('pageerror', ...)`, `page.on('console', ...)` 리스너가 누적되거나 누수
- 테스트 간 격리 부족

### 영향
- 사용자 영향 0 (테스트 코드만의 문제)
- CI 안정성 ↓ (가짜 fail 가능성)

### 추정 fix 방향
- 각 페이지 검증 후 `page.off('pageerror', ...)` 정확히 호출
- 또는 각 페이지마다 새 page context 생성

### 관련 파일
- `e2e/tests/06-user-mode-routing.spec.ts:76`

---

## 🟢 B-003 — E2E 모드 전환 토스트 검증 실패 (timing)

**발견**: 2026-05-25 (Phase 2 자동화 실행)
**심각도**: 🟢 Low
**상태**: 미해결

### 재현
- `tests/09-dual-role-mode.spec.ts` "모드 전환 — 회원 → 상담사 토스트 발화"
- 회원 마이 진입 → "상담사 모드로" 버튼 클릭 → 토스트 발화 검증
- 실제: 토스트 표시되지만 expect 가 못 잡음 (2.2초 후 자동 사라짐 + Playwright 검증 타이밍)

### 영향
- 사용자 영향 0 (실 화면에선 정상 보임)
- 자동화 신뢰도만 ↓

### 추정 fix 방향
- 토스트 selector 더 명확히 (`role="status"` 가 이미 있음)
- 또는 expect.toBeVisible timeout 짧게 (1500ms)
- 또는 토스트가 발화하는 순간 즉시 검증 (트리거 후 immediately)

### 관련 파일
- `e2e/tests/09-dual-role-mode.spec.ts:78`
- `web/user/src/components/ModeIndicator.tsx:130` (토스트 렌더)

### 처리 (2026-05-25)
- spec 09 의 토스트 selector 를 `role="status"` + filter hasText 로 변경 + timeout 5초로 완화. 단독 실행 OK.

---

## 🟢 B-004 — spec 09 듀얼 역할자 토스트/배너 race

**발견**: 2026-05-25
**심각도**: 🟢 Low
**상태**: 미해결 (정식 운영 전 일괄 fix)

### 재현
- `tests/09-dual-role-mode.spec.ts` 의 "모드 전환 토스트" + 일부 배너 검증
- 묶음 실행에선 첫 두 케이스 flaky, 단독 실행에선 토스트 케이스 flaky
- 2026-05-25 fix 시도 다수 (beforeEach 재로그인, me() 캐시, 단일 직렬 test 통합) 모두 race 잔존

### 진짜 원인 (2026-05-25 분석)
`ModeIndicator` 컴포넌트의 토스트 발화 조건:
```
useEffect: prev=null 이면 setToast 안 함 (첫 마운트 처리)
```
- SPA mount 시점에 me() 응답이 늦으면 isCounselor=false → ModeIndicator 자체가 마운트 안 됨
- me() 응답 도착 후 isCounselor=true → ModeIndicator 마운트 → prev=null 첫 useEffect
- 이미 /counselor/* URL 에 있다면 mount 시점 currentMode='counselor' → 토스트 X
- 묶음 실행 시 백엔드 ThrottlerException(429) 으로 me() 가 더 느림 → race 강화

### 영향
- 사용자 영향 0 (실 화면에선 me() 빠르게 응답, ModeIndicator mount 시점이 /mypage URL 이라 currentMode='member' 정상 시작)
- CI 안정성 ↓ (자동화에서 retry 1회로 흡수 못 함)

### 추정 fix 방향
1. **ModeIndicator 컴포넌트 fix** — useRef 대신 useState 로 lazy init,
   또는 마운트 시점 currentMode 와 URL 직전 모드 비교 (sessionStorage 활용)
2. **E2E 차원** — 토스트 검증 케이스 fixme + spec 09 의 다른 검증만 유지
3. **백엔드 throttle 정책 완화** (로그인/me() 분리)

### 부분 해결 (2026-05-25 turn 4)
- ModeIndicator 에 sessionStorage 기반 prev mode 저장 (LAST_MODE_KEY).
  mount 시점이 늦어도 정확한 비교 → spec 09 단독 6/6 통과 (이전엔 1 fail).
- 묶음 실행에선 여전히 1차 fail → retry-failed 로 통과.
  추가 원인: 다른 spec 의 백엔드 호출 누적 → me() 응답 timing 영향.
- **잔존**: 묶음 실행 안정성 향상 위해 retry 정책(_deploy_and_verify.py --retry) 사용 권장.

### 관련 파일
- `web/user/src/components/ModeIndicator.tsx:48-61` (useEffect)
- `e2e/tests/09-dual-role-mode.spec.ts` (다양한 fix 시도 코드 흔적)
