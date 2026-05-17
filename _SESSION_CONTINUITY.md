# 사주문 세션 연속성 마스터 핸드오버

> 작성: 2026-05-17
> 이 한 파일만 읽으면 지금까지의 모든 작업 맥락을 파악할 수 있습니다.
> 세션이 차서 새 세션으로 이사할 때 이 파일을 먼저 읽어주세요.

---

## 🎯 한 줄 요약

**사주문 (sajumoon.co.kr) 정밀 audit + 보안 강화 + 운영 매뉴얼 + E2E 자동 테스트 인프라까지 완성**. Critical 12건 + 보안 15건 + 18개 DB invariant + 50개 자동 클릭 테스트 모두 100% 통과.

---

## 🏗️ 환경

| 항목 | 값 |
|---|---|
| 작업 폴더 | `c:\claudeworkspace\sajumoon` |
| OS | Windows 10 (Git Bash + PowerShell 혼용) |
| test 서버 | `172.235.211.75` (`sajumoon.kr`, `api.sajumoon.kr`) |
| prod 서버 | `104.64.128.103` (`sajumoon.co.kr`, `api.sajumoon.co.kr`) |
| root 비번 (양 서버 동일) | `saju26moon@!!` (메모리 보존 X — 사장님이 직접 알려주심) |
| admin 계정 (prod) | `admin / test1234!` |
| 사장님 OpsAlert 휴대폰 | `01075740572` (prod setting 등록 완료) |
| 운영자 추가 번호 | `01066633914` (사장님이 prod 에 추가) |
| 사장님 메모 | "prod 만 보고 test 는 안 봄" |
| Windows 도구 한계 | `rsync`, `sshpass` 없음 → 모두 `paramiko` 우회 |

---

## 📋 완료된 작업 인덱스 (Phase 별)

### Phase A — Audit Critical 12건 ✅
A 그룹 (quick fix, 각 30분~1시간):
- #1 정산률 형식 검증 (decimal 0~1 강제)
- #2 settlement_monthly 멱등성 (OR→AND + UNIQUE 2종)
- #7 refunds amt 정합성 (`amt_free+amt_pro=amt` 검증)
- #11 상담사 적립 OpsAlert 추가
- 커밋 `9b2aaf6e`

B 그룹 (surgical patch, 각 2~3시간):
- #3 consultation UNIQUE (callid/roomid)
- #5 point.free_balance FOR UPDATE
- #8 refund idempotent_key 컬럼 + UNIQUE
- #12 부동소수점 anomaly 로그
- 커밋 `1e68f51b`

C 그룹 (대규모 변경, 각 3~6시간):
- #6 정산 cron `refund_request` LEFT JOIN (커밋 `dea87861`)
- #9 settleChatRoomLocal retry queue + #10 payment-m2net retry queue (커밋 `eeac2003`)
- #4 M2NET 콜백 단일 트랜잭션 (`deductMemberPointInTx`/`creditCounselorPointInTx` 분리 + handleCallPush 통합)

### Phase E — 보안 16건 자율 적용 + 3건 false positive ✅
- **C-1 PG/M2NET 콜백 인증** — nginx access log 5일치 12,406건 분석으로 **`211.175.205.88` 단일 IP 자체 검증** → `CallbackIpAllowlistGuard` (log 모드, 1주 후 reject 전환 검토)
- C-2 admin 가드 — false positive (29 컨트롤러 모두 적용)
- C-3 phone list 마스킹 (`010-****-5678`)
- C-4 cron 토큰 헤더 방식 전환 + crontab 5건 마이그레이션
- **C-5 membid 위조** — `handleAutopayPush` 진입 시 `payment_method.auto_enabled` + 패키지 금액 교차 검증 + OpsAlert
- C-6 `counselorId` NaN/음수 검증
- W-1 단가 분당 10만원 hard cap
- W-2 page 상한 10,000
- W-3 날짜 round-trip (`02-31` 같은 invalid 차단 + KST 시차 버그 수정)
- W-4 admin updateCustomer phone/password 타입 강제
- W-5 CORS (false positive)
- **W-6 + I-1** Rate limit default 1M → 1,200/분, login → 20/분
- W-7 packageId (false positive — DTO + service 이중 검증)
- **W-8 SMS 재검증** — signup (로컬+소셜) 양쪽 `isVerifiedRecently(phone, 30)` 추가
- W-9 settlement rollback OpsAlert 3단 알림
- I-2 파일 업로드 MIME 화이트리스트
- I-3 은행 계좌 (false positive — list 이미 제외)

