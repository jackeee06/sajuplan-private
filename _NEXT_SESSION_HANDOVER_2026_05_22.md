# 2026-05-22 세션 핸드오프

다음 세션은 이 문서를 먼저 읽어 컨텍스트를 잡는다. CLAUDE.md / MEMORY.md 와 같이 보면 더 완전.

---

## 이번 세션 큰 주제 (시작 → 끝)

1. **회원/상담사 ID 단일화** — 한 사람 한 mb_id (회원이면서 상담사도 가능)
2. **DB 초기화 사고 + 복구** — TRUNCATE CASCADE 잘못해서 admin/setting 등 날아감 → 시드 복구
3. **csrid 컬럼 정합성 정리** — 회원 m2net id 는 `m2net_membid`, 상담사는 `csrid` 로 분리
4. **결제/통화/채팅 흐름 정합성** — csrid 잘못 참조 전수 수정
5. **운영 데이터 복구** — 등급/알림톡/출석/충전금액/소셜로그인 키 등
6. **신청 폼 UX 친절화** + 더미 데이터 (구글 심사용)

---

## ✅ 완료된 작업

### 1. ID 단일화 (한 사람 한 mb_id)

**DB 스키마**:
- `member.m2net_membid VARCHAR(50)` 컬럼 추가 (회원 m2net ID 전용)
- `member.csrid` 컬럼은 **상담사 전용**으로 분리

**백엔드 변경 파일 (회원 측 m2net_membid 사용)**:
- `api/src/user/auth/auth.service.ts` — 회원가입 m2net 등록 → m2net_membid 저장, `syncM2netBalance` 함수
- `api/src/admin/counselor-apply/counselor-apply.service.ts` — 승인 시 회원이면 `promoteToCounselor` (새 row 만들지 X), 비회원이면 새 row
- `api/src/admin/members/members.service.ts` — `promoteToCounselor` 메서드 추가
- `api/src/user/counselor-apply/counselor-apply.service.ts` — 회원이면 mb_id/password/phone 자동 사용 (폼 입력값 무시)
- `api/src/user/counselor-apply/counselor-apply.controller.ts` — 회원이면 SMS 인증 검증 skip
- `api/src/user/charge/charge.service.ts` (line 884, 1217) — 결제 회원 매핑
- `api/src/pg-callbacks/m2net-push.service.ts` (line 113, 524, 733, 1017) — 회원 매핑/정산/잔액
- `api/src/admin/payments/payments.service.ts` (line 173) — 자동결제 URL 갱신
- `api/src/cron/reset.service.ts` (line 88) — cron 회원 조회
- `api/src/user/chat/chat.service.ts` (line 217) — 채팅방 조회
- `api/src/user/consult/consult.service.ts` (line 200, 291) — 채팅 시작 + createChatRoom

**프론트 변경**:
- `web/user/src/pages/MyPageEntry.tsx` — 항상 MemberMyPage 렌더 (회원이 기본)
- `web/user/src/pages/MemberMyPage.tsx` — 우상단 [상담사 메뉴 >] 핑크 칩 (role=counselor 일 때만)
- `web/user/src/pages/CounselorMyPage.tsx` — 우상단 [회원 메뉴 >] 회색 칩 (항상 노출)

**검증된 동작**:
- 회원 가입 → m2net_membid 자동 발급
- 회원이 상담사 신청 → 같은 mb_id 그대로 (다른 mb_id 입력 차단)
- 어드민 승인 → 그 회원의 role='user' → 'counselor' 로 promote (새 row 안 생김)
- 우상단 토글 칩으로 회원/상담사 화면 전환

### 2. DB 사고 + 복구

**사고 (반드시 기억)**:
- 운영 전 데이터 정리 SQL 에서 `information_schema.constraint_column_usage` 로 member FK 가진 테이블 자동 발견 → TRUNCATE CASCADE
- 그런데 `setting` 등 cross-cutting 테이블이 member FK 가지고 있어 **member 본체까지 cascade 로 truncate** → admin 계정 + setting + 일부 날아감

**복구 완료**:
- ✅ admin 계정 `gisu` 복구 (id=90 prod, id=87 test) + is_super=true + 비밀번호 `3004!`
- ✅ 등급 정책 22개 row (예비파트너/파트너1~5 단가 옵션 + 정산률 + 임계값)
  - 정확값: 예비파트너 40%, 파트너1 52%, 파트너2 56%, 파트너3 60%, 파트너4 63%, 파트너5 70%
  - 파트너5 단가옵션: `1200,1300,1400,1500,1800,2000`
