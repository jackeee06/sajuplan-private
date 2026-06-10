# 사주플랜 플랫폼 완전 이해 가이드 (입문 필독)

> 이 문서는 신규 개발자·관리자가 사주플랜 플랫폼의 전체 구조를 빠르게 파악하기 위한 입문서입니다.  
> 상세 내용은 각 카테고리 문서를 참조하세요.

---

## 서비스 한 줄 정의

**사주·타로·신점 전화/채팅 상담 중개 플랫폼.**  
회원이 코인을 충전 → 상담사를 선택 → m2net(PassCall) 인프라를 통해 전화/채팅 연결.  
사주플랜은 회원·상담사 관리, 결제, 정산을 담당하고 실제 통화/채팅 라우팅은 m2net이 처리.

---

## 전체 아키텍처

> 시각적 다이어그램: [플랫폼 설계도 HTML](https://sajuplan.com/mng/platform-blueprint.html)

**① 사용자 레이어**
- 사용자 웹: `sajuplan.com` → 서버 경로 `/data/wwwroot/sajumoon.co.kr/`
- 관리자 웹: `sajuplan.com/mng` → 서버 경로 `/data/wwwroot/sajumoon.co.kr/mng/`
- 모바일 앱: React Native WebView 셸 (`com.dmonster.sajumoon`)

**② API 레이어** — HTTPS → nginx → NestJS :3001
- `api.sajuplan.com` → 서버 경로 `/data/wwwroot/api.sajumoon.co.kr/`
- UserModule (회원 서비스 전체)
- AdminModule (관리자 도구 전체)
- M2netPushModule — 전화/채팅 콜백 수신, **금전 처리 진입점** 🔴
- CronModule (정산·부재중·헬스체크 등 자동화)
- SharedModule (M2net, AG9, BizM, FCM, OpsAlert 공통 서비스)

**③ 외부 서비스**
- m2net (PassCall) — 전화·채팅 라우팅 & 잔액 보유 🔴 핵심
- AG9 (PG) — 카드결제·가상계좌·자동충전 🔴 핵심
- BizM — 카카오 알림톡 발송 🟡 중요
- FCM — 앱 푸시 (거의 안 씀) 🟢 보조

---

## 기술 스택 요약

| 영역 | 기술 |
|---|---|
| 사용자 웹 (`web/user`) | React 18 + Vite + TailwindCSS + React Router v6 |
| 관리자 웹 (`web/mng`) | React 18 + Vite + TailwindCSS + Recharts |
| 모바일 (`mobile/`) | React Native WebView 셸 |
| API (`api/`) | NestJS 11 + postgres.js (ORM 없음) + PostgreSQL |
| 인증 | JWT HTTP-only cookie (`sjm_user`) |
| DB | PostgreSQL — raw SQL 태그드 쿼리, ORM 미사용 |
| 배포 | Python paramiko 기반 SFTP 패치 스크립트 |

---

## 도메인·서버 경로 구조 (반드시 숙지)

| 접속 도메인 | 실제 서버 경로 | 비고 |
|---|---|---|
| `sajuplan.com` | `/data/wwwroot/sajumoon.co.kr/` | 사용자 프론트 |
| `sajuplan.com/mng` | `/data/wwwroot/sajumoon.co.kr/mng/` | 관리자 프론트 |
| `api.sajuplan.com` | `/data/wwwroot/api.sajumoon.co.kr/` | API 서버 |
| `/data/wwwroot/sajuplan.com/` | ❌ nginx 미사용 | **절대 배포 금지** |

> **왜 폴더명이 `sajumoon.co.kr`인가?**  
> 초기 서비스명이 "사주문(Sajumoon)" → "사주플랜(Sajuplan)"으로 변경됐지만,  
> 서버 폴더·외부 API 경로 변경은 작업량이 너무 커서 그대로 유지.  
> 도메인(겉)과 서버 경로(속)의 이름이 다른 것은 의도된 구조.

PROD 서버 IP: `104.64.128.103`  
TEST 서버(`172.235.211.75`) — **2026-05-29 공식 폐기, PROD 단일 운영**

---

## 돈 흐름 핵심

**회원 결제**
AG9(PG)로 결제 완료 → `paid_balance` 적립 + m2net 잔액 동기화.
AG9이 m2net에도 직통 fill하므로 이중 적립 위험이 있어, `correctM2netDoubleFill` cron(10분 주기)이 자동 정정.

**상담 종료**
m2net push (END_CALL / END_CHAT) 수신 → `consultation` INSERT → 회원 `paid_balance` 차감 → 상담사 `earning_balance` 적립.

**월 정산** (매월 1일 자동 실행)
`gross × 등급별 정산률 = 공급가` → 부가세 10% 포함 → 원천세 3.3% 차감 → 회선료 ₩20,000 차감 → 실지급액 → 운영자 수작업 계좌이체.

**선지급**
`누적 수익금 × 70% = 가용` → `신청액 - 수수료 5% - 원천세 3.3% = 실수령` → 다음 정산에서 자동 차감.

**DB 컬럼 (변경 금지):**
- `point.free_balance` — 무료코인 (출석/이벤트)
- `point.paid_balance` — 유료코인 (결제)
- `point.earning_balance` — 상담사 수익금

**UI 표기 규칙:**
- 회원 화면 → **코인** ("포인트" 금지)
- 상담사 화면 → **수익금** ("수익 내역", "earning point" 금지)

---

## 코인 차감 우선순위

상담 시 차감 순서: **유료코인(paid_balance) 먼저 → 무료코인(free_balance) 나중**

---

## 채팅 상태 머신

채팅방은 3가지 상태를 순서대로 거칩니다.

1. **STAY** (대기 중) — 코인 차감 없음. 회원이 요청했지만 상담사 미입장 상태.
2. **CNCH** (진행 중) — 상담사 입장(START_CHAT push) 시점에 선결제 차감 발생.
3. **DISCONNECT** (종료) — END_CHAT push 또는 자동취소. 단방향, 되돌릴 수 없음.

- **3분 무응답**: cron이 STAY → DISCONNECT 자동 전환 + 알림톡 발송
- **F정책**: 상담사 입장 시점에 선택한 시간(15/30/45/60분) 전체 코인 즉시 차감
- **G정책**: 입장 후 5초 이내 종료 시 전액 자동 환불 (일 2회/주 4회 한도)

---

## 상담사 등급 시스템

| 등급 | 기준(당월 누적 상담) | 정산률 |
|---|---|---|
| 예비파트너 | 신규 | 40% |
| 파트너1 | 5시간+ | 45% |
| 파트너2 | 15시간+ | 50% |
| 파트너3 | 30시간+ | 55% |
| 파트너4 | 50시간+ | 60% |
| 파트너5 | 80시간+ | 70% |

- **승급**: 당월 누적 달성 즉시 실시간 자동 승급 (2026-06-07 신설)
- **강등**: 매월 1일 크론에서만 처리 (한 단계씩만)

---

## Cron 스케줄 요약

| 잡 | 주기 | 역할 |
|---|---|---|
| 채팅 자동취소 | 매분 | STAY 3분 초과 자동 종료 |
| 5분 알림 안전망 | 매분 | 채팅/전화 잔여 5분 경고 |
| m2net 동기화 재시도 | 10분 | 결제 후 m2net 잔액 정합 복구 |
| 채팅 정산 재시도 | 10분 | m2net 장애로 누락된 정산 재처리 |
| 상담사 자동 부재중 | 1시간 | 24시간 무응답 → 부재중 전환 |
| 등급 재산정 | 매월 1일 | 전월 실적 기반 등급 재계산 |
| 월 정산 | 매월 1일 | earning_balance → settlement 생성 |
| 일일 요약 | 매일 09:00 | 전일 매출·가입·채팅 알림톡 발송 |
| 헬스체크 | 매시간 | DB 정합성 18 invariant 검사 |

---

## 알림 채널 정책

| 채널 | 용도 | 특이사항 |
|---|---|---|
| BizM 알림톡 | 외부 도달 메인 | 채팅 중 차단 (예외: chat_request_to_counselor만 통과) |
| 인앱 알림 | 종모양, 영구보존 | 채팅 중에도 발생 |
| FCM 푸시 | 거의 안 씀 | 알림톡 선호 정책 |

---

## 배포 명령 (운영자 필수 숙지)

| 변경 내용 | 명령 |
|---|---|
| 사용자 프론트 변경 | `python tools/_patch_frontend_fast.py user` |
| 관리자 프론트 변경 | `python tools/_patch_frontend_fast.py mng` |
| API 코드 변경 | `python tools/_patch_api.py` |
| 핸드북 MD 변경 | `python tools/_sync_handbook.py` |

> **"fast패치"** 키워드 = 위 명령 즉시 실행. 다른 방법 없음.

---

## 회원 역할 구조

DB 컬럼 `member.role` 값: `user` / `counselor` / `admin`. 슈퍼 여부는 `member.is_super` 별도 관리.

한 사람이 회원 + 상담사를 동시에 가질 수 있습니다 (듀얼 계정). URL 경로로 모드가 자동 구분됩니다.
- `/mypage/*` 접근 시 → 회원 모드
- `/counselor/mypage/*` 접근 시 → 상담사 모드

---

## 관리자 권한 분리

| 권한 | 슈퍼관리자 전용 | 일반관리자 |
|---|---|---|
| 슈퍼 승격 | ✅ | ❌ |
| 영업이익 시뮬레이터 | ✅ | ❌ |
| 회원 관리 | ✅ | ✅ |
| 결제·환불·정산 | ✅ | ✅ |
| 콘텐츠·게시판 | ✅ | ✅ |
| 상담사 신청 심사 | ✅ | ✅ |

---

## 핵심 안전 원칙

1. **DB 직접 삭제·TRUNCATE 절대 금지** — soft delete 정책
2. **배포 후 `__SAJUMOON_ENV__` → `prod` 치환 필수** — 누락 시 prod가 test API 호출
3. **`/data/wwwroot/sajuplan.com/`에 배포 금지** — nginx 미사용 죽은 폴더
4. **결제 관련 코드 변경 시 E2E 0 failed 확인 필수**
5. **외부 서비스 키(m2net, AG9, BizM) 임의 수정 금지**

---

## 관련 문서

- `system/01-domains` — 도메인 매핑 상세
- `system/02-deploy` — 배포 흐름
- `system/03-incident` — 사고 매뉴얼
- `system/04-cron-jobs` — cron 전수
- `payment/01-m2net-relation` — m2net 관계
- `payment/02-charge-flow` — 충전 흐름
- `payment/05-settlement` — 정산 상세
- `chat/01-prepaid-policy` — 채팅 선결제 정책
- `counselor/02-grade-pricing` — 등급·단가 시스템
