# [AI 전용] 등급별 단가 + 실시간 승급 — 기술 상세

## 개요

2026-06-07 실시간 승급 시스템 신설.
상담 종료 시마다 당월 누적 시간을 재산정해 다음 등급 임계값 달성 시 즉시 승급.

---

## DB 스키마

```sql
-- 등급 변경 이력 (기존 테이블, 실시간 승급도 여기에 기록)
member_grade_history
  - id, member_id
  - grade_before, grade_after
  - last_month_seconds  -- 실시간 승급: 당월 누적 초 / 크론: 전월 초
  - change_type         -- 'promote' | 'demote' | 'unchanged' | 'manual'
  - changed_by          -- 'realtime' | 'cron' | 'admin:N'
  - reason              -- '당월 누적 5.2시간 달성 → 즉시 승급' 등
  - created_at

-- 실시간 승급 이력만 조회 시: WHERE changed_by = 'realtime'
```

---

## 핵심 파일

| 파일 | 역할 |
|---|---|
| `api/src/shared/grade-upgrade/grade-upgrade.service.ts` | 실시간 승급 핵심 로직 |
| `api/src/shared/grade-upgrade/grade-upgrade.module.ts` | 모듈 정의 |
| `api/src/cron/grade-cron.service.ts` | 월 1일 크론 (강등 + unchanged) |
| `api/src/pg-callbacks/m2net-push.service.ts` | 상담 종료 후 checkAndUpgrade 호출 |
| `api/src/cron/settlement-cron.service.ts` | grade_at_session 별 구간 정산 |

---

## 실시간 승급 흐름

```
상담 종료 (DISCONNECT / END_CHAT / END_CHAT_LOCAL)
  ↓
m2net-push.service.ts → handleCallPush()
  ↓ (consultation INSERT + point 처리 트랜잭션 완료 후)
gradeUpgrade.checkAndUpgrade(counselorId)   ← void 호출
  ↓
  1. pg_advisory_xact_lock(7777003, counselorId) — 동시성 보호
  2. 당월 KST 시작~끝 범위 계산
  3. SELECT SUM(usetm) FROM consultation WHERE counselor_id=N AND created_at 범위
  4. setting 테이블에서 grade 임계값 로드 (thresholds.partner1~5)
  5. computeTargetGrade(totalHours, thresholds)
  6. targetRank > currentRank 이면 승급:
     - UPDATE member SET grade=targetGrade, unit_cost_changeable_at=NULL
     - INSERT member_grade_history (changed_by='realtime')
  7. setImmediate → sendAlimtalkByCode('counselor_grade_upgraded', phone, {...})
```

---

## 정산 크론 — grade_at_session 별 구간 정산

기존: 단일 등급 × 월 전체 amt 합산
변경: grade_at_session 별 그룹핑 → 각 등급의 정산률 적용

```sql
-- settlement-cron.service.ts 핵심 쿼리
SELECT
  COALESCE(c.grade_at_session, $current_grade) AS grade,
  SUM(GREATEST(c.amt_free - refunded_free, 0)) AS amt_free,
  SUM(GREATEST(c.amt_pro  - refunded_pro,  0)) AS amt_pro
FROM consultation c
LEFT JOIN refund_request rr ...
WHERE counselor_id = N AND created_at BETWEEN month_start AND month_end
GROUP BY COALESCE(c.grade_at_session, $current_grade)
```

각 grade 그룹에 해당 등급의 revenue_rate 적용:
```
priceFree += floor(rowAmtFree × ratePct / 100)
pricePaid += floor(rowAmtPro  × ratePct / 100)
```

---

## 수익금 내역 — grade_at_session 뱃지

`user/settlements/settlements.service.ts` incomeList():
- consultation.grade_at_session 컬럼 JOIN 해서 응답에 포함
- 프론트 SettlementHistory.tsx: 각 행에 등급 뱃지 표시

---

## API 엔드포인트

| 메서드 | 경로 | 용도 |
|---|---|---|
| GET | `/api/user/counselor-mypage/grade/progress` | 당월 진행상황 + 실시간 승급 이력 |
| GET | `/api/admin/grade/counselor/:id/realtime-upgrades` | 어드민: 실시간 승급 이력 |
| GET | `/api/admin/grade/counselor/:id/grade-history` | 어드민: 전체 이력 (기존) |

---

## 알림톡 템플릿

`counselor_grade_upgraded`
- 변수: `#{counselor_name}`, `#{new_grade}`, `#{hours}`
- BizM 콘솔 등록 필요 (검수 후 작동)
- 미등록 시: template_not_found → alimtalk_log에 실패 기록, 승급 자체는 정상

---

## 인덱스 (마이그레이션 20260607000000_realtime_grade_upgrade.sql)

```sql
CREATE INDEX idx_grade_history_realtime ON member_grade_history(member_id, changed_by, created_at DESC);
CREATE INDEX idx_consultation_counselor_reason_created ON consultation(counselor_id, reason, created_at DESC);
```