- ✅ 정산 정책 (VAT 10%, 원천세 3.3%, 회선비 임계 5만원 / 금액 2만원)
- ✅ 선지급 정책 (수수료 5%, 가용 70%, 일1회, 원천 3.3%)
- ✅ 출석 정책 20개 row (회원/상담사 별)
- ✅ 알림톡 템플릿 15개 INSERT (BizM v2 시리즈) + 옛 v1 잔존 14개
- ✅ 통화 대표번호: prepaid=07080169699, postpaid=5000878
- ✅ 소셜 로그인 setting (카카오 REST `5b4c5440d90bc00e073d5749a7f02ec4` / 네이버 Client ID `el3J2RlODMyuPtyBRq0X` + Secret `DFuP7CgJme`)

**살아남은 운영 데이터 (사고 영향 X)**:
- 충전금액 6개 (account_setting)
- 쿠폰 정의 6개 (coupon_zone)
- FAQ 27개 + faq_category 7개
- shop_banner 3개, page (약관) 2개, popup_notice 1개

### 3. csrid 정합성 — 전수 검증 통과

**Agent + 수동 grep + 컨텍스트 분석 결과**:
- 회원 측 csrid 잘못 참조: **0건**
- 상담사 측 csrid 사용: 11곳 모두 정당
- chat_room.csrid / consultation.csrid 컬럼: 상담사 m2net ID 의미 명확

**검증된 흐름**:
- 회원 가입 m2net 등록 → m2net_membid ✓
- 충전 시작 / 콜백 → m2net_membid ✓
- 회원 잔액 동기화 → m2net_membid ✓
- 채팅 시작 / 정산 → m2net_membid ✓
- 자동결제 URL 갱신 → m2net_membid ✓

### 4. UX 친절화 (상담사 신청 폼)

- 제목 input 제거 → 백엔드 자동 채움 (`[상담사 지원] {예명}`)
- 신청상태 디폴트 "상담사 지원" + 토글 위 안내
- 예명/지역/상담분야/생년월일/전문분야 헬프 텍스트 추가
- 사업자 파일 (선택) 라벨
- 회원이면 이름/아이디/비번/휴대폰/이메일 입력 폼 통째 숨김 (회원 정보 자동 매핑)
- 파일 업로드 중 전체 화면 오버레이 (다른 입력 차단)
- 이미지 자동 리사이즈 (Canvas API, `web/user/src/lib/image-resize.ts`)

### 5. 더미 데이터

**상담사 10명** (`dummy_01 ~ dummy_10`):
- 도운선생/라온선생/별빛선생 (사주 3) / 한별선생/솔이선생/가온선생 (타로 3) / 은하선생/새벽선생 (신점 2) / 강가선생/청풍선생 (심리 2)
- 이미지: `repo/images/square/`, `repo/images/oblong/` (15쌍) → seed-counselor-images.ts 로 자동 매핑
- 비밀번호: `dummy_pass_2026!`

**고객 10명** (`dummy_cust_01 ~ dummy_cust_10`):
- 김민준/이서연/박지호/최수아/정도윤/강하윤/윤서준/임지유/한예준/오시은
- 보유 P 다양 (0 ~ 100,000)
- 비밀번호: `dummy_pass_2026!`

**정리 SQL** (심사 끝나면):
```sql
DELETE FROM member WHERE mb_id LIKE 'dummy_%';
DELETE FROM member WHERE mb_id LIKE 'dummy_cust_%';
```

### 6. mng 로고 변경

- `web/mng/public/logo_b.svg`, `logo_w.svg` 에 사주플랜 새 로고 복사
- `web/mng/src/pages/Login.tsx:69` — `logo_w.png` → `logo_b.svg`

### 7. 알림톡 v2 통일

- v1 옛 14개 (prod 13, test 12) 삭제
- v2 시리즈 15개 유지 + register_idpw1 (비번찾기 v1) 만 보존
- .env 의 `BIZM_TPL_SIGNUP_AUTH=register_num_v2` 라인 추가 + pm2 reload
- `BIZM_PROFILE_KEY=2dfd4854029b86f17d87eb6fd9b12faf0ccfbe07` (사장님이 알려준 새 키)

