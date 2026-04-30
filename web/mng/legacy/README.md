# inxight Admin - 디자인 가이드

> 이 문서는 관리자 페이지의 디자인 시스템을 정의합니다.
> AI(Claude 등)가 추가 개발 시 이 문서를 참조하여 일관된 디자인을 유지합니다.

---

## 1. 프로젝트 구조

```
design_mng/
├── login.html              # 관리자 로그인 (좌:배너 우:폼)
├── dashboard.html          # 대시보드 (KPI, 방문자차트, 구독도넛, 결제테이블)
├── member_list.html        # 회원관리 (검색필터, DataTables 1000건, 수정모달, 삭제컨펌)
├── content_list.html       # 콘텐츠관리 (검색필터, DataTables 1000건, 등록/수정모달, 삭제컨펌)
├── guide.html              # UI 컴포넌트 가이드 (이 문서의 시각적 버전)
├── DESIGN_GUIDE.md         # 디자인 가이드 문서 (이 파일)
├── CLAUDE.md               # Claude Code 참조 문서
├── css/
│   └── style.css           # 커스텀 스타일 (사이드바, 메뉴, DataTables, 툴팁, 셀렉트 등)
├── js/
│   ├── index.js            # 파셜 로드 (참조용, 실제 사용 안함)
│   └── components/
│       ├── sidebar.js      # 사이드바 접기/펼치기, 서브메뉴, localStorage 상태 유지
│       ├── header.js       # 다크모드, 드롭다운
│       └── datepicker.js   # 커스텀 달력 (한글, 2026년 3월 형식)
├── partials/               # 참조용 원본 (실제 각 HTML에 인라인됨)
│   ├── sidebar/sidebar.html
│   └── header/header.html
└── images/
    ├── logo.svg
    └── logo-dark.svg
```

---

## 2. 외부 라이브러리 (CDN)

| 라이브러리 | 버전 | 용도 |
|---|---|---|
| Tailwind CSS | CDN Latest | 유틸리티 CSS 프레임워크 (인라인 config) |
| Lucide Icons | Latest | SVG 아이콘 (`data-lucide` 속성) |
| Google Fonts - Outfit | wght@100..900 | 기본 폰트 |
| ApexCharts | Latest | 차트 (대시보드 전용) |
| jQuery | 3.7.1 | DataTables 의존성 |
| DataTables | 1.13.8 | 데이터 테이블 (정렬, 페이징, scrollX) |

**주의**: DataTables 기본 CSS는 사용하지 않음. `style.css`에서 전체 오버라이드.

---

## 3. 색상 시스템

### Brand (Primary)
| 토큰 | 값 | 용도 |
|---|---|---|
| brand-25 | `#f2f7ff` | 가장 연한 배경 |
| brand-50 | `#ecf3ff` | 뱃지/활성메뉴 배경 |
| brand-400 | `#7592ff` | 다크모드 텍스트 |
| **brand-500** | **`#465fff`** | **메인 컬러 (버튼, 링크, 활성, 페이징)** |
| brand-600 | `#3641f5` | 버튼 호버 |
| brand-700 | `#2a31d8` | - |

### Gray
| 토큰 | 값 | 용도 |
|---|---|---|
| gray-50 | `#f9fafb` | 페이지 배경, 테이블 헤더 |
| gray-100 | `#f2f4f7` | 구분선, 호버 배경 |
| gray-200 | `#e4e7ec` | 보더, DataTables 테두리 |
| gray-300 | `#d0d5dd` | 입력 필드 보더 |
| gray-400 | `#98a2b3` | 비활성 아이콘 |
| gray-500 | `#667085` | 보조 텍스트 |
| gray-700 | `#344054` | 본문 텍스트 |
| gray-800 | `#1d2939` | 다크모드 배경 |
| gray-900 | `#101828` | 다크모드 최하단 배경 |

### 상태 뱃지 색상

