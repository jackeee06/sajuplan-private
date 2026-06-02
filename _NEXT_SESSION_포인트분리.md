# 다음 세션 — 소비포인트 / 수익포인트 분리 작업

> 작성: 2026-05-22 (이번 세션 종료 시점)
> 우선순위: 큰 작업 (~7시간). 별도 신선한 세션에서 시작 권장.

> ✅ **prod DB 백업 완료** (2026-05-22 21:09)
>   - prod 서버: `/backup/before-point-separation-20260522-2109-full.sql` (471KB)
>                `/backup/before-point-separation-20260522-2109-core.sql` (27KB)
>   - 로컬: `c:/claudeworkspace/sajumoon/backup/prod_20260522-2109_full.sql` (481KB)
>           `c:/claudeworkspace/sajumoon/backup/prod_20260522-2109_core.sql` (27KB)
>   - test 서버: pg_dump 미설치로 스킵 (검증용 환경 — 영향 적음)
>   - 복구: `psql "$DBURL" < /backup/before-point-separation-20260522-2109-full.sql`

---

## 🎯 한 줄 요약

회원이 결제로 산 코인(소비포인트)과 상담사가 상담으로 번 코인(수익포인트)이 같은 `point.paid_balance` 컬럼에 섞여있어 향후 사고 위험. 완전 분리.

---

## 📋 결정 사항 (사장님 합의 완료)

### 1) 명명
- **소비포인트**: 회원이 결제로 산 코인 (회원이 서비스 받을 때 차감)
- **수익포인트**: 상담사가 상담 제공으로 번 코인 (매월 1일 정산 시 현금화)

→ "포인트" 단독 노출 금지. 항상 "소비포인트 / 수익포인트" 로 표기.

### 2) 분리 근거
| 항목 | 소비포인트 | 수익포인트 |
|---|---|---|
| 회계 분류 | 선수금 (회원에게 진 빚) | 미지급금 (상담사에게 줄 돈) |
| 발생 | 결제 / 환불 회복 / 이벤트 혜택 | 상담 제공 |
| 소멸 | 회원 상담 사용 시 | 매월 1일 정산 cron |
| 세무 | VAT 매출 | 사업소득 3.3% 원천징수 |
| 환불 가능 | YES | NO (정산 대상) |

향후 어떤 종류 (이벤트 보너스 / 추천 보상 / 상담사 보너스 등) 추가되어도 소비/수익 두 큰 분류 안에 자연 흡수 가능.

---

## 🗝 활용 가능한 기존 DB 흔적 (사장님 직감 적중)

`point_history.rel_table` 컬럼에 거래 종류 마커가 이미 살아있음:

| rel_table | 의미 | 분류 |
|---|---|---|
| `payment` / `payment_autopay` | 회원 결제 충전 | 소비포인트 |
| `consultation` (회원=고객 차감) | 회원이 상담 받음 | 소비포인트 (소진) |
| `consultation` (회원=상담사 적립) | 상담사가 상담 제공 | **수익포인트** (적립) |
| `refund_request` | 환불 | 소비포인트 (회수) |
| `settlement_monthly` | 월 정산 차감 | 수익포인트 (지급) |

추가로 `member.csrid` (상담사로서 m2net ID) vs `member.m2net_membid` (회원으로서 m2net ID) 가 같은 row 에 공존 — m2net 측에는 이미 두 잔액이 외부적으로 분리됨.

→ **별도 가정·휴리스틱 없이 데이터만으로 정확한 분리 가능. 사고 위험 낮음.**

---

## 📐 작업 청사진

### Phase 0: 다층 백업 (필수, 30분)

**① DB 백업 — prod 서버**
```bash
# prod 서버 SSH 접속 후
mkdir -p /backup
cd /data/wwwroot/api.sajumoon.co.kr
DBURL=$(grep "^DATABASE_URL=" .env | head -1 | sed "s/^DATABASE_URL=//; s/^['\"]//; s/['\"]$//")
TS=$(date +%Y%m%d-%H%M)
pg_dump "$DBURL" > /backup/before-point-separation-$TS.sql
# 또는 핵심 테이블만:
pg_dump "$DBURL" --table=point --table=point_history --table=member \
  > /backup/before-point-separation-core-$TS.sql
ls -lh /backup/before-point-separation-*.sql
```

**② DB 백업 — 로컬 다운로드** (prod 서버 사고 대비)
```bash
# Windows 로컬에서
SSHPASS='...' python -c "
import paramiko, os
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'])
sftp = ssh.open_sftp()
# /backup/ 의 최신 파일 다운로드
"
# 또는 단순히:
# scp root@104.64.128.103:/backup/before-point-separation-*.sql c:/claudeworkspace/sajumoon/backup/
```
로컬 저장 위치: `c:/claudeworkspace/sajumoon/backup/`

**③ test 서버에 똑같이 백업** (test 마이그레이션 검증 전)

**④ 코드 백업 — git commit + tag**
```bash
git add -A
git commit -m "snapshot: before point separation work (2026-05-22)"
git tag pre-point-separation-$(date +%Y%m%d-%H%M)
# 또는 .git/refs/tags/ 백업
```

**⑤ 마이그레이션 SQL 자체도 파일로 저장**
```
api/db/migrations/2026-05-XX-point-separation.sql
```
실행 전후 양쪽에서 검증 SQL 도 함께 보관.