---

## ⏳ 미해결 / 다음 세션 후보

### 사장님이 해주실 일

1. **카카오 콘솔 Redirect URI 등록 확인** (했는지 모름)
   - 카카오 개발자 콘솔 → 본인 앱 → 카카오 로그인 → Redirect URI
   - 등록값: `https://api.sajuplan.com/api/user/auth/social/kakao/callback`
   - 카카오 로그인 활성화 ON
   - 동의항목: 닉네임/프로필사진/이메일

2. **네이버 콘솔 Callback URL 등록**
   - https://developers.naver.com → Application → API 설정
   - 등록값: `https://api.sajuplan.com/api/user/auth/social/naver/callback`
   - 네이버 로그인 동의 화면의 사주플랜 로고도 콘솔에서 업로드 변경 가능 (옛 음양 로고)

3. **m2net (PassCall) 어드민 청소** (했는지 모름)
   - 옛 회원/상담사 csrid 들 정리
   - 안 하면 새 가입 시 m2net 측 충돌 가능

4. **BizM 측 비밀번호 찾기 템플릿 v2 재제작**
   - BizM 콘솔에서 v2 만든 후 엑셀 export
   - 받으면 1) DB INSERT 2) `.env` 의 `BIZM_TPL_FIND_PW=register_idpw_v2` 변경 3) `register_idpw1` row 삭제

### 코드 작업 후보

1. **DB 자동 백업 cron 설정** — 사고 재발 방지. 일일 pg_dump → /root/backup/postgres/YYYYMMDD.sql.gz (7일 보관)
2. **mng 에 통화 대표번호 / 소셜 로그인 키 입력 UI** — 현재는 SQL 직접 시드
3. **일반관리자 권한 매트릭스 default** — 일반 admin 만들 때 필요

---

## 🔑 중요 자격증명 / URL

### 운영 계정
- **admin (mng)**: id=`gisu` / pw=`3004!` / is_super=true
- **더미 계정 비밀번호** (모두 공통): `dummy_pass_2026!`

### 외부 키
- **카카오 REST API 키**: `5b4c5440d90bc00e073d5749a7f02ec4`
- **카카오 Client Secret**: (사장님이 안 줌, 활성화 안 됐을 수도)
- **네이버 Client ID**: `el3J2RlODMyuPtyBRq0X`
- **네이버 Client Secret**: `DFuP7CgJme`
- **BizM Profile Key**: `2dfd4854029b86f17d87eb6fd9b12faf0ccfbe07`
- **BizM User ID**: `sajumoon9`

### URL
- prod 회원앱: https://sajuplan.com
- prod mng: https://sajuplan.com/mng
- prod api: https://api.sajuplan.com (NestJS prefix: `/api`)
- test 회원앱: https://sajumoon.kr
- test mng: https://sajumoon.kr/mng

### 통화 대표번호 (setting.consult)
- prepaid: `07080169699`
- postpaid: `5000878`

---

## 📊 현재 DB 상태

- 회원/상담사 본체는 새로 가입한 사람들만 존재 (사고 후 초기화)
- `jackee` (id=91 prod) — role=counselor 승격됨, m2net_membid=295109, csrid=19970
- 더미 상담사 10명 + 더미 고객 10명 활성

---

## 🚨 다음 세션이 반드시 알아야 할 것

1. **csrid vs m2net_membid 분리 정책** (위에 자세히)
2. **사고 재발 방지** — DB 작업 시 자동 발견 TRUNCATE 패턴 절대 금지. 화이트리스트 방식으로 구체 테이블만.
3. **사장님 카카오/네이버 콘솔 작업 여부 미확인** — 다음 세션 시작 시 사장님께 "카카오/네이버 로그인 테스트 됐나요?" 물어볼 것
4. **PWA 캐시 강함** — 사장님이 화면 변경 안 보인다 하면 캐시 클리어 안내. 시크릿창 권장.

---

## 메모리 업데이트 항목

다음 세션은 메모리도 자동 로드. 별도로 [project_sajumoon_basics] / [project_security_audit_2026_05_22] / [feedback_deploy_*] 등 자동 적용.

신규 추가 필요 메모리:
- `project_id_unification_complete` — ID 단일화 완료 상태 + csrid/m2net_membid 분리 정책
- `feedback_db_truncate_cascade_disaster` — 자동 발견 TRUNCATE 의 위험성
