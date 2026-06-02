# Phase B — 사용자 측 포인트 충전 (`/mypage/charge`) 구현 계획

> **연관**: [PLAN/README.md](README.md) — Phase B (결제/취소). 본 문서는 **user-facing 충전 흐름**.
> Admin 측 환불·취소는 [domain-02-payment-order.md](domain-02-payment-order.md) 참조.

## Context — 왜 이 작업을 하는가

`web/user/src/pages/Charge.tsx`는 Figma 시안 5종 픽셀 충실도로 퍼블리싱은 끝났지만 mock 데이터로만 동작한다. 결제 버튼이 placeholder다.

**작업 성격 (사용자 확정)**: **sample 라이브 = 운영 정책 = 진리**다. 신규 구현은 sample을 정책 기준으로 1:1 마이그레이션하되, sample의 **오류(SQL injection / 트랜잭션 누락 / 중복 콜백 미멱등)만 처음부터 재현하지 않는다**. 이는 admin/mng 쪽의 "전면 재설계" 원칙과 다르다 — user-facing 결제는 라이브가 안정적으로 돌고 있으므로 흐름·키·UI를 그대로 옮긴다.

라이브 결제 흐름 4종:

1. **일반결제 (카드/가상계좌/페이코/카카오/네이버/애플/토스)** — AG9(`passcall.co.kr:32837`)에 form post → returnurl로 결제 결과 push → `coin_pay_ok_v2.php` (카드/간편) 또는 `coin_pay_bank_ok_v2.php` (가상계좌 입금완료)
2. **사주플랜페이 등록 (BillKey 발급)** — 카드 정보 AES-128-CBC 암호화 → AG9 PATCH `gnrc_autopay_regist` → BillKey 받음 → DB 저장 + **엠투넷에 PUT memb-mgr으로 `autopaypin/autopayamt/autopaycoinamt/autopaypushurl/autopayflag=Y` 등록**
3. **사주플랜페이 즉시 결제 (단발)** — billkey 보유 회원이 결제하기 클릭 → AG9 POST `gnrc_autopay_request` → `req_result==00` 시 즉시 완료
4. **자동충전 (엠투넷 자율)** — 엠투넷이 상담 중 잔액 < 임계값 감지 시 자율적으로 PG 호출 → 결과를 `autopaypushurl`(=`/mtonet/auto_pay_result.php`)로 push → 사주플랜 백엔드는 `saju_payment` INSERT + `insert_point` + 카톡 알림. **사주플랜 측에 잔액 체크 cron 없음**

**결제 후 엠투넷 코인 동기화** — 카드/간편결제/가상계좌 모두 `send_mjson1("memb-mgr", {amt}, "PUT", mb_1)` 으로 엠투넷 회원 코인 잔액 동기화 (`coin_pay_ok_v2.php` 라인 137·168·198·227, `coin_pay_bank_ok_v2.php` 라인 110-123). 자동충전(auto_pay_result.php)은 엠투넷이 호출자이므로 추가 동기화 불필요.

**핵심 발견 (사용자가 메시지에서 강조)**: 자동충전 트리거는 사주플랜 백엔드가 아니라 **엠투넷 자체가 자율적으로 한다**. 사주플랜이 할 일은 (a) 카드 등록 시 엠투넷에 자동결제 정보 PUT, (b) push 콜백 수신 엔드포인트 노출, (c) 토글 OFF 시 엠투넷에 `autopayflag=N` PUT.

---

## sample 정책 매핑 (이 흐름 그대로 신규 시스템에 옮김)

| sample 파일 | 신규 위치 | 비고 |
|---|---|---|
| `sample/coin/coin_fill.php` | `web/user/src/pages/Charge.tsx` (charge 탭) | 이미 UI 완성. mock 제거하고 chargeApi 연결 |
| `sample/coin/coin_fill_auto.php` | `web/user/src/pages/Charge.tsx` (auto 탭) | 동일 페이지의 토글 |
| `sample/coin/coin_fill_auto_card.php` (카드 입력) | `web/user/src/pages/ChargeCardRegister.tsx` (신규) | |
| `sample/coin/coin_fill_auto_card_update.php` (등록 처리) | `POST /api/user/charge/autopay-register` | 카드 AES 암호화 + AG9 PATCH + 엠투넷 PUT |
| `sample/coin/coin_fill_auto_card_del.php` (삭제) | `DELETE /api/user/charge/autopay-card` | AG9 POST gnrc_autopay_delete + 엠투넷 PUT autopayflag=N |
| `sample/coin/coin_fill_auto_card_member_update.php` (자동결제 토글) | `PUT /api/user/charge/auto-config` | 엠투넷 PUT memb-mgr {autopayflag} |
| `sample/coin/ajax.coin_fill_update.php` (사전 row INSERT) | `POST /api/user/charge/prepare` | payment.status='pending' INSERT |
| `sample/coin/coin_pay_ok_v2.php` (카드/간편 콜백) | `POST /api/pg/charge/callback` (인증 없음) | payment UPDATE + insert_point + 엠투넷 동기화 |
| `sample/coin/coin_pay_bank_ok_v2.php` (가상계좌 입금) | `POST /api/pg/charge/vbank-callback` (인증 없음) | 가상계좌 deposit 정보 + 점수 적립 + 엠투넷 동기화 |
| `sample/coin/coin_pay_ok_auto.php` (사주플랜페이 즉시) | `POST /api/user/charge/autopay-charge` | AG9 POST gnrc_autopay_request 호출 |
| `sample/mtonet/auto_pay_result.php` (엠투넷 자율 push 수신) | `POST /api/pg/charge/autopay-push` (인증 없음) | saju_payment INSERT + insert_point + 카톡 알림 |
| `sample/lib/common.lib.php::send_mjson1` | `M2netService.addMemberCoin()` | 결제 완료 시 엠투넷 코인 동기화 (PUT memb-mgr/{cpid}/{membid}) |
| `sample/lib/common.lib.php::send_mjson_auto_pay` | `Ag9Service` (autoPayRegister/Request/Delete) | AG9 자동결제 API |
| `sample/lib/pay_ag9.php::pay_cancel_full` | `Ag9Service.cancelPay()` (admin 측 사용) | 결제 취소 |

