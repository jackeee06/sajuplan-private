# [AI 전용] 영업이익 시뮬레이터 — 기술 상세

## 권한

- `SuperOnlySection` 가드 (`is_super=true` 만)
- 비밀 단가 / 마진 / 영업이익률 노출 영역

## 입력 → 출력

```typescript
// 입력
interface SimInput {
  mau: number          // 월 활성 회원
  avgPaymentPerUser: number  // 회원당 평균 결제 (원)
  chatRatio: number    // 채팅 비율 (0-1)
  callRatio: number    // 통화 비율 (0-1)
  counselorRates: { 일반: number, 우수: number, 특급: number }  // 등급별 분당 단가
  marginPct: number    // 회사 마진 (0-1)
  refundRate: number   // 환불율 (0-1)
  opCost: number       // 운영비 (월, 원)
}

// 계산
const revenue = mau * avgPaymentPerUser * (1 - refundRate)
const counselorCost = revenue * (chatRatio + callRatio) * (1 - marginPct)
const profit = revenue - counselorCost - opCost
const profitMargin = profit / revenue
```

## 핵심 코드 위치

- API: `api/src/admin/profit-sim/profit-sim.service.ts`
- 페이지: `web/mng/src/pages/ProfitSimulator.tsx`

## DB

시뮬레이션 결과 저장 시 별도 테이블 검토 (현재 미구현 — 매번 입력 후 계산만).

## 메모리

- `[[test-phase]]` (실측 의미 작은 현 단계, 시뮬레이터가 더 유의미)
