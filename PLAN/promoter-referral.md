# 🧲 모집인(서포터즈) 회원모집 보상 제도 — 구현 계획서

> **상태**: ✅ **구현·배포 완료 (2026-06-18)** — API+사용자/관리자 프론트+DB+E2E/돈무결성 PASS. 알림톡만 BizM 템플릿 승인 후 활성(게이트 off).
> **성격**: 일반인이 비가입자를 모집→가입→상담 사용 시, 회사가 그 사용액의 일부를 모집인에게 보상하는 **마케팅 비용 제도**
> **메모리**: `project-promoter-referral-plan`

---

## 0. 핵심 원칙 (절대 규칙)

1. **상담사 추천(추천수익금)과 완전히 별개 도메인.** 기존 추천은 제로섬(`earning_balance` 원장, 피추천자 부담). 이건 **회사 100% 부담**.
2. **코인/포인트/수익금 원장(point, point_history, earning_balance)을 절대 건드리지 않는다.** 모집인 보상은 별도 원장(`promoter_reward`)에만 기록 → 돈 불변식(`_verify_money_integrity.py`) 무영향.
3. **보상은 회원이 실제로 쓴 유료 사용분에만 발생** (가입 머릿수로는 0원). 어뷰징 구조적 차단.
4. **귀속은 1회·영구.** 한 회원 = 모집인 1명, 가입 시 확정 후 변경 불가.

---

## 1. 정책 상수 (관리자 변경 가능)

| 항목 | 기본값 | 저장 위치 | 비고 |
|---|---|---|---|
| 보상 비율 | **3%** | `setting` (namespace='promoter') | 관리자 변경 가능 |
| 보상 기간 | **3개월** | `setting` (namespace='promoter') | 가입일 기준 |
| 보상 기준 | **consultation.amt_pro** (유료 사용분) | 코드 | 무료코인 사용분(amt_free) 제외 |
| 보상 상한 | **없음** | — | 캡 미적용 |
| 정산 | **수동** | 관리자 [지급완료] 마킹 | 선지급/월정산 패턴 재사용 |
| 표시 명칭 | **"기대수익"** | UI | 모집인 화면 |

> 비율·기간은 **가입 시점 값을 `promoter_referral`에 스냅샷**으로 고정한다. 관리자가 나중에 3%→5%로 바꿔도 **기존 귀속 회원은 가입 당시 비율 유지**(분쟁 안전). 변경은 이후 신규 가입자부터 적용.

---

## 2. DB 설계

### 2.1 `promoter` (모집인 마스터)
```
id              serial PK
name            varchar         -- 이름
phone           varchar UNIQUE  -- 고유키(정산·OTP 로그인)
code            varchar UNIQUE  -- 회원이 입력하는 코드(기본=전화 뒷자리, 중복 시 관리자가 임의 유니크)
bank_name       varchar
bank_account    varchar
account_holder  varchar
member_id       int NULL FK     -- 회원이기도 하면 링크(아니면 NULL)
reward_rate     numeric NULL    -- per-모집인 개별요율(NULL=글로벌 setting 사용). MVP는 NULL 고정
is_active       boolean default true
memo            text
created_by_admin_id int
created_at, updated_at timestamptz
```

### 2.2 `promoter_referral` (회원 귀속 — 한 회원 1행)
```
id              serial PK
promoter_id     int FK
member_id       int UNIQUE FK   -- ★ UNIQUE 로 "한 회원=모집인 1명" 강제
entry_method    varchar         -- 'qr' | 'code'
signup_at       timestamptz     -- 가입 시각(window 계산용)
reward_until    date            -- 가입일 + 보상기간(스냅샷)
rate_snapshot   numeric         -- 가입 시점 비율 스냅샷
created_at      timestamptz
```

### 2.3 `promoter_reward` (보상 적립 원장 — 상담별)
```
id              serial PK
promoter_id     int FK
member_id       int FK
consultation_id int UNIQUE FK   -- ★ 멱등(상담 1건당 1회만)
base_amount     int             -- consultation.amt_pro (적립 시점)
rate            numeric         -- 적용 비율
reward_amount   int             -- floor(base_amount * rate)
status          varchar         -- 'accrued'(적립) | 'voided'(환불로 취소)
settlement_id   int NULL FK     -- 정산 시 마킹
created_at      timestamptz
```
> 회사 부채/비용 원장. **여기에만 기록**, point/earning 무관.

### 2.4 `promoter_settlement` (정산 배치 — 수동 지급)
```
id              serial PK
promoter_id     int FK
total_reward    int             -- 묶인 promoter_reward 합
withholding     int default 0   -- 원천징수(필요 시)
paid_amount     int             -- 실지급액
status          varchar         -- 'calculated' | 'paid' | 'voided'
paid_at         timestamptz
paid_by_admin_id int
memo            text
created_at      timestamptz
```
> 정산 시 대상 `promoter_reward.settlement_id` 채우고 status 전이. settlement_monthly 의 "지급완료 마킹" 패턴 동일.

