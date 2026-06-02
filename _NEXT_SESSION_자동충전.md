# 사주플랜페이 자동충전 — 핸드오프 문서

> 작성: 2026-05-29
> 다음 세션이 이 한 파일만 읽으면 바로 자동충전 작업 시작 가능.
> 사장님 본인이나 신뢰 사용자로 첫 실 테스트 진입 직전 필독.

---

## 🎯 한 줄 요약

**코드는 완성도 높지만 PROD 실 사용자 0명, 결제 이력 0건 — 첫 사용자 등록 시점이 핵심 검증 순간**. AG9 PG / m2net / DB 3중 연동의 미세 차이가 첫 등록 시 드러날 가능성 높음.

---

## 📋 시스템 구조 (4-tier)

```
[사용자] → [프론트 ChargeCardRegister.tsx]
            ↓ POST /api/user/charge/autopay-register
         [백엔드 charge.service.ts: registerAutoPayCard]
            ↓ 1) AG9 POST gnrc_autopay_regist
         [AG9 PG: passcall.co.kr:32837]
            ↓ BillKey 발급
         [DB: payment_method INSERT]
            ↓ 2) m2net PUT updateAutoPayConfig (autopayflag='Y')
         [m2net: autopaypushurl 등록]
            ↓
       [m2net push 발생 (잔액 부족 시)]
            ↓ POST /api/user/charge/autopay-push
         [백엔드 handleAutopayPush]
            ↓ C-5 보안 가드 (auto_enabled + amount 교차 검증)
         [DB: payment + point_history INSERT]
            ↓
       [사용자 잔액 충전 완료]
```

---

## 📁 핵심 파일 + 라인 매핑

### 프론트엔드
| 파일 | 라인 | 역할 |
|---|---|---|
| `web/user/src/pages/ChargeCardRegister.tsx` | 24~ | 카드 등록 폼 (카드번호/만료/생년월일/비번/패키지) |
| `web/user/src/pages/ChargeCardRegister.tsx` | 53-101 | onSubmit — 검증 후 chargeApi.autopayRegister 호출 |
| `web/user/src/pages/Charge.tsx` | 자동충전 탭 | 토글 ON/OFF + 카드 미등록 시 register 페이지로 redirect (`window.location.href`) |
| `web/user/src/lib/api.ts` | 1875~ | chargeApi.autopayRegister — `/user/charge/autopay-register` POST |
| 라우트 | `/mypage/charge/card-register` | App.tsx:146 |

### 백엔드 (NestJS)
| 파일 | 라인 | 역할 |
|---|---|---|
| `api/src/user/charge/charge.controller.ts` | 53-56 | `@Post('autopay-register')` 엔드포인트 |
| `api/src/user/charge/charge.controller.ts` | 58-61 | `@Delete('autopay-card')` 카드 삭제 |
| `api/src/user/charge/charge.controller.ts` | 68-71 | `@Put('auto-config')` 자동충전 ON/OFF 토글 |
| `api/src/user/charge/charge.service.ts` | 267-291 | `registerAutoPayCard` (try/catch wrapper) |
| `api/src/user/charge/charge.service.ts` | 293-389 | `registerAutoPayCardImpl` — 진짜 로직 |
| `api/src/user/charge/charge.service.ts` | 213~ | `autoPayCharge` — 즉시 결제 (BillKey 보유 회원) |
| `api/src/user/charge/charge.service.ts` | 394-435 | `deleteAutoPayCard` |
| `api/src/user/charge/charge.service.ts` | 440-485 | `setAutoConfig` (토글 ON/OFF) |
| `api/src/user/charge/charge.service.ts` | 868~ | `handleAutopayPush` — m2net push 콜백 처리 |
| `api/src/user/charge/pg-callback.controller.ts` | 86-88 | autopay push 엔드포인트 (m2net 호출용) |
| `api/src/shared/ag9/ag9.service.ts` | - | AG9 PG 클라이언트 (autoPayRegister/Delete/Charge) |
| `api/src/shared/m2net/m2net.service.ts` | - | m2net 클라이언트 (updateAutoPayConfig) |

