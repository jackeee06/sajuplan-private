# DB 이상 감지 시스템 — 다음 세션 작업

> 작성: 2026-06-02
> 배경: 사업자 정보(footer) 데이터가 DB에 없었던 것을 사장님이 뒤늦게 발견.
>       백업만으로는 "언제 사라졌는지" 모르면 복원 시점을 놓칠 수 있음.

---

## 문제 핵심

- 매일 DB 백업은 있지만 **즉시 감지가 없으면** 뒤늦게 발견 → 7일 백업 기간을 넘기면 복원 불가
- 어떤 데이터든 사라지면 **다음날 아침 이전에 알아야** 복원 가능

---

## 만들어야 할 것

### 1. health-check에 핵심 수치 전날 대비 감시 추가

기존 health-check cron(매시간)에 아래 감시 항목 추가:

| 감시 항목 | 이상 기준 | 알림 |
|---|---|---|
| 회원수 | 전날 대비 10% 이상 감소 | OpsAlert |
| 상담사수 | 전날 대비 20% 이상 감소 | OpsAlert |
| footer 설정값 | 비어있음 | OpsAlert |
| setting 전체 키 수 | 전날 대비 감소 | OpsAlert |
| 결제 데이터 | 전날 대비 10% 이상 감소 | OpsAlert |

### 2. setting 테이블 일별 스냅샷

매일 새벽 setting 테이블을 JSON으로 별도 저장:
- 경로: `/data/backup/settings/settings_YYYYMMDD.json`
- Google Drive 동기화 포함
- 사람이 읽을 수 있는 형태 → 언제 값이 바뀌었는지 diff로 확인 가능

### 3. 중요 키 삭제 방지 DB 트리거 (선택)

footer, grade, settlement 등 핵심 namespace 키는 DELETE 시 알림 발송.

---

## 우선순위

1. **health-check 감시 추가** — 30분, 즉각 효과
2. **setting 스냅샷** — 15분, 히스토리 추적 가능
3. 트리거 — 복잡도 높음, 나중에

---

## 관련 파일

- `api/src/cron/health-check/health-check.service.ts` — 감시 항목 추가 위치
- `api/src/shared/ops-alert/ops-alert.service.ts` — 알림 발송
- `/data/backup/db/` — 기존 백업 경로
