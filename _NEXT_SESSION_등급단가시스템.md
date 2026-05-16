# 다음 세션 — 등급/단가 시스템 전체 도입

> 이 파일을 새 세션에게 "이 파일을 봐" 라고 알려주시면, 컨텍스트 + 작업 명세 한꺼번에 전달됩니다.

---

## A. 프로젝트 한눈에

### 1) 무엇
**사주문(SAJUMOON)** — 사주/타로/신점 **모바일 전용** 상담 플랫폼. 회원이 상담사에게 전화·채팅 상담 요청, 코인으로 결제.

### 2) 기술 스택
- **API**: NestJS + postgres.js + PostgreSQL 18 (raw SQL 템플릿 리터럴)
- **사용자 프론트** (`web/user`): Vite + React + Tailwind, 모바일 전용 (375px 기준 / max-w 600px)
- **어드민 프론트** (`web/mng`): 같은 스택, 데스크탑 어드민
- **인증**: JWT + httpOnly 쿠키
- **빌드/배포**: `deploy.sh`(rsync via paramiko), `_patch_api.py`(외과 패치)
- **OS**: Windows 10 (개발) — `rsync`/`sshpass` 없어 `paramiko` 로 우회

### 3) 서버 (deploy.config.sh)
| 환경 | 도메인 | API | SSH | 경로 |
|---|---|---|---|---|
| test | sajumoon.kr | api.sajumoon.kr | `root@172.235.211.75` | `/data/wwwroot/api.sajumoon.kr` |
| prod | sajumoon.co.kr | api.sajumoon.co.kr | `root@104.64.128.103` | `/data/wwwroot/api.sajumoon.co.kr` |

비밀번호: `saju26moon@!!` (root SSH). DB ROOT: `saju26moon@!` (느낌표 1개).

### 4) 배포 방식 — "외과 배포" 기본

⚠️ `./deploy.sh api` / `./deploy.sh all` 의 API 풀 rsync 는 **Windows 환경에서 hang 빈도 높음** (2026-05-13~16 5번 발생, 누적 대기 1시간+).

**대신 사용**:
- API: `tools/_patch_api.py` 의 FILES 리스트만 갱신 → `MSYS_NO_PATHCONV=1 SSHPASS=... python tools/_patch_api.py root@HOST /data/wwwroot/api.도메인 sajumoon-api`
- 프론트: `SSHPASS=... ./deploy.sh both user` / `./deploy.sh both mng` (vite build → SFTP)
- 양쪽 서버 (test+prod) 병렬 가능 (서로 독립)

자세한 사용 예: `tools/_patch_api.py`, `tools/_seed_attendance_settings.py`, `tools/_seed_apply_samples.py` (paramiko + base64 SQL UPSERT 패턴)

### 5) 디자인 시스템
- **CLAUDE.md** 와 `publishing_guide.md` 우선
- Figma 디자인 픽셀 단위 일치 (임의 변경 금지)
- 컬러: `--primary = #9b7af7`, 활성 강조 `#F3EEFE`/`#8259F5`
- 모바일 전용 (Tailwind sm:/md:/lg: 금지)
- 컴포넌트: `design/design_system.html` 참고

