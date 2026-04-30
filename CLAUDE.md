# 사주문(SAJUMOON) — Claude 작업 지침

퍼블리싱 작업 전 `publishing_guide.md`를 반드시 읽는다. 상세 규칙은 해당 파일 기준.

## 디자인 충실도 (최우선 규칙)

- 사용자가 제공한 디자인(Figma·스크린샷·시안)과 **픽셀 단위로 동일하게** 작업한다.
- 색상·간격·폰트 크기·라운드·아이콘·정렬·문구 등 어떤 요소도 **임의로 변경·추가·생략하지 않는다**.
- "더 나아 보일 것 같아서", "관습적으로 이렇게 한다" 같은 이유로 디자인을 각색하지 않는다.
- 디자인이 모호하거나 누락된 부분이 있으면 **추측하지 말고 사용자에게 먼저 확인**한다.
- 기존 컴포넌트(`design_system.html`)와 디자인이 충돌할 경우에도 임의 판단 금지 — 사용자에게 확인 후 진행한다.

## 프로젝트 정보

- Figma: https://www.figma.com/design/v9JT0ZgilboPxdXAnpH4sS/사주문_디자인
- 컬러 정의: `node-id=91-6911`
- 컴포넌트: 버튼 `node-id=6-2225` / 인풋 `node-id=12-1983` / 탭 `node-id=79-4139`
- 작업 폴더: `design/`
- 디자인 시스템: `design/design_system.html`
- 스크린샷: `design/screens/`

## 기술 스택

Tailwind CDN + jQuery 3.7.1 + Lucide Icons + `css/design.css` + `js/design.js`
금지: React / Vue / Angular / Sass / npm 빌드 / 외부 폰트 CDN

## 폰트

`Pretendard` (Variable). 파일: `design/fonts/PretendardVariable.woff2`
`@font-face`는 `design.css` 상단에 정의됨. CDN 사용 금지.

## CSS 변수 (design.css)

### 키컬러
`--primary` = `--primary-400` = `#9b7af7`

### 컬러 토큰 (Tailwind 스케일)
- **primary** 50/100/200/300/**400**/500/600/700/800/900 — 보라 계열
- **gray** 50/100/200/300/400/500/600/700/800/900/950
- **semantic** red / green / blue / orange / yellow / pink (각 50~950)

### 레이아웃
`--container:1280px` `--font-base:'Pretendard'`

### 라운드
`--rounded-sm:10px` `--rounded:16px` `--rounded-lg:20px` `--rounded-xl:28px` `--rounded-pill:1000px`

### 그림자
`--shadow-xs` `--shadow-sm` `--shadow-md` `--shadow-lg`
`--focus-primary` (인풋·버튼 포커스 링)

## 컴포넌트 (design_system.html)

작업 전 반드시 `design_system.html`을 읽어 확인. 정의된 컴포넌트는 새로 만들거나 인라인으로 대체 금지.

| 컴포넌트 | 클래스 |
|---------|--------|
| 버튼 | `.btn` `.btn--sm/--md/--base/--lg` `.btn-primary` `.btn-outline-primary` `.btn-gray-50` `.btn-outline-gray` `.btn-ghost` `.btn-link` `.btn--icon` |
| 좋아요 | `.like_btn` `.is-active` |
| 필터 칩 | `.filter_chip` `.is-active` |
| 필터 셀렉트 | `.filter_select` `.filter_select__label` `.filter_select__arrow` `.is-active` |
| 인풋 | `.input-field` `.input-field--has-suffix` `.is-typing` `.is-valid` `.is-invalid` |
| 인풋 래퍼 | `.input_wr` `.input_wr--with-btn` `.input_wr__suffix` `.input_wr__clear` `.input_wr__pw-toggle` `.input_wr__count` |
| 텍스트에어리어 | `.textarea-field` |
| 라벨·헬프 | `.input-label` `.req` `.form-text` `.form-text--error` `.form-text--success` |
| 체크박스·라디오 | `.form-check` `.form-check-input` |
| 메인 탭 | `.main_tab` `.main_tab__btn` `.is-active` |
| 필 탭 | `.pill_tab` `.pill_tab__btn` `.is-active` |
| 라인 탭 | `.line_tab` `.line_tab__btn` `.is-active` |
| 토글 탭 | `.toggle_tab` `.toggle_tab__btn` `.is-active` |
| 접근성 | `.skip_nav` `.sr_only` |

> 목록에 없는 UI도 `design_system.html`을 먼저 확인한다. 새 컴포넌트 추가 시 `design_system.html`·`design.css`에 함께 등록.

## 뷰포트 (모바일 온리)

모바일 전용. 기준 뷰포트 **375px**, 페이지 루트 래퍼 **`max-width: 600px` + `margin: 0 auto`**로 가운데 정렬. 600px 초과에서도 모바일 레이아웃 유지. `max-width` 기반 반응형 분기 · Tailwind `sm:`/`md:`/`lg:` prefix 사용 금지. Figma 모바일 수치 그대로 반영.

## 인터랙션 패턴 (디자인 충실도 + 동작 규칙)

> Figma는 정적 시안만 제공한다. 인터랙션·상태·필터 로직은 디자인 토큰을 일관되게 적용하여 구현해야 한다. 새 페이지·기능 작성 시 **반드시 이 섹션 먼저 읽고**, 동일한 색·동작을 재사용한다.

### 공통: 활성/비활성 색 매핑

