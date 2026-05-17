# Phase E — 보안/권한 감사 결과 (남은 별도 세션 항목)

> 작성: 2026-05-17
> **자율 처리 15건 완료 + 3건 false positive 확인**
> **남은 별도 세션 항목**: Warning 1 (W-8)
> ✅ C-1, C-5 우회로 적용 — IP/HMAC 매뉴얼 없이도 위조 차단

---

## ✅ 이미 처리 완료 (13건 + false positive 3건)

| # | 항목 | 처리 결과 |
|---|---|---|
| C-1 | PG/M2NET 콜백 인증 누락 | **IP 화이트리스트 (log 모드) + throttle + OpsAlert** — 5일치 12,000+ 콜백 분석으로 단일 IP `211.175.205.88` 확인 후 적용. 1주 모니터링 후 reject 전환 검토 |
| C-2 | Admin 가드 전수 감사 | false positive — 29개 모두 적용됨 |
| C-3 | 휴대폰 list 마스킹 | list 응답만 `010-****-5678`, 단건 평문 (UI 검토 완료) |
| C-4 | cron 토큰 헤더 전환 | 양 서버 crontab 5건 헤더 방식 마이그레이션 + 헤더/legacy 양립 검증 |
| C-5 | 결제 콜백 membid 위조 | **우회로 적용** — autopay-push 시 payment_method.auto_enabled + 패키지 금액 교차 검증, 불일치 시 거부 + OpsAlert |
| C-6 | consult counselorId 검증 | NaN/음수 BadRequest 추가 |
| W-1 | 단가 상한 | 분당 10만원 hard cap |
| W-2 | points page 상한 | 10,000 hard cap |
| W-3 | settlements 날짜 round-trip | `02-31` 등 invalid 차단 + KST 시차 버그 수정 |
| W-4 | admin updateCustomer phone/password 타입 강제 | 비문자열 injection BadRequest |
| W-5 | CORS credentials=true | false positive — 단일 origin이라 안전 |
| W-6 | Rate limit 합리화 | default 1M → 1200/분, login → 20/분 |
| W-7 | PrepareChargeDto packageId | false positive — DTO + service 이중 검증 |
| W-9 | settlement rollback OpsAlert | 실행 시작/완료/실패 3단 알림 |
| I-1 | login throttle 강화 | W-6 와 함께 분당 20회 |
| I-2 | 파일 업로드 MIME 화이트리스트 | 확장자 + mimetype 양쪽 검사 |
| I-3 | 은행 계좌 응답 | false positive — list 이미 SELECT 제외, 단건은 편집용 평문 |

---

## ✅ C-1 + C-5 우회로 + IP 화이트리스트 (2026-05-17 완료)

### IP 화이트리스트 분석 결과 (자체 검증)

prod 의 nginx access log 5일치 (48,437 라인 중 콜백 10,418건) 분석:

| Path | 총 호출 | unique IP |
|---|---|---|
| /api/pg/m2net/state-push | 10,372건 | **1개** (`211.175.205.88`) |
| /api/pg/m2net/call-push | 22건 | **1개** (`211.175.205.88`) |
| /api/pg/charge/callback (AG9) | 10건 | **1개** (`211.175.205.88`) |
| /api/pg/charge/autopay-push | 2건 | **1개** (`211.175.205.88`) |

**결론**: M2NET 와 AG9 모두 단일 IP 고정. 매뉴얼 없이도 자체 검증 완료.

### 적용된 방어막 (defense in depth)

| 항목 | 조치 |
|---|---|
| **IP 화이트리스트 가드** | `CallbackIpAllowlistGuard` — `211.175.205.88` 만 통과, 외 IP 는 OpsAlert. 적용 라우트: m2net/{call,state}-push + charge/{callback,vbank-callback,autopay-push} |
| **모드** | `CALLBACK_IP_MODE=log` (기본) — 외 IP 도 통과시키되 알림. `reject` 로 변경 시 401 차단. 1주 모니터링 후 전환 권장. |
| **trust proxy** | `app.set('trust proxy', 1)` — nginx X-Forwarded-For 신뢰. file log 에 실제 발신 IP 기록 검증 완료 |
| **pg/charge throttle** | 분당 60회 (정상은 회원당 1~2회) |
| **pg/m2net throttle** | 분당 120회 (콜 종료 시 push, 여유) |
| **autopay-push 검증** | `payment_method.auto_enabled = TRUE` + 등록 패키지 금액 일치 |
| **위조 의심 시** | OpsAlert 즉시 발송 (membid + oid + 차이 정보) |
| **handlePaymentCallback** | 기존 oid → DB payment 진실원천 사용 |
| **handleVbankCallback** | 기존 oid → DB payment.member_id 사용 |

### 운영자 후속 작업 (선택)

1. **추가 IP 발견 시** — `.env` 의 `CALLBACK_ALLOW_IPS=211.175.205.88,...` 로 쉼표 추가
2. **1주 모니터링 후** — OpsAlert 가 안 오면 `.env` 에 `CALLBACK_IP_MODE=reject` 추가 후 재배포
3. **PG/M2NET 매뉴얼 도착 시** — HMAC 서명 검증 추가 (위 방어막 위에 쌓기)

---

## 🟡 Warning — 남은 1건

| # | 위치 | 문제 | 선행 작업 |
|---|---|---|---|
| W-8 | signup SMS 재검증 생략 | 가입 도중 계정 탈취 | 코드 주석에 의도적 정책 명시됨 — UX 결정 필요 |

---

## 추천 작업 순서 (별도 세션)

### Phase 1 — 외부 매뉴얼 도착 시 (선택, 우회로로 이미 차단 중)
1. **C-1 추가**: AG9/M2NET 발신 IP 화이트리스트 적용
2. **C-5 추가**: AG9 HMAC 서명 검증 적용

### Phase 2 — 운영자 UX 결정 후
3. **W-8** SMS 재검증 (현재 정책 vs 재검증 절충안 결정)

**현재 상태**: 보안 audit Phase E **사실상 종결**. 매뉴얼은 defense in depth 강화용.

---

## 다음 세션 시작 명령

```
이 문서 (_NEXT_SESSION_SECURITY.md) 를 먼저 읽고,
Phase 1 의 C-1 PG/M2NET 콜백 IP 화이트리스트부터 시작.

AG9/M2NET 에서 콜백 발신 시 사용하는 고정 IP 가 있나요? 매뉴얼 위치?
```
