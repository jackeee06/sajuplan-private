# 🔄 세션 인수인계 — 2026-05-25 (2026-05-27 갱신)

## 📦 다음 정기 모바일 앱 빌드 시 묶음 작업 (2026-05-27 합의)

개발자가 앱 소스 작업 시작하면 **"FCM 작업 시작"** 한 마디로 재개.
빌드 1회로 평생 푸시 + 가로보기 + 회전 정책 일괄 해결.

| # | 작업 | 변경 위치 | 효과 |
|---|---|---|---|
| 1 | 가로보기 차단 | Info.plist + AndroidManifest | 회전 시 콘텐츠 세로 유지 |
| 2 | FCM 활성화 | `@react-native-firebase/messaging` + Google Services | 모든 푸시 즉시 수신 |
| 3 | Deep Link 일반 처리 | mobile/App.tsx onMessage 핸들러 | 새 푸시 라우팅 무한 가능 |
| 4 | Android Notification Channel 5종 | consult/chat/payment/marketing/system | 사운드/진동 분류 |
| 5 | In-App Foreground 통합 | InAppNotification.tsx 정비 | 앱 열린 상태 알림 |
| 6 | 표준 payload schema | `{ type, link, channel, ... }` | 평생 일관 처리 |
| 7 | (선택) 애플 OAuth | Service ID + Key | iOS 정식 출시 시 필수 |

**원칙**: 위 인프라 한 번 깔면 이후 새 푸시 종류 추가 = 백엔드 코드만 작성. 빌드 X.

향후 예상 푸시 종류 (30+):
- 상담: 상담 요청 도착(이미 코드 있음), 상담사 입장, 채팅 메시지, 종료, 단골 접속 등
- 결제/코인: 결제 완료, 가상계좌 입금, 자동충전, 환불, 코인 부족
- 상담사: 새 후기/Q&A, 월 정산, 선지급 처리, 등급 변경
- 마케팅: 출석/추천인/생일/쿠폰 만료/휴면 복귀
- 시스템: 가입 환영, 새 디바이스 로그인, 약관 변경, 점검

---

### 🔔 빌드 직후 즉시 활성화 작업 (사장님 "FCM 적용해줘" 한 마디로 진행)

빌드로 RN 측 FCM 활성화되면, **백엔드 코드에 FCM 발송 한 줄 추가** 하는 작업들 모음.
각 항목은 이미 백엔드 알림 함수 골격에 자리 잡혀 있어, 빌드 후 주석 해제 또는 한 줄 추가로 즉시 활성화.

#### A. 상담 5분 잔량 알림 (2026-05-27 작업 — 자체 구현 + FCM 보완)
- **자체 구현 (지금)**: 채팅 시스템 메시지 + 화면 배너 + TTS + 진동 (앱 포그라운드)
- **FCM 추가 시점**: 빌드 후 — 앱 백그라운드/잠금 화면 사용자에게도 푸시
- **payload 표준**:
  ```ts
  {
    title: '⏰ 5분 남았어요',
    body: '충전하시면 끊김 없이 계속 상담 가능합니다',
    data: {
      type: 'consult_5min_warning',
      channel: 'consult',
      link: '/mypage/charge',           // 클릭 시 충전 페이지
      consult_id: String(consultId),     // 채팅 ID — 결제 후 복귀용
      consult_type: 'chat'|'phone',
    }
  }
  ```
- **백엔드 위치**: 상담 시작 트리거 함수 안 (이미 자체 알림 발송하는 곳에 1줄 추가)
- **회원 + 상담사 양쪽 토큰 모두에 발송**

##### 🚨 2026-05-27 발견 — FCM 빌드 후 반드시 보완할 한계

**자체 구현만으로는 못 잡는 시나리오 2가지** (FCM 빌드 후 보완 필수):

1. **전화 통화 중 사주플랜 앱이 다른 화면에 있는 경우**
   - 통화 중 사용자/상담사가 사주플랜 앱 안 어디든 있을 수 있음
   - 통화 중 사주플랜 앱 화면 = 다양함 (홈, 마이, 상담사 상세 등)
   - 자체 구현은 WebSocket 전역 채널로 어느 정도 해결되지만,
     **앱이 백그라운드 / 잠금 화면이면 WebSocket 도 끊김**
   - FCM 푸시만이 백그라운드 도달 가능