**복구 시나리오 (사고 발생 시)**
- 마이그레이션 SQL 트랜잭션 안에서 실행 → `ROLLBACK;` 으로 즉시 복구
- 트랜잭션 후 발견 → `psql "$DBURL" < /backup/before-point-separation-*.sql` 로 복구
- prod 서버 자체 문제 → 로컬 백업 → 새 서버에 복원

---

### Phase 1: DB 스키마 + 마이그레이션 (1시간)
1. **백업 완료 확인** (Phase 0 의 5개 백업 모두 정상)
2. **스키마 변경** (트랜잭션 안에서):
   ```sql
   ALTER TABLE point ADD COLUMN earning_balance INTEGER NOT NULL DEFAULT 0;
   COMMENT ON COLUMN point.paid_balance IS '소비포인트 잔액 (결제 충전)';
   COMMENT ON COLUMN point.earning_balance IS '수익포인트 잔액 (상담사 적립, 미정산)';
   COMMENT ON COLUMN point.free_balance IS '소비포인트 무료분 (이벤트/혜택)';
   ```
3. **데이터 마이그레이션**:
   ```sql
   WITH earned_per_member AS (
     SELECT member_id,
            COALESCE(SUM(earn_point), 0) - COALESCE(SUM(use_point), 0) AS earned
       FROM point_history
      WHERE rel_table = 'consultation'
        AND member_id IN (SELECT id FROM member WHERE role = 'counselor')
      GROUP BY member_id
   )
   UPDATE point p
      SET earning_balance = GREATEST(e.earned, 0),
          paid_balance    = p.paid_balance - GREATEST(e.earned, 0)
     FROM earned_per_member e
    WHERE p.member_id = e.member_id;
   ```

### Phase 2: 백엔드 코드 (~3시간)
영향 파일 (예상):
- `api/src/pg-callbacks/m2net-push.service.ts` — 회원 차감 vs 상담사 적립 컬럼 분기
- `api/src/cron/settlement-cron.service.ts` — `earning_balance` 만 차감
- `api/src/admin/refunds/refunds.service.ts` — `paid_balance` 만 환불
- `api/src/user/charge/charge.service.ts` — 충전은 `paid_balance` 증가
- `api/src/admin/points/points.service.ts` — 어드민 포인트 조정 분기
- `api/src/admin/counselor-ops/counselor-ops.service.ts` — 분리 표시
- `api/src/admin/dashboard/dashboard.service.ts` — 충전금 부채 카드 분리
- `api/src/cron/health-check.service.ts` — 새 invariant 추가 (paid + earning = total)

### Phase 3: UI 라벨 전환 (~2시간)
- 어드민:
  - `web/mng/src/pages/CounselorList.tsx` — 포인트 컬럼 → "소비/수익" 두 컬럼
  - `web/mng/src/pages/CustomerList.tsx`
  - `web/mng/src/pages/CounselorForm.tsx` (포인트 조정 패널)
  - `web/mng/src/pages/PointHistoryList.tsx` — 흐름별 색 구분
  - `web/mng/src/components/CounselorOpsCompact.tsx` — "보유" 분리
  - `web/mng/src/pages/Dashboard.tsx` — "충전 잔액" 카드 분리
- 사용자:
  - `web/user/src/pages/CounselorMyPage.tsx` — "수익포인트" 명시
  - 회원 마이페이지 — "소비포인트" 명시
  - 충전 화면 / 정산 화면

### Phase 4: 배포 + 검증 (~1시간)
- API 외과 패치 (양 서버)
- mng + user 빌드 + minimal SFTP
- 엄격 검증:
  - 라온선생 (id=123): 소비포인트 0 + 수익포인트 1,000 분리 확인
  - 일반 회원: 소비포인트 그대로 + 수익포인트 0
  - 결제 흐름: 충전 시 소비포인트만 증가
  - 정산 흐름: 6월 1일 cron 이 수익포인트만 차감

---

## ⚠️ 주의 사항

1. **DB 백업 필수** (사장님 메모리: DB TRUNCATE CASCADE 사고 — 항상 백업)
2. **마이그레이션 SQL 트랜잭션 안에서** (BEGIN/COMMIT, 사고 시 ROLLBACK 가능)
3. **prod 라온선생 케이스 미리 시뮬레이션** (test 서버에서 마이그레이션 먼저 검증)
4. **health-check C-8 drift** — 마이그레이션 직후 잠시 발생 가능, 24h 이내 해소되는지 모니터링

---

## 🚀 다음 세션 시작 방법

새 세션에서 사장님이 입력할 첫 메시지:

```
_NEXT_SESSION_포인트분리.md 읽고 작업 시작해줘.
```

또는

```
포인트 분리 작업 시작. _NEXT_SESSION_포인트분리.md + 메모리 참고.
```

→ AI 가 자동으로:
1. 이 파일 읽기
2. 메모리 `project_point_separation_plan` 읽기
3. Phase 1 (DB 백업 + 스키마 변경 + 마이그레이션) 부터 단계별 진행
4. 사장님께 단계별 진행 보고 (자율 진행, 위험 단계만 GO 확인)

---

## 📁 참고 파일

- 메모리: `project_point_separation_plan.md`
- 관련 메모리: `project_id_unification_complete.md`, `feedback_db_truncate_cascade_disaster.md`
- 이번 세션 작업한 관련 파일들: `m2net-push.service.ts`, `settlement-cron.service.ts`, `counselor-ops.service.ts`, `CounselorOpsCompact.tsx`