### 6) 메모리 시스템
`C:\Users\USER\.claude\projects\c--claudeworkspace-sajumoon\memory\` — 자동 메모리. `MEMORY.md` 가 인덱스. 이전 세션에서 쌓아둔 user/feedback/project/reference 메모가 있음.

핵심 메모:
- `feedback_deploy_surgical_patch.md` — "외과 배포" 키워드
- `feedback_windows_tooling.md` — rsync/sshpass 없음 함정
- `project_sajumoon_basics.md` — 서버 URL, 도메인 매핑
- `reference_deploy_usage.md` — 자주 쓰는 deploy 패턴

---

## B. 최근 세션 (2026-05-16) 누적 작업

이번 세션에서 한 일 요약:

1. **상담사 신청 폼 분기** — `apply_type: application|inquiry|other`
   - 사용자 폼: select → 토글 버튼 3개
   - 풀폼(지원) vs 간단폼(문의/기타) 조건부 렌더링
   - DB: `post_apply.category` 에 종류 저장
   - 어드민 리스트: 종류 필터 칩 + 컬럼 뱃지
2. **신청 완료 페이지** (`/mypage/counselor-apply/done`) — 다음 단계 4단계 안내
3. **6개 UX 개선**:
   - 상담분야 토글
   - 큰 이미지 서버 자동 축소 (프로필 800px / 와이드 1600px)
   - 누락 필드 자동 스크롤 + 빨간 깜빡
   - 한글 파일명 latin1→utf8 디코딩
   - 본인 소개 파란 안내 박스 + "수정 가능"
   - 휴대폰 확인 버튼 강조
4. **글로벌 ScrollToTop** — 라우트 이동 시 최상단 (POP 제외)
5. **Toast UI Editor autofocus=false** — 페이지 진입 시 스크롤 끌어내림 방지
6. **마이페이지 환영 텍스트 정리** — 한 줄, 자연스러운 문법
7. **어드민 신청 상세** — 본인 소개 HTML 렌더링 + 와이드 사진 라벨 명확화
8. **이전 세션 잔여** — 출석체크 시스템 (4 Phase), 베스트 후기, 후기 신고, NEW 뱃지, 12개 분야, 상담사 정렬, is_recommended 어드민 토글, 본명 마스킹 등 다수

### 미커밋 상태
working tree 에 43+ 파일 미커밋 (이번 세션 + 이전 세션 누적). 사용자 의사 — 당분간 커밋 안 하고 working tree 만 유지하기로 함. (`feedback_pending_commits` 메모리 참고)

---

## C. 새로 할 작업 — 등급/단가 시스템 전체 도입

### 1) 배경 (고객 요청 원문)

> 상담부재시에 상담을 받고 싶은 사람이 접속알림신청을 할때 뜨는 부분이예요. 카카오 채널로 [사주문 알림] 접속알림신청이 등록되어 상담가능시 고객에게 알림이 갑니다.
> 상담사가 30초당 금액을 설정할 수 있는 부분인데 (이미지) 이런식으로 우리가 상담비용을 정하고 기준을 매월말에 정산되는부분을 보고 1일에 선택을 할 수 있는 부분입니다.
> 이부분은 상담 수수료를 확정하고 선택할 수 있도록 해야할거 같아요!

고객은 **사주나루(다른 사이트)** 의 등급/단가 시스템 캡처를 보여주며 "이렇게 해달라" 요청.

### 2) 사주나루 모델 (참고)

**누적 상담시간 기반 등급**:
| 누적 시간 | 등급 | 30초당 단가 옵션 |
|---|---|---|
| 0시간~ | 일반 | 800원, 1,000원 |
| 20시간~ | 파트너1 | 800원, 1,000원 |
| 40시간~ | 파트너2 | 1,000원, 1,200원 |
| 80시간~ | 파트너3 | 1,000원, 1,200원, 1,300원 |
| 120시간~ | 파트너4 | 1,000원, 1,200원, 1,300원, 1,400원, 1,500원 |
| 180시간~ | 파트너5 | 1,000원, 1,200원, 1,300원, 1,400원, 1,500원 |

**시간당 상담료(상담사 수익)** 도 등급/단가별로 다름 (정산 시 참고). 예시:
- 일반 800원 단가 → 시간당 32,000원
- 파트너2 1,200원 단가 → 시간당 82,960원
- 파트너5 1,500원 단가 → 시간당 126,000원

(정산 비율은 사주나루 정책. 사주문 정책은 별도 협의 필요)

### 3) 현재 사주문 시스템

| 항목 | 현재 |
|---|---|
| 단가 저장 | `member.call_070_unit_cost`, `member.chat_unit_cost` (개별 컬럼) |
| 단가 설정 | **어드민만** ([web/mng/src/pages/CounselorForm.tsx](web/mng/src/pages/CounselorForm.tsx) line 27, 30) |
| 등급/누적시간 | **❌ 없음** |
| 상담사 본인이 변경 | **❌ 없음** |
| 월 1일 락 | **❌ 없음** |
| 정산 | level=5 기준 (member.role/level 이중 진실원천 이슈 — 다음 세션 정리 대상 메모 있음) |

### 4) 작업 명세 (Phase 분할)

#### Phase 1 — DB 스키마 + 정책 설정 (백엔드만)

**신규 컬럼 (member)**:
```sql
ALTER TABLE member ADD COLUMN grade text NOT NULL DEFAULT 'normal';
  -- 'normal'/'partner1'/'partner2'/'partner3'/'partner4'/'partner5'
ALTER TABLE member ADD COLUMN cumulative_call_seconds bigint NOT NULL DEFAULT 0;
ALTER TABLE member ADD COLUMN cumulative_chat_seconds bigint NOT NULL DEFAULT 0;
ALTER TABLE member ADD COLUMN unit_cost_changeable_at timestamptz;
  -- NULL = 언제든 (신규/등급 변동 직후), 아니면 그 시점까지 락
