# [AI 전용] 듀얼 모드 - 기술 상세

## URL 매핑 로직

`web/user/src/components/ModeIndicator.tsx`:
```typescript
const inCounselorArea =
  location.pathname === '/counselor' ||
  location.pathname.startsWith('/counselor/')
const currentMode = isCounselor && inCounselorArea ? 'counselor' : 'member'
```

→ 메모리 `[[counselor-path-matching]]`: `/counselors` (회원이 상담사 둘러보기) 와 구분 필수.

## 4가지 UI 요소

1. **상단 sticky 핑크/보라 바** (sticky top-0, z-40, h-7)
2. **영구 닷** (dismiss 후 좌상단 작은 점)
3. **전환 토스트** (2.2초 자동)
4. **큰 안내 배너** (상담사 → 회원 자동 전환 + 홈/단골)

## 가드

```typescript
if (!isLoggedIn || !isCounselor) return null  // 듀얼만
if (location.pathname.startsWith('/chat/')) return null  // 채팅방 가림 방지 (2026-05-30)
```

## localStorage 키

- `sajuplan.modeBanner.dismissed` — 'counselor' / 'member' / null
- `sajuplan.modeBanner.lastMode` — 모드 추적 (mount race 방지)

## 채팅방 자동 숨김 (2026-05-30 추가)

이유: ChatRoom 헤더 fixed top-0 z-30 + ModeIndicator sticky top-0 z-40 → 헤더 위 28px 가림 → 상담종료 버튼 잘림.

## 핵심 코드 위치

- `web/user/src/components/ModeIndicator.tsx`
- 듀얼 라우팅: `web/user/src/App.tsx` (Route 정의)

## 관련 메모리

- `[[counselor-path-matching]]`
- `[[id-unification-complete]]`
- `[[mobile-deep-link-status]]`
