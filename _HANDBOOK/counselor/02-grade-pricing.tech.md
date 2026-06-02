# [AI 전용] 등급별 단가 — 기술 상세

## 등급 정책 박제

메모리 `[[grade-system-plan]]` + `_NEXT_SESSION_등급단가시스템.md`:
- 등급: '일반' / '우수' / '특급'
- 단가 차이는 상담사 정산 측. 회원 차감은 동일 (정책 통일)
- 변경 시 소급 X — consultation.amt 가 시점 확정

## DB

```
member
- grade VARCHAR — '일반' / '우수' / '특급'
- grade_changed_at TIMESTAMPTZ

grade_pricing (운영자 설정)
- grade VARCHAR (PK)
- per_minute_rate INT — 분당 단가 (원)
- margin_pct DECIMAL — 회사 마진 비율
- updated_by INT FK admin
- updated_at TIMESTAMPTZ

grade_history (변경 이력)
- member_id, old_grade, new_grade, reason, changed_by, changed_at
```

## 단가 적용 (consultation.amt 확정)

`api/src/pg-callbacks/m2net-push.service.ts` END_CHAT:
```typescript
const counselor = await this.sql`SELECT grade FROM member WHERE id=${counselorId}`
const pricing = await this.sql`SELECT per_minute_rate FROM grade_pricing WHERE grade=${counselor.grade}`
const amt = Math.floor(use_seconds / 60 * pricing.per_minute_rate)
await this.sql`UPDATE consultation SET amt=${amt} WHERE id=${consultId}`
```

## 핵심 코드 위치

- 등급 관리: `api/src/admin/grade/grade.service.ts`
- 단가 적용: `api/src/pg-callbacks/m2net-push.service.ts`
- 회원 화면 단가 표시: `web/user/src/pages/CounselorDetail.tsx`

## 운영 SQL

```sql
-- 등급별 분포
SELECT grade, COUNT(*) FROM member WHERE role='counselor' GROUP BY grade;

-- 등급별 매출 (월별)
SELECT
  m.grade,
  DATE_TRUNC('month', c.started_at) AS month,
  COUNT(*) AS sessions,
  SUM(c.amt) AS total_amt
FROM consultation c
JOIN member m ON m.id = c.counselor_id
WHERE c.started_at >= NOW() - INTERVAL '6 months'
GROUP BY m.grade, month
ORDER BY month DESC, m.grade;
```

## 관련 메모리

- `[[grade-system-plan]]`
- `[[counselor-grade-pricing]]` (있다면)