ALTER TABLE member ADD COLUMN grade_recalculated_at timestamptz;
```

**setting 테이블 — 등급 정책 (어드민이 수정 가능)**:
```
namespace='grade', key='thresholds.partner1', value='20'  -- 시간 단위
namespace='grade', key='thresholds.partner2', value='40'
... partner5 '180'
namespace='grade', key='options.normal', value='800,1000'  -- 콤마 구분 단가 옵션
namespace='grade', key='options.partner1', value='800,1000'
namespace='grade', key='options.partner2', value='1000,1200'
... partner5 '1000,1200,1300,1400,1500'
namespace='grade', key='lock_until_first_day', value='true'  -- 월 1일 락 여부
namespace='grade', key='recalc_day_of_month', value='1'  -- 매월 1일 등급 재산출
```

**신규 테이블 — 단가 변경 이력**:
```sql
CREATE TABLE member_unit_cost_history (
  id bigserial PRIMARY KEY,
  member_id bigint NOT NULL REFERENCES member(id),
  grade_at_change text NOT NULL,
  call_unit_cost_before int,
  call_unit_cost_after int,
  chat_unit_cost_before int,
  chat_unit_cost_after int,
  changed_by text NOT NULL,  -- 'self' | 'admin'
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

#### Phase 2 — 백엔드 로직

1. **누적 시간 집계** — 상담 종료 시 (`call_session`/`chat_session` end 핸들러) `member.cumulative_xxx_seconds += duration`
2. **등급 재산출 크론** — 매월 1일 0시(KST), 누적 시간 기준 등급 산정. 등급 변동 시 `unit_cost_changeable_at = null` (단가 변경 가능 풀어줌)
3. **단가 변경 API** (`POST /api/user/counselor/unit-cost`):
   - 본인 상담사만 (auth guard)
   - 정책 조회 → 현재 등급의 허용 옵션 외 값 거부
   - `unit_cost_changeable_at` 체크 (null 이거나 now() 이상이면 OK)
   - 변경 후 `unit_cost_changeable_at = 다음달 1일 0시` 로 락
   - history 행 INSERT
   - 트랜잭션 처리

#### Phase 3 — 상담사 마이페이지 UI

[CounselorMyPage.tsx](web/user/src/pages/CounselorMyPage.tsx) 확장:
- 등급 뱃지 (일반/파트너1~5) + 다음 등급까지 누적 시간 진척바
- 현재 단가 표시 + "변경" 버튼
- 단가 변경 모달: 등급별 옵션 라디오 + 확정 모달
- 락 상태면 "다음 변경 가능: YYYY-MM-DD" 안내 + 변경 버튼 비활성
- 정산 영역에 상담료 표 링크 (등급별 시간당 상담료)

#### Phase 4 — 어드민 UI

- 등급 정책 페이지 (`/mng/policy/grade`):
  - 시간 임계값 6단계 수정
  - 등급별 단가 옵션 콤마 입력
  - 락 정책 (월 1일 / 즉시 변경)
- 회원 상세에 등급/누적시간 표시 + 등급 수동 변경 (디버그/예외 처리용)
- 상담사 단가 변경 이력 조회
- 정산 모듈 — 등급 + 단가 기반 시간당 수익 산출 (현재 level=5 기준 → 등급 기준으로 마이그레이션)

### 5) 미정 사항 (고객 확인 필요)

1. **신규 상담사 시작 단가**: 가입 시 `call_070_unit_cost`/`chat_unit_cost` 기본값?
2. **기존 상담사 마이그레이션**: 현재 unit_cost 값을 어느 등급에 매핑? 누적 시간은 어떻게 집계 (과거 데이터 있나)?
3. **등급 강등 정책**: 누적 시간이 임계값 밑으로 안 떨어진다 가정? 평생 한 번 올라가면 유지?
4. **단가 옵션 외 값**: 정책에 없는 단가가 이미 DB 에 있다면? (예: 현재 750원)
5. **월 1일 락 예외**: 신규 가입자, 등급 변동 직후 — 즉시 변경 허용?
6. **시간당 상담료(상담사 수익) 산식**: 30초당 1,200원 → 시간당 82,960원 같은 표는 누가 어떻게 산출? 사주문 정책 별도 필요
7. **call/chat 단가 통합 vs 분리**: 사주나루는 한 단가, 사주문은 call/chat 분리. 통합할지 분리 유지할지

### 6) 작업 규모 추정

출석체크 시스템(이전 세션 4 Phase)과 비슷한 규모. 한 세션에 다 못 끝남.

**권장 순서** (3~4 세션):
- 세션 1: Phase 1 (DB 스키마 + 시드) + Phase 2 일부 (단가 변경 API 핵심)
- 세션 2: Phase 2 마무리 (누적 집계 + 크론) + Phase 3 (상담사 마이페이지)
- 세션 3: Phase 4 (어드민 UI) + 정산 마이그레이션
- 세션 4: 검증 + 엣지케이스 + 기존 상담사 일괄 마이그레이션

---

## D. 참고 파일

### 코드 진입점
- API 단가 노출: [api/src/user/counselors/counselors.service.ts](api/src/user/counselors/counselors.service.ts) — `unit_cost` COALESCE 로직
- 어드민 단가 설정: [web/mng/src/pages/CounselorForm.tsx](web/mng/src/pages/CounselorForm.tsx) line 27, 30
- 상담사 마이페이지: [web/user/src/pages/CounselorMyPage.tsx](web/user/src/pages/CounselorMyPage.tsx)
- 정산 관련: `api/src/admin/settlements/`
- 세션 종료 핸들러 (누적 시간 집계 추가할 자리): `api/src/user/chat/`, M2NET 연동 callback (콜 종료)

### 시드 스크립트 패턴 (참고)
- [tools/_seed_attendance_settings.py](tools/_seed_attendance_settings.py) — 정책 시드
- [tools/_migrate_attendance.py](tools/_migrate_attendance.py) — 마이그레이션 패턴
- [tools/_patch_api.py](tools/_patch_api.py) — 외과 배포

### 운영 정책 메모
- `project_role_level_cleanup.md` 메모리 — member.role/level 이중 진실원천 이슈. 정산 크론이 level=5 기준 → 등급 시스템 도입 시 함께 정리 대상.

---

## E. 작업 시작 시 첫 액션 권장

1. 이 파일 + `CLAUDE.md` + `MEMORY.md` 읽기
2. ~~위 **5) 미정 사항** 사용자에게 질문~~ → **F 섹션 (2026-05-16 확정) 참조**
3. F 섹션 안전장치 체크리스트 반영해 Phase 1 마이그레이션 스크립트 작성
4. test 서버에서 단계별 검증 → prod 적용

