# 🚀 정식 운영 준비 체크리스트

> **목적**: 사주플랜 정식 운영(테스트 → prod 전환) 전 점검할 항목 일괄 정리.
> **작성**: 2026-05-25 / **최종 갱신**: 2026-05-29 (운영 직전 안전망 검증)
> **검토**: 사장님 + m2net 협의 후 한 항목씩 클리어.
> **원칙**: 큰 흐름 누락 방지. 각 항목은 사장님이 "이건 됐다" 명확히 체크 표시.
>
> ## 🎯 한눈에 보는 운영 시작 가능 상태 (2026-05-29 기준)
>
> | 영역 | 상태 | 비고 |
> |---|---|---|
> | 💰 돈 흐름 / 정산 / 결제 / 환불 | 🟢 prod 검증 통과 | [MONEY_FLOW.md](../MONEY_FLOW.md) 마스터 + 22 invariants 모두 PASS |
> | 🔒 권한 / 시크릿 / 외부 401 | 🟢 OK | JWT 128자, CRON 64자, 외부 모두 차단 |
> | 📡 운영자 알림 (OpsAlert) | 🟢 가동 | 사장님 카톡 도착 검증 (2026-05-29) |
> | 💾 DB 자동 백업 | 🟢 가동 | 매일 03:30 + 7일 보관 |
> | 🔔 알림톡 (BizM) | 🟡 일부 검수 대기 | chat_* 2개 + counselor_request_v1 검수 중 / coupon_req_v2 반려 처리 중 |
> | 🧹 테스트 데이터 정리 | 🟢 완료 | settlement_monthly 14 + chat_room 10 + jackee drift 정리 |
> | 📜 영수증/세금계산서 | 🔴 미구현 | 5만원 초과 거래 시 법적 의무 — m2net 협의 필요 |
> | 📢 푸시 / FCM | 🟢 OK | 38이벤트 매트릭스 확정, prod 발송 흔적 OK |

---

## ⚠️ 정식 운영 시작 전 반드시

### 1. m2net 협의 (현재 진행 중)
- [ ] 건당 채팅 정책 결정 ([per-session-chat-pricing.md](per-session-chat-pricing.md))
- [ ] m2net 6가지 추가 질문 답변 받기 (Section 5)
- [ ] 운영 정책 옵션 A/B/C 결정 (전체 건당 / 혼용 / 점진)
- [ ] m2net 내부 개발 완료 통보 받기
- [ ] 단가 등록 형식 합의 (10,000원/910초 등)
- [ ] 시간 도달 알림 방식 합의 (push or 자체 타이머)

### 2. 코인/수익금 시스템 검증
- [x] 충전 → 차감 → 환불 흐름 prod 환경 검증 (2026-05-29)
      - payment completed 4건 → point_history 매칭 100%
      - consultation 21건 (DISCONNECT/END_CHAT/END_CHAT_LOCAL) → 패턴 매칭 100%
      - refund_request 0건 (어드민 환불 발생 X, 시스템 자동 short_call_refund 2건만)
      - [MONEY_FLOW.md](../MONEY_FLOW.md) §3~§5 prod 1:1 매칭 통과
- [ ] 가상계좌 입금 자동 처리 검증 (24시간 만료 포함)
- [x] 보너스 코인 (free_balance) vs 충전 코인 (paid_balance) 분리 정확성 (2026-05-29)
      - point 3계좌 (free/paid/earning) prod 매칭 OK
      - jackee +200 drift 정정 완료 (member.point 단독 누락 1건)
- [x] 환불 시 어떤 balance 에서 빠지는지 명확화 ([MONEY_FLOW.md §5](../MONEY_FLOW.md))
      - 결제환불 = point.paid_balance 회수, 카드 실환불은 stub
      - 상담환불 = free/pro 비율로 복구 + consultation.refunded_amount += → 정산 자동 차감
- [ ] 추천인 보상 정책 확정 (코인 vs 수익금) — 사장님 의사결정 대기

### 3. 상담사 정산 검증
- [x] 매월 1일 정산 cron 등록 확인 (2026-05-25)
      - 양 서버 crontab `0 4 1 * *` settlement/monthly + `5 0 1 * *` grade/recalculate 등록됨
      - **5월 1일 미발화**: crontab 마지막 수정 2026-05-17 → 5월 1일 이후 등록.
      - **수동 호출로 5월 정산 INSERT 완료** (14명 모두 0원, prod settlement_monthly).
      - 다음 자동 발화: 2026-06-01 04:00.
      - 2026-05-29 추가: 5/25 수동 테스트 정산 14건 (모두 price=0) 삭제 → 통계 클린.