---

## 오류 → 신규 구현에서 fix 하는 항목 (sample 정책은 유지)

| sample 오류 | 신규 처리 |
|---|---|
| 모든 PG 콜백/처리에서 `$_REQUEST` 직접 SQL 보간 (SQL injection) | postgres.js 템플릿 리터럴(파라미터 바인딩) 사용 |
| 콜백 트랜잭션 부재 — `coin_pay_ok_v2.php` `START TRANSACTION` 주석 처리됨 | NestJS service 내부에서 `sql.begin()` 적용 |
| 중복 콜백 멱등 부분만 처리 (가상계좌만 lock UPDATE) | 모든 콜백에서 `payment.oid` UNIQUE + `SELECT ... FOR UPDATE` 후 `status` 체크 (이미 completed면 idempotent return) |
| 평문 카드정보 DB 저장 (`g5_member_auto_pay.cardno_full` 등) | `payment_method`엔 마스킹만 — billkey만 보존 (마이그레이션 0004 이미 그렇게 설계됨) |
| Outbox 누락 (송신 로그가 sendBeacon으로만 기록) | `payment_outbox` INSERT는 prepare 시점부터 (이미 마이그레이션에 있음) |
| 카톡 알림 발송 실패 시 메시지 손실 | 신규: alimtalk_outbox로 비동기 처리 (이미 0006_alimtalk_sms.sql 존재) |

> **그 외 정책은 sample 그대로**. account_setting 5개 등급, VAT 10% 가산, "최소 결제 금액 30,000원", 5일 환불 정책, paytype 코드, 결제수단 라벨, 카드 등록 폼 5필드(카드번호+만료+생년월일6+비번2), 자동충전 토글/기준잔액 UI 모두 라이브와 동일.

---

## 핵심 결정 사항 요약

| 항목 | 결정 |
|---|---|
| 자동충전 트리거 주체 | **엠투넷이 자율 호출** (사주플랜 백엔드는 등록·삭제·push 수신만) |
| 결제 마스터 | 기존 `payment` 테이블 (마이그레이션 0004) |
| BillKey 보존 | `payment_method` (이미 있음). 평문 카드 폐기, billkey만 |
| 엠투넷 코인 동기화 | `M2netService.addMemberCoin(membid, amt)` 신규. **카드/간편/가상계좌 모두** 동기화 |
| 엠투넷 자동결제 등록/해제 | `M2netService.updateAutoPayConfig(mb_1, payload)` 신규 — `PUT memb-mgr/{cpid}/{mb_1}` |
| PG 클라이언트 | `Ag9Service` 신규 (`api/src/shared/ag9/`) — autoPayRegister/Request/Delete + cancelPay + AES-128-CBC 카드 암호화 + 일반결제 form 파라미터 빌더 |
| `payment_method`에 추가 컬럼 | `coin_amount INT` (autopaycoinamt) — 자동충전 시 발급 코인 |
| `account_setting` 추가 컬럼 | `bonus_percent INT`, `total_point INT`, `message VARCHAR` (sample account_config 그대로) |
| 기준잔액(자동충전 임계값) 저장 위치 | **엠투넷이 관리 — 사주플랜 DB에 컬럼 추가하지 않음**. UI에서 입력값을 `M2netService.updateAutoPayConfig`로 PUT 할 때 함께 전달 (필드명은 sample 동작 검증 후 확정 — 매뉴얼 미명시 → 운영팀에 확인 필요) |
| 가상계좌 콜백 IP 검증 | passcall.co.kr 도메인 IP 화이트리스트 (`setting` 테이블 관리) |
| formurl (결제 완료 화면) | `https://sajumoon.kr/charge/complete?oid=...` (frontend가 `/api/user/charge/status/:oid` 폴링) |
| returnurl (PG → 백엔드) | `https://api.sajumoon.kr/api/pg/charge/callback` |
| autopaypushurl (엠투넷 → 백엔드) | `https://api.sajumoon.kr/api/pg/charge/autopay-push` |
| SSR | Charge 관련 페이지 모두 기존 user SSR 패턴 유지 |

---

## 구현 단계

### Step 0 — 마이그레이션 `0047_user_charge_columns.sql`

> **이중 처리 방지를 위한 UNIQUE 제약**을 강하게 건다. DB 레벨에서 차단 + 애플리케이션 레벨 `SELECT FOR UPDATE`/`ON CONFLICT DO NOTHING` 이중 방어.

