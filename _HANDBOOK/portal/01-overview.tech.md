# 통합 운세 포털 — 기술 (아키텍처·엔진·배포)

## 코드 위치 — 독립 모노레포
```
portal/                         # c:\claudeworkspace\sajumoon\portal (사주플랜 api/web과 분리)
  package.json                  # npm workspaces
  packages/
    engine/   @portal/engine    # 순수 함수(결정론적). DB·프레임워크·사주플랜 의존 0
      src/ seed.ts lotto.ts daily.ts dream.ts couple.ts extra.ts index.ts
      test/ lotto.test.ts
    web/      @portal/web        # Vite + React18 + Tailwind3 + TS. engine 소비
      src/ App.tsx(해시라우터) components/{lotto,fortune,dream,couple} data/topics.ts lib/dateKey.ts
```
- 만세(`manse/`)·타로(`tarot/`)와 동일 스택·패턴. **의존성 단방향**: 포털 → 엔진. 엔진은 포털/사주플랜을 모름.
- 빌드: `npm run build -w @portal/engine` (web이 dist 참조) → `npm run build -w @portal/web`.

## 엔진 (결정론적 — 같은 입력 = 같은 결과)
- `seed.ts`: `hashString`(FNV-1a) + `mulberry32` PRNG + `pickUnique(seed,count,max)`. **Math.random 미사용**(결정성). 날짜·랜덤이 필요하면 호출부(UI)가 시드를 넘김.
- `lotto.ts`: `destinyNumbers(birth,gender)`=평생 운명번호(고정) / `weeklyLucky(birth,round)`=회차별 변동 / `quickPick(seed)`=뽑기 / `checkWinning(mine,win,bonus)`=6/45 등수판정 / `NUMBER_MEANING`=45개 풀이 / `ballColor`.
- `daily.ts`: `dailyFortune(subjectKey,dateKey)`=종합·분야별4·행운요소(긍정 편향 45~99). `ZODIAC`(12)·`STAR`(12)·`zodiacOfYear`.
- `dream.ts`: `DREAMS`(24종)·`searchDreams`·`interpretDream(id)`=의미+행운번호. 카테고리(재물/길몽/애정/변화/주의).
- `couple.ts`: `compatibility(a,b)`=순서무관(키 sort) 점수+풀이.
- `daily.ts`: `starOfDate(m,d)`=생일→별자리. `dailyFortune`은 신년(periodKey=연)·월간(연-월)에도 재활용(FortuneView mode newyear/monthly).
- `extra.ts`: `wealthFortune(birth,period)`=재물운(시기·주의)·`lifeFortune(birth)`=평생 5단계 대운·`goodDays(purpose,year,month,firstWeekday,daysInMonth)`=택일(목적별 길일/대길, 날짜는 UI가 전달).

## 프론트
- 해시 라우터(`App.tsx`): `#/ #/lotto #/today #/zodiac #/star #/dream #/couple`. 외부 타일(만세·타로)은 `window.open` 새 탭.
- 디자인 토큰(`tailwind.config.js`/`index.css`): bg `#f7f7fb`·Pretendard(jsdelivr CDN)·primary 보라 `#8259F5`·accent 핑크(`#ec4899`/`#fdf2f8`/`#f472b6`)·흰 카드 ring·`rounded-card 20px`. 모바일 rem 18/16px. `.app-shell` max-w 600 가운데.
- 날짜는 `lib/dateKey.ts`가 생성(엔진 순수 유지): `todayKey` / `weekKey`(ISO) / `todayLabel`.
- 콘텐츠 추가 = `data/topics.ts`에 타일 1줄 + 라우트 + 뷰 컴포넌트. (kind: lotto/fortune/external/soon)

## 배포 — additive (기존 사이트 무영향)
- 스크립트: `tools/_portal_deploy.py {inspect|deploy|upload}`. `_tarot_deploy.py` 패턴 복제.
- 서버 `104.64.128.103`: vhost `/usr/local/nginx/conf/vhost/unse.sajuplan.com.conf`(전용·additive), webroot `/data/wwwroot/portal`, SSL acme.sh(LetsEncrypt EC-256).
- 안전: 기존 server block 무수정, `nginx -t` 통과 후에만 reload, 실패 시 자동 롤백. DNS는 와일드카드 `*.sajuplan.com`로 자동 해석.
- 재배포(파일만): `python tools/_portal_deploy.py upload`. 신규 콘텐츠 후엔 web 빌드 → upload.

## 검증
- E2E: `e2e/tests/121-unse-portal.spec.ts` (라이브 unse.sajuplan.com, 모바일 375px, 7케이스). 실행: `npx playwright test tests/121-unse-portal.spec.ts`.
- 엔진 단위: `npm run test -w @portal/engine`(node --test, .ts 러너 미연결 시 dist 런타임 확인).
- 무에러 스캔(축1): pageerror 0 · 가로 오버플로 0 · 전 라우트 200.

## 함정
- engine 수정 시 **tsc 빌드 먼저**(web이 dist 참조). 안 하면 옛 로직.
- 배포는 PowerShell + paramiko(.env.local SSHPASS). 와일드 DNS라 새 서브도메인도 DNS 추가 불필요.
- 캐시버스트: vhost가 `.html`=no-cache, 정적(js/css)=30d. 새 빌드는 파일 해시가 바뀌어 자동 무효화.