### DB
| 테이블 | 컬럼 | 용도 |
|---|---|---|
| `payment_method` | id, member_id, billkey, card_no_masked, expires_at, amount, coin_amount, auto_enabled, auto_package_id, is_active, registered_at | 카드 정보 + 자동충전 설정 |
| `payment` | oid, pay_method, status, amount, coin_amount, m2net_status | 모든 결제 row (자동충전도 여기) |
| `point_history` | member_id, content, earn_point, balance_after | 잔액 적립 row |
| `member` | id, mb_1 (m2net membid), telno, name, point | 회원 기본 정보 |
| `account_setting` | id, amount, point | 충전 패키지 (auto_package_id 가 참조) |

### Sample (옛 PHP) 매핑
| 백엔드 함수 | sample/ PHP |
|---|---|
| `prepareCharge` | `coin/ajax.coin_fill_update.php` |
| `autoPayCharge` | `coin/coin_pay_ok_auto.php` |
| `registerAutoPayCard` | `coin/coin_fill_auto_card_update.php` |
| `deleteAutoPayCard` | `coin/coin_fill_auto_card_del.php` |
| `setAutoConfig` | `coin/coin_fill_auto_card_member_update.php` |
| `handleAutopayPush` | `mtonet/auto_pay_result.php` |

---

## 🔄 데이터 흐름 — 3가지 시나리오

### A. 카드 등록 흐름 (사용자가 카드 등록)

```
1. ChargeCardRegister.tsx 폼 입력
   ↓ 검증: 카드번호 15~16자리 + 만료 MM/YY + 생년월일 YYMMDD + 비번 2자리
2. POST /api/user/charge/autopay-register { cardno, expMonth, expYear, socno, pass, packageId }
3. charge.service: registerAutoPayCardImpl
   a) AG9 POST gnrc_autopay_regist (oid 생성, payAmount = pkg.amount × 1.1 VAT)
      - 응답: { ok, billkey, error }
      - req_result=27 (이미등록) 시: AG9 삭제 후 재등록 (orphan 자동복구)
   b) DB INSERT payment_method (billkey UNIQUE, ON CONFLICT DO UPDATE)
   c) m2net PUT updateAutoPayConfig (autopayflag='Y', autopaypushurl=runtimeEnv().pgAutopayPushUrl)
4. 응답: { billkey, masked }
5. 프론트: navigate('/mypage/charge')
```

### B. 자동충전 트리거 흐름 (통화/채팅 중 잔액 부족)

```
1. 회원 잔액 < AUTO_THRESHOLD (10,000원) 도달
2. m2net 측이 등록된 autopaypushurl 로 POST 발생
3. POST /api/user/charge/autopay-push
4. handleAutopayPush:
   a) req_result !== '0000' → ignored (실패는 sample 정책상 무시)
   b) oid 중복 검사 → idempotent
   c) m2net_membid 로 member 찾기
   d) [C-5 보안 가드]
      - auto_enabled=TRUE + is_active=TRUE 카드 보유 검사
      - amount 가 account_setting.amount 와 정확히 일치 검사
      - 둘 중 하나 실패 → OpsAlert + BadRequest
   e) 중복 적립 가드: 10분 윈도우 dedup (race 방어)
   f) payment INSERT + point_history INSERT + member.point UPDATE
5. m2net 측 회원 잔액 fill (별도 호출)
```

### C. 카드 삭제 / 토글 흐름

**삭제** (`DELETE /api/user/charge/autopay-card`):
```
1. AG9 autoPayDelete(membid) — best-effort (실패해도 DB 정리)
2. DB UPDATE payment_method.is_active = FALSE
3. m2net PUT autopayflag='N' (best-effort)
```

**토글 ON/OFF** (`PUT /api/user/charge/auto-config`):
```
- ON: m2net PUT autopayflag='Y' + DB UPDATE auto_enabled=TRUE, auto_package_id=N
- OFF: m2net PUT autopayflag='N' + DB UPDATE auto_enabled=FALSE
```

---

## 🔐 보안 가드 (Audit C-5 — 이전 세션에서 추가)

`handleAutopayPush` 위조 방어:

