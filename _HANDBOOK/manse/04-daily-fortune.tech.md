# [AI 전용] 무료 만세력 — 일일운세 기술

> 사용자용: [무료 만세력 — 일일운세](manse/04-daily-fortune)

## 핵심 파일
| 파일 | 역할 |
|---|---|
| `manse/packages/engine/src/daily.ts` | `computeDailyFortune(input, date)` 순수함수(엔진). 결정론적 |
| `manse/packages/web/src/components/DailyFortune.tsx` | 일일운세 탭 UI(입력·오늘 결과·기간 토글·공유·세션·프로필카드) |
| `manse/packages/web/src/components/PeriodViews.tsx` | 주간/월간/평생(WeekView·MonthView·LifeTeaser) |
| `manse/packages/web/src/lib/interpret.ts` | 평생 맛보기용 일간 기질(STEM_TRAIT)·격국(GYEOK_MEANING) 재활용 |

## 계산 (daily.ts)
- **입력** `DailyInput`: `{mode:"natal", birth, gender, unknownHour, longitude}` 또는 `{mode:"zodiac", yearBranch}`(0~11 연지).
- **오늘 일진**: `monthDayPillars(y,m)` 에서 day 매칭 → `{stem, branch}`.
- **natal**: `computeFourPillars`+`strength`(용신)를 **직접 호출**(computeManse 안 거쳐 index↔daily 순환 회피). 천간 십성 `tenGodOf(myStem, todayStem)` + 지장간 십성.
- **zodiac**: 띠 연지 오행 vs 오늘 오행 `generates/controls`(상생·상극).
- **지지 관계**: 충(+6)/육합(SIX_HAP)/삼합(SAM_HAP) 표.
- **점수**: base 50 + 십성 가중(`TG_SCORE`) + 용신 일치(+14) + 지지관계(삼합+12/육합+9/충−12) → `clamp(12,96)`. stars=`round(/20)`.
- **부가 필드**: `title`/titleEmoji(별명), `percentile`(상위 N%), `hashtags`, `scenario`, `caution`, `quote`, `lotto`(LCG 결정론 6개), `luckySurname`(행운오행→자음오행), `chart`(natal 미니명식 4기둥+오행%+강약), `fields`(6분야), `timeSlots`(4구간), `guide`(do/dont), `luck`(색·숫자·방향·시간·아이템·음식), `zodiacMatch`.
- ⚠️ **`Date.now`/`Math.random` 미사용**(결정론) — `date`는 인자로 주입(web에서 `new Date()`로 today/어제/7일/한달 생성).

## 기간운세 (PeriodViews — web 집계, 엔진 무변경)
- **주간** `WeekView`: 오늘~+6일 `computeDailyFortune` 7회 → 평균·best/worst·분야별 평균.
- **월간** `MonthView`: 이번달 1~말일 N회 → 주차별 평균·길일(top3)/조심할날(bottom3).
- **평생** `LifeTeaser`: `computeManse(input)` → 일간/격국/강약·용신/현재 대운(나이=올해−`chart.birthYear`+1) + interpret.ts. **맛보기 전용**(🔒 + "전문가 상담" CTA, 풀 해석 금지 — 상담사 보호). natal만(띠 모드 → "생년월일시 입력" 안내).

## 세션 공유 (App lastInput 리프팅)
- `App.tsx`: `lastInput`(ManseInput) **단일 소스**, `chart`는 lastInput 파생 `useMemo`. `reset()`=lastInput null.
- 세 탭 공유: `<DailyFortune sharedInput onShared onReset>`, `<CoupleView sharedInput>`(A `fromIso` prefill).
- DailyFortune: sharedInput 있으면 정밀 자동 계산 + `NatalProfile`(프로필카드 — 정보수정/초기화/결과공유), `onShared`로 공유 갱신, URL `?m=daily&db=…`도 onShared 경유.
- **세션 한정**(영구저장 X) — 상담사 다회 조회·공용PC 개인정보 고려.
- 공유 URL: 띠 `?m=daily&z=띠`, 정밀 `?m=daily&db=생일&g=&uh=&lon=`(재진입 자동계산).

## 디자인 (사주플랜 톤 일체화 2026-06-25)
- 흰 카드(`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100`) + 핑크 좌측바 제목(`SectionTitle`). **그라데이션은 하단 상담 CTA 배너에만**(만세력 App 하단과 동일 패턴).
- 버튼 위계: 주 동작 `bg-accent-500`(핑크채움) / 토글 활성 핑크·비활성 흰버튼+테두리 / 보조 외곽선 / 요약 대표헤더 `ring-2 ring-primary-400 shadow-md`.
- 공유 버튼 3곳(만세력 결과공유·일일운세·궁합) 핑크 통일.
- ⛔ **사람 이름 강조색 = primary(보라), accent(빨강/핑크) 금지** — 고인(故人) 금기. 메모리 `feedback_no_red_names`. (오행 화·신살 빨강은 의미색이라 OK)

## 빌드·배포 주의
- engine 수정 시 **`cd manse/packages/engine && npm run build`(tsc) 먼저** — web이 `dist/index.js` 참조.
- 배포 `python tools/_manse_deploy.py deploy`(index.html + assets만). **이미지(img)는 안 올림** → `_put_prod_file.py`로 직접(`/data/wwwroot/manse/img/`).
- OG 카드: `index.html` og:image=`og8.png`(흰 배경 사주플랜 톤). 카카오는 og:image **URL이 같으면 재요청 안 함** → 이미지 바꾸면 **새 파일명** 필요.

## 검증
엔진 node sanity(띠/정밀 결정론) + `tsc --noEmit` + Playwright(띠/정밀·4기간·세션공유·결과공유 버튼).

## 관련
- [무료 만세력 — 일일운세](manse/04-daily-fortune)
- [무료 만세력 화면·UX 기술](manse/03-chart-ui)
- 메모리: `project_manse_daily_fortune`, `project_no_ai_saju_analysis`, `feedback_no_red_names`
