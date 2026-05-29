# 🚀 사주플랜 운영 시작 D-Day 체크리스트

> **사용법**: 사장님이 "오늘부터 정식 운영 시작!" 누르기 직전, 이 체크리스트를 위에서 아래로 한 번에 점검. 모두 ✅ 면 시작 가능.
>
> **작성**: 2026-05-29
> **소요 시간**: 약 15분 (사장님 + Claude 협업)

---

## ☑️ Phase A: BizM 검수 통과 확인 (사장님 손)

- [ ] **chat_request_to_counselor** — BizM 콘솔 → 알림톡 템플릿 → 상태 "승인" 확인
- [ ] **chat_auto_cancelled_to_member** — 동일
- [ ] **counselor_request_v1** — 동일
- [ ] **settlement_complete** — 동일 (방금 등록한 것)

→ 모두 ✅ 가 아니면 → 검수 통과까지 1~2일 더 기다림 (잠시 잠금)

## ☑️ Phase B: 운영자 알림 (OpsAlert) 정상 작동

- [ ] **사장님 카톡에 테스트 알림 도착** — Claude 에게 "테스트 알림 보내줘" 한 마디
- [ ] **카톡 도착 시간 1분 이내**

→ 안 오면 → BIZM_USER_ID 설정 / setting.ops.recipients 확인

## ☑️ Phase C: 백업 정상

- [ ] **DB 백업 어제 파일 존재**:
  ```bash
  ls -la /data/backup/db/sajumoon_$(date +\%Y\%m\%d -d yesterday)*.sql.gz
  ```
- [ ] **uploads 백업 가장 최근 일요일 파일 존재**:
  ```bash
  ls -la /data/backup/uploads/
  ```

→ 없으면 → 수동 실행 후 cron 점검

## ☑️ Phase D: health-check 깨끗 (22 invariants)

- [ ] **C-1~C-20 모두 0건** (음수 잔액 / drift / 정산 중복 / 정산률 범위 등)
- [ ] **C-17 m2net_failed 0건** (정리됨)
- [ ] **C-16 결제 retry 0건**

```bash
SSHPASS=... python tools/_audit_db_invariants.py
```

→ 위반 있으면 → 정리 후 시작

## ☑️ Phase E: 테스트 데이터 분리 (선택)

운영 시작 후 통계 깔끔 위해:

- [ ] **사장님 본인 정산/상담 데이터** — 운영 통계와 분리하고 싶은지 결정
  - 옵션 A: 그대로 유지 (실 운영 시작 후 자연스럽게 비율 작아짐)
  - 옵션 B: mb_id 별도 라벨 (`is_test_account` 컬럼 추가)
  - **Claude 추천**: A (단순)

## ☑️ Phase F: cron 정상 작동 확인

- [ ] **crontab -l 11개 등록**:
  ```
  3 10 * * *           acme.sh
  5 0 1 * *            grade/recalculate
  0 4 1 * *            settlement/monthly  ★
  5,15,25,35,45,55 * * * *    retry/chat-settle
  0,10,20,30,40,50 * * * *    retry/payment-m2net
  0 * * * *            health-check
  * * * * *            chat/auto-cancel
  * * * * *            chat/five-min-alert
  * * * * *            phone/five-min-alert
  30 3 * * *           db_backup
  0 4 * * 0            uploads_backup
  9 0 * * *            daily-summary  (오늘 신설)
  ```

## ☑️ Phase G: 사장님 비밀번호 정책

- [ ] **admin 비밀번호 변경** (현재 알려진 비번 → 새 비번)
- [ ] **사장님 본인 회원/상담사 계정 비밀번호 변경**

## ☑️ Phase H: 운영 매뉴얼 사장님 1회 정독

- [ ] **MONEY_FLOW.md** — 돈 흐름 전체 (50KB, 정독 30분)
- [ ] **ALERT_MAPPING.md** — 알림 시스템
- [ ] **_OPS_INCIDENT_MANUAL.md** — 사고 시 대응
- [ ] **_OPS_RUNBOOK.md** — OpsAlert 도착 시 대응

## ☑️ Phase I: 사장님 첫 1주 일과 약속

매일 아침 (Claude daily-summary 카톡 도착 후 — 매일 09:00):

- [ ] **카톡 요약 확인** (어제 결제 / 상담 / 사고 0건)
- [ ] **health-check 결과 한 줄 확인**
- [ ] **OpsAlert 도착 알림이 밤사이 있었는지** — 있으면 어드민/SSH 즉시 점검

---

## 🚨 운영 시작 후 첫 1주 위험 시그널 (즉시 대응)

| 시그널 | 의미 | 대응 |
|---|---|---|
| OpsAlert 카톡 도착 | 사고 발생 | _OPS_INCIDENT_MANUAL.md 해당 카테고리 |
| health-check Critical | 데이터 무결성 위반 | _PRODUCTION_READINESS §12 |
| 회원 "결제했는데 코인 안 들어와요" | PG-m2net 동기화 사고 | MONEY_FLOW §13 H-1 안전망 가동 중인지 확인 |
| 상담사 "정산금 못 받았어요" | settlement_monthly status='paid' 미마킹 | 사장님 통장 송금 후 [지급완료] 버튼 잊었는지 |
| 회원 "카톡 못 받았어요" | 알림톡 누락 | alimtalk_log 조회 |

---

작성: 2026-05-29 (운영 시작 직전 안전망)
다음 업데이트: 운영 시작 후 1개월 — 실제 발생한 시나리오 반영
