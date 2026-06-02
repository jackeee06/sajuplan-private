# 💬 채팅 선결제 (15분 단위) 운영 정책 — 최종 (v2)

> **상태**: 정책 확정 (사장님 결정 2026-05-29), Phase 1 코드 작업 시작 직전
> **작성**: 2026-05-29 v1
> **업데이트**: 2026-05-29 v2 — 9가지 신규 결정 반영 (F 차감 시점 변경 / 1분 테스트 옵션 / 30초 전 알림 / G 5초 환불 / 인프라 점검 결과 / 음성 알림 / Phase 재분할 등)
> **연결 문서**: [PLAN/per-session-chat-pricing.md](PLAN/per-session-chat-pricing.md) (m2net 협의 / 개발 분담)
> **연결 메모리**: [[project-prepaid-chat-plan]] (옛 메모리 — 이 문서가 최신 진실원)

---

## 한 줄 요약 (v2)

**사용자가 ConsultModal 에서 15/30/45/60분(테스트 1분 포함)을 선택하면 사주플랜이 chat_room 생성하되 코인 차감은 0. 상담사 입장(m2net CONNECT_CSR) 시점에 즉시 chargeMinutes × 단가 차감(선결제). 통화 중 화면 잔액 변화 X, 사전 선택 시간 도달 후엔 m2net 종량제 페이스로 자동 연장. 정상 종료 환불 X, 비정상 종료는 캐치 가능한 경우만 환불.**

---

## 1. 시간 옵션 (ConsultModal)

| 옵션 | 분 | 단가 가정 (30초/1,000원) | 즉시 차감액 | 노출 정책 |
|---|---|---|---|---|
| **1분 (테스트)** | 60초 | 2 × 1,000 | **2,000원** | ⚠️ **mb_id 화이트리스트 — 사장님 + 개발자만** |
| 15분 | 900초 | 30 × 1,000 | **30,000원** | 일반 노출 |
| 30분 (베스트) | 1,800초 | 60 × 1,000 | **60,000원** | 일반 노출 |
| 45분 | 2,700초 | 90 × 1,000 | **90,000원** | 일반 노출 |
| 60분 | 3,600초 | 120 × 1,000 | **120,000원** | 일반 노출 |

> 차감액 = `ceil(chargeMinutes × 60 / 30) × pricePerHalfMin` (상담사별 단가 적용)

### 1.1 1분 테스트 옵션 노출 정책 (2026-05-29 추가)
- **목적**: 빠른 회귀 검증 (1분 후 자동 연장 진입 + 알림 + 강제 동기화)
- **노출 방식**: `mb_id` 화이트리스트 (사장님 본인 mb_id + 개발자)
- **클라이언트 코드 위치**: `ConsultModal.tsx` 의 `CHAT_MINUTE_OPTIONS` 배열
- **운영 시작 후**: 화이트리스트에서 제거 + 옵션 자체 삭제

