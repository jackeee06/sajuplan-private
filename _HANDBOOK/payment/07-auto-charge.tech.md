# [AI 전용] 사주플랜페이 자동충전 — 기술 상세

> ⚠️ **머니크리티컬.** 이 문서가 다루는 `handleAutopayPush` / `autoPayCharge` 는 실고객 카드에서 돈이 빠지고 코인이 적립되는 심장부다. 수정 전 이 문서를 읽고, 수정 후 `python tools/_verify_money_integrity.py` PASS 확인 필수.

## 실제 구조 (2026-06-26 현행화 — 옛 문서의 `auto_pay_card`/`auto_charge_log`/`autoCharge cron` 은 전부 가공이었음, 폐기)

핵심 파일: `api/src/user/charge/charge.service.ts`, `api/src/user/charge/pg-callback.controller.ts`

### 등록 카드 = `payment_method` 테이블
주요 컬럼: `billkey`(PG 빌링키), `is_active`(사용중), `auto_enabled`(자동실행 토글 ON/OFF), `amount`(VAT 포함 실결제금액), `coin_amount`, `auto_package_id`, `member_id`.
- 등록: `registerAutoPayCard` — AG9 빌링키 발급 → `payAmount = round(pkg.amount * 1.1)`(부가세 가산) → `payment_method` INSERT(`is_active=TRUE`) + m2net `updateAutoPayConfig(autopayflag='Y')`. ⚠️ `account_setting.amount` 는 **부가세 전**(예 30,000), 실청구는 ×1.1=33,000.
- `req_result=27`(AG9 stale billkey) → `autoPayDelete` 후 재등록.

### 충전이 들어오는 3경로 (구분 필수)
| 경로 | 누가 시작 | oid 형태 | 처리 |
|---|---|---|---|
| **autoPayCharge** | 회원이 앱에서 "등록카드로 충전" | `auto_pay_card_*`(우리 자체) | 우리 서버가 m2net 호출 → 응답으로 즉시 적립. push 와 무관 |
| **m2net 단독 자동충전** | m2net 이 통화중(IN_CONNECT) 잔액부족 시 등록 billKey 로 자동 과금 | m2net 자체 oid(예 `202606...o3E`) | **push 만 도착** → `handleAutopayPush` |
| **일반 결제** | 회원 수동 카드/가상계좌 | — | `handlePaymentCallback` (별도, 매출 대부분) |

> push `reason`: `GNR_AUTO_PAY_CARD_NOT_CONNECT`(통화중 아님=대개 앱충전 사후통지) / `..._IN_CONNECT`(통화중 m2net 단독).

## `handleAutopayPush` 처리 순서 (2026-06-26 수정 반영 — 위→아래)

`POST /pg/charge/autopay-push` (controller). `CallbackIpAllowlistGuard`(m2net IP 전용) + Throttle 60/min. 예외 throw 시 controller 가 OpsAlert '처리 실패' 발송.

1. **`req_result !== '0000'` 또는 oid 없음 → 무시**(실패 push).
2. **🛑 `msg` 에 `CANCEL` 포함 → 무시 + 경보**(적립 절대 안 함). m2net 결제취소 시 **같은 oid 로 `req_result='0000'` + `msg='CANCEL_PAY'`** push 가 온다. 원래 충전 push 엔 `msg` 필드가 없다. 이걸 충전으로 오인하면 '환불+코인' 이중지급(회사손실). **(강원구 251, 2026-06-26 실사고 — 아래 사고기록)**
3. **동일 oid 가 payment 에 이미 있으면 → 멱등 종료.**
4. **membid 없음 → throw / `member.m2net_membid` 매칭 회원 없음 → throw.**
5. **dedup** — 최근 10분 내 같은 member+amount+coinamt 이고 **oid 가 `auto_pay_card_%`(우리 자체)인** row 매칭 시:
   - 잠금(FOR UPDATE)하 status='pending' 이면 → completed 승격 + **적립(멱등키 `rel_table='payment', rel_action='coin_credit'` = applyCompletion 과 동일)**. 아니면 적립 스킵.
   - ⚠️ dedup 을 `auto_pay_card_%` 로 한정(2026-06-26): 안 그러면 m2net 단독 같은금액 2건을 1건으로 오병합 → 카드 2회청구·코인 1회 = 고객손실.