```sql
BEGIN;

-- ============================================================
-- 1) account_setting: sample/account_config 컬럼 그대로 추가
-- ============================================================
ALTER TABLE account_setting
  ADD COLUMN IF NOT EXISTS bonus_percent INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_point   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS message       VARCHAR(255);

-- ============================================================
-- 2) payment_method: 자동충전 코인 컬럼 + 이중 등록 방지
-- ============================================================
ALTER TABLE payment_method
  ADD COLUMN IF NOT EXISTS coin_amount INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN payment_method.coin_amount IS '자동충전 시 발급 코인 (autopaycoinamt)';

-- 빌링키 자체 중복 금지 (PG가 같은 billkey를 두 회원에게 발급할 수 없음)
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_method_billkey ON payment_method (billkey);

-- 한 회원당 활성 카드 1장 제약 (sample 라이브 정책 — coin_fill_auto_card_member_update.php는 회원당 1행 가정)
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_method_active_member
  ON payment_method (member_id) WHERE is_active = TRUE;

-- ============================================================
-- 3) payment: 엠투넷 동기화 상태 + 결제 흐름별 추적
-- ============================================================
ALTER TABLE payment
  ADD COLUMN IF NOT EXISTS m2net_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS mb_1         VARCHAR(255);  -- 엠투넷 회원 ID (mb_1)

COMMENT ON COLUMN payment.m2net_status IS '엠투넷 코인 동기화 상태 (sample saju_payment.mtonet 동등): 충전처리중/코인충전성공/코인충전실패/등록카드 자동코인충전성공';
COMMENT ON COLUMN payment.mb_1         IS '엠투넷 회원 ID (mb_1) — m2net.addMemberCoin 호출에 사용';

-- payment.oid는 0004에서 이미 UNIQUE. 추가 안전망: tid도 NULL 아닐 때 UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_tid_when_present
  ON payment (tid) WHERE tid IS NOT NULL AND tid <> '';

-- ============================================================
-- 4) point_history: 같은 결제건 이중 적립 차단 (★ 핵심)
-- ============================================================
-- sample/coin_pay_ok_v2.php의 insert_point() 는 멱등 보장 없음 — 신규에서는 DB UNIQUE로 강제
-- (rel_table, rel_id, rel_action) 조합으로 같은 결제의 같은 액션이 두 번 INSERT 되지 않음
CREATE UNIQUE INDEX IF NOT EXISTS uq_point_history_payment_action
  ON point_history (rel_table, rel_id, rel_action)
  WHERE rel_table IN ('payment', 'payment_autopay');

COMMENT ON INDEX uq_point_history_payment_action IS
  '결제건당 동일 액션(coin_credit/coin_refund 등) 1회만. 콜백 중복 호출 시 두 번째 INSERT는 ON CONFLICT DO NOTHING으로 무시';

-- ============================================================
-- 5) payment_outbox: oid는 0004에서 UNIQUE. 추가 안전 인덱스
-- ============================================================
-- 콜백 멱등 추적용 (cb_at은 콜백 도착 시각)
CREATE INDEX IF NOT EXISTS idx_payment_outbox_cb
  ON payment_outbox (oid, cb_at DESC);

-- ============================================================
-- 6) payment_cancel_log: 동시 취소 요청 차단
-- ============================================================
-- (oid, trace_id) 조합 UNIQUE — 같은 trace_id로 두 번 호출 못 함
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_cancel_log_trace
  ON payment_cancel_log (oid, trace_id) WHERE trace_id IS NOT NULL;

COMMIT;
```

> **member 테이블에 임계값 컬럼 추가하지 않음**. sample 라이브 g5_member_auto_pay에 threshold 컬럼이 없고, 엠투넷이 관리하는 것이 현 운영 정책. UI에서 받은 값은 그대로 엠투넷 PUT으로 전달.

---

### Step 0-A — ★ 이중 처리 방지(멱등) 설계 — DB + 애플리케이션 이중 방어

| 위협 | DB 레벨 차단 | 애플리케이션 레벨 차단 |
|---|---|---|
| 같은 oid 결제 row 두 번 INSERT | `payment.oid` UNIQUE (0004) | `prepareCharge()`에서 `INSERT ... ON CONFLICT (oid) DO NOTHING` |
| 같은 oid 콜백 두 번 처리 | `payment.oid` UNIQUE | `SELECT ... FOR UPDATE` 후 `if status='completed' return idempotent` |
| 같은 결제건 point 두 번 적립 | `point_history (rel_table, rel_id, rel_action) WHERE rel_table='payment'` UNIQUE | `pointsService.adjust(...)`가 자체 트랜잭션 내에서 ON CONFLICT DO NOTHING 사용 |
| 같은 billkey 두 회원에 등록 | `payment_method.billkey` UNIQUE | `autoPayRegister()`에서 PG 응답 후 중복 billkey 검증 |
| 한 회원 카드 2장 활성화 | `payment_method (member_id) WHERE is_active` 부분 UNIQUE | `registerAutoPayCard()`에서 기존 카드 deactivate 후 INSERT |
| 가상계좌 이중 입금 처리 | `payment.oid` UNIQUE + `m2net_status` 락 패턴 | sample/coin_pay_bank_ok_v2.php 라인 53-63의 atomic UPDATE 패턴 그대로 |
| 같은 trace_id로 취소 두 번 | `payment_cancel_log (oid, trace_id)` UNIQUE | `cancelPay()`에서 trace_id 발급 후 INSERT, 충돌 시 immediate fail |
| 자동결제 push 두 번 도착 | `payment.oid` UNIQUE | `autopayPush()` 첫 줄에 `SELECT 1 FROM payment WHERE oid` — sample auto_pay_result.php 라인 18-22 동일 |
| 동일 사용자 동시 결제 (race) | `payment.oid` UNIQUE (oid는 timestamp 기반) | `prepareCharge()`에서 oid를 `the_${memberId}_${timestamp}` 식으로 회원ID 포함 |

#### `oid` 생성 전략

