# 🔔 ALERT_MAPPING.md — 알림 시스템 매핑 (alertCatalog ↔ 코드 ↔ prod)

> **목적**: 사주플랜 37 알림 이벤트가 실제로 어디서 호출되고 prod 에서 도착하는지 한눈에. 운영 시작 전 누락/죽은 알림 검출.
>
> **작성**: 2026-05-29
> **연결**: [alertCatalog.ts](web/mng/src/data/alertCatalog.ts) (UI 문서) + [MONEY_FLOW.md](MONEY_FLOW.md) (정산 알림)

---

## 한 줄 원칙

**alertCatalog 의 active 마킹은 "의도" 일 뿐, 실제 동작은 코드 + prod 등록 + 카카오 검수 3자 모두 통과해야 함**.

---

## ✅ 정상 작동 (코드 ↔ prod ↔ alertCatalog 일치)

| 이벤트 | 코드 위치 | prod template_code | 상태 |
|---|---|---|---|
| signup_auth | sms.service.ts:send | register_num_v2 | ✅ |
| find_password | sms.service.ts:sendFindPwAlimtalk | register_idpw1 | ✅ |
| vbank_info | charge.service.ts:768 | order_bankinfo_v2 | ✅ (5/29 fix) |
| new_review | reviews.service.ts:610 | review_for_counselor_v2 | ✅ (5/29 fix) |
| new_qna | qna.service.ts:759 | qa_ask_v2 | ✅ (5/29 fix) |
| qna_answered | qna.service.ts:808 | qa_answer_v2 | ✅ (5/29 fix) |
| coupon_zone_grant | coupon-zones.service.ts:274 | coupon_req_v2 | 🔴 **prod 반려** (사장님 처리 중) |
| payout_request_received | counselor-mypage-payout.service.ts:471 | payout_request_received | ✅ |
| payout_processed | payouts.service.ts:430 | payout_request_paid | ✅ |
| payout_rejected | payouts.service.ts:282 | payout_request_rejected | ✅ |
| (운영자) | ops-alert.service.ts:79 | ops_admin_alert_v2 | ✅ (5/29 검증) |

## 🔵 검수 통과 대기 (사장님 BizM 검수요청 완료, 카카오 1~3일)

| 이벤트 | 코드 위치 | prod template_code | 비고 |
|---|---|---|---|
| consult_request_arrived | counselors.service.ts:200 | counselor_request_v1 | 전화상담 요청 시 |
| chat_request_to_counselor | consult.service.ts:515 | (동명) | 채팅상담 요청 시 |
| chat_auto_cancelled | consult.service.ts:647 | chat_auto_cancelled_to_member | cron 자동 취소 시 |

## 🚨 신규 발견 — 운영 시작 시 누락

### #1. counselor_auto_absent (상담사 자동 부재중 전환) — ✅ 해결 (2026-05-29)
- **사장님 결정 C안**: 회원 알림(chat_auto_cancelled) + 상담사 알림(counselor_auto_absent) 둘 다 필요
- **2026-05-29 코드 추가**: `consult.service.ts:notifyCounselorAutoAbsent` 신규
  - `autoCancelStaleChats` 안에서 호출 (회원 알림과 동시)
  - 템플릿: `counselor_state_changed_v2` (prod 이미 승인됨, 그동안 호출 0건이었음)
  - 변수: 상담사명
- **state 자동 전환은 안 함**: m2net csrstat 진실원 충돌 위험. 알림만 발송 → 상담사가 본인 판단 후 수동 전환

### #2. settlement_complete (월 정산 완료) — ✅ 코드 추가 (2026-05-29)
- **2026-05-29**: 사장님이 어드민에서 정산 [지급완료] 마킹 시 자동으로 알림톡 발송
  - 코드: `settlements.service.ts` `notifySettlementComplete(id)` → `markPaid` 직후 void 호출
  - template_code: `settlement_complete` (BizM 신규 등록 필요)
  - 변수: 상담사명 / 정산월 / 실지급액