6. **위조 방어(재설계 2026-06-26)** — dedup 도 아닌 새 push:
   - `payment_method` 1행 조회(활성·비활성 무관, `is_active DESC, auto_enabled DESC`).
   - **등록 카드 없음 OR 전화 불일치(`normTel`: 숫자만+82→0 정규화) → 위조 throw + 경보.** (등록 카드가 본인 카드의 강한 증거 → 카드 없을 때만 차단)
   - **비활성 카드인데 충전됨 → 코인 지급 + 경보**(환불검토. m2net billKey 미해제 가능).
   - **금액 sanity**: `payment_method.amount`(VAT 포함)와 다르면 → **throw 아님, 경보만**(돈은 이미 빠졌으니 코인은 지급). ❗과거 버그: `account_setting.amount`(부가세 전)와 비교해 정상충전을 막을 뻔함.
   - **coinamt 누락(amount>0 인데 coinamt<=0)** → 등록카드 `coin_amount` fallback + 경보, 그것도 없으면 경보(무경보 코인0 종료 차단).
7. 신규 payment INSERT(`ON CONFLICT (oid) DO NOTHING`) + `creditPointInTx`(`rel_table='payment_autopay'`) 적립.

> **설계 철학**: `req_result=0000` = 고객 돈은 이미 빠진 뒤다. 그래서 위조(카드없음/전화불일치)·취소(CANCEL_PAY)만 차단하고, 나머지 이상(비활성카드·금액불일치·코인누락)은 **막지 말고 코인 지급 + 경보**(돈 안 떼임). 조용히 사라지는 경로 0.

## 멱등 (이중적립 차단)
- `payment.oid` UNIQUE + `point_history (rel_table, rel_id, rel_action)` 부분 UNIQUE(`WHERE rel_table IN ('payment','payment_autopay')`).
- ⚠️ dedup 승격 적립과 `applyCompletion` 적립이 **같은 멱등키**(`payment`/`coin_credit`)를 써야 교차 차단됨. 2026-06-26 전엔 승격이 `payment_autopay`/reason 이라 키가 달라 **앱충전+push 경합 시 코인 2배(회사손실)** 가능했음 → 통일 + FOR UPDATE 게이트로 수정.

## 🔴 사고 기록 (2026-06-26)
- **강원구(251)/진유비(136)**: 카드 등록했으나 `auto_enabled=OFF`(+강원구는 카드 비활성)인 회원에게 m2net 이 통화중 단독 자동충전(33,000, 결과 0000) → 구 핸들러가 `auto_enabled=TRUE & is_active=TRUE` 만 정상인정해 **위조로 막음 → 코인0 = 돈 빠지고 코인 못받음**. 진짜 무인 자동충전(IN_CONNECT)은 역사상 2건뿐, 둘 다 막혔음(=한번도 성공한적 없음). 매출 대부분은 수동카드/가상계좌라 매출붕괴는 아니었음. → 위 6번 재설계로 수정.
- **CANCEL_PAY 오적립**: 위 수정 직후 강원구 환불(카드취소) 처리하자 m2net 이 같은 oid 로 `msg=CANCEL_PAY` push 전송 → 수정된 핸들러가 충전으로 오인해 30,000 적립(환불+코인 이중지급). → 위 2번 가드로 수정 + 강원구 우리DB 30,000 회수(payment cancelled + point_history `cancel_reversal`). **교훈: m2net 충전취소는 같은 oid·0000 push 로 통지된다. `req_result` 만 믿지 말고 `msg` 확인.**

## 🟡 조사 기록 (2026-06-28) — 우리BC 카드 자동결제 거절 (req_result=07, **미해결·AG9 답변 대기**)

> ⚠️ **결론 미확정.** 아래는 "검증된 사실 + 미해결 + 다음 액션"이다. 원인(왜 우리BC만 07인지)은 카드사/PG만 알 수 있어 **AG9 답변 전까지 단정 금지.**

