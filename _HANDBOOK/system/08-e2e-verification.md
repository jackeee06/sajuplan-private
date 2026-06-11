# E2E 엄격검증 전체 결과 (2026-06-06, v2)

## 한 줄로 답하면
**2026-06-06 기준, Playwright E2E 자동 테스트 41개 스펙 파일 / 270+건 시나리오 전수 통과. 실 데이터(쿠폰/후기코인/선지급)까지 검증 완료. 수정 버그 2건.**

---

## 2026-06-11 운영 직전 적대적 정밀점검 (1~5순위)

축1(무에러 전수 스캔) + 축2(적대적 엣지 — "깨뜨리려" 찌르고 전부 막히는지 확인) 방식으로 보강.
**모두 "차단" 케이스 위주 → 운영 데이터 오염 0.**

| 순위 | 영역 | 신규 spec | 결과 |
|---|---|---|---|
| 1·2 | 돈 + 핵심 사용자 흐름 | 53(무에러스캔) · 54(인증) · 55(후기) · 56(문의) | self 소유권 4곳 수정(JWT sub) |
| 3 | 상담사 기능 (선지급/단가/정산) | 57-counselor-edge (17건) | 0 버그 — 경계·소유·역할 전부 차단 |
| 3·4 | 상담사 전탭 + 관리자 돈/회원 페이지 무에러 스캔(375px) | 59-counselor-admin-scan (30건) | **버그 2건 발견·수정** ↓ |
| 4 | 관리자 돈 라우트 (포인트/정산) | 58-admin-guard-edge (12건) | 0 버그 — 비로그인·회원·상담사 토큰 전부 401 |
| 5 | 시스템/설정 | 09·12·26·40 회귀 | spec 09 flaky locator 수정(strict-mode) |

### 축1 스캔에서 발견·수정한 버그 (spec 59, 2026-06-11)
- **B-1 SettlementHistory 가로 오버플로우(397px)**: 날짜검색 행의 `<input type=date>` 가 flex-1 로도 안 줄어들어(네이티브 최소폭) 375px 초과. → 인풋에 `min-w-0`, 버튼에 `shrink-0` 추가.
- **B-2 CounselorMyReferral 카카오 공유 버튼 깨진 이미지**: `/img/kakao_logo.png` 404(자산 없음). onError 로 숨겨져 로고만 비어 보였음. → `/img/icon-kakao.svg` 로 교체.

### 점검 결과 (코드 정밀 — 직접 정독)
- **선지급/포인트/정산 서비스**: 트랜잭션·FOR UPDATE·advisory lock·음수방지·멱등 모두 견고. 0 버그.
- **⚠️ 보고대상(정책 결정 필요) — 일반관리자 전화번호 마스킹 우회**: `members.controller.canShowPhone` 가
  일반관리자에 대해 `?show_phone=1` 쿼리값만 신뢰. 문서상 의도("슈퍼가 켠 시간제한 토글 ON 시만")의
  **서버측 강제가 없어** 일반관리자가 파라미터로 전 회원 전화 평문 열람 가능. 권장: setting 테이블에
  슈퍼 전용 토글(만료시각 포함) 신설 후 서버에서 검증. **사장님 정책 결정 후 처리.**

- **권한 가드 하드닝**: user/admin 양 가드에서 JWT `sub` 를 `Number()` 정규화 → 향후 소유 비교 버그 원천 차단.
  상세: [권한 가드 하드닝](system/10-auth-guard-hardening)
- **코드 정밀점검 확정 버그 0건** — 검토 후보 3건은 전부 false positive(정상 동작). 상세는 tech 문서.
- spec 09(듀얼 모드)는 배너 정규식이 전환 토스트까지 매칭하던 **테스트 자체 결함**(strict-mode 2-element)을
  `$` 앵커(`/상담사 모드$/`)로 수정 — 제품 동작은 정상.

---

## 검증 범위 (5개 Phase)

| Phase | 내용 | 스펙 파일 | 결과 |
|---|---|---|---|
| Phase 1 | 돈 직결 (코인/결제/출석/후기/정산) | 10, 15, 17, 21, 30, 31, 32, 33, 34, 35 | ✅ 전체 통과 |
| Phase 2 | 사용자 핵심 흐름 (상담사 탐색/마이페이지/단골/후기/QnA) | 02, 06, 07, 08, 09, 11, 13, 14, 16, 18, 20, 22, 23, 24, 25, 28, 29, 36, 37 | ✅ 전체 통과 |
| Phase 3 | 상담사 기능 (마이페이지/등급/수익금/선지급) | 17, 38 | ✅ 전체 통과 |
| Phase 4 | 관리자 기능 (회원관리/포인트조정/결제/정산) | 01, 04, 05, 39 | ✅ 전체 통과 |
| Phase 5 | 시스템/설정 (운영바이블/AI/공지/FAQ/cron) | 12, 19, 26, 40 | ✅ 전체 통과 |
| 실 데이터 검증 | 쿠폰 사용, 후기 코인, 선지급 정책 | 41 | ✅ 전체 통과 |

---

## 검증 중 발견·수정된 버그

### 버그 1: 베스트 후기 코인 중복 지급 (2026-06-06)
- **증상**: 관리자가 베스트 ON/OFF를 반복할 때마다 10,000코인 중복 지급
- **원인**: SELECT→INSERT 패턴에서 동시 요청 race condition + DB UNIQUE 제약 없음
- **수정**: `ON CONFLICT DO NOTHING RETURNING id` + DB UNIQUE INDEX `uq_point_history_review_best`
- **E2E 검증**: `tests/32-best-review-idempotency.spec.ts` — ON→OFF→ON 반복 시 코인 변화 없음 확인