- **사장님 BizM 액션 필요**: 콘솔에서 `settlement_complete` 템플릿 신규 등록 + 검수 신청 → 1~3일 검수 통과 후 자동 작동
- 등록 전엔 sms.service 가 `template_not_found` 로 reject + alimtalk_log 에 기록 (정상)

## 🟡 죽은 prod 템플릿 (검수 통과 자원 낭비)

| prod template_code | 상태 | 원인 |
|---|---|---|
| chat_counseling_v2 | 등록 + 승인 | chat_request_to_counselor 로 코드 교체 (2026-05-23). 이 템플릿은 호출 코드 없음 |
| ~~counselor_state_changed_v2~~ | ✅ **2026-05-29 부활** | counselor_auto_absent 코드 추가로 호출 시작 (이제 살아있는 템플릿) |

→ **사장님 액션**: BizM 콘솔에서 chat_counseling_v2 만 archive 검토. counselor_state_changed_v2 는 유지 (이제 활발히 호출됨).

## ⏸️ 의도적 미발송 (rejected 결정)

37 이벤트 중 push.status='rejected' 대부분 (2026-05-28 사장님 일괄 결정). 푸시 피로/스팸 방지 정책. alimtalk='rejected' 일부 (마케팅성). 메모리 [[alert-channel-policy]] 참고.

## 📡 푸시 (FCM) 추적

`shared/push/push.service.ts` 의 `sendToTokens`, `sendToTopic` 호출처 별도 추적 필요. consult_request_arrived 가 push='active' (FCM 발송) 라 했지만 호출 코드 매핑 확인 필요.

---

## 운영 시작 전 체크리스트

- [ ] counselor_auto_absent cron 신설 OR m2net 책임 명확화 (사장님 결정)
- [ ] settlement_complete 알림 추가 여부 결정
- [ ] 죽은 prod 템플릿 2개 archive (chat_counseling_v2, counselor_state_changed_v2)
- [ ] 검수 통과 3개 대기 (counselor_request_v1, chat_request_to_counselor, chat_auto_cancelled_to_member)
- [ ] coupon_req_v2 반려 처리 (사장님)
- [ ] alimtalk_log 테이블 신설 (발송 흔적 DB — MONEY_FLOW.md §15)
- [ ] FCM 푸시 호출처 추적 + alertCatalog 'active' 매칭 검증

---

## 🔘 알림톡 버튼 타입 규칙 (2026-06-03 정리)

BizM API 버튼 타입에 따라 필드명이 다름. `alimtalk_template.primary_btn_type` 으로 관리.

| 타입 | 의미 | 코드 필드 | 해당 템플릿 |
|---|---|---|---|
| `WL` | 웹링크 | `url_mobile`, `url_pc` | 대부분 (`qa_answer_v2`, `counselor_request_v1` 등) |
| `AL` | 앱링크 (딥링크) | **`scheme_android`, `scheme_ios`** | `qa_ask_v2`, `review_for_counselor_v2` |

> ⚠️ AL 타입은 `url_android`/`url_ios` 가 아니라 **`scheme_android`/`scheme_ios`** — PHP sample (`bizmsg.class.php`) 확인.
> AL 타입에 `url_android` 보내면 K208 (MissingRequiredParameterException) 거부됨.

### 2026-06-03 수정 이력
- `qa_ask_v2`: K108 (WL→AL 타입 불일치) → K208 (AL 필드명 오류) → ✅ 해결 (`scheme_android`)
- `review_for_counselor_v2`: 동일 문제 → ✅ 해결
- `alimtalk_template.primary_btn_type` 컬럼 신설 (default 'WL')
- `qna.service.ts notifyQaAsk`: qnaId 파라미터 추가 → 버튼 딥링크에 정확한 QnA ID 포함

---

## 변경 이력

| 날짜 | 변경 | 작성자 |
|---|---|---|
| 2026-05-29 | 최초 작성 — 37 이벤트 × 코드 × prod 3자 매핑 | Claude (사장님 자율) |
| 2026-06-03 | AL 버튼 타입 필드명 수정 (scheme_android/ios), primary_btn_type 컬럼 신설 | Claude (사장님 자율) |