| 컴포넌트 | 비활성 (off) | 활성 (on / selected / checked) |
|---|---|---|
| `filter_select` 칩 (분야/스타일/성별) | bg `#F9FAFB` · border `#F3F4F6` · text `#6A7282` | bg `#F3EEFE` · border `#9B7AF7` · text `#8259F5` |
| `filter_chip` (#연애/#재물 등) | bg `transparent` · text `#99A1AF` | bg `#F3EEFE` · text `#8259F5` |
| `main_tab01` (전체/사주/타로/신점) | text `#6A7282` | text `#8259F5` (밑줄 옵션) |
| `pill_tab` / `toggle_tab` | bg `#F9FAFB` · text `#6A7282` | bg `#8259F5` · text white |
| `like_btn_icon` (단골 하트) | `like_btn_icon_off.svg` | `like_btn_icon_on.svg` (보라 fill) |
| 페이지네이션 숫자 | radius 6 · text `#252B36` | radius 50 · bg `#9B7AF7` · text white |
| 체크박스 (`input[type=checkbox]`) | bg `#F9FAFB` · border `#F3F4F6` · radius 6 | bg `#9B7AF7` · 흰색 체크 (글로벌 css에 정의됨) |
| 셀렉트 화살표 | stroke `#6A7282` | stroke `#8259F5` (선택값 있을 때) |

> **연보라 강조색 `#F3EEFE`** 는 모든 활성 칩/리스트 옵션 hover/선택의 표준 톤이다. 새 인터랙션 추가 시 이 색을 재사용한다.

### `FilterDropdown` (분야·스타일·성별 칩)

위치: [`web/user/src/components/FilterDropdown.tsx`](web/user/src/components/FilterDropdown.tsx)
사용처: 상담사 리스트 / 단골 / (향후 후기 고급 필터)

동작 규칙:
1. **클릭 시 토글** — 칩 바로 아래 드롭다운 패널이 토글된다 (`top: calc(100%+4px)`, `z-50`).
2. **외부 클릭 / Esc** — 패널이 닫힌다.
3. **옵션 선택** — `value`가 세팅되며 패널 자동 닫힘. 칩이 활성 스타일로 전환된다.
4. **"전체" 옵션** — 첫 항목으로 노출되며 클릭 시 `value=null` (해제 → 비활성).
5. **선택된 옵션 시각화** — 패널 내 해당 옵션 row에 `bg #F3EEFE` + `text #8259F5` + `font-medium` 적용.
6. **드롭다운 펼침 시 화살표 회전** — `rotate-180` 트랜지션.
7. **상태가 바뀌면 페이지네이션을 1페이지로 리셋** (호출처에서 `resetPage()`).

옵션 데이터 컨벤션:
- 옵션 라벨은 한글 단어 그대로 (예: `연애운`, `따뜻한`, `남성`).
- "전체" 라벨은 기본값. 필요 시 `allLabel` prop으로 변경하거나 `null`로 숨김 가능.

필터 매칭 규칙:
- **분야**: 카드 `hashtags` 배열에서 옵션 텍스트가 부분 일치 (`tag.includes(option)`) — 즉 옵션 `연애운`은 `#연애궁합운`·`#연애운` 둘 다 매칭한다.
- **스타일 / 성별**: 카드의 `style` / `gender` 필드와 정확 일치. 백엔드 연동 전까지 mock 데이터에 임의 부여.

### 페이지네이션

위치: [`web/user/src/components/Pagination.tsx`](web/user/src/components/Pagination.tsx)
- 1~5 숫자 노출이 기본. `totalPages=1`이면 활성 1만, prev/next는 disabled (opacity 0.4).
- 활성 숫자는 32×32 원형 (`radius:50`) `#9B7AF7` bg + 흰색 텍스트.
- 비활성 숫자는 32×32 정사각형 (`radius:6`) text `#252B36`.
- 폰트: 15px/150% Pretendard, `font-variant-numeric: lining-nums tabular-nums`.

### CounselorCard 뱃지 컬러

위치: [`web/user/src/components/CounselorCard.tsx`](web/user/src/components/CounselorCard.tsx)
- `타로` → `#8259F5` (보라)
- `신점` → `#00BBA7` (청록)
- `사주` → `#FF6467` (빨강)

`hideChat={true}` prop을 넘기면 채팅 버튼이 숨고 전화 버튼이 풀폭 노출된다 (Figma 카드 `btn2:false` 대응).

### 헤더 (hd2 + 우측 액션)

- `h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]`
- 좌측: 뒤로가기 버튼 `30×30` (`/img/ic_hd_back.svg`)
- 타이틀: `text-[18px] font-semibold leading-[120%] text-[#030712]`, `flex-1` 로 가운데 영역 차지
- 우측 액션 클러스터: `flex items-center gap-3`, 각 액션 `30×30` 컨테이너 + `28×28` 아이콘 (`ic_hd_search`, `ic_hd_push` 등)

### 정렬/카운터 행

`px-4 py-3 flex items-center justify-between border-b border-[#F3F4F6]`
- 좌측: 카운터 텍스트 또는 체크박스
- 우측: 정렬 버튼 (`ic_filter.svg` + 텍스트 `최신순`/`인기순`)
- 카운터 강조 숫자는 `text-[#8259F5] font-medium` (예: `전체 9,999건` → `9,999`만 강조)

### 새 인터랙션 추가 시 체크리스트

- [ ] 디자인 토큰 (`#F3EEFE` 활성, `#8259F5` 텍스트, `#9B7AF7` 보더) 재사용했는가?
- [ ] 외부 클릭 / Esc / 페이지 변경 시 닫힘 처리했는가?
- [ ] 활성 상태에서 chevron/아이콘 색도 같이 바뀌는가?
- [ ] 필터 변경 시 페이지네이션을 1로 리셋하는가?
- [ ] 새 동작 규칙은 이 섹션에 추가했는가?

## Git 푸시 규칙

커밋·푸시 전 **README.md**(페이지 목록·상태)와 **CLAUDE.md**(변수·컴포넌트·규칙) 확인 및 업데이트.
