# 신규 mng 클린 빌드 — 통합 실행 로드맵

9개 도메인 정밀 분석을 종합한 신규 관리자(`web/mng` + `api`) 구현 로드맵.

**작업 성격:** sample/adm 참고 + 비효율 개선 + 클린 빌드. **이관 아님.** 라이브 점검도 안 함.

---

## 1. 컷 확정 목록 (분석에서 폐기 결정된 영역)

### 폴더 단위
- `sample/adm/shop_admin/` (112개) — 라이브 미사용
- `sample/adm/sms_admin/` (44개) — 라이브 미사용
- 백업 파일 `*_20240xxx.php`, `*_20250xxx.php`, `*_backup.php`, `point_list_.php` 등 (~25개)

### 파일/메뉴 단위
| 영역 | 컷 대상 | 사유 |
|---|---|---|
| 게시판/콘텐츠 | service.php, service_form.php, service_list.php, history_list.php, tour_link.php, view.php | 정기세차/관광지 placeholder, plugin hook |
| 게시판/콘텐츠 | poll_*.php (4) | 라이브 미사용 |
| 게시판/콘텐츠 | boardgroupmember_*.php (3) | 라이브 미사용 |
| 게시판/콘텐츠 | board_copy*.php (2) | 라이브 미사용 |
| 통계 | visit_browser/device/os/search/year/list/delete/delete_update | GA4가 더 잘 함 |
| 결제 | coin_charge_history.php | placeholder (디자인만) |
| 결제 | revenue_list_day/month.php | 더미 HTML |
| 결제 | pay_month.php | 통계 아님 → 정산 트리거. Phase D로 흡수 |
| 인프라 | phpinfo.php | ★ 보안 위험, 절대 금지 |
| 인프라 | dbupgrade.php | 페이지 로드 중 ALTER TABLE 패턴 폐기 |
| 인프라 | browscap*.php (4), theme*.php (5), *_file_delete (4), sendmail_test, _rewrite_config_form, mail_test | 라이브 미사용 또는 자연 대체 |
| 인증 | manager_list.php | 더미 데이터 화면 |
| 인증 | auth_*.php | g5_auth는 라이브에서 거의 미사용. 신규 RBAC로 클린 빌드 |
| 알림 | sms_admin/ 전체 | 라이브 미사용 (별도 결정) |

### 보존 (도메인 흡수)
- `ajax.csr_mgr.php` — M2NET 상담사 매니저 (도메인 03 흡수)
- `pay_month.php` 안의 정산 트리거 로직 → Phase D 정산 cron에 통합

---

## 2. 신규 mng 사이드바 메뉴 구조 (확정)

도메인 1~9 결과 종합. 9개 그룹.

```
대시보드                                        (구현됨, 더미 KPI 제거 필요)
├ 핵심 KPI / 14일 추이 / TOP 상담사·고객 등

회원 관리
├ 고객                                          (구현됨, 포인트 조정 섹션 추가)
└ 상담사                                        (구현됨, 단가/정산율 보강)

포인트 관리                                     [Phase A]
├ 포인트 조정 (회원 상세 페이지에서도 진입)
└ 포인트 변동 이력

결제 관리                                       [Phase B]
├ 결제 내역
├ 환불/취소
└ 결제수단 설정

상담 관리                                       [Phase C]
├ 상담 이력
└ 실시간 상담사 상태

정산 관리                                       [Phase D]
├ 월별 정산 (자동)
├ 정산 이력
└ 수동 보정

콘텐츠                                          [Phase E]
├ 게시판 (18 슬러그 통합 라우팅)
├ FAQ
├ 페이지(고정 콘텐츠)
├ 팝업레이어                                    (구현됨)
└ 배너                                          (신규)

알림                                            [Phase E2]
├ 메일 (큐 기반)
├ 푸시 (FCM)
└ 알림톡 (BizM)

통계                                            [Phase F]
├ 방문/매출 통합
└ 인기 검색어

시스템 설정                                     [Phase G]
├ 기본 환경설정                                 (구현됨, 5탭 추가)
├ 사이트 메뉴 (2depth 지원)
├ 관리자 계정
├ 권한 관리
└ 감사 로그
```

---

## 3. NestJS 모듈 구조 (`api/src/admin/`)

| 모듈 | 상태 | Phase |
|---|---|---|
| `auth/` | ✅ 구현됨 | - |
| `members/` | ✅ 구현됨 (customers/counselors) | - |
| `points/` | 🆕 신규 | A |
| `payments/` | 🆕 신규 | B |
| `consultations/` | 🆕 신규 | C |
| `settlements/` | 🆕 신규 | D |
| `posts/` | 🆕 신규 (18 슬러그 통합) | E |
| `faqs/` | 🆕 신규 | E |
| `banners/` | 🆕 신규 | E |
| `popups/` | ✅ 구현됨 | - |
| `notifications/` | 🆕 신규 (mail/push/alimtalk 통합) | E2 |
| `stats/` | 🆕 신규 | F |
| `settings/` | ✅ 일부 (확장 필요) | G |
| `permissions/` | 🆕 신규 (RBAC) | G |
| `audit/` | 🆕 신규 (감사로그 통일) | G |