| 상태 | 라이트 배경 | 라이트 텍스트 | 다크 배경 | 다크 텍스트 |
|---|---|---|---|---|
| 성공/활성/공개/스탠다드 | `bg-green-50` | `text-green-700` | `bg-green-500/10` | `text-green-400` |
| 경고/대기/비활성/무료 | `bg-orange-50` | `text-orange-600` | `bg-orange-500/10` | `text-orange-400` |
| 오류/차단/취소 | `bg-red-50` | `text-red-600` | `bg-red-500/10` | `text-red-400` |
| 정보/프리미엄/이벤트 | `bg-brand-50` | `text-brand-600` | `bg-brand-500/10` | `text-brand-400` |
| 공지사항 | `bg-purple-50` | `text-purple-600` | `bg-purple-500/10` | `text-purple-400` |
| 뉴스 | `bg-blue-50` | `text-blue-600` | `bg-blue-500/10` | `text-blue-400` |
| 임시/초안 | `bg-gray-100` | `text-gray-600` | `bg-gray-700` | `text-gray-400` |

---

## 4. 타이포그래피

- **폰트**: Outfit (Google Fonts)
- **로고**: 텍스트 "inxight" (`text-xl font-bold tracking-tight`)

| 용도 | 클래스 |
|---|---|
| 페이지 제목 | `text-2xl font-semibold text-gray-800 dark:text-white` |
| 카드 제목 | `text-base font-semibold text-gray-800 dark:text-white` |
| 모달 제목 | `text-lg font-bold text-gray-900 dark:text-white` |
| 본문 텍스트 | `text-sm text-gray-500 dark:text-gray-400` |
| 라벨 | `text-sm font-medium text-gray-700 dark:text-gray-300` |
| 필터 라벨 | `text-xs font-medium text-gray-600 dark:text-gray-400` |
| 뱃지 | `text-xs font-medium` |
| 테이블 헤더 | `text-xs font-semibold uppercase text-gray-500 dark:text-gray-400` |
| KPI 수치 | `text-2xl font-bold text-gray-800 dark:text-white` |

---

## 5. 컴포넌트 패턴

### 5.1 카드 (Content Card)

```html
<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
  <div class="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
    <h4 class="text-base font-semibold text-gray-800 dark:text-white">제목</h4>
    <!-- 우측 버튼 (선택) -->
  </div>
  <div class="p-5 sm:p-6">콘텐츠</div>
</div>
```

### 5.2 KPI 카드

```html
<div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 md:p-6">
  <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
    <i data-lucide="아이콘명" class="w-6 h-6 text-brand-500"></i>
  </div>
  <div class="mt-5 flex items-end justify-between">
    <div>
      <p class="text-sm text-gray-500 dark:text-gray-400">라벨</p>
      <h4 class="mt-2 text-2xl font-bold text-gray-800 dark:text-white">수치</h4>
    </div>
    <span class="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-500/10
           text-green-600 dark:text-green-400 text-xs font-medium px-2.5 py-0.5">+12.5%</span>
  </div>
</div>
```

### 5.3 검색 필터

```html
<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6">
  <div class="flex items-center gap-2 mb-4">
    <i data-lucide="search" class="w-5 h-5 text-gray-400"></i>
    <h4 class="text-sm font-semibold text-gray-800 dark:text-white">검색 필터</h4>
  </div>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <!-- 필터 필드들 -->
  </div>
  <div class="flex items-center gap-3 mt-4">
    <!-- 검색/초기화 버튼 -->
  </div>
</div>
```

### 5.4 입력 필드

```html
<!-- 필터용 (h-10) -->
<input type="text" placeholder="..." class="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent dark:bg-gray-900 px-3.5 text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition">

<!-- 모달용 (h-11) -->
<input type="text" placeholder="..." class="h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent dark:bg-gray-900 px-4 text-sm text-gray-800 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition">

<!-- 셀렉트박스 (CSS에서 커스텀 화살표 자동 적용) -->
<select class="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent dark:bg-gray-900 px-3.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition">
  <option value="">전체</option>
</select>
```

### 5.5 버튼