1. **회원 검증**: `m2net_membid` 매칭되는 회원 존재 여부
2. **자동결제 등록 검증**: `payment_method.auto_enabled=TRUE AND is_active=TRUE` row 보유
3. **금액 교차 검증**: `payment_method.auto_package_id` → `account_setting.amount` vs `payload.amount` 정확 일치
4. **OpsAlert 발송**: 둘 중 하나 실패 시 운영자에게 카톡 알림
5. **IP allowlist**: 별도 CallbackIpAllowlistGuard (211.175.205.88 단일 IP) — log 모드 → reject 모드 검토 중

**defense in depth**: m2net HMAC 매뉴얼 도착 시 추가 강화 예정.

---

## 📊 PROD 현황 스냅샷 (2026-05-29 기준)

### DB 데이터
```sql
SELECT COUNT(*) FILTER (WHERE is_active = TRUE) AS active_cards,
       COUNT(*) FILTER (WHERE is_active = FALSE) AS inactive_cards,
       COUNT(*) AS total
FROM payment_method;

-- 결과: 0 / 0 / 0
```

```sql
SELECT pay_method, status, COUNT(*)
FROM payment
WHERE pay_method LIKE '%AUTO%'
GROUP BY pay_method, status;

-- 결과: 0 rows
```

### 환경 변수 (PROD `.env`)
```
AG9_HOST=https://passcall.co.kr:32837
AG9_AUTH_TOKEN=f58cdy2sXhkOdp2YSJUjuqEJB
AG9_CPID=0047
```

(추가) m2net 측 autopaypushurl 등록 = `runtimeEnv().pgAutopayPushUrl` (prod 도메인 + /api/user/charge/autopay-push)

---

## ⚠️ 미검증 위험 — 5개

### 1. AG9 API 응답 포맷 (가장 큰 위험)

**코드 가정**:
- `reg.ok` = true/false
- `reg.billkey` = string
- `reg.error?.includes('req_result=27')` = 이미 등록된 케이스

**검증 안 된 영역**:
- AG9 의 실제 응답 JSON 구조가 위와 정확히 일치하는지
- `req_result` 외 다른 에러 코드 (예: 카드 거부, 한도 초과, 정지 카드) 처리
- AG9 의 응답 인코딩 (UTF-8 vs EUC-KR) — sample 시절엔 KR

**fix 준비**: AG9 응답 형식 확인 → `api/src/shared/ag9/ag9.service.ts` 의 응답 파싱 코드 검증

### 2. m2net updateAutoPayConfig 응답 검증 부재

**코드 가정**:
- `r.ok` = true/false
- `r.error` = string

**검증 안 된 영역**:
- autopayflag='Y' PUT 성공 후 m2net 측에 실제로 등록되는지
- autopaypushurl 이 올바른 prod 도메인으로 등록되는지 (test/prod 분기 정확)
- m2net 측에서 본인 회원 정보 조회 API 가 있다면 등록 후 verify 필요

### 3. 자동충전 push 트리거 시점 미검증

**미확인**:
- 통화/채팅 중 잔액 10,000원 미만 진입 시 m2net 가 push 즉시 보내는지, 다음 결제 시점에 보내는지
- push payload 형식이 코드 가정 (`payload.oid`, `payload.req_result`, `payload.membid`, `payload.amount`, `payload.coinamt`) 과 일치하는지
- push 실패/재시도 정책

### 4. C-5 보안 가드의 false positive

**우려**:
- 정상 자동충전 push 가 위조 의심으로 잘못 차단될 가능성
- `amount` 가 등록 패키지 금액과 1원이라도 다르면 차단
  - VAT 계산 (× 1.1) 후 반올림 차이 가능
  - m2net 측 금액과 사주플랜 DB 금액의 정수/소수 처리 차이
- 첫 사용자가 등록만 했고 토글 OFF 인 상태에서 push 도착 시 → 위조 의심

### 5. 에러 UX 미검증

**확인 필요**:
- 카드 거부 시 사용자 메시지 ("등록 실패: …") 의 구체성
- 한도 초과, 정지 카드, 만료 카드 등 케이스별 분기
- 사용자가 재시도하기 쉬운 UX (입력 정보 보존?)