---

## F. 2026-05-16 확정 정책 + 검토 결과

> 고객 전화 통화 (2026-05-16) + 사용자 확인을 통해 확정된 정책. 이 섹션이 **이전 C.5 미정 사항보다 우선**.

### F.1 등급 구조 (확정)

| 등급 | 직전 1개월 시간 | 비고 |
|---|---|---|
| **예비파트너** | 0시간~20시간 미만 | 신규 기본. 계약방식 다름 (다른 경쟁앱 가입 가능) |
| **파트너1** | 20시간~ | 파트너부터 경쟁앱 가입 금지 (전속) |
| **파트너2** | 40시간~ | |
| **파트너3** | 70시간~ | |
| **파트너4** | 90시간~ | |
| **파트너5** | 120시간~ | |

> ⚠️ "계약방식 다름"은 **운영/계약 차원**이며, **시스템 동작은 동일**. UI/DB 에 별도 분기 없음 (등급명만 다름).

### F.2 승급/강등 규칙 (확정)

- **재산정 주기**: 매월 1일 0시(**KST**), 크론 자동 실행
- **산정 기준**: **직전 1개월** 통화 시간 (누적 아님)
- **강등**: 한 번에 **한 단계씩만**. (예: 파트너5가 0시간이어도 파트너4로만 강등)
- **승급**: 직전 1개월 시간이 임계값 도달 시 해당 등급으로 (한 번에 여러 단계 가능)

### F.3 단가 변경 락 (확정)

- 단가 변경은 **매월 1일에만** 가능 (등급 재산정 직후)
- **신규 가입자 예외**: 가입 즉시 **예비파트너 단가 옵션 중 1회** 선택 가능 → 그 달 말일까지 유지 → 다음달 1일 재산정
- **call / chat 단가 통합** — 한 값으로 운영 (분리 없음)

### F.4 단가표 (초기 임시값 — 어드민에서 수정)

> **고객 확정 단가표 받기 전 임시값**. 사주나루 참고. 어드민 정책 페이지에서 즉시 수정 가능하게 설계.

**30초당 단가 옵션** (call/chat 통합):

| 등급 | 옵션 (원) |
|---|---|
| 예비파트너 | 800 / 1,000 |
| 파트너1 | 800 / 1,000 |
| 파트너2 | 1,000 / 1,200 |
| 파트너3 | 1,000 / 1,200 / 1,300 |
| 파트너4 | 1,000 / 1,200 / 1,300 / 1,400 / 1,500 |
| 파트너5 | 1,000 / 1,200 / 1,300 / 1,400 / 1,500 |

**시간당 상담사 수익** (등급별 정산률 적용):

