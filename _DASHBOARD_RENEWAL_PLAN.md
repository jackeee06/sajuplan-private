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