**공통 패턴:**
- 모든 service 메서드는 트랜잭션 단위 (`postgres.js sql.begin()`)
- 모든 변경 작업은 `actor_admin_id` + `actor_ip` 기록
- 모든 SQL은 파라미터 바인딩 (직접 보간 금지)
- 모든 라우트는 `AdminAuthGuard` + `@RequirePermission(resource, action)`

---

## 4. React 페이지 구조 (`web/mng/src/pages/`)

| 페이지 | 상태 | Phase |
|---|---|---|
| `Login.tsx` | ✅ | - |
| `Dashboard.tsx` | ✅ (더미 제거 필요) | F (보강) |
| `CustomerList.tsx` / `CustomerForm.tsx` | ✅ (포인트 조정 섹션 추가) | A |
| `CounselorList.tsx` / `CounselorForm.tsx` | ✅ (단가/정산율 보강) | C |
| `PointHistoryList.tsx` | 🆕 | A |
| `PaymentList.tsx` / `PaymentDetail.tsx` | 🆕 | B |
| `ConsultationList.tsx` | 🆕 | C |
| `SettlementList.tsx` / `SettlementMonthly.tsx` | 🆕 | D |
| `posts/PostList.tsx` / `PostForm.tsx` | 🆕 (ContentList placeholder 대체) | E |
| `FaqList.tsx` / `FaqForm.tsx` | 🆕 | E |
| `BannerList.tsx` / `BannerForm.tsx` | 🆕 | E |
| `PopupLayerList.tsx` / `PopupLayerForm.tsx` | ✅ | - |
| `notifications/MailCenter.tsx`, `PushCenter.tsx`, `AlimtalkCenter.tsx` | 🆕 | E2 |
| `stats/StatsOverview.tsx` 등 3개 | 🆕 | F |
| `Settings.tsx` | ✅ (5탭 추가) | G |
| `AdminUsers.tsx`, `AdminPermissions.tsx`, `AuditLog.tsx` | 🆕 | G |

---

## 5. DB 마이그레이션 통합 목록

기존: 0001~0012 (작성 완료, 미적용). 신규에서 추가할 마이그레이션:

| 파일 | 내용 | Phase |
|---|---|---|
| `0013_point_history_actor.sql` | `point_history`에 `actor_admin_id`, `actor_ip`, `actor_type` 추가 | A |
| `0014_payment_audit.sql` | `payment_cancel_log`에 `actor`/`refund_amount`/`refund_coin`/`refund_reason`/`is_partial`/`cancel_method` 추가, `account_setting`에 `bonus_percent`/`total_point`/`message` 추가 | B |
| `0015_admin_permission_extend.sql` | `admin_permission`에 `expires_at`/`note` 추가, `member`에 `is_super` 컬럼 추가 | G |
| `0016_admin_audit_log.sql` | `admin_audit_log` 신규 (모든 admin 변경 작업 통일) | G |
| `0017_settlement_monthly.sql` | `settlement_monthly` 신규 (UNIQUE: member_id, month) + `settlement_job` 신규 (cron 실행 추적) | D |
| `0018_member_state_changed_at.sql` | `member.state_changed_at` (상담사 부재중 경과 시간) | C |
| `0019_post_way_and_fixes.sql` | `post_way` 누락 추가, `c_*` ↔ `post_*` 명명 정합, `revew` 오타 정리 | E |
| `0020_email_template_alimtalk_queue.sql` | `email_template`, `alimtalk_send_queue`, `alimtalk_send_log` 신규 | E2 |
| `0021_setting_extend.sql` | `setting` namespace 확장(qa/saju), `site_menu.parent_id` 추가 | G |

ETL 스크립트는 각 Phase에서 도메인별로 작성:
- `api/db/etl/01_member.sql`, `02_point.sql` (Phase A)
- `04_payment.sql` (Phase B)
- `05_consultation.sql` (Phase C)
- `06_settlement.sql` (Phase D)
- `07_post.sql`, `08_faq.sql` (Phase E)
- 등

---

## 6. Phase 실행 순서 (확정)