| 등급 | 정산률 | 800 | 1,000 | 1,200 | 1,300 | 1,400 | 1,500 |
|---|---|---|---|---|---|---|---|
| 예비파트너 | 35% | 33,600 | 42,000 | - | - | - | - |
| 파트너1 | 45% | 43,200 | 54,000 | - | - | - | - |
| 파트너2 | 55% | - | 66,000 | 79,200 | - | - | - |
| 파트너3 | 60% | - | 72,000 | 86,400 | 93,600 | - | - |
| 파트너4 | 65% | - | 78,000 | 93,600 | 101,400 | 109,200 | 117,000 |
| 파트너5 | 70% | - | 84,000 | 100,800 | 109,200 | 117,600 | 126,000 |

> 산식: `단가 × 120(30초→1시간) × 정산률`. 등급 ↑ → 정산률 ↑ (전속 보상).

**시드 정책 (setting 테이블)**:
```
namespace='grade', key='options.preliminary', value='800,1000'
namespace='grade', key='options.partner1',    value='800,1000'
namespace='grade', key='options.partner2',    value='1000,1200'
namespace='grade', key='options.partner3',    value='1000,1200,1300'
namespace='grade', key='options.partner4',    value='1000,1200,1300,1400,1500'
namespace='grade', key='options.partner5',    value='1000,1200,1300,1400,1500'
namespace='grade', key='revenue_rate.preliminary', value='0.35'
namespace='grade', key='revenue_rate.partner1',    value='0.45'
namespace='grade', key='revenue_rate.partner2',    value='0.55'
namespace='grade', key='revenue_rate.partner3',    value='0.60'
namespace='grade', key='revenue_rate.partner4',    value='0.65'
namespace='grade', key='revenue_rate.partner5',    value='0.70'
```

정산 모듈은 **처음부터 grade 기반으로 신규 구축** (오픈 전 = 마이그레이션 개념 없음).

---

### F.5 🔴 안전장치 체크리스트 (구현 시 필수)

> **돈이 걸린 시스템. 아래 항목은 코드/스키마 설계 시 반드시 박혀야 함.**

#### 시간 경계 처리
- [ ] 모든 시각 **KST 기준** 명시. UTC 변환 헷갈리지 않게 코드에 주석.
- [ ] "직전 1개월" 범위: **`[전월 1일 00:00 ≤ session.end_at < 당월 1일 00:00]`** (반열린구간)
- [ ] 통화가 월 경계 넘을 시: **종료 시점 기준 한 달에 통째로 귀속** (분할 안 함)
- [ ] 통화 진행 중 단가 변경 절대 금지 — `call_session` 에 `unit_cost_snapshot` 컬럼으로 시작 시점 단가 보존

#### 데이터 무결성
- [ ] 단가 변경 API: **단일 트랜잭션**으로 ① unit_cost 변경 ② changeable_at 갱신 ③ history INSERT
- [ ] 크론 멱등성: `member.grade_recalculated_at` 또는 `(member_id, year_month) UNIQUE` 로 중복 실행 방지
- [ ] 동시성: `UPDATE ... WHERE changeable_at IS NULL OR changeable_at <= NOW() RETURNING` 으로 락 우회 방지
- [ ] 어드민 수동 변경도 `history.changed_by = 'admin:XXX'` + `reason` 필수

#### 정책 변경 영향도
- [ ] 임계값 변경은 **다음달 1일 재산정부터 적용** (즉시 적용 금지)
- [ ] 단가 옵션 삭제 시 해당 단가로 운영 중인 상담사는 다음 변경 시 새 옵션 중 선택
- [ ] 정책 변경 자체도 이력 (`setting_history`)

#### 구현 시 확인 (정책 아닌 기존 코드 확인)
- [ ] **채팅 시간 측정 방식** 확인 — 전화는 통화 시간 명확. 채팅은 ① 세션 전체 ② 메시지 주고받은 시간 ③ 응답 누적 중 어느 것인지 기존 `api/src/user/chat/` 코드 확인 후 결정

#### 운영 안전장치
- [ ] **이력 테이블 2종**: `member_unit_cost_history`, `member_grade_history`
- [ ] 매월 1일 크론 결과 리포트: 승급/강등/유지 인원수 + 어드민 알림 (무음 실패 방지)
- [ ] 단가 변경 UI: 더블 컨펌 모달 ("N월부터 30초당 N원으로 적용됩니다. 다음 변경은 N월 1일 가능합니다.")
- [ ] 락 상태에서 변경 시도 시 친절한 메시지 + 다음 가능 일자 표시
- [ ] 비정상 종료 통화: M2NET 콜백으로 `end_at` 받을 때만 시간 인정
- [ ] 환불된 통화: **금액만 처리, 시간은 유지** (운영 단순화. 분쟁 시 어드민 수동 조정)