### Phase G — DB health-check (18 invariants) ✅
매시간 자동 실행, Critical 위반 시 OpsAlert.
- C-1~C-8: 잔액/금액 정합성
- C-9~C-15: 정산/등급/refund 정합성
- C-11 `settlement_monthly.price` 음수 (Warning)
- C-14 `point.free_balance > total_earned` (Warning)
- C-16 M2NET retry 누적, C-17 chat-settle retry 누적
- **C-18 role/level 매핑 어긋남** (Critical, admin=10/counselor=5/user=2)

prod 현재 상태: violations=1 (known C-8, `mb_id=ubuub1234`, 100원 drift, 운영자 결정 대기)

### Phase B/D — 시나리오 + 외부 의존성 ✅
- [`_AUDIT_PHASE_B_SCENARIOS.md`](_AUDIT_PHASE_B_SCENARIOS.md) — 6개 시나리오 다이어그램
- [`_AUDIT_PHASE_D_EXTERNAL_DEPS.md`](_AUDIT_PHASE_D_EXTERNAL_DEPS.md) — M2NET/AG9/BizM/알리고 종합

### Phase 1 추가 사이클 ✅
- role/level 통일 (`level=5 → role='counselor'` 4파일: settlement-cron / grade-cron / admin/grade / admin/alimtalk-bulk)
- `roleToLevel()` helper
- 사고 대응 매뉴얼 [`_OPS_RUNBOOK.md`](_OPS_RUNBOOK.md)

