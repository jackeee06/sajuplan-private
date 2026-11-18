# [AI 전용] 무료 만세력 — 화면·UX 구현 (2026-06-24 개편)

> 위치: `manse/packages/web/src/`. 엔진 변경분은 `manse/packages/engine/src/`.

## 1. 인터랙티브 원국 — `components/ChartGrid.tsx`
- 별도 `TabbedDetail.tsx`(아래 중복 표) **삭제**. 원국 하나로 통합.
- 상단 탭 `TABS`(궁성=null / 천간합 / 육합 / 삼합 / 방합 / 천간충 / 충 / 공망 / 형 / 파 / 해 / 원진). `active` state. 탭 행 = **`flex flex-wrap`**(가로 스크롤 폐지 — 12탭 한눈에, 스와이프 불필요, 2026-06-24).
- 강조 로직: `hi: Set<"pillarKey:stem|branch">`. 관계 탭이면 `chart.analysis.hapchung.filter(type)` → `r.pillars × r.row`. 공망이면 gongmang 닿는 지지.
- `dimMode = hi.size > 0` (매칭 없으면 dim 안 함 — 전체 흐려짐 방지). `cellState(key,row)` = normal | emph(`ring-[3px] ring-accent-500`) | dim(`opacity-30`).
- 왼쪽 라벨에 **궁성·의미** 행 추가(`PALACE` 맵: 시주=말년운/자녀·결실 …). 아래 표 흡수의 핵심.
- 공망 = 항상 지지 Char에 "공" 뱃지(`voidMark`) + `ring-accent-400`.
- 오행 범례 `<ElementLegend/>` 삽입.

## 2. 운의 흐름 드릴다운 — `components/LuckFlow.tsx` (신규)
- App에서 ChartGrid·AnalysisView 사이에 배치. 기존 ChartGrid의 대운 / AnalysisView의 세운·월운 블록을 **여기로 이전·삭제**.
- 대운(`chart.daewoon.list`) 클릭 → `yearLuck(dayStemIndex, birthYear+age, 10)` → 연운 클릭 → `monthLuck(dayStemIndex, year)`.
- 기본 선택 = `new Date().getFullYear()` 기준 현재 나이 대운 + 올해. 캐시 무효는 `selAge`/`selYear` state.
- 표시 순서 = 이른 나이/연도가 **왼쪽**(좌→우 자연 순서, reverse 제거). Row = **`flex flex-wrap gap-1.5 py-1`**(가로 스크롤 폐지) → 대운10·연운10·월운12 전부 줄바꿈으로 한눈에, 스와이프 불필요(2026-06-24 변경).
- `CharR` = 한자+한글 음 루비(壬임). 한자 `text-base`, 음 `text-[14px]`.

## 3. 엔진 변경 — 관계 위치 노출
- `analysis.ts` `Relation`에 `pillars: string[]`(year/month/day/hour) + `row: "stem"|"branch"` 추가. `hapchung()`이 채움(삼합/방합은 `keysFor`로 관여 기둥 추출).
- `index.ts`: `chart.dayStemIndex`, `chart.birthYear` 노출. `yearLuck(dayStemIndex, startYear, count)` / `monthLuck(dayStemIndex, year)` export(친화형 — sewoon/monthlyWoon 재활용, 새 계산식 0).
- `types.ts` ManseChart에 위 필드 반영. **vitest 38/38 PASS 유지**.

## 4. 가독성
- `tailwind.config.js`: `font-hanja` 1순위를 **Noto Sans KR**로(Pretendard엔 한자 글리프 없어 font-weight 무시됐던 근본원인). `index.html`에 Noto Sans KR(400;500;700;900) 로드.
- `index.css`: `html { font-size: 18px }`(노안 — rem 기반 전체 비율 확대).
- 원국 한자 `font-black`, 대운/표 한자 `font-extrabold`. 작은 라벨(궁성/의미/십성/지장간/운성) 고정 px→rem(text-xs/sm)로, 색 진하게(gray-600/700).

## 5. 입력 접기·공유 — `App.tsx`, `lib/shareCard.ts`, `components/InputPanel.tsx`
- `editing` state: 계산되면 InputPanel을 **언마운트 않고 `hidden`**(입력값 보존), 결과에 "정보 수정하기"로 토글.
- **링크 공유** `share()`: `?b=birth&g&lon&uh&nm=name` URL. `navigator.share`는 **title+url만**(text 넣으면 카톡이 raw텍스트 처리). 폴백 클립보드. 자동로드 useEffect가 `nm` 읽어 이름 표시.
- OG: `index.html`에 og:title/description/url/image + `public/img/og.png`(1200×630 브랜드 이미지). 카톡 미리보기 카드.
- **이미지 공유** `shareImage()`: ① 클립보드 복사 우선(`ClipboardItem` image/png — 검증됨) → ② 공유 시트 → ③ 다운로드. 결과 전체 캡처는 `html-to-image`(동적 import 청크) + 백그라운드 프리워밍(`prepareFull`/`markFullDirty`).

## 6. 신살·길성 표 — `AnalysisView.tsx` + `lib/interpret.ts` (2026-06-24)
- 칩 나열 → **기둥별 `<table>`**(cols=시/일/월/년 존재기둥, rows=천간·지지·신살). 상단 요약 칩 + "총 N개·길성 G·신살 S".
- 색: `SINSAL_KIND`(길성/신살) → 길성 violet, 신살 amber. `SINSAL_MEANING` 푸짐한 뜻풀이.
- 엔진 `analysis.ts sinsal()` **9→25종 확대**: +천덕·월덕·태극·문곡·천의·천문·금여·홍염·현침·비인·고신·과숙·귀문관·천라지망. 도화/역마/화개 **년지+일지 삼합** 둘 다 + **사생지(寅申巳亥) 역마**. 천간/지지 글자는 **오행 색**(`elementStyle`). `name:pillar` dedup. **vitest 43/43**(D2=신살 위치 핀 추가).