---

## 3. 흐름도

### 3.1 귀속 (가입 시) — 두 경로가 같은 결과로 수렴
```
[모집인 QR/링크 스캔] ──┐
                        ├─→ 가입화면 코드 세팅 → 가입완료 → promoter_referral 생성(1:1 영구)
[코드(전화뒷자리) 입력] ─┘
```
- **QR/링크**: `sajuplan.com/s/{code}` 또는 `?ref={code}` → localStorage 저장 → 가입폼 **자동입력(prefill)**
- **코드 입력**: 가입폼 "모집인 코드(선택)" 직접 타이핑
- 가입 성공 시 서버:
  1. code → `promoter` 조회 (없거나 비활성 → 귀속 생략, 가입은 정상 진행)
  2. **자기추천 차단**: member.phone == promoter.phone 이거나 member_id == promoter.member_id → 귀속 생략
  3. `promoter_referral` INSERT (member_id UNIQUE 로 중복 방지) + reward_until/rate 스냅샷

### 3.2 적립 (상담 종료 시)
```
m2net push (상담 종료) → consultation INSERT (기존 로직)
   ↓ (그 직후, 같은 흐름에서)
회원에게 promoter_referral 있고 AND now <= reward_until AND amt_pro > 0 ?
   ↓ yes
promoter_reward INSERT (ON CONFLICT consultation_id DO NOTHING)
   reward_amount = floor(amt_pro * rate_snapshot)
```
- point/earning **건드리지 않음** — 별도 원장 기록만.
- **환불 연동**: 해당 consultation 환불로 amt_pro 감소 시 → 대응 `promoter_reward` 차감 또는 `voided` (refunds.service 훅).

### 3.3 모집인 대시보드 (앱 불필요)
```
sajuplan.com/s (랜딩) → 휴대폰번호 입력 → SMS OTP 인증 → 모집인 세션
```
**첫 화면 구성 (동기부여 우선 — "신나서 더 하게")**
1. 상단: **총 기대수익 크게 강조** (누적 미정산 보상 합)
2. 그 아래: **시간순 적립 타임라인 피드** — "○월○일 홍** 30,000원 사용 → +900원 적립" 최신순
3. 보조: 모집 인원 수 / 내 코드 / 정산 완료액
- 회원은 **무조건 마스킹**(`홍**`). 사용금액 숫자는 노출(타임라인에 표시) — 사장님 결정
- 모집인 본인 이름·코드·기대수익은 노출

### 3.5 실시간 적립 알림톡 (모집인에게 — 앱 없으니 카톡이 유일 경로)
```
promoter_reward INSERT 성공 시 (멱등 1회) → 모집인 phone 으로 알림톡
   "홍** 님이 30,000원을 사용해 +900원이 적립되었습니다.
    누적 기대수익 45,000원"  [내 기대수익 보기]
```
- **회원 마스킹 필수**(`홍**`) — 사주/타로 사용은 민감정보
- **멱등**: 적립 1건당 1회. m2net push 재전송돼도 중복 발송 금지
- **누적 기대수익 동봉**(숫자가 쌓이는 체감 = 동기부여 핵심)
- **환불로 차감(void) 시엔 알림톡 미발송**(김 빠짐 방지) — 대시보드·관리자만 반영
- BizM 신규 템플릿 등록·검수 필요(1~3일). 버튼은 대시보드 링크 1개만(버튼 URL 함정 주의)
- 비용 건당 ~7원. 폭증 시 일일 요약 전환 옵션 여지

### 3.4 관리자
- **모집인 등록/수정**: 이름·전화·계좌·코드(중복 검사) ·활성 토글
- **모집인 목록**: 각자 모집 인원·기대수익·정산 상태
- **정산**: 모집인별 미정산 보상 합 → 통장 송금 후 [지급완료] → 알림톡 통보
- **설정**: 비율(3%)·기간(3개월) 변경

---

## 4. API 목록

### 랜딩/모집인 (공개 + OTP 세션)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/promoter/by-code/:code` | 코드 유효성(존재·활성)만. 이름 미반환 |
| POST | `/api/promoter/otp/request` | `{phone}` SMS 인증번호 발송 |
| POST | `/api/promoter/otp/verify` | `{phone, code}` → 모집인 세션 쿠키 |
| GET | `/api/promoter/me` | 내 정보·코드 |
| GET | `/api/promoter/me/dashboard` | 모집 인원·기대수익·회원목록(마스킹) |