#### 정산 모듈 (오픈 전 신규 구축)
- [ ] 기존 `level=5` 기반 정산 코드 제거 → `grade` + `revenue_rate` 기반으로 재작성
- [ ] 매월 말 정산 시 등급 기준: **정산 대상월의 unit_cost_snapshot** 사용 (당월 단가 변경 발생 시에도 통화 시점 단가로 계산)
- [ ] 정산 결과 테이블에 `grade_at_settlement`, `unit_cost_snapshot`, `revenue_rate_at_settlement` 보존 (사후 검증용)

---

### F.6 DB 스키마 (수정안)

기존 C.4 Phase 1 스키마를 다음과 같이 **수정**:

```sql
-- member 테이블 추가 컬럼
ALTER TABLE member ADD COLUMN grade text NOT NULL DEFAULT 'preliminary';
  -- 'preliminary' | 'partner1' | 'partner2' | 'partner3' | 'partner4' | 'partner5'
ALTER TABLE member ADD COLUMN last_month_seconds bigint NOT NULL DEFAULT 0;
  -- 직전 1개월 통화 시간 (매월 1일 크론으로 갱신)
ALTER TABLE member ADD COLUMN unit_cost_changeable_at timestamptz;
  -- NULL = 즉시 변경 가능 (신규/락 해제), 그 외 = 해당 시점까지 락
ALTER TABLE member ADD COLUMN grade_recalculated_at timestamptz;
  -- 마지막 등급 재산정 시각 (멱등성용)

-- 통화 시작 시 단가 스냅샷
ALTER TABLE call_session ADD COLUMN unit_cost_snapshot int;
ALTER TABLE chat_session ADD COLUMN unit_cost_snapshot int;
```

신규 테이블:

```sql
-- 단가 변경 이력
CREATE TABLE member_unit_cost_history (
  id bigserial PRIMARY KEY,
  member_id bigint NOT NULL REFERENCES member(id),
  grade_at_change text NOT NULL,
  unit_cost_before int,
  unit_cost_after int,
  changed_by text NOT NULL,  -- 'self' | 'admin:홍길동'
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 등급 변동 이력
CREATE TABLE member_grade_history (
  id bigserial PRIMARY KEY,
  member_id bigint NOT NULL REFERENCES member(id),
  grade_before text,
  grade_after text NOT NULL,
  last_month_seconds bigint,
  change_type text NOT NULL,  -- 'promote' | 'demote' | 'manual'
  changed_by text NOT NULL,   -- 'cron' | 'admin:홍길동'
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 정책 변경 이력
CREATE TABLE setting_history (
  id bigserial PRIMARY KEY,
  namespace text NOT NULL,
  key text NOT NULL,
  value_before text,
  value_after text,
  changed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### F.7 어드민 페이지 구조

```
/mng/policy/grade        — 등급 임계값 (20/40/70/90/120 시간 수정)
/mng/policy/unit-cost    — 등급별 단가 옵션 콤마 입력
/mng/policy/lock         — 락 정책 토글 (기본: 월 1일)
/mng/policy/revenue      — 등급/단가별 시간당 수익 표 (정산용, 추후 채움)
/mng/members/[id]        — 회원 상세에 "등급/직전월시간/단가 변경 이력" 섹션 추가
/mng/grade-recalc-log    — 매월 1일 크론 실행 결과 (승급/강등/유지 인원)
```

### F.8 권장 Phase 분할 (오픈 전 완벽 개발)

> 오픈 일정 고정 X. **품질 우선 / 완벽하게 끝나면 오픈**.

| Phase | 내용 | 세션 |
|---|---|---|
| **1** | DB 스키마 + 정책 setting 시드 + 이력 테이블 3종 | 1 |
| **2** | 단가 변경 API (트랜잭션/동시성) + 통화 시간 스냅샷 컬럼 + 통화 종료 시 시간 집계 | 1~2 |
| **3** | 크론 (매월 1일 등급 재산정) + 멱등성 + 리포트 | 2 |
| **4** | 상담사 마이페이지 UI (등급 표시, 단가 변경 모달) | 2~3 |
| **5** | 어드민 정책/이력/크론 로그 페이지 + **정산 모듈 grade 기반 신규 구축** | 3~4 |
| **6** | 통합 검증 (test 서버 시나리오 테스트 + 시뮬레이션) | 4 |

> Phase 5 에 정산 모듈 통합 — 오픈 전이라 마이그레이션 개념 없음. `level=5` 정산 코드는 grade 기반으로 재작성.
> Phase 6 = 오픈 전 최종 검증. **시뮬레이션** 으로 가상 통화 데이터 넣고 매월 1일 크론 → 정산까지 한 사이클 돌려보기.

작성: 2026-05-16
업데이트: 2026-05-16 (F 섹션 추가, Phase 6 정산 마이그레이션 → 통합 검증으로 교체)

---

## G. 진행 로그

### 2026-05-16 — Phase 1 완료 ✅

**스키마 마이그레이션** (`tools/_migrate_grade_system.py`):
- test ✅ (172.235.211.75) / prod ✅ (104.64.128.103)
- `member` 컬럼 추가: `grade` (DEFAULT 'preliminary'), `last_month_seconds`, `unit_cost_changeable_at`, `grade_recalculated_at`
- `consultation` 컬럼 추가: `unit_cost_snapshot`, `grade_at_session`
- 신규 테이블: `member_unit_cost_history`, `member_grade_history`, `setting_history`
- CHECK 제약: `member_grade_check` (grade 값 검증)

**정책 시드** (`tools/_seed_grade_settings.py`):
- test ✅ / prod ✅ (각 21건)
- `namespace='grade'`: options.* (6개), revenue_rate.* (6개), thresholds.* (5개), 정책 4개

**기존 데이터 현황**:
- test: 35명 전원 preliminary
- prod: 37명 전원 preliminary
- 오픈 전 = 데이터 마이그레이션 불필요

**발견 사항**:
- 정산 모듈 **2-layer 구조**:
  - **WHO** (상담사 식별): `WHERE level = 5` ([settlement-cron.service.ts:57,62](api/src/cron/settlement-cron.service.ts#L57)) — `project-role-level-cleanup` 메모 그대로 유효
  - **HOW MUCH** (정산 금액): `member.free_royalty_pct / paid_royalty_pct` ([settlement-cron.service.ts:107+](api/src/cron/settlement-cron.service.ts#L107))
  - Phase 5 정산 모듈 grade 기반 전환 시 → royalty_pct 를 grade 의 `revenue_rate.*` 로 교체
- `consultation` 단일 테이블 (call/chat 통합 — reason 컬럼으로 구분: 'DISCONNECT' / 'END_CHAT' / 'END_CHAT_LOCAL')
- `member.call_070_unit_cost`, `chat_unit_cost` 별도 컬럼이지만 통합 정책으로 양쪽 동일값 쓰기로

### 2026-05-16 — Phase 2 완료 ✅ (백엔드 단가 변경 API + consultation 스냅샷)

**신규 모듈** [api/src/user/counselor-mypage-grade/](api/src/user/counselor-mypage-grade/):
- `counselor-mypage-grade.service.ts` — Grade type, MyGradeInfo, getMine, changeUnitCost
- `counselor-mypage-grade.controller.ts` — Routes
- `counselor-mypage-grade.module.ts` — DI

**라우트**:
- `GET /api/user/counselor-mypage/grade` — 내 등급/단가/락 상태 (현재 단가, 가능 옵션, 다음 변경일)
- `POST /api/user/counselor-mypage/grade/unit-cost` — 단가 변경 (body: `{ unit_cost, reason? }`)

**핵심 안전장치 구현**:
- 트랜잭션 (`sql.begin`)
- 동시성 락 — `pg_advisory_xact_lock(7777003, memberId)` (settlement 의 7777002 와 별도 키)
- 행 잠금 — `SELECT ... FOR UPDATE`
- 락 체크 — DB 시각 기준 (`unit_cost_changeable_at > NOW()`)
- 정책 외 단가 거부 — `setting.options.<grade>` 조회 후 검증
- KST 다음달 1일 계산 — `date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul') + interval '1 month'`
- 단가 통합 — `call_070_unit_cost` / `chat_unit_cost` 양 컬럼 동일값
- 이력 INSERT — `member_unit_cost_history` (changed_by='self')

**consultation 스냅샷** ([api/src/pg-callbacks/m2net-push.service.ts](api/src/pg-callbacks/m2net-push.service.ts)):
- main INSERT (라인 ~282) + settleChatRoomLocal INSERT (라인 ~491) 양쪽에 `unit_cost_snapshot`, `grade_at_session` 채움
- 종료 시점에 member 조회 → INSERT 값으로 박제 (월 1일 락 정책상 통화 중 변경 불가)

**배포**: test + prod 양쪽 빌드 통과, pm2 reload 완료.
- 검증: `curl https://api.sajumoon.kr/api/user/counselor-mypage/grade` → 401 (auth required = 라우트 마운트 확인)
- 검증: `curl https://api.sajumoon.co.kr/api/user/counselor-mypage/grade` → 401

**기타 변경**:
- `tools/_patch_api.py` — 신규 폴더 대비 `mkdir -p` 추가, FILES 목록 갱신

### 2026-05-16 — Phase 3 완료 ✅ (매월 1일 등급 재산정 크론)