sample은 `the_${Date.now()}` (라인 233) — 동시 클릭 시 충돌 가능. 신규에서는:
```ts
const oid = `the_${memberId}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
// 예: the_42_1746674400000_a3f9d2
```
→ DB UNIQUE는 보호망일 뿐, 클라이언트 더블클릭이라도 같은 oid가 생성될 일이 없음.

#### Service 레벨 트랜잭션 패턴 (모든 콜백 공통)

```ts
async completePayment(oid: string, pgResult: PgCallback) {
  return await this.sql.begin(async (tx) => {
    // 1) FOR UPDATE 잠금
    const [pmt] = await tx`SELECT * FROM payment WHERE oid=${oid} FOR UPDATE`;
    if (!pmt) {
      // prepare 안 거친 콜백은 INSERT로 보강 (sample 정책) — ON CONFLICT 보호
      const [inserted] = await tx`
        INSERT INTO payment (oid, ...) VALUES (${oid}, ...)
        ON CONFLICT (oid) DO NOTHING
        RETURNING *`;
      if (!inserted) {
        // 다른 트랜잭션이 동시에 INSERT — 다시 SELECT FOR UPDATE
        return await tx`SELECT * FROM payment WHERE oid=${oid} FOR UPDATE`;
      }
    }

    // 2) 이미 completed면 멱등 종료
    if (pmt.status === 'completed') {
      return { ok: true, idempotent: true };
    }

    // 3) status 갱신
    await tx`UPDATE payment SET status='completed', ... WHERE id=${pmt.id} AND status='pending'`;

    // 4) point 적립 — ON CONFLICT (rel_table, rel_id, rel_action) DO NOTHING
    await tx`
      INSERT INTO point_history (member_id, rel_table, rel_id, rel_action, earn_point, ...)
      VALUES (${pmt.member_id}, 'payment', ${pmt.id}, 'coin_credit', ${pmt.coin_amount}, ...)
      ON CONFLICT (rel_table, rel_id, rel_action) WHERE rel_table IN ('payment','payment_autopay')
      DO NOTHING
    `;
  });
}
```

→ 어떤 시나리오에서도 **payment row 1개·point 적립 1회** 보장.

---

### Step 1 — `Ag9Service` 신규 작성 (`api/src/shared/ag9/`)

파일:
- `api/src/shared/ag9/ag9.module.ts`
- `api/src/shared/ag9/ag9.service.ts`
- `api/src/shared/ag9/ag9.types.ts`
- `api/src/shared/ag9/card-crypto.ts` — AES-128-CBC 암호화

환경변수 추가 (`api/.env`):
```
AG9_HOST=https://passcall.co.kr:32837
AG9_AUTH_TOKEN=<운영팀 발급 토큰>
AG9_CPID=<운영팀 발급 CPID>
CARD_CRYPT_KEY=<sample/config.php $crypt_pass 그대로 — 16자>
PG_RETURN_URL=https://api.sajumoon.kr/api/pg/charge/callback
PG_FORMURL=https://sajumoon.kr/charge/complete
PG_VBANK_CALLBACK_URL=https://api.sajumoon.kr/api/pg/charge/vbank-callback
PG_AUTOPAY_PUSH_URL=https://api.sajumoon.kr/api/pg/charge/autopay-push
```

> `AG9_AUTH_TOKEN`, `AG9_CPID`, `CARD_CRYPT_KEY` 실값은 운영팀이 보유. plan 승인 후 사용자가 별도 전달 (sample/coin/_pay_config.php placeholder만 있음).

`Ag9Service` 메서드 (sample 함수 1:1 매핑):

| sample | 신규 |
|---|---|
| `send_mjson_auto_pay("cptl/autopay/gnrc_autopay_regist", PATCH)` | `autoPayRegister(plain)` |
| `send_mjson_auto_pay("cptl/autopay/gnrc_autopay_request", POST)` | `autoPayRequest(membid, amount, coinamt)` |
| `send_mjson_auto_pay("cptl/autopay/gnrc_autopay_delete", POST)` | `autoPayDelete(membid)` |
| `send_mjson_cancle("cptl/cancelpay/gnrc_cancel_pay", POST)` | `cancelPay(oid)` |
| `send_mjson_cancle("cptl/cancelpay/gnrc_cancel_pay_part", POST)` | `cancelPayPartial(oid, recamt, reccoinamt)` |
| coin_fill.php JS form submit url 분기 | `buildPayFormParams({method, isMobile, ...})` |

`card-crypto.ts` (sample/coin/coin_fill_auto_card_update.php 라인 60-82 동등):
```ts
import * as crypto from 'crypto';

// AES-128-CBC, 키=SHA-512(CARD_CRYPT_KEY)의 앞 16바이트, IV=동일
export function encryptCardField(plain: string, rawKey: string): string {
  const sha = crypto.createHash('sha512').update(rawKey).digest();
  const key = sha.slice(0, 16);
  const iv = sha.slice(0, 16);
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]).toString('base64');
}
```

암호화 대상 필드 (PDF 별첨1): `cardno`, `exp_month`, `exp_year`, `socno`, `pass`, `usernm`, `membid`, `telno`.

---

### Step 2 — `M2netService` 메서드 추가

기존 파일 수정: `api/src/shared/m2net/m2net.service.ts`

#### 2-1. `addMemberCoin(mb_1, amt)` — 결제 완료 시 코인 동기화

sample/lib/common.lib.php `send_mjson1` + `coin_pay_ok_v2.php` 라인 137-143 동등:

```ts
/** 회원 코인 잔액 동기화. amt > 0 = 적립, amt < 0 = 회수 */
async addMemberCoin(mb_1: string, amt: number) {
  // PUT {apiUrl}/memb-mgr/{cpid}/{mb_1}  body { amt }
  // mb_1 = member.mb_1 = 엠투넷 회원 ID (membid 동일)
}
```

#### 2-2. `updateAutoPayConfig(mb_1, payload)` — 자동결제 정보 등록/해제

sample/coin/coin_fill_auto_card_member_update.php 라인 28·53 동등:

```ts
interface AutoPayPayload {
  membnm: string;
  telno: string;
  autopaypin: string;        // billkey
  autopayamt?: number;       // 자동결제 시 결제할 원화 금액
  autopaycoinamt?: number;   // 자동결제 시 지급할 코인
  autopaypushurl?: string;   // 결제 결과 push 받을 URL (PG_AUTOPAY_PUSH_URL)
  autopayflag: 'Y' | 'N';
  // 임계값/threshold 필드명은 운영팀 확인 필요
}

