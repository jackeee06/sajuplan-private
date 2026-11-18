# 공유 프로필 & 임베드 — 기술

## 공유 프로필 (`web/src/lib/profile.ts`)
- `Profile = { birth:"YYYY-MM-DD"(양력), gender?, name?, time?:"HH:mm", lon?, region? }`. 키 `unse_profile_v1`(localStorage).
- `loadProfile()`(옛 타일별 키 마이그레이션 포함)·`saveProfile()`(이벤트 `unse-profile-change` 디스패치)·`clearProfile()`.
- 파생: `zodiacOfProfile`·`starOfProfile`(engine `zodiacOfYear`/`starOfDate` 사용)·`profileSummary`(접힌 카드 문자열, 시각 있으면 오전/오후).
- 포털 엔진(로또·daily·couple)은 birth(양력 날짜)+gender만 사용. time/lon/region은 만세력 연동용 pass-through.
- UI: `ProfileBar.tsx`(미입력 권유배너 → 입력폼[이름+성별 한줄·생년월일(DateField)+시각(TimeField)+시간모름·출생지칩 REGIONS] → 접힌 요약카드[수정·초기화]). 입력 컴포넌트 `DateField.tsx`(digits→`1990/06/15`)·`TimeField.tsx`(digits→`07:20`), inputMode=numeric.
- 신규 사용자 기본 `unknownHour=false`(시각 칸 바로 활성). 필드 너비충돌 주의(`w-full`+`flex-1` 금지, 칸별 명시).

## 만세력 자동 연동 (`web/src/components/EmbedView.tsx`)
- 🔑 만세력 App이 **이미 URL 파라미터 자동계산 지원**(`manse/.../App.tsx`: `?b=YYYY-MM-DDTHH:mm&g=M|F&nm=이름&lon=경도&uh=시간모름0|1` → 입력폼 스킵, 결과 바로). 원래 공유링크 기능. **만세력 0% 수정**(보관 원칙).
- EmbedView가 src에 'manse' 포함 시 프로필을 그 형식으로 조립: `b=${birth}T${time||'12:00'}`, `uh=${time?'0':'1'}`, `g`, `lon=${lon??127}`, `nm`. 타로엔 파라미터 없음.
- ⚠️ 양음력 토글 미지원(만세 b=양력ISO·포털엔 lunarToSolar 없음). 음력자는 만세력 안에서 수정.

## 임베드 (iframe)
- 만세·타로 = `kind:"embed"` + `route`/`href`. App이 embed 라우트에서 포털 Header 대신 EmbedView(자체 "‹ 운세 포털" 바 + iframe 100dvh) 렌더.
- 사전점검: manse/tarot에 X-Frame-Options/CSP frame-ancestors **없음** → 크로스서브도메인 iframe 허용. 만세·타로 nginx 무수정.

## 배포·검증
- `tools/_portal_deploy.py {inspect|deploy|upload}`(additive vhost+acme SSL, `_tarot_deploy` 패턴). 재배포=`upload`.
- E2E P-8(공유프로필 자동적용)·P-9(임베드+뒤로가기)·P-10(만세 자동채움) — `e2e/tests/121-unse-portal.spec.ts`.