2. **채팅 중 사용자가 다른 페이지로 이동한 경우**
   - 채팅 메시지 polling 은 ChatRoom 페이지에서만 동작
   - 사용자가 채팅 중 충전/마이/홈 등 다른 페이지 가면 → 채팅창 안 새 메시지 못 받음
   - 전역 WebSocket 으로 보완하지만, 앱 백그라운드 시엔 못 받음
   - FCM 푸시로 백그라운드 도달

**FCM 빌드 후 보완 작업** (간단):
- 백엔드 알림 발송 함수에 `await this.push.sendToTokens(memberTokens, payload)` 한 줄 추가
- 사용자가 푸시 누르면 Deep Link → 채팅창 자동 복귀 (data.link 활용)
- 회원 + 상담사 양쪽 토큰 모두 발송

#### B. 상담 요청 도착 알림 (이미 코드 있음)
- 백엔드 코드: `counselors.service.ts:221` — sendToTokens 호출
- 빌드 후 자동 동작 (수정 불필요)

#### C. 결제 완료 / 가상계좌 입금 / 자동충전 알림
- 코드 추가 시점: 빌드 후
- payload data.type: `'payment_complete'` / `'vbank_received'` / `'auto_charge'`

#### D. 정산 완료 / 선지급 처리됨 (상담사 대상)
- 코드 추가 시점: 빌드 후
- 매월 1일 정산 cron 안 + 선지급 admin 처리 안에 1줄 추가

#### E. 새 후기 / 새 Q&A (상담사 대상)
- payload data.type: `'new_review'` / `'new_qna'`
- 상담사 토큰으로 직접 발송

#### F. 단골 상담사 접속 (회원 대상)
- 토픽 활용 가능 (단골 등록 시 동적 토픽 구독)
- 또는 토큰 직접 발송

**빌드 후 일괄 작업 예상 시간**: A~F 합쳐 약 1~2시간 + 양 서버 배포.
사장님이 "FCM 적용해줘" 하시면 위 6개 일괄 진행.

---

## ⚡ 2026-05-27 자율 진행 추가 작업

### 완료
- **chat/auto-cancel cron prod 등록** — 매분 발화, 매분 채팅방 자동 취소 활성. crontab.backup.2026-05-27 백업 보존.
- **정산 선지급 코드 점검** — 8가지 정책 모두 정상 구현 확인 (pending 차단/일1회/70%/5%/3.3%/실지급 양수/계좌 스냅샷/알림톡)
- **spec 17-payout-policy** 작성 (가용/이력/페이지 로드 3 케이스, test 서버 복구 후 자동 검증)
- **spec 18-password-change** 작성 (변경 endpoint 정책 회귀 4 케이스, test 서버 복구 후 자동 검증)
- **PROD api-healthcheck 9/9 통과** (health + counselors/event + filter-options + app-version + charge/packages + CORS + OAuth config + kakao + naver)
- **PROD 비번 정책 재확인** — signup endpoint "abc" 시도 → "8~20자 + 영문/숫자" 정책 메시지 응답

### 🔴 발견 — 사장님 외출 복귀 후 조치
- **B-005 TEST 서버 다운** (172.235.211.75 ping/HTTPS 모두 무응답)
  → 호스팅 콘솔 reboot 필요
  → PROD 정상, 사용자 영향 0

### 외부 행동 보류 항목
- 애플 OAuth 활성화 (애플 개발자 계정)
- 영수증/세금계산서 (m2net 협의)
- BizM 알림톡 템플릿 검토 (BizM 콘솔)
- test 서버 chat/auto-cancel cron 추가 (서버 복구 후)

---



> **이 세션의 마지막 상태**: 사장님이 자율 진행 원함. 새 세션은 이 문서 + `MEMORY.md` + `PLAN/_PRODUCTION_READINESS.md` 읽고 이어가면 됨.

---

## 📍 큰 그림

사주플랜은 **테스트 단계** (정식 운영 X, 사장님 + 일부 상담사만). 다음 큰 흐름:
1. m2net 답변 받기 → 건당 채팅 정책 결정
2. 정식 운영 체크리스트 클리어
3. 정식 운영 시작

## 🎯 사장님 핵심 선호 (자동 메모리에서 불러올 것)