async updateAutoPayConfig(mb_1: string, payload: AutoPayPayload) {
  // PUT {apiUrl}/memb-mgr/{cpid}/{mb_1}
}
```

---

### Step 3 — User Charge 모듈 (`api/src/user/charge/`)

```
api/src/user/charge/
├── charge.module.ts
├── charge.controller.ts          # UserAuthGuard 적용
├── pg-callback.controller.ts     # 인증 없음 — IP 화이트리스트
├── charge.service.ts             # 트랜잭션 + 멱등 핵심
└── dto/
    ├── prepare-charge.dto.ts
    ├── register-card.dto.ts
    ├── set-auto-config.dto.ts
    └── pg-callback.dto.ts
```

#### 엔드포인트

| Method | Path | Auth | sample 매핑 |
|---|---|---|---|
| GET  | `/api/user/charge/packages` | UserAuth | coin_fill.php 라인 42-48 (account_config SELECT) |
| GET  | `/api/user/charge/methods`  | UserAuth | coin_fill.php 라인 32-39 (member_auto_pay_card) |
| POST | `/api/user/charge/prepare`  | UserAuth | ajax.coin_fill_update.php (saju_payment INSERT pending) |
| POST | `/api/user/charge/autopay-register` | UserAuth | coin_fill_auto_card_update.php |
| DELETE | `/api/user/charge/autopay-card` | UserAuth | coin_fill_auto_card_del.php |
| POST | `/api/user/charge/autopay-charge` | UserAuth | coin_pay_ok_auto.php |
| PUT  | `/api/user/charge/auto-config` | UserAuth | coin_fill_auto_card_member_update.php |
| GET  | `/api/user/charge/status/:oid` | UserAuth | (신규) frontend 폴링용 |
| POST | `/api/pg/charge/callback` | none + IP 화이트리스트 | coin_pay_ok_v2.php |
| POST | `/api/pg/charge/vbank-callback` | none + IP 화이트리스트 | coin_pay_bank_ok_v2.php |
| POST | `/api/pg/charge/autopay-push` | none + IP 화이트리스트 | mtonet/auto_pay_result.php |

#### 주요 비즈니스 로직 (sample 그대로)

##### `prepareCharge(memberId, packageId, payMethod)`
1. `account_setting` 조회 → `pay_amount = round(price * 1.1)` (VAT 10%, sample coin_fill.php 라인 47)
2. `oid = 결제수단 prefix + Date.now()` — sample coin_fill.php JS 라인 232-234
   - VBANK: `BK04_{ts}` 식
   - 카드/간편: `the_{ts}`
3. `payment` INSERT (`status='pending'`, `coin_amount = account_setting.total_point`)
4. `payment_outbox` INSERT (request_type='prepare', payload=form params)
5. `Ag9Service.buildPayFormParams()` 반환 → 클라이언트가 form submit

##### `completePaymentFromCallback(pgResult)` (returnurl 콜백)

sample/coin/coin_pay_ok_v2.php 라인 137-204 동등 흐름. **트랜잭션 + 멱등**:

```ts
return await sql.begin(async (tx) => {
  const [pmt] = await tx`SELECT * FROM payment WHERE oid=${oid} FOR UPDATE`;
  if (!pmt) {
    // sample은 INSERT 흐름도 있지만, 신규에서는 prepare가 선행되어야 함 (sample 라이브 버그 — 결제 후 row가 없을 때 INSERT 보강)
    // 폴백: payment INSERT (sample 정책 동일)
  }
  if (pmt?.status === 'completed') return { idempotent: true };
  
  const ok = pgResult.req_result === '0000';
  if (!ok) {
    await tx`UPDATE payment SET status='failed', tid=${pgResult.tid}, req_result=${pgResult.req_result}, result_message=${pgResult.resultmsg} WHERE id=${pmt.id}`;
    return { ok: false };
  }
  
  // 1) payment 갱신
  await tx`UPDATE payment SET status='completed', tid=${pgResult.tid}, req_result='0000', pay_method=${pgResult.paytype}, result_message=${pgResult.resultmsg} WHERE id=${pmt.id}`;
  
  // 2) point 적립 — sample insert_point 동일 의미
  await pointsService.adjust(pmt.member_id, +pmt.coin_amount, `포인트 충전 (${oid})`, { actorType: 'system' }, { isPaid: true, relTable: 'payment', relId: String(pmt.id) }, tx);
});