## 7. 오행·십성 분석 — `AnalysisView.tsx` + `lib/interpret.ts` (2026-06-24)
- 십성: `tenGodDistribution`에서 `count>0` 필터 **제거** → 10종 전부 반환. UI는 막대(오행과 동일 패턴)+5그룹(`GROUP_DEF`)+뜻풀이(`SIPSEONG_MEANING`/`SIPSEONG_GROUP_MEANING`). 0%는 dim. (domains.ts·테스트는 count 합산이라 영향 없음)
- 오행: 도넛+막대(등급)+`Pentagon`(상생/상극·`role`·%). 변경 없음(이미 경쟁사 이상).

## 8. 분야별 풀이 장문화 — `components/DomainReadings.tsx` + `lib/domains.ts` (2026-06-24)
- 직업·애정·재물·건강을 1~2문장 → **3~5문장 장문 + 조언(tip) 박스**로 보강(경쟁사 읽을거리 대응).
- 데이터 결합: 십성 5그룹 우세·격국·신강약·용신(분야 매핑)·오행 과부족(장부)·신살(역마/문창/화개/괴강/도화/백호)·배우자궁(일지 십성)·일지 충/합·재다신약/식상생재/군겁쟁재. 전부 명식에서 결정적 도출(참고용).
- UI: 2열 그리드 → **전체폭 단일 열**(장문 가독성) + 분야마다 `tip` 한 줄.

## 9. 쉽게 보기(일반인용) 콘텐츠 보강 — `components/EasyView.tsx` (2026-06-24)
- 예전: 일간+원국+"전문가 보기에서 확인" 안내만(빈약) → 일반인 첫 화면이 비어 마케팅 깔때기 역전 문제였음.
- 보강: 일간 성향(`STEM_TRAIT`) + 오행 기운(친절 요약+%칩) + 신강약·용신·**지금 대운**(현재 나이 기준 `daewoon.list`에서 선택) + **분야별 장문풀이(`DomainReadings` 재사용)** + 주요 길성/신살 3개(길성 우선). 친절체(~요).
- 역할 분리 확정: **쉽게 보기 = 일반인 친절 읽을거리 / 전문가 보기 = 상담사 빽빽 데이터**.

## 10. 궁합 풀이 보강 — `components/CoupleView.tsx` (2026-06-24)
- 예전: 점수+격국+요인(delta)만(빈약). → **궁합 풀이 카드**(`CoupleReading`) 추가.
- 내용: 종합 해석(`compat.level`별 친절 문장) + 두 사람 일간 성향(`STEM_TRAIT`) + **오행 궁합**(한쪽 부족 오행을 상대가 채우면 보완형 / 둘 다 강하면 통함+충돌 / 결 다르면 자극) + 조언. 엔진 무수정(두 명식 `res.a`/`res.b` 데이터 재사용).
- **상담 전환 깔때기 (2026-06-25)**: 결과 하단에 감정 고조 시점용 CTA 카드(맛보기 3=결혼시기·갈등이별·자녀재물운 → "전문가에게 궁합 물어보기" `sajuplan.com`). 무료=인상/공유, 깊은 결정은 상담 영역. 근거: 궁합=최고 intent·최고 바이럴 입구(메모리 [[project-manse-marketing-maximize]]).
- **결과 공유 (바이럴)**: `📤 궁합 결과 공유` → 두 사람 담긴 링크 `?m=couple&ab&ag&bb&bg`(title+url만=카톡 카드). App `tool` 초기값이 `m=couple`이면 궁합 탭, CoupleView가 `ab/bb` 자동입력+계산 → 받은 사람이 같은 궁합 재현.

## 11. 원국 상세 항상 펼침 — `components/ChartGrid.tsx` (2026-06-25)
- 상담사 요청: 경쟁사처럼 "동그라미 친 정보(납음·관계·신살·12신살)를 원국에 다 보여달라". **전문가 보기는 접지 않고 전부 노출**이 원칙(쉽게 보기는 깔끔 유지).
- 기존 간지 그리드(flex, 색·공망·탭강조) 아래에 **상세 `<table>`**(table-fixed, 시/일/월/년 정렬) 추가: **납음**(`p.nayin`)·**관계**(`hapchung` where pillars 포함 → type 합치기, 항상)·**신살**(`sinsal` per pillar)·**12신살**(`sinsal12` per pillar). + 요약 줄(오행 개수·공망·월령=월지 정기).
- 탭(궁성/천간합/충…)은 이제 **정보 표시 수단이 아니라 강조(하이라이트) 보너스**일 뿐 — 관계 정보는 표에 항상 보임. (탭 안 눌러도 다 보임)
- **밀도 보강(2026-06-25, 경쟁사 대비)**: ①운성 = 일간기준 + **자좌운성**(`p.selfStage`, 괄호) 2개 ②12신살 = **년지+일지 2기준**(`sinsal12`+`sinsal12Day`) ③관계 = 타입만→**글자 포함**(`r.detail` 라벨접두 제거, 午午형·午卯파) 여러 줄 ④요약에 **천을귀인 지지**(`analysis.cheoneul`) 추가.

## ⚠️ 보류(미완)
- **이미지 전체 캡처가 상단 일부만** 잡힘(`html-to-image`가 resultRef scrollHeight 전체 미포착). 단서: 명시적 `height/width` 옵션. 메모리 `project_manse_image_capture_parked`.

## 관련
- `manse/01-overview.tech.md`, `manse/02-engine-accuracy.tech.md`
- 메모리 `project_manse_standalone`, `project_manse_image_capture_parked`
