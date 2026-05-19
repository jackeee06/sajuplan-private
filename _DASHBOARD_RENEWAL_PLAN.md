# 대시보드 재설계 — 전체 계획 + 진행 상황

> 합의일: 2026-05-19
> 목적: 1920×1080 한 화면에 핵심 정보 압축, 위→아래 의사결정 순. 좌측 정렬 + 조밀.
> 확인 URL: https://sajumoon.co.kr/mng/dashboard

---

## 5존 구성 (전체 청사진)

### Zone 1 — 즉시 보는 핵심 KPI (한 줄)
가장 위. 큰 숫자만. 클릭 시 상세 페이지 이동.

| 항목 | 데이터 출처 | 상태 |
|---|---|---|
| 오늘 매출 (어제 대비 %) | sales-trend 마지막 합산 | ✅ |
| 어제 매출 | sales-trend [-2] 합산 | ✅ |
| 이번달 매출 누적 | sales-trend 이번달 합산 | ✅ |
| 진행 중 상담 | summary.counselors.busy | ✅ |
| 활성 상담사 | summary.counselors.idle | ✅ |
| 오늘 가입 | summary.members.today | ✅ |
| 이번달 가입 | summary.members.this_month | ✅ |
| 총 회원 | summary.members.total | ✅ |

**결과**: 6 → 8개로 확장. xl:grid-cols-8.

### Zone 2 — 즉시 액션 필요 알림 큐
운영자가 매일 처리해야 할 일. 0건은 회색, 있는 건 빨강/주황. 클릭 시 해당 페이지로.

| 항목 | SQL source | 상태 |
|---|---|---|
| 추천수당 미지급 | counselor_referral active + settlement_monthly>0 + payment 없음 | ✅ |
| 결제 실패 (24h) | payment status='failed' 24h | ✅ |
| 신고 대기 | post_report status=0 | ✅ |
| 정산 음수 (60일) | settlement_monthly price<0 최근 60일 | ✅ |
| 알림톡 실패 (24h) | alimtalk_send_log status='failed' 24h | ✅ |
| 환불 발생 (24h) | refund_request 24h (참고용) | ✅ |

**결과**: 3종 → 6종으로 확장. count=0 도 항상 표시 (회색 톤).
**Note**: 원 계획의 "환불 대기" 는 refund_request 가 'approved' 만 INSERT 되는 schema 라 구현 불가 → 대신 "환불 발생(24h)" 모니터링으로 대체.
**Note**: 원 계획의 "정산 미처리" 는 settlement_monthly 의 status 컬럼 없어서 → "정산 음수" 로 의미 전환 (환불 많아 음수가 된 비정상 케이스).
**Note**: BizM 발송 실패 → alimtalk_send_log status='failed' 로 동일 의미 구현.

### Zone 3 — 매출 현황 (가로 3 컬럼 중 2)
- 좌: 14일 매출 추이 (Area chart, 070/060/채팅/충전 분리) ✅
- 우: 14일 매출/방문자 차트 또는 상담사 상태 ✅

### Zone 4 — 상담 현황
- 좌: 상담사 상태 분포 도넛 (idle/busy/absent) ✅
- 우: **14일 상담 건수 추이 (060/070/채팅 분리)** ✅ — 신규 endpoint `/admin/dashboard/consultation-trend` 추가

**Note**: 1차 리뉴얼에서는 방문자 추이로 대체했지만 2차에서 원래 의도대로 상담 건수 추이로 교체.

### Zone 5 — 최근 활동 (가로 3 컬럼)
- 최근 가입 5건 ✅
- 최근 게시물 5건 ✅
- 최근 포인트 거래 5건 ✅

---

## 추가 의견 (1차 리뉴얼 후 제안)

| 항목 | 상태 |
|---|---|
| KPI 카드 클릭 시 페이지 이동 | ✅ Link wrapping |
| 차트 높이 h-44 → h-48 | ✅ |
| KPI 6 → 8개 | ✅ |
| 알림 박스 항상 표시 (0건은 회색) | ✅ |
| 알림 source 5개 확장 (refund/settle/alimtalk) | ✅ 2차에서 완료 |
| 14일 상담 건수 추이 | ✅ 2차에서 완료 |

---

## 디자인 원칙 (전 페이지 공통)