// 3) 트랜잭션 commit 후 엠투넷 동기화 (sample/coin_pay_ok_v2.php 라인 137 동일)
const sync = await m2netService.addMemberCoin(pmt.mb_1, pmt.coin_amount);
await sql`UPDATE payment SET m2net_status=${sync.ok ? '코인충전성공' : '코인충전실패'} WHERE id=${pmt.id}`;
```

> `payment` 테이블에 `m2net_status VARCHAR(50)` 컬럼 추가 필요 (마이그레이션 0047) — sample saju_payment.mtonet 컬럼 동등.

##### `vbankCallback(pgResult)` (가상계좌 입금 통지)

sample/coin/coin_pay_bank_ok_v2.php 라인 44-123 동등. `coin_pay_bank_ok_v2.php`의 락 패턴을 그대로:

```ts
// sample 라인 53-63: 원자적 UPDATE로 동시 콜백 경쟁 방지
const lockResult = await sql`
  UPDATE payment SET m2net_status='충전처리중'
  WHERE oid=${oid} AND tid=${tid}
    AND (m2net_status IS NULL OR m2net_status NOT IN ('코인충전성공', '코인충전실패', '충전처리중'))
  RETURNING id, member_id, mb_1, coin_amount
`;
if (lockResult.count === 0) return { idempotent: true };
// ... 이후 sample 동일
```

##### `autopayPush(pushBody)` (엠투넷 자동충전 push)

sample/mtonet/auto_pay_result.php 라인 18-54 동등:

```ts
// req_result === '0000'만 처리
const exists = await sql`SELECT 1 FROM payment WHERE oid=${oid}`;
if (exists.length) return { idempotent: true };

return await sql.begin(async (tx) => {
  const [member] = await tx`SELECT * FROM member WHERE mb_1=${membid}`;
  if (!member) throw new BadRequestException('회원 없음');
  
  await tx`INSERT INTO payment (member_id, mb_id, membid, mb_1, pay_method, oid, tid, amount, coin_amount, req_result, result_message, telno, bank_code, bank_name, vr_account, deposit_name, deposit_time, status, m2net_status, created_at) VALUES (...)`;
  
  await pointsService.adjust(member.id, +coinamt, `등록카드 코인충전: ${oid}`, { actorType: 'system' }, { isPaid: true, relTable: 'payment_autopay', relAction: reason }, tx);
});

// 카톡 알림 (sample 라인 43-52)
await alimtalkService.send({ phone: member.mb_hp, type: '입금확인', name: member.mb_name, goodsName: '등록카드자동코인결제', price: amount });
```

##### `registerAutoPayCard(memberId, plainCard)`

sample/coin/coin_fill_auto_card_update.php 동등:

```ts
// 1) 카드 정보 AES-128-CBC 암호화
const encrypted = {
  cardno: encryptCardField(plain.cardno, env.CARD_CRYPT_KEY),
  exp_month: encryptCardField(plain.expMonth, env.CARD_CRYPT_KEY),
  exp_year: encryptCardField(plain.expYear, env.CARD_CRYPT_KEY),
  socno: encryptCardField(plain.socno6, env.CARD_CRYPT_KEY),
  pass: encryptCardField(plain.pass2, env.CARD_CRYPT_KEY),
  usernm: encryptCardField(member.mb_name, env.CARD_CRYPT_KEY),
  membid: encryptCardField(member.mb_1, env.CARD_CRYPT_KEY),
  telno: encryptCardField(member.mb_hp.replace(/-/g,''), env.CARD_CRYPT_KEY),
};

// 2) AG9 PATCH gnrc_autopay_regist (PDF 7장 기준)
const reg = await ag9Service.autoPayRegister({ ...encrypted, oid, item: '상담료', amount, coinamt, pushurl: env.PG_AUTOPAY_PUSH_URL });
if (!reg.ok) throw new BadGatewayException('자동결제 등록 실패');

// 3) DB 저장 (마스킹만 보존)
await sql`INSERT INTO payment_method (member_id, mb_id, membid, billkey, card_no_masked, expires_at, item, amount, coin_amount, is_active, registered_at) VALUES (...)`;

// 4) 엠투넷 PUT memb-mgr (sample/coin_fill_auto_card_member_update.php 라인 28)
await m2netService.updateAutoPayConfig(member.mb_1, {
  membnm: member.mb_name,
  telno: member.mb_hp.replace(/-/g,''),
  autopaypin: reg.billkey,
  autopayamt: amount,
  autopaycoinamt: coinamt,
  autopaypushurl: env.PG_AUTOPAY_PUSH_URL,
  autopayflag: 'Y',
});