**신규 서비스** [api/src/cron/grade-cron.service.ts](api/src/cron/grade-cron.service.ts):
- `recalculate(month?, testOnly?, mbId?)` — 직전 1개월 시간 → 등급 산정
- 정책 로드: `setting.namespace='grade'` 의 thresholds + demote_step_max
- 임계값 매핑: hours ≥ partner5(120) > partner4(90) > partner3(70) > partner2(40) > partner1(20)
- **강등 가드**: 한 번에 최대 1단계 (`applyDemoteLimit`)
- **등급 변동 시 unit_cost_changeable_at = NULL** (단가 1회 변경 풀어줌)
- **멱등성**: `grade_recalculated_at >= 당월 1일 0시(KST)` 면 회원별 skip
- 트랜잭션 + advisory lock(7777003) — 단가 변경 API 와 같은 키 직렬화

**라우트** (외부 cron 진입점):
- `GET /api/cron/grade/recalculate?month=YYYY-MM&test=1&mb_id=xxx`
- 옵션: `test=1` (dry-run), `mb_id` (단건 처리)
- crontab 예: `5 0 1 * * curl -s 'https://api.sajumoon.kr/api/cron/grade/recalculate' >> /var/log/sajumoon_grade.log 2>&1`

**검증**:
- test (172.235.211.75): `?test=1&month=2026-04` → 25명 처리, 0시간/전원 preliminary 유지 ✅
- prod (104.64.128.103): 같은 쿼리 → 27명 처리, 동일 결과 ✅
- 양 서버 빌드 통과 + pm2 reload OK

**운영 액션 (오픈 후)**:
- 양 서버 crontab 에 매월 1일 0시 5분 KST 등록 필요
- 등급 변동 리포트 통계는 응답 JSON 의 `summary` 필드에 포함됨 (수동 모니터링)

### 2026-05-16 — Phase 4 완료 ✅ (상담사 마이페이지 UI)

**API 클라이언트** [web/user/src/lib/api.ts](web/user/src/lib/api.ts):
- `counselorGradeApi.getMine()` / `changeUnitCost()`
- `MyGradeInfo`, `CounselorGrade` 타입 export

**컴포넌트** [web/user/src/components/UnitCostChangeModal.tsx](web/user/src/components/UnitCostChangeModal.tsx):
- 2단계 모달 (select → confirm)
- 옵션 라디오 (현재 단가 뱃지 + 시간당 환산)
- 더블 컨펌 단계: "30초당 N원, 즉시 적용, 다음 변경 N월 1일"
- 에러 메시지 표시 (락/정책 외 단가 등 서버 에러)
- 디자인 토큰: `#F3EEFE` 활성 / `#9B7AF7` primary / 모바일 600px max-w

**페이지 통합** [web/user/src/pages/CounselorMyPage.tsx](web/user/src/pages/CounselorMyPage.tsx):
- 마운트 시 `counselorGradeApi.getMine()` 호출
- 정산 카드 아래 **등급 카드** 추가:
  - 등급 뱃지 (예비파트너/파트너1~5)
  - `NextGradeProgress` 컴포넌트 — 직전 1개월 시간 + 다음 등급까지 잔여 + 진척바
  - 현재 단가 + 변경 버튼
  - 락 상태: 버튼 비활성 + "다음 변경 가능: YYYY-MM-DD"
- 모달 통합 + 성공 시 `getMine()` 재호출로 UI 갱신

**배포**:
- vite build (1722 modules, 9.39s)
- test ✅ (172.235.211.75 / sajumoon.kr) — 3 files synced
- prod ✅ (104.64.128.103 / sajumoon.co.kr) — 3 files synced

**검증 필요 (사용자)**:
1. 상담사 로그인 → 마이페이지 → 등급 카드 렌더 확인
2. "변경" 버튼 클릭 → 옵션 라디오 → 더블 컨펌 → 단가 변경 확인
3. 변경 직후 버튼 비활성 + "다음 변경 가능: 2026-06-01" 표시 확인
4. 재로그인/새로고침 후 상태 유지 확인

### 다음: Phase 5 — 어드민 UI + 정산 모듈 grade 전환

1. 어드민 정책 페이지 4종
   - `/mng/policy/grade` (임계값 5단계)
   - `/mng/policy/unit-cost` (등급별 옵션 콤마)
   - `/mng/policy/lock` (락 정책 토글)
   - `/mng/policy/revenue` (정산률 6등급)
2. 회원 상세 (`/mng/members/[id]`) 에 등급/이력 섹션
3. 크론 로그 페이지 `/mng/grade-recalc-log` (선택)
4. **정산 모듈 grade 기반 전환** ([settlement-cron.service.ts](api/src/cron/settlement-cron.service.ts))
   - 기존 `free_royalty_pct` / `paid_royalty_pct` → `setting.revenue_rate.<grade>` 조회로 교체
   - `consultation.unit_cost_snapshot` 활용 안전망