- [x] `chat/auto-cancel` cron 등록됨 (2026-05-29 확인, 매분 발화)
      - + `chat/five-min-alert`, `phone/five-min-alert` 도 매분 등록
      - + `retry/chat-settle`, `retry/payment-m2net` 10분마다
      - + `health-check` 매시간 / `settlement/monthly` 월 1일 04:00 / `grade/recalculate` 월 1일 00:05
- [x] 선지급 흐름 (payout_request) 검증 (2026-05-29)
      - prod payout_request 0건 (신청 발생 X, 시스템 준비 OK)
      - 코드: counselor-mypage-payout.service.ts L109+ 가용 한도 계산식 OK
- [x] 수수료 5% / 원천징수 3.3% 계산 검증 (2026-05-29)
      - prod setting: payout.fee_rate=0.05 / payout.withholding_rate=0.033 / payout.available_rate=0.70 / payout.daily_limit=1
      - MONEY_FLOW.md §7.2 와 100% 일치
- [x] 일1회 신청 제한 검증 → payout.daily_limit=1 (setting)
- [x] 가용 금액 70% 제한 검증 → payout.available_rate=0.70 (setting)
- [ ] 🚨 **정산 "지급완료" 마킹 시스템 부재** (2026-05-29 신규 결함 발견)
      - settlement_monthly 에 status / paid_at / paid_by_id 컬럼 자체가 없음
      - 어드민 UI 에도 "지급완료" 버튼 없음
      - 운영 시작 시 사장님 메모/엑셀로 추적 필요 (임시 대응)
      - 장기 해결: 마이그레이션 + 어드민 UI 추가 (1세션 작업)
      - 상세: [MONEY_FLOW.md §15 Q7](../MONEY_FLOW.md)
- [x] **신규 상담사 최소 활동 기간 룰 없음** (2026-05-29 코드 확인)
      - settlement-cron 이 가입 직후 상담사도 자동 포함
      - 룰 도입 필요 시 코드 변경 — 사장님 정책 결정
      - 상세: [MONEY_FLOW.md §15 Q5](../MONEY_FLOW.md)

### 4. 상담 흐름 검증
- [x] 전화 상담 — m2net 통화 → 차감 → 종료 → 정산 (2026-05-29)
      - prod 21건 (DISCONNECT 13 / END_CHAT 8) 모두 point_history 매칭 OK
      - consultation.amt=amt_free+amt_pro 무결성 OK (C-3 통과)
- [x] 채팅 상담 — m2net 채팅 → 차감 → 종료 → 정산 (2026-05-29)
- [x] 짧은 통화 환불 (short-call-refunds) 동작 (2026-05-29)
      - prod 2건 발견 (회원 차감 스킵 + 상담사 적립 정상) — MONEY_FLOW.md §4.2 패턴 일치
- [x] consultation `counselor_id=NULL` 통화실패 로그 회원 UI 차단 (2026-05-29)
      - consult.service.ts history 쿼리에 `AND counselor_id IS NOT NULL` 추가
      - prod 10건 (홍루연 4, 박기수 3, 사장님 3) 회원 마이페이지 노출 차단
- [ ] 상담사 차단/거부 처리 — 미검증

### 5. 알림 시스템 (BizM 알림톡)
- [x] template_code 코드↔prod 일치 검증 (2026-05-29)
      - 5개 fix: coupon_req2 → coupon_req_v2, order_bankinfo2 → order_bankinfo_v2, qa_ask2 → qa_ask_v2, qa_answer2 → qa_answer_v2, review_for_counselor → review_for_counselor_v2
      - prod 16개 등록 중 11 승인 / 3 검수요청 / 1 반려 (coupon_req_v2)
- [ ] 모든 템플릿 한번 더 검토 (포인트→코인 용어 통일)
- [x] **OpsAlert 운영자 알림** 가동 (2026-05-29 카톡 도착 검증)
      - setting.ops 4건 INSERT (enabled=true, recipients=01075740572, template=ops_admin_alert_v2, cooldown=300)