---

## ✅ 다음 작업 시 점검 체크리스트

### Phase 1 — 사전 점검 (코드 정적)

- [ ] `api/src/shared/ag9/ag9.service.ts` 의 `autoPayRegister` 응답 파싱 코드 재검토
- [ ] `api/src/shared/m2net/m2net.service.ts` 의 `updateAutoPayConfig` 응답 파싱 재검토
- [ ] `runtimeEnv().pgAutopayPushUrl` 이 PROD 에서 정확한 도메인으로 해석되는지
- [ ] account_setting 패키지 데이터 PROD 에 충분히 있는지 (autopay-register 가 packageId 필요)
- [ ] payment_method 의 UNIQUE 인덱스 (billkey 기준) PROD 에 적용되어 있는지

### Phase 2 — 사장님(또는 신뢰 사용자) 본인 테스트

- [ ] 사장님 본인 계정으로 `/mypage/charge/card-register` 접근
- [ ] 실제 카드로 등록 시도 — **가장 작은 패키지** 선택
- [ ] 등록 성공 시:
  - [ ] PROD DB `SELECT * FROM payment_method WHERE member_id = ?` 로 row 확인
  - [ ] billkey, masked, expires_at 정확히 저장됐는지
- [ ] 등록 실패 시:
  - [ ] 에러 메시지 캡쳐 + 백엔드 로그 (`pm2 logs sajumoon-api`) 확인
  - [ ] AG9 응답 raw 확인 (필요 시 ag9.service.ts 에 임시 로그 추가)
- [ ] m2net 측 검증: m2net 회원 정보 조회 → autopayflag='Y' / autopaypushurl 정확한지

### Phase 3 — 자동충전 트리거 실 테스트

- [ ] 등록 + 자동충전 ON 토글 → 작은 통화/채팅 시작
- [ ] 잔액이 자연스럽게 줄어들도록 → 10,000원 미만 도달 대기
- [ ] m2net push 도착 확인:
  - [ ] `consultation_log` 테이블에 raw payload row
  - [ ] `payment` 테이블에 AUTO_PAY 결제 row (status='completed')
  - [ ] `point_history` 에 적립 row
  - [ ] member.point 갱신
- [ ] OpsAlert 안 떴는지 (false positive 없음)
- [ ] 통화/채팅 끊김 없이 진행됐는지

### Phase 4 — 운영 정책 검토 (Phase 1~3 통과 후)

- [ ] **세션 한도** — 한 통화에 몇 번까지 자동충전 허용? (현재 무제한)
- [ ] **일일 한도** — 하루 총 자동충전 금액 상한? (현재 없음)
- [ ] **카드 만료 임박 안내** — expires_at 1개월 전 SMS/알림톡
- [ ] **자동충전 실패 시 안내** — 통화/채팅 중 결제 거부 시 사용자에게 명확한 안내
- [ ] **사용자 패키지 변경 흐름** — 토글 OFF 없이 패키지만 바꾸는 UX

---

## 🛠️ SQL 진단 쿼리 (다음 세션에서 즉시 사용)

### 등록된 카드 현황
```sql
SELECT id, member_id, card_no_masked, expires_at,
       amount, coin_amount, auto_enabled, auto_package_id,
       is_active, registered_at::date
  FROM payment_method
 ORDER BY registered_at DESC NULLS LAST
 LIMIT 20;
```

### 자동결제 활성 회원
```sql
SELECT m.id, m.mb_id, m.name, m.point AS balance,
       pm.card_no_masked, pm.amount AS auto_amount,
       pm.auto_enabled, pm.is_active
  FROM member m
  JOIN payment_method pm ON pm.member_id = m.id
 WHERE pm.is_active = TRUE
   AND pm.auto_enabled = TRUE;
```

### 자동충전 결제 이력
```sql
SELECT p.oid, p.member_id, p.amount, p.coin_amount,
       p.status, p.m2net_status, p.created_at
  FROM payment p
 WHERE p.pay_method LIKE '%AUTO%'
 ORDER BY p.created_at DESC
 LIMIT 50;
```