- **증상**: 홍루연(112) 사주플랜페이 자동결제(110,000=100,000코인×1.1) → 카드사 거절 SMS `"승인거절 우리BC(2675) 가맹점 조치 후 승인 가능 110,000원 KCP_자동과금"`, payment.result_message=`autopay 실패: req_result=07`. oid `auto_pay_card_112_1782429049077_068d7e`.
- **결제 사슬**: 사주플랜 → **AG9**(`AG9_HOST=passcall.co.kr:32837` = **PassCall = m2net 인프라**, ag9.service.ts:41) → **KCP** → 카드사(우리카드). 즉 AG9=PG(결제)·m2net=라우팅이 **같은 PassCall 회사**. 거절 표기 `KCP_자동과금`의 **가맹점(merchant of record) = KCP/엠투넷**(카드소유자·사주플랜 아님).
- **사주플랜페이 정체**: `pay_method=GNRC_AUTO_PAY_CARD` = AG9 표준 **카드 빌링키 자동결제**(GNRC=일반). **우리의 유일한 자동결제** — 일반 카드결제(`CARD`/`GNRC_MOB_PACA`)·가상계좌(`VBANK`)·간편결제(KAKAO/NAVER/PAYCO)·삼성페이엔 자동결제 **없음**(전부 1회성). "일반결제 되니 자동결제도 돼야"는 카드사 관점에선 성립 안 함(빌링키=비대면 무인 정기결제로 따로 취급).
- **엄격검증 (코드감사 — PG 외부 콜백이라 Playwright E2E 불가)**:
  - `req_result=07`은 AG9 응답 **패스스루**(`res.req_result`, ag9.service.ts:169-170). **우리가 만든 코드 아님.**
  - `autoPayCharge`(charge.service.ts:218)는 **회원 무관 동일 동작** — 홍루연 차단/특수처리 분기 **없음**.
  - **결정적 증거**: 우리카드가 카드소유자에게 거절 SMS를 보냈다 = 우리 요청이 우리카드 승인시스템까지 **정상 도달** = 거절은 우리카드가 한 것. **우리 프로세스 무결.**
- **실사용 규모** (읽기전용 `tools/_check_autopay_scale.py`): 90일 자동결제 **성공 단 2건**(진유비136·강원구251, 각 33,000), 실패 25건(**거의 다 이심원127 단일카드 06-17 수십 회 재시도 = velocity 노이즈** + 홍루연 1). 등록카드 4장 **전부 `auto_enabled=FALSE`**(통화중 무인 자동충전 아무도 안 켬). → 매출 기여 미미, 우선순위 낮음.
- **브랜드/네트워크 무관 확정**: 홍루연(5370)·강원구(5164) **둘 다 마스터카드**인데 하나 거절·하나 성공. 발급사(우리카드) 또는 그 카드/거래 개별 사유.
- **⛔ 검증으로 폐기된 오진 (반복 금지)**: ①"우리카드 미등록" ②"자동결제 전반 실패" ③"BC/우리 네트워크 갭" — 전부 **n=2 빈약표본 + 재시도 노이즈로 패턴 착시**. BC/우리는 국내카드 절반↑ → PG가 통째로 못 할 리 없음(상식). **교훈: 외부 거절코드는 추측 말고 PG/카드사에 디코드 요청이 정답.**
- **다음 액션 (미해결)**: 엠투넷/AG9에 `req_result=07` + "가맹점 조치 후 승인 가능" 사유 디코드 + 우리BC 정기결제 가맹점 등록 여부 문의(거래정보 위 oid·시각·금액 첨부). 답에 따라 — **가맹점 측이면 엠투넷이 처리** / **카드소유자 측이면 홍루연이 우리카드에 한도·자동결제 차단 확인.**

## 불변식 / 검증
- 음수잔액 없음 / `member.point == free+paid` / 멱등 / `상담사적립=실과금×수익률`.
- PG 콜백이라 Playwright E2E 불가. 검증=① `python tools/_verify_money_integrity.py` PASS ② 실데이터 드라이런(해당 회원 카드·전화로 새 로직 통과여부) ③ 적대적 다단계 감사(`Workflow`). 조사도구: `tools/_check_autopay_scale.py`, `_autopay_history.py`, `_check_kangwongu_*.py`.

## 관련
- m2net 충전취소(환불) 절차·취소불가 대응 → `payment/04-refund.tech.md`
- 코인 적립 원장/미러 → `payment/03-coin-system.tech.md`, m2net 관계 → `payment/01-m2net-relation.tech.md`
- 메모리: `[[project-kangwongu-autopay-refund]]`, `[[reference-autopay-push-false-alarm]]`, `[[reference-money-integrity-verifier]]`