| Phase | 영역 | 핵심 산출 | 사전 조건 |
|---|---|---|---|
| **A** | 포인트 조정 이력화 | 0013 마이그레이션, PointsModule, CustomerForm 포인트 조정 섹션, PointHistoryList | - |
| **B** | 결제/취소 | 0014 마이그레이션, PaymentsModule (cancel은 PointsService.adjust 위임), PaymentList/Detail | A 완료 |
| **C** | 상담사/상담 | 0018 마이그레이션, ConsultationsModule, CounselorForm 보강, ConsultationList | - |
| **D** | 정산 | 0017 마이그레이션, SettlementsModule + cron(월 1일), SettlementList/Monthly | C 완료 + 라이브 v2 메커니즘 정확히 재현 |
| **E** | 콘텐츠 (게시판/FAQ/배너) | 0019 마이그레이션, PostsModule(18 슬러그 통합), FaqsModule, BannersModule | - |
| **E2** | 알림 (메일/푸시/알림톡) | 0020 마이그레이션, NotificationsModule (큐 기반), 알림 센터 페이지 3개 | - |
| **F** | 통계/대시보드 강화 | StatsModule, Dashboard.tsx 더미 제거 + 실데이터 연결 | A~E 완료 (data source 필요) |
| **G** | 시스템/권한/감사 | 0015/0016/0021 마이그레이션, PermissionsModule, AdminUsers/Permissions/AuditLog | 다른 모든 Phase의 변경 작업이 audit log에 기록되도록 통합 |
| **도메인-10** | 채팅(1:1 상담) — 사용자향 트랙 | `user/chat` + `shared/m2net` webhook + `consult-charge` + `counselor-state`. 기존 `web/user/src/pages/ChatRoom.tsx` 의 mock → m2net wss 실연동 | 매뉴얼 `docs/상담서비스_API매뉴얼-V1.3.pdf` 정독 + m2net 운영팀 통한 React Native 샘플(`chat-ag9-demo-04.tar.gz`) 입수 + `etc-mgr/{cpid}/notiurl` 등록 1회 |

**권장 시작점: Phase A** — 가장 시급한 이력화 + 다른 Phase에서 재사용할 패턴(트랜잭션 + actor 기록 + audit log 인터페이스)의 기준이 됨.

**도메인-10(채팅)** 은 admin Phase A~G 와 별도 트랙. 사용자향 화면(`web/user`) + NestJS user/shared 모듈만 건드리며, admin Phase 와 의존성 낮음(domain-03 정산 패턴만 참조). Phase A 가 끝나 회원 포인트 이력화 패턴이 잡힌 직후 도메인-10 진입을 권장 — 채팅 종료 시 발생하는 포인트 차감/적립이 동일 패턴(`actor_type='m2net_webhook'`)을 재사용.

---

## 7. 공통 원칙 (모든 Phase 적용)

1. **트랜잭션 + 감사로그**: 모든 변경 작업은 트랜잭션 단위 + actor_admin_id/actor_ip + admin_audit_log 기록
2. **SQL 파라미터 바인딩**: postgres.js 템플릿 리터럴만 사용, 문자열 보간 금지
3. **AdminAuthGuard + RequirePermission**: 모든 `/admin/*` 라우트
4. **CSR 패턴**: 관리자(/mng)는 SPA, 사용자향(/web)은 SSR
5. **에러는 ApiError로**: 서버 응답 `message`를 클라가 자동 표시 (이미 [api.ts](web/mng/src/lib/api.ts) 구현됨)
6. **음수 잔액 금지**: 포인트 차감은 잔액까지만, 초과 시 400
7. **레거시 호환**: `mb_id`, `po_id` 등 ETL용 컬럼만 유지, 신규 코드는 `id`(BIGINT) PK 사용
8. **CSRF 토큰 폐기**: JWT(httpOnly + SameSite) + Origin 검증으로 충분
9. **IP 화이트리스트 폐기**: 환경변수 또는 nginx 레벨로 이동

---

## 8. 검증 절차 (각 Phase 끝)

1. 트랜잭션 동시 호출 race condition 검증
2. 권한 미장착(쿠키 제거) 401 확인
3. 잔액/누적 정합성 검증 (포인트는 `member.point == point.free+paid == 마지막 history.balance_after`)
4. AdminAuthGuard + RequirePermission 적용 누락 없는지
5. SQL 파라미터 바인딩 적용 (직접 보간 0건)
6. admin_audit_log에 모든 변경이 기록되는지
7. ETL 시 row count 검증 (g5_* 원본 vs 신규 테이블)

---

## 9. 라이브 점검 정책

**라이브 점검·수정은 하지 않음.** 분석에서 발견된 라이브 문제(v1 SQL 흔적, pay_cancel 미정의, member_xls_update SQL 버그, push_update CSRF 무방비, phpinfo.php 노출 등)는 신규 mng가 처음부터 재현하지 않는 클린 빌드로 대응.

분석 문서의 "Critical/★" 표시는 신규 빌드 시 해당 패턴을 절대 따라하지 말라는 negative reference.

---

## 10. 시작 지점

다음 세션에서 Phase A 구현 시작 시 [PLAN/phase-a-point-adjustment.md](phase-a-point-adjustment.md) 체크리스트 기준으로 진행.

전체 분석 결과는 [PLAN/](.) 폴더의 9개 도메인 문서(domain-01 ~ domain-09)에 보존.