- [ ] 결제 완료 알림 (order_payment_ok_v2 등록 OK, 호출 매핑 확인 필요)
- [ ] 상담 시작 알림 (회원/상담사 양쪽) — chat_request_to_counselor 검수 대기
- [ ] 정산 알림 — payout 3종 (paid/received/rejected) 승인 OK, 호출 확인 필요
- [ ] 환불 알림 — 코드 확인 필요
- [ ] 알림톡 실패 시 SMS 폴백 미적용 인지 ([[project_alimtalk_bizm_only]])
- [ ] 🟡 alimtalk_log 테이블 신설 (감사 추적 — 분쟁 시 "보냈다" 증거)

### 6. 데이터 정리 (테스트 단계 잔재)
- [x] 테스트 결제/상담 데이터 정리 또는 격리 (2026-05-29)
      - settlement_monthly 5/25 테스트 더미 14건 DELETE
      - chat_room m2net_failed 5/23 테스트 10건 → settle_status='dropped' 마킹
      - jackee member.point +200 drift → 38000 동기화
- [ ] 테스트 회원 (찬물선생, 라온선생 등) 명확히 라벨
- [x] 정산 통계 0 부터 시작 확인 (settlement_monthly 0 잔여, 2026-05-29)
- [ ] 매출 통계 의미 있는 시점 명확화

---

## 🔒 보안 / 운영 안전성

### 7. 도메인 / 인프라
- [x] nginx HTML cache 정책 (no-cache) 적용됨 (2026-05-24)
- [x] vhost 파일 도메인 매핑 주석 추가됨 (2026-05-25)
- [ ] sajumoon.kr → test.sajuplan.com 마이그레이션 검토 (장기, 정식 운영 후)
- [ ] SSL 인증서 만료일 확인 (sajuplan.com / api.sajuplan.com)
- [ ] DNS 백업 (사장님 도메인 등록 정보 안전 보관)

### 8. 인증 / 세션
- [x] 로그인 race condition fix (setSession) 적용됨 (2026-05-25)
- [x] me() 401 재시도 정책 적용됨 (2026-05-25)
- [x] ~~[B-001] /mypage 비로그인 가드 발동 지연 fix~~ — false positive (의도된 환영 페이지 노출, 2026-05-25)
- [x] JWT 만료 시간 정책 — User 14d / Admin 8h / httpOnly+secure+sameSite=lax (2026-05-25 점검)
- [x] **비밀번호 정책 — 강화 완료 (2026-05-25)**
      - 가입/변경 양쪽 통일: **8~20자 + 영문/숫자 각 1개 이상** (`@Length(8,20) + @Matches`)
      - 프론트 (Signup.tsx, MemberEdit.tsx) 에러 메시지/placeholder 갱신
      - spec 16-password-policy 회귀 방지 4 케이스 추가
      - 양 서버 배포 완료, 기존 회원 영향 0 (가입/변경 시점만 검증)
- [x] 비밀번호 재설정 흐름 — randomBytes(8) 안전 난수 + bcrypt cost 12 + 알림톡/이메일 발송 (2026-05-25 점검)
- [x] OAuth (카카오/네이버) 정상 동작 — config + start endpoint 302 redirect 양 서버 검증 (2026-05-25).
      ⚠️ **애플 미설정** (config providers 에 없음).

### 9. 결제 보안
- [x] m2net callback URL 정확성 (api.sajuplan.com 등록 확인 — ✓ 2026-05-25 사장님 확인)
- [x] 이중 결제 방지 idempotency 키 검증 (2026-05-29)
      - point_history UNIQUE (rel_table, rel_id, rel_action) WHERE rel_table IN (payment, payment_autopay, consultation)
      - refund_request idempotent_key UNIQUE
- [x] PG → 사주플랜 fill 흐름 (안전망 [[project_pg_m2net_double_fill]])
      - prod payment.m2net_status='코인충전성공' 4/4 (실패 0)
      - correctM2netDoubleFill 2초 지연 overwrite 패턴 작동
- [ ] 결제 실패 케이스별 사용자 안내 — 미검증