- **자율 진행 강함** — 코드 세부 묻지 말 것. 위험 작업만 확인. ([feedback_strict_autonomy])
- **큰 흐름 우선** — 마이너 디버깅에 시간 잠식 X. 발견된 버그는 [_BUGS_BACKLOG.md] 기록 후 계속
- **빈 여백 딱 질색** — `w-fit` / `inline-flex` 기본 ([feedback_no_empty_whitespace])
- **돈 자각 자극 X** — 사용자 화면에 합계/매출 강조 X ([project_test_phase])
- **코인/수익금 단일 용어** — 사용자 = 코인, 상담사 = 수익금 ([CLAUDE.md] 용어 사전)
- **배포 항상 자동** — 작업 후 prod+test 양쪽 ([feedback_deploy_always])

## ✅ 2026-05-25 세션 완료 작업

### 사용자 앱 (web/user)
- 모드 인디케이터 (Phase A+B+C): 배너 + 닷 + 토스트 + 자동 복원
- PullToRefresh 컴포넌트
- 정산 URL 정통화: `/mypage/settlement/*` → `/counselor/mypage/settlement/*` (옛 URL 자동 redirect)
- BottomNav: URL 기반 모드 분기 (회원 영역 = 코인충전, 상담사 영역 = 수익금)
- Auth race condition fix: 네트워크 에러 시 세션 유지 + 401 1회 재시도 + 로그인 응답 setSession 직접 주입
- 사용자 화면 "포인트" → "코인" 일괄 변경 + 상담사 "수익 포인트" → "수익금"

### 인프라
- nginx `Cache-Control: no-cache` 적용 (3개 vhost) — 사장님 캐시 삭제 X
- vhost 파일 도메인 주석 — 미래 admin 혼동 방지

### 자동화 (E2E)
- Playwright 인프라 — TARGET=test|prod
- e2e_member, e2e_dual 테스트 계정 (test 서버, password=`e2e_test_2026`)
- global-setup — admin (E2E_ADMIN_PW 환경변수 지원, 미설정 시 admin spec 자동 skip)
  + e2e_dual + e2e_member 3종 API 로그인 자동
- **16개 spec / 76 시나리오** — 60 passed / 13 skipped(admin) / 0 failed / 2 flaky+1 retry OK
- 매 배포 후 `_deploy_and_verify.py user --retry` 자동 회귀 방지
- spec 09/14/15 모두 me() guard beforeEach (세션 만료 자동 재로그인)
- `_run_e2e.py`: --retry-failed, --quick, --spec NAME 지원
- `_deploy_and_verify.py`: --quick / --target / --retry / --no-e2e 옵션
- spec 추가/fix 내역 (turn 2~4):
  - 10 coin-terminology: 사용자 영역 "포인트"/"P단위" 노출 0 검증
  - 11 public-pages-deep: 회원가입/찾기/검색/404
  - 12 api-healthcheck: /api/health + 공개 GET + CORS
  - 13 filter-dropdown: 분야 드롭다운 열기/선택/외부클릭/Esc
  - 14 member-area: e2e_member 회원 영역 9 시나리오
  - 15 charge-flow: 충전 페이지 UI + "P" 단위 정책 검증 (단일 직렬)
  - 16 password-policy: 가입 API 비번 정책 회귀 방지 4 케이스
- 컴포넌트/UI fix:
  - ModeIndicator: sessionStorage prev mode (B-004 부분 해결)
  - **P → 코인** 4군데 (Charge / Payments / ChargeCardRegister / MyReviews)
  - **비밀번호 정책 강화** — 가입/변경 양쪽 통일 (8~20자 + 영문/숫자 혼합):
    - api/src/user/auth/dto/signup.dto.ts (@Length(8,20) + @Matches)
    - api/src/user/auth/auth.service.ts (changePassword 검증 통일)
    - web/user/src/pages/Signup.tsx (에러 메시지 + placeholder)
    - web/user/src/pages/MemberEdit.tsx (에러 메시지 + placeholder)
    - tools/_patch_api.py 화이트리스트에 signup.dto.ts 추가
- 백로그 정리:
  - ✅ B-001 false positive (의도된 환영 페이지)
  - ✅ B-002 listener 누수 fix
  - ✅ B-003 토스트 selector fix
  - 🟢 B-004 묶음 race — sessionStorage fix 후 단독 OK, 묶음 1차 fail/retry OK

### 문서
- `CLAUDE.md` — 도메인 매핑 + 용어 사전 추가
- `PLAN/_BUGS_BACKLOG.md` — 발견 버그 3건 (모두 사용자 영향 미미)
- `PLAN/_PRODUCTION_READINESS.md` — 정식 운영까지 체크리스트 20개 영역
- `PLAN/per-session-chat-pricing.md` — m2net 건당 정책 설계

## 🐛 알려진 버그 (백로그)