```html
<!-- 프라이머리 -->
<button class="inline-flex items-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition">
  <i data-lucide="plus" class="w-4 h-4"></i> 등록
</button>

<!-- 세컨더리 (아웃라인) -->
<button class="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 transition">
  <i data-lucide="download" class="w-4 h-4"></i> 다운로드
</button>

<!-- 위험 (삭제) -->
<button class="inline-flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-gray-900 hover:bg-red-50 dark:hover:bg-red-900/20 px-3.5 py-2 text-sm font-medium text-red-600 dark:text-red-400 transition">
  <i data-lucide="trash-2" class="w-4 h-4"></i> 삭제
</button>

<!-- 아이콘 버튼 (테이블 액션) -->
<button class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-brand-500 hover:border-brand-300 transition">
  <i data-lucide="pencil" class="w-4 h-4"></i>
</button>
```

### 5.6 뱃지

```html
<span class="rounded-full bg-green-50 dark:bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">활성</span>
```

### 5.7 툴팁 (도움말)

```html
<span class="tooltip-wrap relative">
  <i data-lucide="help-circle" class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-help"></i>
  <span class="tooltip-box">도움말 텍스트</span>
</span>
```
- 데스크탑: 호버 시 위쪽에 표시
- 모바일: 클릭 토글 (JS에서 `.active` 클래스 제어)
- 다크 배경(#1d2939), 하단 화살표 포인터 포함

### 5.8 모달 (폼)

```html
<div id="modal-이름" class="hidden fixed inset-0 z-[10000] flex items-center justify-center px-4">
  <div class="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px]" onclick="closeModal('이름')"></div>
  <div class="relative z-10 w-full max-w-lg bg-white dark:bg-gray-800 rounded-3xl p-8" onclick="event.stopPropagation()">
    <div class="flex items-start justify-between mb-6">
      <h3 class="text-lg font-bold text-gray-900 dark:text-white">모달 제목</h3>
      <button onclick="closeModal('이름')" class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 transition">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>
    <div class="space-y-4 mb-8">...</div>
    <div class="flex justify-end gap-3">
      <button onclick="closeModal('이름')" class="rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">취소</button>
      <button class="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition">저장</button>
    </div>
  </div>
</div>
```

### 5.9 모달 (삭제 확인)

```html
<div id="modal-delete-confirm" class="hidden fixed inset-0 z-[10000] flex items-center justify-center px-4">
  <div class="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px]" onclick="closeModal('delete-confirm')"></div>
  <div class="relative z-10 w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl px-8 pt-10 pb-10 text-center" onclick="event.stopPropagation()">
    <div class="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-500/15">
      <i data-lucide="alert-triangle" class="w-8 h-8 text-red-500"></i>
    </div>
    <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3">삭제 확인</h3>
    <p class="text-sm leading-6 text-gray-500 dark:text-gray-400 mb-8">정말 삭제하시겠습니까?</p>
    <div class="flex items-center justify-center gap-3">
      <button class="rounded-lg border border-gray-200 dark:border-gray-700 px-6 py-2.5 ...">취소</button>
      <button class="rounded-lg bg-red-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition">삭제</button>
    </div>
  </div>
</div>
```

### 5.10 데이트피커

```html
<div class="relative" data-datepicker="true">
  <input type="text" placeholder="날짜 선택" readonly
    class="datepicker-input w-full h-10 rounded-lg border ... pl-3.5 pr-10 cursor-pointer">
  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
    <i data-lucide="calendar" class="w-4.5 h-4.5"></i>
  </span>
  <div class="datepicker-dropdown hidden absolute left-0 top-full mt-2 z-50 w-[280px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-lg"></div>
</div>
```
- 한국어 표시 (일/월/화/.., 2026년 3월)
- `datepicker.js`가 `[data-datepicker="true"]` 자동 초기화

---

## 6. DataTables 설정

### 기본 설정

```javascript
$('#테이블ID').DataTable({
  language: {
    lengthMenu: '_MENU_ 건씩',
    info: '_START_ - _END_ / 총 _TOTAL_건',
    infoEmpty: '데이터가 없습니다',
    infoFiltered: '(전체 _MAX_건 중 필터링)',
    zeroRecords: '검색 결과가 없습니다',
    emptyTable: '등록된 데이터가 없습니다',
    paginate: { first: '«', last: '»', next: '›', previous: '‹' }
  },
  pageLength: 10,
  lengthMenu: [10, 25, 50, 100],
  order: [[1, 'desc']],
  ordering: true,
  columnDefs: [
    { orderable: false, targets: [0, 마지막컬럼] }  // 체크박스, 관리 컬럼
  ],
  scrollX: true,                                     // 모바일 가로스크롤
  pagingType: 'simple_numbers',
  dom: 'rt<"dt-bottom"<"dt-bottom-left"li>p>',       // [건수+정보] 한줄 + [페이징] 한줄
  drawCallback: function(settings) {
    lucide.createIcons();
    limitPageButtons(this.api(), 5);                  // 페이지 번호 최대 5개
  }
});
```

### 페이지 번호 제한 함수 (필수 포함)

```javascript
function limitPageButtons(api, maxButtons) {
  var paginate = $(api.table().container()).find('.dataTables_paginate');
  var buttons = paginate.find('.paginate_button').not('.previous,.next,.first,.last');
  var current = api.page();
  var totalPages = api.page.info().pages;
  if (totalPages <= maxButtons) return;
  var half = Math.floor(maxButtons / 2);
  var start = current - half, end = current + half;
  if (start < 0) { end -= start; start = 0; }
  if (end >= totalPages) { start -= (end - totalPages + 1); end = totalPages - 1; }
  if (start < 0) start = 0;
  buttons.each(function(i) {
    var pageNum = parseInt($(this).text()) - 1;
    if (isNaN(pageNum)) { $(this).hide(); return; }
    if (pageNum < start || pageNum > end) $(this).hide(); else $(this).show();
  });
  paginate.find('.ellipsis-dot').remove();
  var ellipsis = '<span class="ellipsis-dot" style="display:inline-flex;align-items:center;padding:0 4px;color:#98a2b3;font-size:12px;">...</span>';
  if (start > 0) paginate.find('.previous').after(ellipsis);
  if (end < totalPages - 1) paginate.find('.next').before(ellipsis);
}
```

### 하단 레이아웃 (dom 결과)

```
┌─────────────────────────────────────────┐
│ [10건씩 ▼]  1 - 10 / 총 1,000건        │  ← dt-bottom-left (한 줄)
│                   ‹  ... 3 4 5 ...  ›   │  ← 페이징 (한 줄, 오른쪽 정렬)
└─────────────────────────────────────────┘
```

---

## 7. 사이드바

### 기본 동작
- **데스크탑** (≥1024px): 290px, 접기 시 90px (아이콘만 표시)
- **모바일** (<1024px): 숨김, 햄버거로 슬라이드 오픈
- **접힘 상태 유지**: `localStorage.setItem('sidebarCollapsed', '1'|'0')`

### 접힌 상태 플로팅 서브메뉴
- 서브메뉴가 있는 아이콘 호버 → 오른쪽에 플로팅 패널 표시
- `data-label` 속성으로 메뉴명 라벨 표시
- padding으로 hover 영역 연결 (마우스 이동 시 닫히지 않음)
- 단일 링크(대시보드, 로그아웃)는 플로팅 없이 바로 이동

### 메뉴 구조
```html
<!-- 서브메뉴 있는 경우 -->
<li>
  <button onclick="toggleSubmenu('메뉴id')" class="menu-item-btn menu-item-inactive">
    <i data-lucide="아이콘명" class="w-6 h-6 flex-shrink-0 menu-item-icon-inactive"></i>
    <span class="hide-collapsed flex-1">메뉴명</span>
    <i data-lucide="chevron-down" id="메뉴id-arrow" class="hide-collapsed arrow-icon w-4 h-4"></i>
  </button>
  <div id="메뉴id-submenu" class="submenu-wrap hidden">
    <ul data-label="메뉴명" class="flex flex-col gap-1 mt-2 pl-9">
      <li><a href="페이지.html" class="menu-dropdown-item menu-dropdown-item-inactive">서브메뉴명</a></li>
    </ul>
  </div>
</li>

<!-- 단일 링크 -->
<li>
  <a href="페이지.html" class="menu-item menu-item-inactive" data-tooltip="메뉴명">
    <i data-lucide="아이콘명" class="w-6 h-6 flex-shrink-0 menu-item-icon-inactive"></i>
    <span class="hide-collapsed">메뉴명</span>
  </a>
</li>
```

---

## 8. 다크모드

- `localStorage.setItem('darkMode', '1'|'0')`
- `document.documentElement.classList.toggle('dark')`
- FOUC 방지: `<head>` 안에 즉시 실행 스크립트
- 모든 컴포넌트에 `dark:` 프리픽스 클래스 필수

---

## 9. 반응형

| 브레이크포인트 | 사이드바 | 테이블 |
|---|---|---|
| 모바일 (<1024px) | 숨김, 햄버거 | 가로스크롤, 셀 줄바꿈 방지 |
| 데스크탑 (≥1024px) | 표시, 접기/펼치기 | 전체 표시 |

- 테이블 모든 셀: `white-space: nowrap` (CSS 일괄 적용)
- 셀렉트 박스: CSS에서 커스텀 화살표 자동 적용 (`appearance: none`)
- 페이징: 최대 5개 번호 + `...` 말줄임

---

## 10. 아이콘 참조 (Lucide)

| 아이콘 | 용도 |
|---|---|
| `layout-dashboard` | 대시보드 | `users` | 회원관리 |
| `file-text` | 콘텐츠관리 | `search` | 검색 |
| `pencil` | 수정 | `trash-2` | 삭제 |
| `plus` | 등록 | `download` | 다운로드 |
| `upload-cloud` | 파일 업로드 | `calendar` | 날짜 선택 |
| `eye` / `eye-off` | 비밀번호 | `moon` / `sun` | 다크모드 |
| `log-out` | 로그아웃 | `x` | 닫기 |
| `alert-triangle` | 삭제 경고 | `rotate-ccw` | 초기화 |
| `help-circle` | 도움말 툴팁 | `credit-card` | 결제 |
| `bell-ring` | 구독/알림 | `paperclip` | 첨부파일 |
| `chevron-down/right/left` | 화살표 | `bar-chart-2` | 접힌 사이드바 로고 |
| `shield-check` | 로그인 배너 | `menu` | 햄버거 |

> 전체: https://lucide.dev/icons

---

## 11. z-index 체계

| 레이어 | z-index | 용도 |
|---|---|---|
| 모달 | `z-[10000]` | 모달 오버레이 + 패널 |
| 헤더 | `z-[10000]` | 고정 헤더 |
| 사이드바 플로팅 서브메뉴 | `z-[9999]` | 접힌 사이드바 호버 메뉴 |
| 사이드바 (모바일) | `z-[9999]` | 모바일 슬라이드 사이드바 |
| 사이드바 백드롭 | `z-[9998]` | 모바일 어두운 오버레이 |
| 드롭다운 | `z-[9999]` | 헤더 드롭다운 메뉴 |
| 데이트피커 | `z-50` | 달력 팝업 |
| 툴팁 | `z-50` | 도움말 툴팁 |

---

## 12. 새 페이지 추가 시 체크리스트

1. 기존 HTML 파일(member_list.html 등)을 복사
2. `<title>` 변경
3. 사이드바 메뉴 active 상태 변경 (모든 HTML 파일에서 동일하게)
4. `tailwind.config` 인라인 스크립트 포함
5. `css/style.css`, `js/components/sidebar.js`, `header.js` 포함
6. `lucide.createIcons()`, `initDarkMode()`, `initHeaderListeners()` 호출
7. 다크모드 FOUC 방지 스크립트 `<head>` 안에 포함
8. DataTables 사용 시: jQuery + DataTables CDN, `scrollX: true`, `limitPageButtons()` 포함
9. 모달 사용 시: `z-[10000]`, 백드롭 blur, ESC 닫기 처리
10. 셀렉트 박스는 CSS 자동 적용 (별도 처리 불필요)
11. 서브메뉴 `<ul>`에 `data-label` 속성 추가
