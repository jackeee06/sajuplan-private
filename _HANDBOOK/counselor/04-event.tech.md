# [AI 전용] 이벤트 상담사 — 기술 상세

## 현재 상태

- 정책 박제: 메모리 `[[event-counselors-plan]]`
- 코드: **미구현**
- 운영 시작 후 도입 결정

## 예상 DB 스키마

```
member
- is_event_counselor BOOLEAN DEFAULT false
- event_started_at TIMESTAMPTZ
- event_expires_at TIMESTAMPTZ  -- X일 자동 종료
```

## 예상 코드 위치

- 라벨 부여 cron: `api/src/cron/event-counselor-update.service.ts`
- 회원 화면 필터: `api/src/user/counselors/counselors.service.ts` (별도 endpoint)
- 운영자: `api/src/admin/members/members.service.ts`

## 예상 페이지

- 회원: `/new-counselors` (이미 라우트 일부 존재 — `web/user/src/pages/NewCounselors.tsx`)
- 운영자: 상담사 리스트에서 필터

## 도입 시 검토 항목

- 단가 할인 정책 (수익 모델 영향)
- 종료 조건 (X일 vs N건)
- 자동 vs 수동 부여
- 알림톡 (회원에게 신규 상담사 안내)

## 관련 메모리

- `[[event-counselors-plan]]`