### 자동결제 push 위조 의심 로그 (OpsAlert 트리거 추적)
```sql
SELECT created_at, message
  FROM consultation_log  -- m2net raw payload 저장 위치
 WHERE message ILIKE '%autopay%'
 ORDER BY created_at DESC
 LIMIT 30;
```

### 1주일 내 자동충전 실패율
```sql
SELECT date_trunc('day', created_at) AS day,
       COUNT(*) FILTER (WHERE status = 'completed') AS success,
       COUNT(*) FILTER (WHERE status = 'failed') AS failed,
       COUNT(*) FILTER (WHERE status = 'pending') AS pending
  FROM payment
 WHERE pay_method LIKE '%AUTO%'
   AND created_at > now() - interval '7 days'
 GROUP BY day
 ORDER BY day DESC;
```

---

## 🔧 디버깅 명령 (PROD 서버)

### 실시간 로그 추적
```bash
# 사주플랜 API 로그 실시간
ssh root@104.64.128.103 'pm2 logs sajumoon-api --lines 100'

# autopay 관련만 필터
ssh root@104.64.128.103 'pm2 logs sajumoon-api --lines 1000 | grep -i autopay'

# OpsAlert 로그
ssh root@104.64.128.103 'tail -f /var/log/sajumoon_ops_alert.log 2>/dev/null || journalctl -u sajumoon -f'
```

### AG9 직접 호출 테스트 (개발자가 카드 정보 필요)
- AG9 API 매뉴얼 위치: ??? (개발자에게 받기)
- 테스트 카드: ??? (PG 측 테스트 모드 카드 발급 요청)

### m2net 측 회원 정보 조회
- m2net 측 회원 정보 API 가 있다면 등록 후 verify 가능
- `M2netService` 의 `getMemberInfo` 같은 함수 추가 필요

---

## 🚨 알려진 한계 / 안전망

1. **C-1 IP allowlist (log 모드)**: 비-`211.175.205.88` 도착 시 OpsAlert. 1주 검증 후 reject 전환 검토
2. **m2net HMAC**: 매뉴얼 도착 시 IP 위 추가 강화
3. **AG9 응답 인코딩**: sample 시절 EUC-KR → 현재 UTF-8 가정. 응답 깨짐 가능성

---

## 📞 외부 연락처 / 자료

| 영역 | 담당 / 자료 |
|---|---|
| AG9 PG | passcall.co.kr (개발자가 contact 있음) |
| m2net | sample/mtonet/ 코드 + m2net 측 담당 (개발자) |
| BizM 알림톡 | 별도 _OPS_RUNBOOK.md 참조 |
| 사장님 OpsAlert | 01075740572 (prod 등록 완료) |

---

## 🎯 다음 세션 시작 시 우선순위

1. **사장님 / 개발자가 실 카드로 등록 시도** (Phase 2)
2. 등록 실패 시 → AG9 응답 raw 디버깅 → 코드 fix
3. 등록 성공 시 → 자동충전 트리거 테스트 (Phase 3)
4. 트리거 성공 시 → 운영 정책 검토 (Phase 4) + 정식 운영 진입 준비

---

## 📝 이번 세션 (2026-05-29) 산출물

이 검증은 **코드 정적 분석 + PROD DB 스냅샷** 만 수행. 실 결제 시도는 X.

| 항목 | 결과 |
|---|---|
| 코드 구조 매핑 | ✅ 완료 (이 문서) |
| AG9 환경변수 확인 | ✅ 활성화 |
| PROD DB payment_method | 0건 |
| AUTO 결제 이력 | 0건 |
| 미검증 위험 식별 | 5개 |
| 점검 체크리스트 | 4 Phase 작성 |

**한 줄로**: "코드는 잘 짜여있다. 첫 실 등록만 하면 거의 작동할 것이다. 다만 AG9 응답 포맷 / m2net 측 검증 / C-5 false positive 가 첫 시도에 드러날 위험이 5%~30% 사이로 추정."

---

작성 완료. 다음 세션에서 이 파일 + `MEMORY.md` 만 읽으면 자동충전 작업 100% 복원 가능.