[PLAN/_BUGS_BACKLOG.md](PLAN/_BUGS_BACKLOG.md) 참조:
- ✅ **B-001**: /mypage 비로그인 가드 — **RESOLVED (false positive)**. 환영 페이지 노출은 의도. spec 08 수정 완료.
- ✅ **B-002**: E2E 06-spec flaky — fix (페이지별 분리 + listener finally cleanup)
- ✅ **B-003**: E2E 모드 전환 토스트 timing — fix (role=status + timeout 5초)
- 🟢 **B-004**: ModeIndicator 컴포넌트 race — 묶음 실행 시 일부 케이스 flaky.
  진짜 원인 분석 완료: useEffect 의 prev=null 첫 마운트 처리 + me() 응답 timing.
  정식 운영 전 컴포넌트 차원 fix (useRef→useState lazy init 등).

→ B-004 만 정식 운영 전 잔존. 지금 막 작업 X.

## ⏳ 대기 중인 의사결정 (사장님 외부 행동 필요)

1. **m2net 답변 받기** — `per-session-chat-pricing.md` 의 6가지 질문 (카톡 보내심)
2. 추천인 보상 = 코인 vs 수익금
3. sajumoon.kr → test.sajuplan.com 마이그레이션 시점
4. BizM 콘솔에서 알림톡 텍스트 검토 (DB 는 깨끗 — 사장님 콘솔만 확인)
5. **admin 비밀번호** — 현재 변경된 상태로 추정 (`test1234!` 가 더 이상 안 통함, 401).
   E2E 가 admin 영역 자동 skip 중. 사장님이 새 비번 공유 후 `E2E_ADMIN_PW` 환경변수
   설정 1회면 모든 admin spec 활성. (e2e global-setup.ts 가 환경변수 읽음)

## 🚀 새 세션에서 자율 진행 권장 작업

(체크리스트의 미체크 항목 중 사장님 결정 없이 가능)

✅ 완료된 항목:
- E2E 시나리오 확장 (10/11/12/13/14/15)
- 결제 흐름 검증 spec (15) + P→코인 정책 fix
- /mypage B-001 false positive 판명
- B-004 ModeIndicator race (sessionStorage fix + 묶음 me() guard)
- CI/CD 통합 (_deploy_and_verify.py 옵션)
- JWT 만료 정책 점검 (User 14d / Admin 8h)
- OAuth 검증 (카카오/네이버 정상 / 애플 미설정)
- 비밀번호 정책 점검 (가입 3자리/변경 6자리 불일치 발견)

⚠️ **사장님 의사결정 대기**:
- ~~비밀번호 정책 강화~~ — ✅ 완료 (8~20자 + 영문/숫자, 기존 회원 영향 0)
- **애플 OAuth 활성화** 여부 (현재 카카오/네이버만)
- **영수증/세금계산서 기능** — m2net PG 협의 필요
- **알림톡 BizM 템플릿 검토** (BizM 콘솔에서 사장님 확인)
- **chat/auto-cancel cron 추가** (양 서버 crontab) — 정식 운영 전 권장. 매분 발화 비용 미미.

🔄 **자율 진행 가능 (다음 세션)**:
- 마이너 UX 개선 (사용자 신고 영역)
- B-004 잔여 flaky (묶음 시 일부 케이스 race — retry 1회로 흡수 됨)
- 정산 흐름 추가 검증 (선지급/수수료/일1회/70% 제한) — PRODUCTION_READINESS #3

## 📂 핵심 파일 위치

| 파일 | 내용 |
|---|---|
| `CLAUDE.md` | 프로젝트 지침 + 도메인 매핑 + 용어 사전 |
| `PLAN/_PRODUCTION_READINESS.md` | 정식 운영 체크리스트 |
| `PLAN/_BUGS_BACKLOG.md` | 발견 버그 |
| `PLAN/per-session-chat-pricing.md` | m2net 건당 정책 |
| `web/user/src/lib/auth-context.tsx` | 인증 (최근 fix 다수) |
| `web/user/src/components/ModeIndicator.tsx` | 듀얼 역할자 모드 표시 |
| `web/user/src/components/PullToRefresh.tsx` | 당겨서 새로고침 |
| `web/user/src/components/BottomNav.tsx` | 하단 메뉴 (모드별 라벨) |
| `e2e/tests/09-dual-role-mode.spec.ts` | Phase 2 자동화 |
| `e2e/global-setup.ts` | 테스트 세션 준비 |