### 1.2 코드 현황 ([ConsultModal.tsx:58-63](web/user/src/components/ConsultModal.tsx#L58-L63))
```tsx
const CHAT_MINUTE_OPTIONS = [
  { min: 15 },
  { min: 30, tag: '베스트' },
  { min: 45 },
  { min: 60 },
]
```
**현재 UI 정의되어 있고, 백엔드 chargeMinutes 화이트리스트 검증 가동 중. 다만 [ConsultModal.tsx:132](web/user/src/components/ConsultModal.tsx#L132) 에서 chargeMinutes 안 보냄 → Phase 1 작업으로 활성화.**

---

## 2. 잔액 흐름 (v2 — F 정책 반영: 차감 = 상담사 입장 시점)

> **🚨 핵심 변경 (2026-05-29):** 채팅 상담은 상담사 입장 전까지 m2net 접속을 하지 않음 → **사주플랜 측도 상담사 입장 시점에 비로소 코인 차감**. 사용자가 선결제 의식적 인지 + 상담사 부재 시 자체 환불 0건 (이미 0원 차감이라 환불 불필요).

### 예시: 회원 38,150코인 → 15분 선택, 단가 30초/1,000원

### Phase 0: 상담 요청 ~ 상담사 입장 대기 (status=STAY)
```
T = 0초     사용자 15분 선택 → [실시간 채팅 시작] 클릭
            사주플랜 백엔드:
              - chargeMinutes=15 받음
              - 화이트리스트 검증 (1/15/30/45/60 중 하나)
              - userPoint(38,150) >= requiredCost(30,000) 확인 (코인 사전 검증)
              - chat_room INSERT (status=STAY, alloc_seconds_member=900초, charge_minutes=15)
              - ★ 코인 차감 X (잔액 38,150 그대로) — F 정책
              - 상담사에게 알림톡 발송 (chat_request_to_counselor)
            사용자 화면:
              - chat_room 으로 진입
              - "상담사를 기다리는 중..." + "지금은 코인이 차감되지 않습니다"
              - 잔액 38,150 그대로
            m2net:
              - 채팅 회선 미접속 (m2net 도 과금 X)
```

### Phase A: 상담사 입장 (status=ACTIVE) — ★ 차감 시점
```
T = N초     m2net 가 CONNECT_CSR push 발사 (상담사 채팅방 입장)
            사주플랜 백엔드:
              - chat_room.status = 'ACTIVE'
              - ★ 회원 코인 즉시 30,000 차감 → 8,150
              - alloc_seconds_member 그대로 유지 (900초)
              - SystemPill "상담사가 입장하였습니다" 양측 표시
            사용자 화면:
              - 잔액 38,150 → 8,150 (즉시 갱신)
              - 채팅 입력 가능
            m2net:
              - 자기 측 회원 잔액 38,150 그대로 (사주플랜 차감과 별개)
              - 30초당 1,000원 차감 시작 (자기 페이스)
```

### Phase B: 통화 진행 (사용자 화면 잔액 8,150 고정)
```
T = N+30초  사주플랜 잔액: 8,150 (그대로 — 이미 선결제 완료)   ← 사용자 화면
            m2net 잔액:    37,150 (-1,000)                    ← m2net 내부만

T = N+60초  사주플랜 잔액: 8,150 (그대로)
            m2net 잔액:    36,150 (-1,000)

…(반복)…

T = N+880초 잔여 시간 5분 진입 → SystemPill "⏰ 상담 종료 5분 남았습니다. 5분이 지나면 자동연장됩니다"
            (alloc 모드 5분 전 알림)

T = N+900초 [Phase C 진입 — 자동 연장]
```

### Phase C: 자동 연장 (선택 시간 도달, 잔액 남음)
```
T = N+900초 사주플랜:
              - SystemPill "✅ 상담이 자동 연장되었습니다" 표시 (양측)
              - ★ 이 시점부터 m2net push 를 받을 때마다 사주플랜도 -1,000 차감
              - 잔액 모드 진입 (extended_at 마킹)
              - 화면 차감 시작 (8,150 → 7,150 → 6,150 …)
            m2net: 변경 없음. 계속 30초/1,000원

T = N+930초 사주플랜 잔액: 7,150              ← 화면 갱신 시작
            m2net 잔액:    7,150 (동기화됨 — 자동 일치)

T = N+960초 사주플랜 잔액: 6,150
            m2net 잔액:    6,150

T = N+1140초 잔액 < 5,000 (=5분 분량) 진입 → 잔액 모드 5분 전 알림
            "⏰ 상담 종료 5분 남았습니다" (이때는 더 이상 연장 X)

T = N+1144초 사주플랜 잔액: 150 → 음수 직전
            자동 종료 호출 → m2net 종료 → 양측 잔액 0
```

### Phase D: 종료 처리

#### D-1. 정상 종료 (자동 연장 후 잔액 0)
- 환불 X
- m2net 종료 호출
- 사주플랜 chat_room.status = 'DISCONNECT'
- 정산 (settle_status)
- m2net 잔액 자동 동기화 (자동 연장 단계에서 이미 같이 차감)

#### D-2. 사용자 명시 종료 (Phase A/B 안에서 — 예: 10분만 사용)
- m2net 측 잔액: 38,150 - 20,000(10분) = 18,150
- 사주플랜 측 잔액: 8,150 (선결제 30,000 확정)
- **★ 사주플랜이 m2net 으로 잔액 8,150 강제 push (overwrite)** — `syncM2netBalanceForMember` 활용
- 환불 X
- 코드 위치: [auth.service.ts:153](api/src/user/auth/auth.service.ts#L153) — fill 실패 시 overwrite 폴백

#### D-3. 상담사 미입장 (Phase 0 안에서 3분 경과)
- chat-auto-cancel cron 자동 취소
- **이미 차감 0이므로 환불 불필요** (F 정책 효과)
- 회원/상담사 알림톡 발송 (이미 구현)
- 코드 위치: [consult.service.ts:543](api/src/user/consult/consult.service.ts#L543) `autoCancelStaleChats`

---

## 3. 화면 표시 정책 (v2 — F 정책 반영)

| 시점 | 사용자 화면 잔액 | 설명 |
|---|---|---|
| 시간 선택 전 | 38,150 | 원래 잔액 |
| 시간 선택 직후 (Phase 0 진입) | **38,150 (변화 X)** | 차감은 상담사 입장 시점 |
| Phase 0 대기 중 (상담사 미입장) | **38,150 (변화 X)** | 사주플랜/m2net 모두 차감 0 |
| Phase A 진입 (상담사 입장) | **8,150 (즉시 갱신)** | ★ 사주플랜 선결제 차감 |
| Phase B (통화 중) | **8,150 고정** | 변화 X (선결제 완료) |
| Phase C 진입 (자동 연장) | **8,150 → 7,150 → … (30초당 -1,000)** | m2net 페이스로 차감 |
| 자동 종료 직전 | 잔액 < 5,000 시 5분 전 알림 | |
| 종료 후 | 0 (자동 종료) 또는 강제 동기화 결과 | |

> **핵심**: 통화 중엔 사용자가 "이미 결제됐다" 인지 → 차감 안 보임 → 안심. 자동 연장 진입 후에야 차감 시각화.
> **F 정책**: 상담사 부재 시엔 38,150 그대로 → 사용자가 "결제 안 됨" 인지 → 자체 환불 불필요.

---

## 4. 자동 연장 메커니즘 상세 (Phase 2 작업)

### 조건
- 사전 선택 시간 도달 (`use_seconds >= alloc_seconds_member`)
- 사주플랜 측 잔액 > 0

### 동작
1. SystemPill "✅ 상담이 자동 연장되었습니다" 양측 표시 — **현재 미구현**
2. chat_room.extended_at = now() 마킹 — **새 컬럼 신설 필요**
3. tickRoom 로직 분기:
   - alloc 모드 (use_seconds < alloc): 사주플랜 차감 X (STAY 차단 + 선결제 보호)
   - **잔액 모드 (extended_at 마킹 후)**: m2net push 받을 때마다 사주플랜 잔액 -1,000
4. 화면 갱신 (잔액 시각화)
5. 잔액 5분 미만 진입 시 → SystemPill "⏰ 상담 종료 5분 남았습니다" (더 이상 연장 X)
6. 잔액 0 도달 → 자동 종료

### 강제 동기화 불필요 (자동 연장 후)
- 사주플랜이 m2net push 그대로 따라가 → 양측 잔액 일치
- **강제 동기화는 Phase A/B 안에서만 종료 시 적용** (D-2 케이스)

---

## 5. 비정상 종료 캐치 + 환불 정책 (v2)

### m2net 의 한계
> "m2net 의 END_CHAT push 는 정상 종료(상담종료 버튼) / 강제종료(wss abrupt close) / 무조건 status='DISCONNECT' + 정산" — [m2net-push.service.ts:399](api/src/pg-callbacks/m2net-push.service.ts#L399)

m2net 가 **정상/비정상을 구분하지 않음**. 모두 같은 END_CHAT.

### 5.1 자동 캐치 가능 케이스

| 케이스 | 캐치 방법 | 자동 환불 | 코드 위치 |
|---|---|---|---|
| **상담사 부재중** (Phase 0 에서 3분 STAY) | autoCancelStaleChats cron | ✅ 환불 0건 (이미 차감 0) | 이미 구현 |
| **m2net NO_ANSWER_CSR** | push reason | ✅ 환불 0건 (이미 차감 0) | 이미 구현 |
| **m2net INSUFFICIENT_CONN** | push reason | ✅ 환불 0건 (이미 차감 0) | 이미 구현 |
| **시작 직후 실패 (5초 이내)** | 새 정책 G | ✅ 전액 환불 (= 차감 분 그대로 0이면 OK) | **Phase 1 구현 필요** |
| **짧은 통화 (shortCallRefund)** | 사용 시간 < 임계값 | 🟡 정책 따라 | 이미 변수 존재 — 임계값 결정 필요 |

### 5.2 G 정책 — 시작 직후 실패 자동 환불 (사장님 2026-05-29 결정)

**조건**: Phase A 진입 후 **5초 이내** 비정상 종료
- 즉 상담사 입장 직후 5초 안에 끊김 (회원/상담사/m2net/시스템 사고 무관)

**환불 처리**:
- 사주플랜 측: 선결제 차감 분 **전액 환불**
- m2net 측: 첫 30초 1,000원 이미 과금 시작 → **사주플랜이 1,000원 손해 감수**

**Abuse 제한 (사장님 명시)**:
- **회원당 일 2회 max**
- **회원당 주 4회 max**
- 초과 시 자동 환불 차단 (어드민 수동만)
- 신규 컬럼: `member_chat_refund_log` (refund_count_day / refund_count_week 카운터)

**캐치 방식**:
- chat_room.status = 'ACTIVE' 전환 후 `ended_at - started_at` 5초 미만
- 또는 use_seconds < 5초

### 5.3 자동 캐치 불가능 (수동 처리)

| 케이스 | 캐치 한계 |
|---|---|
| 상담사 통화 중 폰 끊김 vs 정상 종료 | m2net 모두 END_CHAT — 구분 X |
| 회원 통화 중 끊김 vs 정상 종료 | 동일 |
| m2net 측 일시 장애 (push 누락) | END_CHAT_LOCAL 사후 발견만 |
| 사주플랜 자체 장애 (DB 락 등) | health-check + OpsAlert 사후 |

### 5.4 운영 정책 요약 (운영 시작 초기)

**자동 환불 (코드)**
- D-3 상담사 부재 → 환불 불필요 (이미 0)
- G 5초 이내 실패 → 전액 환불 + 1,000원 사주플랜 손해 + 일/주 제한

**반자동 (어드민 알림 → 사장님 결정)**
- m2net_failed 누적 → OpsAlert (이미)
- 짧은 통화 임계값 결정 후 자동화

**전적 수동 (어드민 환불 버튼)**
- 통화 중 끊김 분쟁
- 사장님 사례별 판단

---

## 6. m2net 잔액 강제 동기화 메커니즘 (v2 — 가동 중 확인)

### 구현 상태 ✅ **가동 중**
- 함수: `syncM2netBalanceForMember` ([auth.service.ts:153](api/src/user/auth/auth.service.ts#L153))
- 동작: m2net 잔액 조회 → 사주플랜 잔액과 비교 → delta 만큼 fill → 실패 시 **overwrite 폴백**
- 호출 시점:
  - 사용자 메인 페이지 진입 ([Home.tsx](web/user/src/pages/Home.tsx))
  - 충전 후 ([charge.service.ts:1160](api/src/user/charge/charge.service.ts#L1160))

### 필요 시점 (정책 §2 D-2)
- **Phase A/B 안에서 사용자 명시 종료 또는 끊김 발생 직후**
- 사장님 인식: 통화 종료 시 자동 호출되도록 확장 필요할 수 있음 — **Phase 1 검증 항목**

### 자동 연장 진입 후 (Phase C)
- 사주플랜이 m2net push 페이스 그대로 따라감 → **자동 일치**
- 강제 동기화 불필요

---

## 7. 알림 시점 (v2 — 조건부)

### 7.1 알림 표 (정상 흐름)

| # | 시점 | SystemPill 메시지 | 조건 |
|---|---|---|---|
| 1 | 사전 선택 시간 N초 전 | "⏰ 상담 종료 5분 남았습니다. 5분이 지나면 자동연장됩니다" | alloc >= 5분 시 N=300초, alloc < 5분 시 N=30초 |
| 2 | 사전 선택 시간 도달 | "✅ 상담이 자동 연장되었습니다" | 잔액 > 0 일 때만 |
| 3 | (자동 연장 후) 잔액 5분 전 | "⏰ 상담 종료 5분 남았습니다" (더 이상 연장 X) | 잔액 5분치 미만 |
| 4 | 잔액 0 도달 | 자동 종료 + "통화가 종료되었습니다" | |

> **양측(회원·상담사) 모두 메시지 영역에 시스템 메시지로 표시.**
> **액션 모달 절대 X** — 상담 몰입 흐름 끊김 방지.

### 7.2 1분 테스트 옵션의 알림 시점 (2026-05-29 결정)
- **alloc = 60초** 인 경우 5분 전 알림 음수 시점 → **30초 전 알림으로 자동 전환**
- 테스트 검증 후 다시 일반 5분 전으로 복귀 (1분 옵션 제거 시 자동)

### 7.3 코드 현황
- ALERT_5MIN 발화 로직 ([chat.service.ts:1058](api/src/user/chat/chat.service.ts#L1058)) — ✅ 구현
- 1분 옵션 대응 조건부 알림 — **Phase 1 작업**
- 자동 연장 진입 알림 — **Phase 2 작업**
- 자동 연장 후 잔액 5분 전 알림 — **Phase 2 작업**

---

## 8. 시스템 책임 분담

### 사주플랜 (백엔드)
- chargeMinutes 입력 검증 (1/15/30/45/60)
- chat_room INSERT (status=STAY, alloc, charge_minutes 박제)
- **상담사 입장 (CONNECT_CSR push) 시 즉시 코인 차감** ← F 정책 핵심
- alloc 모드 ↔ 잔액 모드 전환 (자동 연장)
- m2net 잔액 강제 동기화 (Phase A/B 종료 시)
- 자동 환불:
  - 상담사 부재 (이미)
  - G 5초 이내 실패 + 일/주 제한 (Phase 1 신규)
- 알림 발화 (ALERT_5MIN + 조건부)

### 사주플랜 (프론트)
- ConsultModal chargeMinutes 활성화
- 1분 테스트 옵션 (mb_id 화이트리스트)
- 안내 문구 변경 (F 정책 반영 — "상담사 입장 시 차감")
- CTA 비활성 (시간 미선택 시)
- 화면 잔액 표시 정책 (Phase 0 38,150 / Phase A 8,150 / Phase B 고정 / Phase C 차감)
- 알림 4종 SystemPill 표시
- (Phase 2) 음성 알림 추가 검토

### m2net (변경 없음)
- 30초당 1,000원 종량제 차감 (자기 페이스)
- END_CHAT push (정상/비정상 무차별)
- 사주플랜이 보낸 강제 동기화 (overwrite) 수신 → 잔액 덮어쓰기

---

## 9. 인프라 점검 결과 (2026-05-29)

### 9.1 이미 구현 ✅
- `chargeMinutes` 백엔드 검증 + alloc 배정 ([consult.service.ts:204, 290](api/src/user/consult/consult.service.ts#L204))
- `STAY 상태에서 차감 금지` ([chat.service.ts:1141](api/src/user/chat/chat.service.ts#L1141))
- `autoCancelStaleChats` 3분 STAY 자동 취소 ([consult.service.ts:543](api/src/user/consult/consult.service.ts#L543))
- `syncM2netBalanceForMember` m2net 강제 동기화 ([auth.service.ts:153](api/src/user/auth/auth.service.ts#L153))
- `ALERT_5MIN` 잔여 5분 안내 ([chat.service.ts:1058](api/src/user/chat/chat.service.ts#L1058))
- `shortCallRefund` / `refundEligible` 변수 존재 — 임계값 결정 대기

### 9.2 미구현 ❌ (이번 Phase 1 작업)
- ConsultModal `chargeMinutes` 전송 (UI 옵션 정의만 됐음)
- 1분 테스트 옵션 추가
- 안내 문구 변경 (F 정책 — 상담사 입장 시 차감)
- **차감 시점 변경**: startChat 시점 → 상담사 입장 (CONNECT_CSR push) 시점 — F 정책
- `chat_room.charge_minutes` 컬럼 + 마이그레이션
- ALERT_5MIN 조건부 (alloc < 5분 시 30초 전)
- G 5초 이내 자동 환불 + 일/주 제한

### 9.3 미구현 ❌ (Phase 2 작업)
- 자동 연장 진입 알림 ("✅ 상담이 자동 연장되었습니다")
- `chat_room.extended_at` 컬럼 + 마이그레이션
- 잔액 모드 전환 로직 (m2net push → 사주플랜 잔액 -1,000)
- 잔액 모드 5분 전 알림
- 음성 알림 (옵션)

---

## 10. 음성 알림 옵션 (2026-05-29 신규)

### 10.1 제약
- Claude 가 직접 mp3 파일 생성 X (TTS 도구 미장착)
- 사장님이 외부 TTS 서비스로 만들거나 녹음 → 사주플랜 public 에 업로드

### 10.2 옵션 비교

| 옵션 | 동작 | 호환성 | 작업량 | 권장 |
|---|---|---|---|---|
| A. Web Speech API (SpeechSynthesis) | `speechSynthesis.speak('...')` 1줄 | ⚠️ Android WebView 일부 미지원 | 5분 | 임시용 |
| B. 정적 mp3 파일 | 사장님 외부 TTS / 녹음 → public/audio/ + Audio API | ✅ 모든 환경 | 사장님 5분 + 코드 적용 | ★ 권장 |
| C. 알림음 + 진동 | 단순 비프음 + RN vibrate | ✅ 모든 환경 | 10분 | 백업 |

### 10.3 권장 진행
1. Phase 2 시 옵션 B + C 조합
2. 사장님이 mp3 파일 제공 — 5초짜리 (예: "상담 종료 5분 남았습니다")
3. C 는 mp3 동시 재생 (시각/청각 양쪽 자극)

---

## 11. Phase 분할 (v2 — 최종)

### Phase 1 (이번 세션 — 활성화 + 자동 환불 인프라)
1. ConsultModal chargeMinutes 전송 활성화
2. 1분 옵션 추가 (mb_id 화이트리스트)
3. **F 정책 구현** — 차감 시점 = 상담사 입장 (CONNECT_CSR push) 시점
4. 안내 문구 변경 (선결제 + 상담사 입장 시 차감)
5. `chat_room.charge_minutes` 컬럼 마이그레이션
6. ALERT_5MIN 조건부 조정 (alloc < 5분 시 30초 전)
7. autoCancelStaleChats 검증 (F 정책 효과로 환불 0건이어야)
8. **G 5초 이내 자동 환불** + 회원별 일 2회 / 주 4회 제한

### Phase 2 (다음 세션 — 자동 연장 + 알림)
1. `chat_room.extended_at` 컬럼 + 마이그레이션
2. 자동 연장 진입 마킹 (use_seconds >= alloc 시점)
3. SystemPill "✅ 상담이 자동 연장되었습니다"
4. 잔액 모드 전환 로직 (m2net push → 잔액 -1,000)
5. 잔액 모드 5분 전 알림
6. 음성 알림 (옵션 B + C)

### Phase 3 (운영 시작 후 — 점진 개선)
- m2net 강제 동기화 호출 시점 확장 (채팅 종료 자동 호출)
- shortCallRefund 임계값 결정
- G 정책 abuse 통계 분석 + 제한 조정
- 1분 옵션 제거

---

## 12. 미해결 (사장님 결정 대기 — v2)

### 12.1 Phase 1 시작 전
- [ ] 1분 옵션 mb_id 화이트리스트 — 사장님 본인 mb_id 확인 필요
- [ ] G 5초 임계값 — 5초 vs 10초 vs 15초?
- [ ] 시간 선택 시 차감 코인 예상 표시 UI — 어떻게? (예: "선택 시 -30,000코인 차감")

### 12.2 Phase 2 시작 전
- [ ] 음성 알림 mp3 사장님 제공 (또는 Web Speech API 임시)
- [ ] 잔액 모드 5분 전 임계값 — 5분 vs 3분?

### 12.3 운영 안정화 후
- [ ] shortCallRefund 임계값 (예: 1분 미만 자동 환불?)
- [ ] G 일/주 제한 조정
- [ ] 어드민 환불 UI 워크플로

---

## 13. 관련 파일

### 코드
- [web/user/src/components/ConsultModal.tsx](web/user/src/components/ConsultModal.tsx) — 시간 선택 UI
- [api/src/user/consult/consult.service.ts](api/src/user/consult/consult.service.ts) — startChat / chargeMinutes / autoCancelStaleChats
- [api/src/user/chat/chat.service.ts](api/src/user/chat/chat.service.ts) — alloc/use_seconds/tickRoom/ALERT_5MIN
- [api/src/pg-callbacks/m2net-push.service.ts](api/src/pg-callbacks/m2net-push.service.ts) — m2net push 처리 (CONNECT_CSR / END_CHAT 등)
- [api/src/user/auth/auth.service.ts](api/src/user/auth/auth.service.ts) — syncM2netBalanceForMember
- [api/src/cron/cron.controller.ts](api/src/cron/cron.controller.ts) — autoCancelStaleChats cron

### 문서
- [PLAN/per-session-chat-pricing.md](PLAN/per-session-chat-pricing.md) — m2net 협의 / 개발 분담
- [MONEY_FLOW.md](MONEY_FLOW.md) §6 (채팅 차감 흐름)

### 메모리
- [[project-prepaid-chat-plan]] — 옛 메모리 (5일 전, outdated. **본 문서가 최신 진실원**)
- [[money-flow-master]]
- [[alert-mapping]]

---

## 15. 상담사 Incoming 채팅 요청 패턴 (2026-05-30 신규)

> **목적**: 상담사가 알림톡 클릭하고 사주플랜 진입 시 대기 중인 채팅 요청에 빠르게 접근 가능하도록.

### 15.1 사장님 결정 (2026-05-30 회의)

1. **모달은 한 건만 표시** — 다중 리스트 X
2. 동시 여러 요청 들어와도 **나머지는 3분 후 autoCancelStaleChats 가 자동 처리**
3. 채팅 1건이 보통 3분 이상이라 자연 만료가 합리적
4. **별도 incoming 리스트 페이지** — 상담사가 한 건 끝낸 후 직접 가서 순차 선택
5. **홈 핑크 배너** — "남은 N건의 상담 대기 화면으로 가기" 클릭 → 리스트로

### 15.2 사장님이 헷갈리신 기능 (구분)

| 항목 | 기능 |
|---|---|
| `counselor_request_v1` 알림톡 | **회원 → 부재중 상담사** 에게 "상담 가능해지면 알려달라" 요청. DB: `counselor_request_alert` |
| **incoming 채팅 (본 §15)** | **회원 → 상담중인 상담사** 가 보낸 새 채팅 요청. DB: `chat_room` (status=STAY) |

→ 이름이 비슷해 혼동 가능. 본 §15 는 **신규 구현 대상**.

### 15.3 코드 현황 (점검 2026-05-30)

| 영역 | 상태 |
|---|---|
| `consultApi.incoming` API ([api/src/user/consult](api/src/user/consult/consult.controller.ts)) | ✅ STAY 상태 chat_room 반환 (5초 polling) |
| `CounselorIncomingChatWatcher` 모달 ([web/user/src/components](web/user/src/components/CounselorIncomingChatWatcher.tsx)) | ✅ 한 건씩 표시 (사장님 의도 그대로 유지) |
| **상담사 incoming 리스트 페이지** | ❌ 미구현 — 본 §15 작업 대상 |
| **홈 배너** | ❌ 미구현 — 본 §15 작업 대상 |
| `autoCancelStaleChats` 3분 자동 취소 | ✅ cron 가동 중 |

### 15.4 구현 분할 (작업 Phase)

#### Phase A. `/counselor/mypage/incoming` 리스트 페이지
- 위치: `web/user/src/pages/CounselorIncomingList.tsx` (또는 비슷한)
- 데이터: `consultApi.incoming()` polling (5초)
- 정렬: **대기 오래된 순** (먼저 신청한 회원 보호)
- 각 row 표시:
  - 회원 닉네임 + 이름 (성 X)
  - 대기 시간 ("3분 전 신청")
  - 남은 시간 ("약 2분 남음" — 3분 - waited)
  - 만료 임박 표시 (예: 30초 미만 → 빨강)
- 각 row 클릭 → `/chat/:chat_room_id` 진입
- 빈 상태: "현재 대기 중인 채팅 요청이 없습니다"

#### Phase B. Home 상단 핑크 배너 컴포넌트
- 위치: `web/user/src/components/CounselorIncomingBanner.tsx`
- 조건:
  - 사용자 역할 = 'counselor' AND incoming N > 0
  - 일반 회원 모드 X (회원 모드일 땐 안 보임)
- 표시: "📞 새 채팅 요청 **N건** → [바로가기]"
- 클릭 → `/counselor/mypage/incoming` 진입
- 5초 polling — `CounselorIncomingChatWatcher` 와 같은 endpoint 재사용 (중복 polling 방지 위해 context 통합 고려)
- 디자인 톤: 기존 `FavoriteCounselorBanner` 와 동일 (메모리 [[inapp-banners]] 패턴)

#### Phase C. 라우터 등록 + 진입점
- App.tsx: `/counselor/mypage/incoming` route 추가
- BottomNav: 상담사 모드일 때 '대기' 또는 '요청' 메뉴 (선택 — 기본은 배너만으로 충분)
- 헤더: 알림 아이콘 (🔔) 의 배지 신규 (incoming N건) — 선택 사항

### 15.5 자동 만료 흐름 (이미 가동 — 사장님 결정 그대로)

```
T=0   회원 A → 상담사 채팅 요청 → STAY 방 INSERT
T=0   상담사 incoming 모달에 회원 A 표시
       (상담사가 다른 회원과 채팅 중이면 모달은 안 뜨고 incoming 큐에만 누적)
T+3분 autoCancelStaleChats cron 이 STAY 3분 자동 취소
       → 회원 A 에게 chat_auto_cancelled_to_member 알림톡
       → 상담사 incoming 리스트에서 자동 제거
```

→ 상담사가 첫 상담 끝낼 때까지 대기 요청들은 자연 만료. 상담사가 첫 상담 끝낸 후 incoming 리스트 진입 시 **아직 살아있는 요청만** 표시.

### 15.6 정책 일관성

| 항목 | 결정 |
|---|---|
| 모달 vs 배너 동시? | **둘 다.** 모달 = 즉시 인지 / 배너 = 재접근 |
| 배너 위치 | Home 상단 (점검 배너 / 단골 배너 보다 위) |
| 폴링 빈도 | 5초 (incoming 큐 갱신) — 메모리 [[strict_autonomy]] 의 폴링 정책 준수 |
| 회원 모드일 때 | 배너 안 보임 (모드 명확) |
| FCM 푸시 | 이미 가동 중 — 알림톡 + 푸시 + 인앱 배너 = 3중 안전망 |

### 15.7 미해결 (Phase 작업 중 결정)

- [ ] 배너 안에 회원 이름 일부 표시? (개인정보 보호 vs 인지)
- [ ] BottomNav 메뉴 추가? (배너만으로 충분할지)
- [ ] 헤더 알림 아이콘 배지 추가?

---

## 14. 변경 이력

| 날짜 | 버전 | 변경 |
|---|---|---|
| 2026-05-29 | v1 | 최초 작성 (사장님 회의 후) |
| 2026-05-29 | v2 | 9가지 신규 결정 반영 — F 차감 시점 변경, 1분 테스트 옵션, 30초 전 알림, G 5초 환불 정책, 인프라 점검 결과, 음성 알림 옵션, Phase 재분할, syncM2netBalance 가동 확인 |
| 2026-05-30 | v3 | §15 신규 — 상담사 incoming 채팅 요청 패턴 (모달 1건 + 리스트 페이지 + 홈 배너 3중 패턴) |

---

작성: 2026-05-29
다음 업데이트: Phase 1 작업 완료 후 (구현 완료 항목 ✅ 마킹)