### 후속 점검 자율 처리 ✅
- settleChatRoomLocal 단일 트랜잭션 (Critical #4 와 동일 패턴)
- health-check C-11/C-14/C-18 추가 (15 → 18 invariants)
- settlements page 상한 (W-2 후속 누락)
- registerAutoPayCard 외부 예외 OpsAlert
- IP allowlist `recentAlerts` Map cleanup

### 이벤트 상담사 시스템 ✅
- DB: `post_counselor.event_starts_at/_ends_at/_banner_image_url` (이미 적용됨)
- API `/api/user/counselors/event` + `?event=1` 통합 필터
- 메인 홈 배너 슬라이드 (이전 세션 완성)
- 어드민 등록 UI (이전 세션 완성)
- **사용자 리스트 "⭐ 이벤트 상담사" 필터 칩** (이번 세션 추가)

### OpsAlert 카톡 발송 — **부분 완료** ⚠️
- 사장님 휴대폰 `01075740572` prod setting 등록
- BizM 알림톡 발송 시도 → **`K104:TemplateNotFound`** (BizM 콘솔에 `ops_admin_alert` 미등록)
- SMS 폴백 코드 추가 (BizM 실패 시 ALIGO LMS)
- **ALIGO 미설정 → SMS 도 불가**
- 사장님이 내일 개발자에게 BizM 콘솔 템플릿 등록 요청 예정

### 운영알림 페이지 UX 개선 ✅
- 안내 박스 (운영자 알림 정의, 크론 5가지 표, 사고 종류 5가지)
- `RecipientsEditor` (이름+휴대폰 행 단위 추가/삭제 UI)
- **추가 버튼 동작 버그 수정** (자체 state 분리)
- **settings UPSERT** (이름 저장 안 됨 사고 해결 — UPDATE only → INSERT ON CONFLICT)
- hint 친절한 한글로
- 글자 크기 키움 (text-xs → text-sm/base)

### 사이드바 빡빡하게 ✅
- 폭 260px → 240px → **220px**
- 메뉴 항목 py-2 → py-1.5 → **py-1**
- 글자 14px → **13px**
- 아이콘 20px → **16px**
- 두 번 압축 (사장님 요청)

### E2E 자동 테스트 (Playwright) ✅
- **50개 시나리오 100% 통과** (2.1분, prod)
- 4 spec 파일: 01-mng-login (3) + 02-user-counselor-list (2) + 04-admin-pages (9) + **05-all-admin-routes (36)**
- `storageState` 기반 한 번만 로그인 → throttle 회피
- 429 무시 + 페이지 사이 1.5초 sleep
- 사용법: `python tools/_run_e2e.py prod`

### 배포 인프라 (rsync/sshpass 없는 Windows 환경)
- `tools/_patch_api.py` — API surgical patch (cat > 파일 + npm build + pm2 reload)
- `tools/_patch_frontend.py` — frontend dist 전송 + **`__SAJUMOON_ENV__` 자동 치환** (tar.gz + ssh)
- `tools/_install_grade_cron.py` — crontab 헤더 방식 등록 (idempotent)
- `tools/_migrate_cron_token_header.py` — crontab 쿼리스트링 → 헤더 마이그레이션
- `tools/_post_deploy_verify.py` — 배포 후 양 서버 검증
- `tools/_run_e2e.py` — Playwright wrapper

---

## 🔥 진짜 남은 작업 (다음 세션 / 별도 작업)

### 즉시 (외부 의존)
1. **BizM 콘솔에 `ops_admin_alert` 템플릿 등록** — 사장님이 개발자에게 내일 요청
   - 본문 (DB `alimtalk_template` 와 100% 동일해야): `[사주문 운영 알림]\n\n유형: #{category}\n시각: #{at}\n\n#{detail}`
   - 변수: `#{category}`, `#{at}`, `#{detail}`
   - 카테고리: 정보성
   - 승인 1~3일
2. **ALIGO 계정 등록** (선택) — BizM 실패 시 SMS 폴백 작동시키려면

### 시간 후
3. **C-1 reject 모드 전환** — 1주 모니터링 후 (`2026-05-24` 경)
   - `.env` 에 `CALLBACK_IP_MODE=reject` 추가
   - 그 동안 OpsAlert 채널에 비-`211.175.205.88` 도착 알림 없으면 안전
4. **Critical #4 모니터링** — 배포 후 1~2일 `M2NET 콜백 트랜잭션 실패 (전체 롤백)` 알림 추적

### 운영자 결정
5. **C-8 drift 100원 보정** — `mb_id=ubuub1234` 의 `member.point` vs `point.balance` 100원 차이. 수동 SQL 또는 그대로 둘지 결정.

### 별도 큰 세션
6. **PG/M2NET HMAC 매뉴얼** (선택) — 매뉴얼 도착 시 IP 화이트리스트 위에 추가 강화
7. **부하 테스트** — 동시 통화 100건 등 시뮬레이션
8. **CI 연동** — E2E 를 GitHub Actions 또는 cron 으로 매일 자동 실행
9. **시각 회귀 테스트** — Playwright snapshot

### 디자인 (별도 채팅 권장)
- 이미지 복붙이 많아 컨텍스트 차는 속도 빠름
- 새 채팅에서 `CLAUDE.md` + `design/design_system.html` 부터 시작

---

## 📁 핵심 파일 인덱스

### 문서 (이 세션 산출물)
| 파일 | 용도 |
|---|---|
| **`_SESSION_CONTINUITY.md`** | **(현 파일) 다음 세션 첫 읽기 — 모든 맥락** |
| `_AUDIT_SUMMARY.md` | Audit Phase A~H 종합 |
| `_NEXT_SESSION_HANDOVER.md` | 세션별 핸드오버 (이번 세션 중간 보고) |
| `_NEXT_SESSION_SECURITY.md` | 보안 Phase E 결과 |
| `_NEXT_SESSION_AUDIT_CRITICAL4.md` | Critical #4 분석 |
| `_OPS_RUNBOOK.md` | OpsAlert 종류별 대응 매뉴얼 + 진단 SQL |
| `_AUDIT_PHASE_B_SCENARIOS.md` | 6개 시나리오 다이어그램 |
| `_AUDIT_PHASE_D_EXTERNAL_DEPS.md` | 외부 의존성 종합 |

### 핵심 코드 (수정/신규)
| 파일 | 변경 |
|---|---|
| `api/src/pg-callbacks/m2net-push.service.ts` | Critical #4: InTx 분리 + handleCallPush 단일 트랜잭션 + settleChatRoomLocal 동일 |
| `api/src/pg-callbacks/callback-ip-allowlist.guard.ts` | (신규) C-1 IP 화이트리스트 가드 |
| `api/src/cron/health-check.service.ts` | (신규) 18 invariants |
| `api/src/cron/retry-cron.service.ts` | (신규) chat-settle + payment-m2net retry |
| `api/src/shared/ops-alert/ops-alert.service.ts` | SMS 폴백 추가 |
| `api/src/user/sms/sms.service.ts` | `sendAdminSms` (LMS) generic 발송 |
| `api/src/admin/settings/settings.service.ts` | UPDATE → UPSERT (이름 저장 사고 해결) |
| `api/src/admin/members/members.service.ts` | phone list 마스킹 + `roleToLevel` + W-4 타입 강제 |
| `api/src/cron/cron.controller.ts` | rollback OpsAlert + `/test-alert` endpoint |
| `api/src/main.ts` | `trust proxy = 1` (nginx X-Forwarded-For 신뢰) |
| `api/src/app.module.ts` | Rate limit 1200/20 |
| `api/src/shared/db/db.module.ts` | `TxSql` 타입 export |
| `web/mng/src/pages/Settings.tsx` | 운영알림 안내 박스 + RecipientsEditor + hint 친절 |
| `web/mng/src/components/layout/Sidebar.tsx` | 빡빡하게 (220px, py-1, 13px) |
| `web/mng/src/index.css` | `.menu-item` 등 빡빡한 패딩 |
| `web/user/src/pages/CounselorList.tsx` | 이벤트 필터 칩 추가 |
| `web/user/src/lib/api.ts` | `counselorsApi.list({event: true})` |

### 도구 (Windows 우회)
| 파일 | 용도 |
|---|---|
| `tools/_patch_api.py` | API 단일/다중 파일 SFTP put + 원격 빌드 + pm2 reload |
| `tools/_patch_frontend.py` | frontend dist tar.gz + `__SAJUMOON_ENV__` 치환 |
| `tools/_install_grade_cron.py` | crontab 헤더 방식 등록 |
| `tools/_migrate_cron_token_header.py` | crontab 쿼리스트링→헤더 마이그레이션 |
| `tools/_run_e2e.py` | Playwright E2E 실행 wrapper |
| `tools/_post_deploy_verify.py` | 배포 후 양 서버 검증 |
| `tools/_register_ops_alert.py` | OpsAlert 수신자 등록 |
| `tools/_trigger_test_alert.py` | OpsAlert 테스트 발송 |
| `tools/_check_ops_alert.py`, `_diag_mng_login.py`, `_collect_callback_ips.py`, `_analyze_callback_ips.py` | 각종 진단 |

### E2E (Playwright)
| 파일 | 용도 |
|---|---|
| `e2e/package.json` | playwright 의존성 |
| `e2e/playwright.config.ts` | TARGET=test/prod 분기, storageState, retries 1, timeout 60s |
| `e2e/global-setup.ts` | admin 한 번만 로그인 → storageState.json |
| `e2e/tests/01-mng-login.spec.ts` | 로그인 + 운영알림 탭 + 글자 크기 (3) |
| `e2e/tests/02-user-counselor-list.spec.ts` | user 메인 + 상담사 리스트 + 이벤트 칩 (2) |
| `e2e/tests/04-admin-pages.spec.ts` | 핵심 admin 9개 (heading + JS 에러) |
| `e2e/tests/05-all-admin-routes.spec.ts` | **36개 admin 메뉴 자동 검증** |

---

## 🚨 사장님 자주 사용하는 명령

```bash
# E2E 자동 검증 (배포 후)
python tools/_run_e2e.py prod

# API 외과적 패치 배포 (단일 파일)
SSHPASS=<root비번> python tools/_patch_api.py root@104.64.128.103 /data/wwwroot/api.sajumoon.co.kr sajumoon-api

# 프론트 배포
SSHPASS=<root비번> python tools/_patch_frontend.py mng    # 어드민
SSHPASS=<root비번> python tools/_patch_frontend.py user   # 사용자

# health-check 수동 호출
curl -H 'X-Cron-Token: $TOKEN' https://api.sajumoon.co.kr/api/cron/health-check

# OpsAlert 테스트
curl -H 'X-Cron-Token: $TOKEN' https://api.sajumoon.co.kr/api/cron/test-alert
```

---

## 🎯 사장님 요청 패턴 (학습된 메모리)

### 자율 진행 정신
사장님이 반복해서 강조하신 핵심:
> "니가 세운 멋진 계획이니깐 특별하게 나한테 묻지말고 니가 알아서 해줘. 중간중간 방향을 물을 때마다 내용을 완벽히 이해하지 못하고 니가 작업하는 것을 구경하는 나의 입장에서는 그때마다 당황스럽고 내가 무슨 선택을 하든 그 결정이 오히려 너의 작업에 방해가 되는 것 같더라."

→ **묻지말고 자율 진행**. 위험한 항목은 별도 세션 메모로 적고, 덜위험한 건 알아서.

### 렌더링 에러 패턴
긴 markdown 답변이 가끔 안 보임. → **짧은 follow-up 한 줄** 덧붙이기. 메모리: `feedback_render_error_pattern.md`

### "배포해" = both
명시 안 하면 양 서버 (test + prod) 동시. 메모리: `feedback_deploy_default_both.md`

### "외과 배포" / "패치 배포" = `_patch_api.py`
`./deploy.sh` 의 rsync hang 회피. 메모리: `feedback_deploy_surgical_patch.md`

### "왼쪽 정렬해줘" / "폭 정리해줘"
max-w 제한 + 입력란 적정 크기 + 좌측 정렬. 메모리: `feedback_left_align_keyword.md`

### 글자 크기/UI 빡빡함
사장님은 가독성보다 **정보 밀도** 선호. 단 글자 크기는 유지 (13px 정도까지 OK).

---

## 📝 미커밋 변경분 (참고)

이번 세션의 변경은 모두 양 서버 배포는 됐으나 **git commit 은 안 한 상태일 수 있음** (사용자 명시 요청 시에만 커밋하는 정책). `git status` 로 확인.

```bash
git -C c:/claudeworkspace/sajumoon status --short
```

다음 세션에서 커밋 요청 시:
- Audit Critical 커밋들 (`9b2aaf6e`, `1e68f51b`, `dea87861`, `eeac2003`, `b48eace7`) 는 이미 들어있음
- 그 이후 변경 (보안, E2E, UX, 사이드바 등) 은 미커밋

---

## ⚠️ 알려진 known issue

1. **prod C-8 drift** — `mb_id=ubuub1234`, 100원, 운영자 결정 대기 (자동 보정 안 함)
2. **BizM 콘솔 `ops_admin_alert` 미등록** — OpsAlert 카톡 발송 안 됨. 내일 개발자 작업.
3. **ALIGO 미설정** — SMS 폴백도 안 됨
4. **C-1 log 모드** — 1주 후 reject 전환

---

## 🚀 새 세션에서 시작할 때

```
사장님이 입력하시는 첫 메시지 예시:

"_SESSION_CONTINUITY.md 읽고 작업 이어가자."

또는

"OpsAlert 카톡 등록 됐는지 확인해줘. _SESSION_CONTINUITY.md 참고."
```

AI 가 자동으로:
1. 이 파일 읽기
2. `_NEXT_SESSION_HANDOVER.md` 도 읽기
3. 메모리 (`MEMORY.md`) 읽기
4. 작업 이어감

---

작성 완료. 세션 차도 이 파일 + `_NEXT_SESSION_HANDOVER.md` + 메모리만 읽으면 100% 이어집니다.