### 버그 2: 테스트 중 더미 계정 초과 코인 (2026-06-06)
- **증상**: dummy_cust_05(도윤) 계정에 130,000코인 (정상: 10,000)
- **원인**: 버그1 수정 전 테스트 과정에서 13회 중복 지급 누적
- **수정**: DB 직접 정리 (-120,000), UNIQUE INDEX 추가
- **E2E 검증**: 최종 잔액 10,000 확인

---

## 검증되지 않은 영역 (코드 외부 시스템)

| 영역 | 이유 | 대안 |
|---|---|---|
| 실제 카드 결제 | PG(AG9) 실제 결제 불가 | 수동 1회 실결제 테스트 |
| m2net 전화/채팅 | 외부 시스템 | m2net 콘솔 직접 확인 |
| BizM 알림톡 실수신 | 카카오 검수 필요 | 실 발송 1회 확인 |

---

## E2E 스펙 파일 목록 (e2e/tests/)

| 번호 | 파일명 | 내용 |
|---|---|---|
| 01 | 01-mng-login | 관리자 로그인 |
| 02 | 02-user-counselor-list | 상담사 목록 |
| 04 | 04-admin-pages | 어드민 페이지 |
| 05 | 05-all-admin-routes | 전체 어드민 라우트 |
| 06 | 06-user-mode-routing | 사용자 라우팅 |
| 07 | 07-user-bottom-nav | 하단 네비게이션 |
| 08 | 08-user-auth-stability | 인증 안정성 |
| 09 | 09-dual-role-mode | 듀얼 역할 모드 |
| 10 | 10-user-coin-terminology | 코인 용어 통일 |
| 11 | 11-user-public-pages-deep | 공개 페이지 심층 |
| 12 | 12-api-healthcheck | API 헬스체크 |
| 13 | 13-filter-dropdown | 필터 드롭다운 |
| 14 | 14-member-area | 회원 영역 |
| 15 | 15-charge-flow | 충전 흐름 |
| 16 | 16-password-policy | 비밀번호 정책 |
| 17 | 17-payout-policy | 선지급 정책 |
| 18 | 18-password-change | 비밀번호 변경 |
| 19 | 19-five-min-alert | 5분 알림 |
| 20 | 20-review-five-min-policy | 후기 5분 정책 |
| 21 | 21-coin-payout-terminology | 수익금 용어 |
| 22 | 22-my-qnas | 내 문의 |
| 23 | 23-qna-crud | QnA CRUD |
| 24 | 24-counselor-qna | 상담사 QnA |
| 25 | 25-counselor-apply-style / 25-review-crud | 상담사 신청 / 후기 CRUD |
| 26 | 26-keyword-pin | 인기검색어 핀 |
| 27 | 27-counselor-apply-region | 상담사 신청 지역 |
| 28 | 28-counselor-badge / 28-counselor-detail-tabs | 뱃지 / 상세탭 |
| 29 | 29-my-calls-realdata | 내 통화 내역 |
| 30 | 30-coupon-m2net-sync | 쿠폰 동기화 |
| 31 | 31-coin-system / 31-review-system | 코인 시스템 / 후기 시스템 |
| 32 | 32-best-review-idempotency | 베스트 후기 멱등성 ★ |
| 33 | 33-attendance-coin | 출석 코인 |
| 34 | 34-review-coin-realcheck | 후기 코인 실검증 |
| 35 | 35-settlement-logic | 정산 계산 로직 |
| 36 | 36-favorites | 단골 기능 |
| 37 | 37-mypage-full | 마이페이지 전체 |
| 38 | 38-counselor-mypage | 상담사 마이페이지 |
| 39 | 39-admin-members | 관리자 기능 |
| 40 | 40-system-handbook | 운영바이블/시스템 |
| 53 | 53-no-error-scan | 무에러 전수 스캔 (375px) ★ |
| 54 | 54-auth-b1-edge | 인증 적대적 엣지 |
| 55 | 55-review-edge | 후기 적대적 엣지 |
| 56 | 56-qna-edge | 문의 적대적 엣지 |
| 57 | 57-counselor-edge | 상담사 적대적 엣지 (선지급/단가/소유권) ★ |
| 58 | 58-admin-guard-edge | 관리자 돈 라우트 가드 차단 ★ |
| 59 | 59-counselor-admin-scan | 상담사 전탭+관리자 돈/회원 무에러 스캔 (375px) ★ |

---

## 이건 정상인가요? 에러인가요?

| 상황 | 판단 |
|---|---|
| E2E 0 failed | ✅ 모든 시나리오 정상 |
| 실제 카드 결제 E2E 없음 | ✅ 정상 (외부 PG 불가) |
| 출석 API `/attendance/today` (status 아님) | ✅ 정상 엔드포인트 확인됨 |
| 단골 API `POST /counselors/:id/like` | ✅ 정상 경로 확인됨 |
| 선지급 이력 배열 직접 반환 (items 래퍼 없음) | ✅ 정상 설계 |

---

## 관련 항목
- [사고 매뉴얼](system/03-incident)
- [cron 잡 전수](system/04-cron-jobs)
- [운영 바이블 AI](system/07-handbook-ai)