- 좌측 정렬 + 콘텐츠 폭만큼 (`w-fit max-w-full`)
- 카드 padding 압축 (`p-2.5` ~ `p-3`)
- 행 간격 `space-y-3`
- 헤더 색: `bg-gray-50 dark:bg-gray-800/60` (보라 헤더 X)
- 행 hover: `hover:bg-brand-50 dark:hover:bg-brand-500/5`
- 차트 폰트 10px / 차트 높이 h-48
- 카드 클릭 시 hover 보라 border + 약한 shadow
- 다크 모드 색상 모두 보완

---

## 진행 차수 정리

| 차수 | 내용 | commit |
|---|---|---|
| 1차 | KPI 4 + 큰 카드 + 차트 + TOP5 + 최근활동 (기존 구조) | 이전 세션 |
| 2차 (2026-05-19) | 4 row 압축 리뉴얼 (KPI 6 + 3컬럼 차트 + TOP5 + 최근활동) | `247be7f6` |
| 3차 (2026-05-19) | KPI 8 + 클릭 이동 + 알림 박스 + 차트 +4px | `247be7f6` |
| 4차 (2026-05-19) | 알림 항상 표시 + 5개 페이지 표준 통일 | `9c286f46` |
| 5차 (2026-05-19) | 알림 6종 확장 + 상담 건수 추이 차트 | 진행 중 |

---

## 향후 추가 가능 항목 (작업 안 함)

- 알림 박스 새로고침 버튼 (현재는 페이지 reload)
- 차트 click-through (특정 일자 클릭 → 해당 일자 상세)
- KPI 카드 sparkline (1주일 미니 추이)
- 다크/라이트 모드 자동 전환

---

## 6차 — 운영 핵심 통합 (2026-05-19, _OPS_RUNBOOK 반영)

`_OPS_RUNBOOK.md` 매일 일과 + `_AUDIT_SUMMARY.md` 의 운영 안전망 을 대시보드로 통합.
운영자가 카카오톡 OpsAlert + 별도 curl 안 봐도 대시보드 한 화면에서 모든 상태 확인.

### 알림 6종 → 9종 확장 (Zone 2)
| 추가 | source | 의미 |
|---|---|---|
| 상담사 신청 대기 | counselor_apply status='pending' | 매일 검토할 가입 신청 |
| 미답변 후기(3일+) | post_review NOT EXISTS post_review_reply, 3일 이상 | 운영 품질 핵심 |
| retry 영구실패 | chat_room settle_status='permanently_failed' + payment m2net_retry_count>=5 | 정산/M2NET 영구실패 큐 |

### KPI 8개 일부 교체 (Zone 1)
- ❌ "이번달 가입" 제거 (오늘 가입만으로 충분)
- ❌ "총 회원" 제거 (변동 적음, 의사결정에 영향 적음)
- ✅ **오늘 출석 상담사** (오늘 1건 이상 한 상담사 / 전체) — 활동성 핵심
- ✅ **충전 잔액 (회사 부채)** — 유료+무료 합. 매일 변동 큰 운영 지표

### 신설 — 상담사 운영 패널 (Row 6, 6컬럼)
- 오늘 활성 상담사 명단 (TOP 5)
- 7일 0건 상담사 (이탈 위험 TOP 5)
- 미답변 후기 5건
- retry 영구실패 카운트 + 명단 5
- (선택) health-check 위반 카운트
- (선택) 최근 OpsAlert 발송 이력 5건

→ 이 Row 는 운영자 매일 처리 패널 역할.

### 추가 차트 후보 (8차 이후)
- 채널별 매출 도넛 (070/060/채팅/충전 비율)
- 시간대별 트래픽 (어느 시간에 통화/채팅 집중)
- 이번달 일별 매출 + 전월 동기 비교 (목표 달성률)
- 평균 후기 별점 추세

---

## 진행 차수 최종

| 차수 | 내용 | commit |
|---|---|---|
| 1차 | 기존 구조 (KPI 4, 큰 카드, 차트) | (이전 세션) |
| 2차 | 4 row 압축 리뉴얼 | `247be7f6` |
| 3차 | KPI 8 + 클릭 이동 + 알림 박스 | `247be7f6` |
| 4차 | 알림 항상 표시 + 페이지 표준 통일 | `9c286f46` |
| 5차 | 알림 6종 + 14일 상담 건수 추이 | `7663fd85` |
| 6차 (now) | 알림 9종 + 충전잔액 KPI + 오늘 출석 상담사 KPI + md 종합 | 진행 중 |
| 7차 (예정) | 상담사 운영 패널 Row 6 신설 (오늘 활성/이탈위험/미답변 명단) | — |