### 가입 연동
- 기존 회원가입 API payload에 `promoter_code?` 추가 → 가입 성공 후 귀속 처리(§3.1)

### 관리자
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/admin/promoters` | 목록(+요약) |
| POST | `/api/admin/promoters` | 등록(코드 중복검사) |
| PATCH | `/api/admin/promoters/:id` | 수정/활성 토글 |
| GET | `/api/admin/promoters/:id` | 상세(보상·정산 내역) |
| POST | `/api/admin/promoter-settlements` | 정산 배치 생성(미정산 보상 묶기) |
| PATCH | `/api/admin/promoter-settlements/:id/mark-paid` | 지급완료 마킹 + 알림톡 |

---

## 5. MVP 단계 (구현 순서)

- **Phase 1 — 코어 적립(가장 먼저)**
  - DB 4테이블 마이그레이션 + setting(promoter.rate/months)
  - 관리자 모집인 등록 화면/API
  - 가입 코드 귀속(`promoter_referral`) — QR prefill + 코드 입력
  - 상담 종료 시 `promoter_reward` 적립(멱등) + 환불 연동
  - → **목표: 보상이 정확히 쌓이는 것**(화면 없이도 데이터가 맞아야)

- **Phase 2 — 모집인 대시보드 + 실시간 알림톡**
  - 랜딩 + 휴대폰 OTP 로그인
  - 첫 화면: 총 기대수익 강조 + 시간순 적립 타임라인 / 모집 인원 / 회원목록(마스킹)
  - QR/링크 발급(`/s/{code}`)
  - **실시간 적립 알림톡**(§3.5) — BizM 템플릿 등록 선행

- **Phase 3 — 정산**
  - 관리자 모집인별 정산 화면 + [지급완료] 마킹
  - **원천징수 적용 + 주민번호 미제출 시 미지급**
  - 지급 통보 알림톡(앱 없는 모집인)

- **Phase 4 — 다듬기**
  - 비율·기간 설정 화면
  - 어뷰징 모니터링(자기추천·이상 패턴), 개인정보 동의 문구

---

## 6. 결정 완료 (2026-06-18 사장님 확정)

1. **대시보드 금액 노출**: ✅ 사용금액 **숫자 노출**. 첫 화면 = 총 기대수익 강조 + 시간순 적립 타임라인(§3.3)
2. **원천징수**: ✅ **뗀다.** 정산 시점에 주민번호 요청 → **안 주면 미지급**(no 주민번호 = no payout). `promoter_settlement.withholding` 적용
3. **환불 시**: ✅ **보상 차감 필요.** 환불로 amt_pro 감소 → 대응 `promoter_reward` void/차감. 이미 지급됐으면 다음 정산에서 상계(이월)
4. **개인정보 동의**: ✅ **동의 절차 불필요.** 마스킹(`홍**`)만으로 처리
5. **실시간 적립 알림톡**: ✅ 추가 (§3.5) — 회원 마스킹·멱등·누적 기대수익 동봉·환불차감 시 미발송

### 남은 운영 디테일 (Phase 진행 중)
- 원천징수율: 기타소득(8.8%) vs 사업소득(3.3%) — 정산 시작 전 세무 기준 확정
- 환불 후 이미 지급된 보상 회수 방식(이월 상계 vs 직접 회수) 세부

---

## 6.5 시나리오 — 모집인이 회원/상담사로도 가입하는 경우

한 사람이 **모집인 + 회원(+상담사)** 동시 보유 가능. 회원가입은 정상 진행되며 원장이 분리되어 충돌 없음.
- 회원가입 시 **전화번호가 기존 모집인과 일치 → `promoter.member_id` 자동 연결**(한 사람으로 묶음)
- 회원 본인의 코인/상담 원장(point) ↔ 모집인 기대수익 원장(promoter_reward)은 **완전 별개**
- ⚠️ **자기추천 금지**: 회원가입 시 자기 코드 입력(phone/member_id 일치) → 귀속 생략(자기충전 어뷰징 차단)
- 다른 모집인 코드로 가입은 정상 허용(그쪽 실적으로 귀속)

## 7. 안전장치 체크리스트

- [ ] `promoter_referral.member_id` UNIQUE — 한 회원 1모집인
- [ ] `promoter_reward.consultation_id` UNIQUE — 상담 1건 1적립(멱등)
- [ ] 자기추천 차단(phone/member_id 일치)
- [ ] 코드 유니크(등록 시 중복검사)
- [ ] point/point_history/earning 무침범 → `_verify_money_integrity.py` 무영향 확인
- [ ] 3개월 window 계산은 KST 기준(`reference_server_timezone_kst`)
- [ ] 회원 목록 마스킹(`홍**`)
- [ ] E2E spec 추가(귀속·적립·정산·OTP)