return { billkey: reg.billkey, masked: maskCardNumber(plain.cardno) };
```

##### `deleteAutoPayCard(memberId)`

sample/coin/coin_fill_auto_card_del.php 동등:
1. AG9 POST `gnrc_autopay_delete` 
2. DB `payment_method.is_active=false` (또는 row delete — sample은 row delete)
3. 엠투넷 PUT memb-mgr `{autopayflag:'N'}`

##### `setAutoConfig(memberId, { enabled, threshold, packageId })`

sample/coin/coin_fill_auto_card_member_update.php 동등 — `autopayflag` Y/N 토글. threshold/packageId가 변경되면 amount/coinamt도 재계산해서 엠투넷 PUT.

---

### Step 4 — Web user 프론트 연동

#### `web/user/src/lib/api.ts` — `chargeApi` 추가

```ts
export const chargeApi = {
  packages: () => api.get<ChargePackage[]>('/user/charge/packages'),
  methods:  () => api.get<{ cards: RegisteredCard[], auto: { enabled, threshold, packageId } }>('/user/charge/methods'),
  prepare:  (input) => api.post<{ pgUrl, params, oid }>('/user/charge/prepare', input),
  autopayRegister: (input) => api.post<{ billkey, masked }>('/user/charge/autopay-register', input),
  autopayCardDelete: () => api.del('/user/charge/autopay-card'),
  autopayCharge:    (input) => api.post<{ oid, status }>('/user/charge/autopay-charge', input),
  setAutoConfig:    (input) => api.put('/user/charge/auto-config', input),
  status: (oid) => api.get<{ status, coin_amount }>(`/user/charge/status/${oid}`),
}
```

#### `web/user/src/pages/Charge.tsx` 수정

- mock 데이터 제거 (`MOCK_*` import 삭제)
- `useEffect` mount 시 병렬 fetch:
  - `chargeApi.packages()` → 패키지 목록
  - `chargeApi.methods()` → 등록된 카드 + 자동충전 설정
  - `pointsApi.balance()` → 보유 포인트
- 결제하기 버튼 핸들러 (sample coin_fill.php JS `pay_go()` 동등):
  - `payment_method='sajumun_pay' && cards.length===0` → `navigate('/mypage/charge/card-register')`
  - `payment_method='sajumun_pay' && cards.length>0` → `chargeApi.autopayCharge({ packageId })` → 응답 oid로 `/charge/complete?oid=...`
  - `payment_method='general'` → `chargeApi.prepare({ packageId, payMethod: generalOption })` → 받은 form params로 hidden form 자동 submit (브라우저가 PG로 이동)
- 자동충전 탭 토글 → `chargeApi.setAutoConfig({ enabled, threshold, packageId })`

#### 신규 페이지

| 라우트 | 파일 | sample 매핑 |
|---|---|---|
| `/mypage/charge/card-register` | `web/user/src/pages/ChargeCardRegister.tsx` | coin_fill_auto_card.php |
| `/charge/complete` | `web/user/src/pages/ChargeComplete.tsx` | (신규) — `?oid=...` 받아 status 폴링 |
| `/charge/vbank-info` | `web/user/src/pages/ChargeVbankInfo.tsx` | coin_pay_result.php |

`design_system.html`의 `.input-field` / `.btn-primary` 컴포넌트 재사용. `design/screens/mypage_member/charge_*.png` 5종 시안은 픽셀 충실 유지.

#### App.tsx
```tsx
<Route path="/mypage/charge/card-register" element={<ChargeCardRegister />} />
<Route path="/charge/complete" element={<ChargeComplete />} />
<Route path="/charge/vbank-info" element={<ChargeVbankInfo />} />
```

---

### Step 5 — 자동충전 트리거 (★ 사주플랜 백엔드는 트리거 코드 없음)

**중요한 정책 정정**: 자동충전 트리거는 **엠투넷이 자율적으로 한다**. 사주플랜 백엔드는 다음만 한다:
- 카드 등록 시 엠투넷 PUT memb-mgr으로 `autopayflag=Y` + autopaypin/amt/coinamt/pushurl 등록
- 토글 OFF 시 `autopayflag=N` PUT
- 엠투넷이 자동결제 처리 후 push로 호출하는 `/api/pg/charge/autopay-push` 엔드포인트 노출 → `auto_pay_result.php` 동등 처리

→ Step 5는 **별도 후크 없음**. Step 1~4만 완성하면 자동충전도 동작.

---

## 보안 / 멱등 체크리스트

- [ ] 모든 DB write는 `sql.begin()` 트랜잭션
- [ ] `payment.oid` UNIQUE + `SELECT ... FOR UPDATE` → 중복 콜백 멱등
- [ ] PG/엠투넷 콜백은 IP 화이트리스트 (passcall.co.kr 도메인 IP) — `setting` 테이블에서 관리
- [ ] 카드 평문 0초 보존 (메모리에서만 사용 후 GC). DB에는 `card_no_masked`만
- [ ] `payment_outbox`에 prepare 시점부터 logging — sample sendBeacon 폴백 안정화
- [ ] `point_history.actor_type='system'` + `rel_table='payment'` (마이그레이션 0015 사용)
- [ ] `Ag9Service`/`M2netService` 호출 30초 timeout, 실패 시 outbox에 에러 기록
- [ ] 엠투넷 동기화 실패해도 결제는 완료. cron이 outbox `m2net_failed` retry
- [ ] CSRF: `/api/user/charge/*`는 동일 출처 + JWT
- [ ] 자동충전 push는 IP 화이트리스트 외 추가 인증 어려움 — `oid` 멱등으로 중복 방지

---

## 검증 방법 (E2E)

1. **마이그레이션 적용** — `cd api && npx ts-node db/migrate.ts up`. `\d account_setting`/`\d payment_method`/`\d payment` 컬럼 확인
2. **환경변수** — `.env`에 AG9_*, CARD_CRYPT_KEY, PG_*, PG_AUTOPAY_PUSH_URL 설정
3. **NestJS 부팅** — `cd api && npm run start:dev` → 로그 `Ag9Service enabled=true`, `M2netService enabled=true`
4. **충전 패키지** — `curl http://localhost:3001/api/user/charge/packages` (쿠키 인증)
5. **prepare** — `POST /api/user/charge/prepare {packageId:1, payMethod:'CARD'}` → pgUrl/params 반환
6. **frontend** — `cd web/user && npm run dev` → `/mypage/charge` → 패키지 선택 → 결제하기 → passcall.co.kr:32837로 form submit
7. **카드 등록 시뮬** — `/mypage/charge/card-register` → 더미 입력 → AG9 응답 확인 → DB `payment_method.billkey` 저장 → 엠투넷 PUT 로그
8. **콜백 재현** — `curl -X POST http://localhost:3001/api/pg/charge/callback -d '<sample coin_pay_ok_v2.php $_REQUEST 형식 JSON>'` → DB `payment.status=completed` + `point.paid_balance` 증가 + 엠투넷 PUT 로그
9. **가상계좌 콜백** — sample/coin_pay_bank_ok_v2.php의 form input 그대로 POST → `payment.deposit_time/deposit_name` + 코인 적립
10. **자동충전 push** — `curl -X POST http://localhost:3001/api/pg/charge/autopay-push -d '<auto_pay_result.php JSON 형식>'` → 새 `payment` row + insert_point + 카톡 알림 outbox 적재

### sample 라이브 비교 검증

각 신규 흐름을 sample 동일 시나리오와 비교:
- coin_pay_ok_v2.php의 send_mjson1 호출 4곳 → 신규 카드/간편 모든 paytype에서 m2netService.addMemberCoin 호출되는지
- coin_pay_bank_ok_v2.php의 lock UPDATE → 신규 vbankCallback의 동시 호출 idempotent
- auto_pay_result.php의 INSERT → 신규 autopayPush의 새 oid 처리
- coin_fill_auto_card_member_update.php의 autopayflag PUT → 신규 setAutoConfig

---

## 참고 파일 (절대경로)

### 분석 대상 (read-only, sample 정책 출처)
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/coin/coin_fill.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/coin/coin_fill_auto.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/coin/coin_fill_auto_card.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/coin/coin_fill_auto_card_update.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/coin/coin_fill_auto_card_del.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/coin/coin_fill_auto_card_member_update.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/coin/coin_pay_ok_v2.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/coin/coin_pay_bank_ok_v2.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/coin/coin_pay_ok_auto.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/coin/ajax.coin_fill_update.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/coin/coin_pay_result.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/mtonet/auto_pay_result.php` ← 자동충전 push 수신
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/lib/common.lib.php` (send_mjson1 / send_mjson_auto_pay / send_mjson_cancle)
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/lib/pay_ag9.php` (saju_pay_outbox 패턴)
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/config.php` 라인 259-276 ($CPID/$headerKey/$crypt_pass)
- `/Users/jin-yubi/dwork/AI/사주플랜1/docs/(주)엠투넷상담서비스-결제(pay)-v1.6메뉴얼(go).pdf` (AG9 매뉴얼)

### 신규/수정 대상

DB 마이그레이션:
- `/Users/jin-yubi/dwork/AI/사주플랜1/api/db/migrations/0047_user_charge_columns.sql` — 신규
  - `account_setting`에 bonus_percent/total_point/message
  - `payment_method`에 coin_amount
  - `payment`에 m2net_status (saju_payment.mtonet 동등)

API:
- `/Users/jin-yubi/dwork/AI/사주플랜1/api/src/shared/ag9/` — 신규 (module/service/types/card-crypto)
- `/Users/jin-yubi/dwork/AI/사주플랜1/api/src/shared/m2net/m2net.service.ts` — addMemberCoin + updateAutoPayConfig 추가
- `/Users/jin-yubi/dwork/AI/사주플랜1/api/src/user/charge/` — 신규 (charge.module/controller/service + pg-callback.controller + dto)
- `/Users/jin-yubi/dwork/AI/사주플랜1/api/src/user/user.module.ts` — ChargeModule import
- `/Users/jin-yubi/dwork/AI/사주플랜1/api/.env` — AG9_*, CARD_CRYPT_KEY, PG_* 추가

웹 (user):
- `/Users/jin-yubi/dwork/AI/사주플랜1/web/user/src/lib/api.ts` — chargeApi 추가
- `/Users/jin-yubi/dwork/AI/사주플랜1/web/user/src/pages/Charge.tsx` — mock 제거 + chargeApi 연동
- `/Users/jin-yubi/dwork/AI/사주플랜1/web/user/src/pages/ChargeCardRegister.tsx` — 신규
- `/Users/jin-yubi/dwork/AI/사주플랜1/web/user/src/pages/ChargeComplete.tsx` — 신규
- `/Users/jin-yubi/dwork/AI/사주플랜1/web/user/src/pages/ChargeVbankInfo.tsx` — 신규
- `/Users/jin-yubi/dwork/AI/사주플랜1/web/user/src/App.tsx` — 라우트 추가

문서:
- `/Users/jin-yubi/dwork/AI/사주플랜1/PLAN/phase-b-user-charge.md` — 이 plan 이관
- `/Users/jin-yubi/dwork/AI/사주플랜1/PLAN/README.md` — Phase B 항목 user-facing 결제 흐름으로 갱신
- `/Users/jin-yubi/dwork/AI/사주플랜1/DB_REFACTOR_PROGRESS.md` — 0047 추가, Phase B 진행 상태 기록

---

## 사용자 확인 필요 (구현 시작 전)

1. **AG9 토큰/CPID 실값** — `AG9_AUTH_TOKEN`, `AG9_CPID` (sample placeholder만 있음)
2. **CARD_CRYPT_KEY 실값** — sample/config.php 라인 275의 `$crypt_pass = "pGXygBXTMNNuRJzC"`가 운영 값과 동일한지
3. **API 도메인** — `https://api.sajumoon.kr` 인지 — PG_RETURN_URL/PG_VBANK_CALLBACK_URL/PG_AUTOPAY_PUSH_URL에 사용
4. **passcall IP 화이트리스트** — vbank/autopay-push 콜백 검증용
5. **자동충전 임계값(기준잔액) 저장 정책** — 엠투넷 PUT memb-mgr에 어떤 필드명으로 보내는지 (PDF 매뉴얼 미명시). 운영팀에 확인 필요. 임시로는 클라이언트가 입력한 값을 `autopaythreshold`로 보내고 엠투넷이 무시하면 추후 보강

---

## 작업 순서 (PR 단위)

1. **PR1** — 마이그레이션 0047 + `Ag9Service` + `M2netService.addMemberCoin/updateAutoPayConfig` (백엔드 인프라)
2. **PR2** — User Charge 모듈 (charge.controller + pg-callback.controller + service) — Step 3
3. **PR3** — Web user 연동: `chargeApi` + `Charge.tsx` 실 API + 신규 3페이지 — Step 4
4. **PR4** (옵션) — Admin payments cancel에 Ag9Service.cancelPay 연결 — Step 6 (Phase B 외 보너스)