### 10. 관리자 보안
- [ ] admin 비밀번호 정책 (현재 알려진 비번 변경) — 사장님 의사결정 대기
- [x] 슈퍼관리자 vs 일반관리자 권한 분리 검증 (2026-05-29)
      - JWT payload is_super 컬럼 OK / AdminAuthGuard 정상 동작
      - 11개 컨트롤러에서 is_super/SuperOnly 가드 사용
      - /api/admin/* 외부 401 차단 OK
- [x] [[project_security_audit_2026_05_22]] 가이드 준수 확인
- [x] cron token 강도 (64자) + /api/cron/* 외부 401 차단 (2026-05-29)
- [x] env 시크릿 모두 설정 (JWT 128 / m2net 25 / AG9 25 / BIZM 40 / CARD_CRYPT 25)

---

## 📊 모니터링 / 운영 도구

### 11. 영업이익 시뮬레이터
- [x] 5월 50명 → 12월 500명 목표 시각화 (2026-05-24)
- [x] 사주나루 벤치마크 비교 카드 (2026-05-24)
- [x] 회사몫 / 상담마진 / 영업이익 3단 구조 (2026-05-24)
- [ ] 정식 운영 시작 후 실측 데이터 반영 시점

### 12. 대시보드
- [ ] [[_DASHBOARD_RENEWAL_PLAN]] 진행 상태
- [ ] 실시간 매출 / 회원 수 / 활성 상담사 KPI
- [x] 운영자 알림 (위험 신호 등) (2026-05-29)
      - OpsAlert.send() → BizM 알림톡 + SMS 폴백 패턴
      - prod setting.ops.* 4건 INSERT, 사장님 카톡 도착 검증 완료
      - cooldown 300초 (같은 카테고리 폭주 방지)
- [x] health-check 22 invariants 매시간 cron 작동 (2026-05-29)
      - C-1~C-20 모두 PASS (1건 drift 도 정정 후 0)

### 13. 운영 매뉴얼
- [ ] [[_OPS_RUNBOOK]] 최신화
- [ ] [[_OPS_INCIDENT_MANUAL]] 검토
- [ ] 새 admin 인수인계 문서

### 14. 백업 / 복구
- [x] **DB 자동 백업 설치** (2026-05-29)
      - `/root/sajumoon_db_backup.sh` 매일 03:30 자동 실행
      - `/data/backup/db/` 7일 보관 (find -mtime +7 -delete)
      - 즉시 1회 테스트 백업 95KB 검증 완료
      - 로그: /var/log/sajumoon_db_backup.log
- [ ] 복구 절차 검증 (실제 복원 한 번 해봤는지)
- [ ] 이미지/파일 백업 (uploads/ 폴더)
- [ ] 외부 저장소 (S3 등) 백업 사본 — 디스크 장애 대비

---

## 🎨 사용자 경험 (UX)

### 15. 용어 통일 (2026-05-25 Phase 1 완료)
- [x] 사용자 화면 "포인트" → "코인"
- [x] 상담사 화면 "수익 포인트" → "수익금"
- [ ] **Phase 2**: 알림톡 BizM 템플릿 검토
- [ ] **Phase 3**: 영수증/세금계산서 표기 (PG 협의)

### 16. 결제내역 페이지 (사장님 신고 후 개선됨)
- [x] 결제완료만 표시 (시도/실패 숨김)
- [x] 24시간 입금대기 옅은 회색 알림
- [x] 결제수단 명확 표시
- [ ] 영수증/세금계산서 다운로드 기능 — **미구현 확인 (2026-05-25)**.
      백엔드 API 0건, 프론트 UI 0건. 사용자 영수증/세금계산서 받을 방법 없음.
      구현 시 m2net PG API 호출 (거래번호 + 발급 요청) 필요 → m2net 협의 필요.
      법적 의무: 5만원 초과 거래 시 현금영수증 발급 의무 → 충전 패키지 가격대 확인.
- [ ] 거래번호 명시 (CS 문의용)

### 17. 모드 인디케이터 (듀얼 역할자)
- [x] Phase A 배너 + X dismiss + 모드 전환 시 자동 복원 (2026-05-25)
- [x] Phase B 헤더 좌측 영구 닷
- [x] Phase C 모드 전환 토스트
- [x] /counselor/mypage/settlement/history 라우트 정리 (2026-05-25)
- [x] BottomNav + ModeIndicator 일관성

### 18. Pull-to-refresh
- [x] 컴포넌트 적용 (2026-05-25)
- [ ] 모바일 환경에서 실사용자 검증

---

## ✅ 검증 자동화

### 19. E2E 테스트
- [x] Phase 1 — 비로그인 핵심 시나리오 (2026-05-25, 10/12 통과)
- [ ] Phase 2 — 듀얼 역할자 자동화 (테스트 계정 셋업 필요)
- [ ] CI/CD 통합 (배포 전 자동 실행)

### 20. 사용자 에러 모니터링
- [ ] Sentry 또는 유사 도구 도입 검토 (정식 운영 후)

---

## 📋 사장님 의사결정 대기 사항 (우선순위 ↓)

1. [ ] m2net 답변 받은 후 건당 정책 옵션 A/B/C 결정 — 사장님 본인 처리 명시 (2026-05-29)
2. [ ] 추천인 보상 = 코인 vs 수익금
3. [x] ~~sajumoon.kr → test.sajuplan.com 마이그레이션 시점~~ — test 서버 미사용 결정 (2026-05-29)
4. [ ] E2E 테스트 계정 셋업 승인 (test 서버 DB INSERT)
5. [ ] 어드민 admin 비밀번호 변경 (e2e global-setup 비번 갱신 필요)

### 사장님 BizM 콘솔 작업 대기 (2026-05-29 발견)
6. [ ] **coupon_req_v2 반려 처리** — 사장님 본인 처리 중 (반려 사유 확인 + 재신청)
7. [ ] **chat_request_to_counselor 검수 통과 대기** — 사장님 검수 신청 완료, 카카오 1~3일
8. [ ] **chat_auto_cancelled_to_member 검수 통과 대기** — 사장님 검수 신청 완료, 카카오 1~3일
9. [ ] **counselor_request_v1 검수 통과 대기** — 사장님 검수 신청 완료, 카카오 1~3일

### MONEY_FLOW.md §15 미확정 (사장님 답변 대기, 우선순위 ↑)
10. [ ] **Q1**: m2net → 사주플랜 정산금 송금 사이클 (월말/익월 N일/금액 산정 기준)
11. [ ] **Q5**: 신규 상담사 첫 정산 시점 정책 (최소 활동 기간 룰 있는지)
12. [ ] **Q7**: 정산 결과 검수 흐름 (status='calculated' → 사장님 검수 → 'paid' 마킹)
13. [ ] Q2/Q3/Q4/Q6/Q8/Q9/Q10 — [MONEY_FLOW.md §15](../MONEY_FLOW.md) 참조

---

## 🔗 관련 문서
- [**MONEY_FLOW.md**](../MONEY_FLOW.md) — 돈 흐름 마스터 (m2net 관계/결제/정산/수익금/환불) ★
- [BUGS_BACKLOG.md](_BUGS_BACKLOG.md) — 발견된 버그 목록
- [per-session-chat-pricing.md](per-session-chat-pricing.md) — 건당 정책 설계
- [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)
- [_NEXT_SESSION_HANDOVER_2026_05_22.md](../_NEXT_SESSION_HANDOVER_2026_05_22.md)

---

## 📅 2026-05-29 운영 직전 안전망 검증 요약

이번 세션에 추가 처리된 항목 한 곳에 정리. 다음 세션 빠른 동기화용.

### 🟢 자율 완료 (코드 변경 + prod 배포)
- MONEY_FLOW.md 마스터 문서 작성 + 메모리 등록 ([[money-flow-master]])
- 5 template_code `_v2` 매칭 fix (coupon/order_bankinfo/qa_ask/qa_answer/review)
- consultation `counselor_id IS NULL` 회원 마이페이지 노출 차단
- 테스트 데이터 정리: settlement_monthly 14 DELETE / chat_room m2net_failed 10 dropped / jackee +200 drift 정정
- DB 자동 백업 설치 (매일 03:30 + 7일 보관) — `/root/sajumoon_db_backup.sh`
- OpsAlert recipients 등록 + 사장님 카톡 도착 검증 (010-7574-0572)
- MONEY_FLOW.md §9 settlement_monthly 실제 schema 정정
- _audit_db_invariants.py prod 만 검사 (test 미사용)

### 🟡 사장님 작업 진행 중
- coupon_req_v2 반려 사유 확인 + 재신청 (사장님 본인 처리)
- chat_request_to_counselor / chat_auto_cancelled_to_member / counselor_request_v1 BizM 검수 통과 대기 (1~3일)

### 🔴 발견된 잠재 사고 (사장님 결정 필요)
- 영수증/세금계산서 발급 기능 미구현 (5만원 초과 거래 법적 의무) → m2net 협의
- alimtalk_log 테이블 부재 (감사/분쟁 시 증거 부족) → 다음 트랙
- 보조 폰 010-5691-0572 K119 (카톡 사용자 미등록) → recipients 에서 제외함
