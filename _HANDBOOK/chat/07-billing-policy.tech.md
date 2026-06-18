# [AI 전용] 채팅 과금 정책 — 기술 상세

## 불변 규칙
**CNCH(상담 중) 채팅은 try_out(이탈) 여부와 무관하게 use_seconds 를 계속 누적한다.** 과금정지 금지.

## tickRoom 과금 분기 (chat.service.ts)
```typescript
async tickRoom({ me, chatRoomId }) {
  // ...권한 검증...
  if (status === 'DISCONNECT') return { reason: 'disconnected' }
  if (status === 'STAY')       return { reason: 'awaiting_counselor' }  // 차감 0 (F 정책)
  // ⛔ 2026-06-17: 여기 있던 member_try_out/counselor_try_out 과금정지 블록 '제거'.
  //    CNCH 면 누가 이탈하든 누적.
  const remain = alloc_seconds_member - use_seconds
  if (remain >= 10) { use_seconds += 10; ...5분알림... return { used: 10 } }
  // remain < 10 → DISCONNECT + settleChatRoomLocal()  (시간 소진)
}
```

## 왜 (m2net 동기화)
- m2net = 실시간 과금 주체. 세션 활성이면 누가 딴짓하든 회원 m2net 잔액에서 계속 차감.
- 우리가 try_out 으로 use_seconds 를 멈추면 → 정산 시 우리 추정 사용량 < m2net 실차감 → 환불 과다 or 매출 누락 → **사주플랜 적자.**
- 따라서 CNCH 는 무조건 누적. 손실 0 보장은 정산을 m2net 실과금 기준으로(settleChatRoomLocal 이 m2net getMemberByMembid 로 실잔액 조회·동기화).

## 제거된 안티패턴 (재도입 금지)
```typescript
// ❌ 2026-06-17 제거됨 — 다시 넣지 말 것
if (r.member_try_out || r.counselor_try_out) {
  return { reason: 'member_paused' }   // ← m2net 과 어긋나 적자
}
```

## STAY 보호는 별개 (유지)
- STAY = 상담사 미입장. m2net START_CHAT push 전이라 m2net 도 과금 안 함.
- `status='STAY'` 체크로 차단 (try_out 과 무관). F 정책: 선결제 채팅 = 상담사 입장 전 차감 0.

## use_seconds 의 한계
- 클라이언트 tickRoom 폴링으로 누적 → 백그라운드(프레임 freeze)면 누적 멈춤(클라 한계).
- 그래서 use_seconds 는 라이브 UI(잔여시간·5분알림)용 추정치. **최종 금액은 m2net 기준.**

## 관련 메모리/문서
- `[[feedback-no-chat-billing-pause]]` — 절대 규칙
- [이탈 처리](chat/03-exit-handling), [m2net 관계](payment/01-m2net-relation), [선결제](chat/01-prepaid-policy)
