# Claude Code 참조 문서 — inxight Admin

> 이 프로젝트의 추가 개발 시 반드시 이 문서를 참조하세요.
> 상세 디자인: `DESIGN_GUIDE.md` / 시각적 가이드: `guide.html`

## 프로젝트 개요

- **위치**: `www/design_mng/`
- **용도**: 관리자 페이지 디자인 가이드 (HTML/CSS/JS only, 빌드 도구 없음)
- **스택**: Tailwind CSS (CDN) + Lucide Icons + ApexCharts + jQuery 3.7.1 + DataTables 1.13.8
- **로고**: 텍스트 "inxight" (이미지 로고 아님)

## 핵심 규칙

### 반드시 지켜야 할 것

1. **Tailwind CDN + 인라인 config** — 빌드 도구 없음
2. **다크모드 필수** — 모든 요소에 `dark:` 변형 클래스 포함
3. **Lucide 아이콘** — `<i data-lucide="아이콘명" class="w-N h-N"></i>`
4. **크롬에서 file:// 직접 열기 가능** — fetch 사용 금지, 사이드바/헤더 모든 HTML에 인라인
5. **한국어** — UI 텍스트, DataTables 언어, 달력 모두 한국어
6. **사이드바 접힘 상태 유지** — `localStorage.getItem('sidebarCollapsed')`
7. **테이블 셀 줄바꿈 방지** — CSS에서 `white-space: nowrap` 일괄 적용
8. **셀렉트 박스** — CSS에서 커스텀 화살표 자동 적용 (`appearance: none`)

### 하면 안 되는 것

- npm/node 빌드 프로세스 추가
- fetch()로 파셜 로드 (file:// 호환 불가)
- 브라우저 기본 `<input type="date">` → `datepicker.js` 사용
- DataTables 기본 CSS (`jquery.dataTables.min.css`) 포함 → `style.css`에서 오버라이드

## 파일별 역할

| 파일 | 역할 |
|---|---|
| `login.html` | 로그인 (사이드바 없음, 좌측 배너 + 우측 폼) |
| `dashboard.html` | 대시보드 (KPI 4개, 방문자 차트, 구독 도넛, 결제 테이블) |
| `member_list.html` | 회원 리스트 (검색필터, DataTables 1000건, 수정모달, 삭제컨펌, 툴팁) |
| `content_list.html` | 콘텐츠 리스트 (검색필터, DataTables 1000건, 등록/수정모달, 삭제컨펌) |
| `guide.html` | UI 컴포넌트 가이드 (독립 페이지, 사이드바 없음) |
| `css/style.css` | 사이드바, 메뉴, DataTables, 플로팅 서브메뉴, 툴팁, 셀렉트 화살표 |
| `js/components/sidebar.js` | 사이드바 토글, 서브메뉴, localStorage 접힘 상태 유지 |
| `js/components/header.js` | 다크모드 토글, 드롭다운 메뉴 |
| `js/components/datepicker.js` | 한국어 커스텀 달력 (2026년 3월 형식) |

## 새 페이지 추가 방법

1. `member_list.html` 또는 `content_list.html`을 복사
2. `<title>` 변경
3. 사이드바 메뉴 active 상태 변경:
   - 해당 메뉴 버튼: `menu-item-inactive` → `menu-item-active`
   - 해당 아이콘: `menu-item-icon-inactive` → `menu-item-icon-active`
   - 서브메뉴 div: `hidden` 클래스 제거
   - 화살표: `open` 클래스 추가
   - 드롭다운 링크: `menu-dropdown-item-inactive` → `menu-dropdown-item-active`
4. 사이드바에 새 메뉴 항목이 필요하면 **모든 HTML 파일**의 `<aside>` 수정 (인라인이므로)
5. `<main>` 내부 콘텐츠 작성
6. 모달이 필요하면 `</main>` 뒤, `<script>` 앞에 배치

## 새 메뉴 추가 방법

사이드바가 각 HTML에 인라인되어 있으므로, **모든 HTML 파일**에서 동일하게 추가.

```html
<!-- 서브메뉴가 있는 경우 -->
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

<!-- 단일 링크 (플로팅 메뉴 없이 바로 이동) -->
<li>
  <a href="페이지.html" class="menu-item menu-item-inactive" data-tooltip="메뉴명">
    <i data-lucide="아이콘명" class="w-6 h-6 flex-shrink-0 menu-item-icon-inactive"></i>
    <span class="hide-collapsed">메뉴명</span>
  </a>
</li>
```

## DataTables 추가 방법

### 1. head에 CDN 추가
```html
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.datatables.net/1.13.8/js/jquery.dataTables.min.js"></script>
```
**주의**: DataTables 기본 CSS는 포함하지 않음

### 2. 테이블에 id 부여
```html
<table id="myTable" class="min-w-full">
```

### 3. 초기화
```javascript
$('#myTable').DataTable({
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
  columnDefs: [{ orderable: false, targets: [0, 마지막인덱스] }],
  scrollX: true,
  pagingType: 'simple_numbers',
  dom: 'rt<"dt-bottom"<"dt-bottom-left"li>p>',
  drawCallback: function(settings) {
    lucide.createIcons();
    limitPageButtons(this.api(), 5);
  }
});

// 페이지 번호 제한 함수 (반드시 포함)
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

## 모달 함수

```javascript
function openModal(id) {
  var el = document.getElementById('modal-' + id);
  if (!el) return;
  el.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
}
function closeModal(id) {
  var el = document.getElementById('modal-' + id);
  if (!el) return;
  el.classList.add('hidden');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('[id^="modal-"]').forEach(function(m) {
    if (!m.classList.contains('hidden')) m.classList.add('hidden');
  });
  document.body.style.overflow = '';
});
```

## 툴팁 (도움말)

```html
<!-- 라벨 옆에 배치 -->
<span class="tooltip-wrap relative">
  <i data-lucide="help-circle" class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-help"></i>
  <span class="tooltip-box">도움말 텍스트<br>여러 줄 가능</span>
</span>
```

모바일 클릭 토글 JS (페이지에 포함):
```javascript
document.querySelectorAll('.tooltip-wrap').forEach(function(wrap) {
  wrap.addEventListener('click', function(e) {
    e.stopPropagation();
    var isActive = wrap.classList.contains('active');
    document.querySelectorAll('.tooltip-wrap.active').forEach(function(w) { w.classList.remove('active'); });
    if (!isActive) wrap.classList.add('active');
  });
});
document.addEventListener('click', function() {
  document.querySelectorAll('.tooltip-wrap.active').forEach(function(w) { w.classList.remove('active'); });
});
```

## 뱃지 패턴

```html
<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {배경} {텍스트}">라벨</span>

성공:  bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400
경고:  bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400
오류:  bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400
정보:  bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400
공지:  bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400
뉴스:  bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400
초안:  bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400
```

## z-index 체계

| 레이어 | z-index |
|---|---|
| 모달 | `z-[10000]` |
| 헤더 | `z-[10000]` |
| 사이드바 플로팅 서브메뉴 | `z-[9999]` |
| 사이드바 (모바일) | `z-[9999]` |
| 사이드바 백드롭 | `z-[9998]` |
| 드롭다운 | `z-[9999]` |
| 데이트피커 / 툴팁 | `z-50` |

## CSS에서 자동 적용되는 것들 (별도 클래스 불필요)

- `main select` → 커스텀 화살표 (appearance: none + SVG background)
- `main table th, main table td` → `white-space: nowrap`
- `table.dataTable` → DataTables 전체 스타일 오버라이드
- `.dataTables_scrollBody thead` → 복제된 thead 숨김
- `.tooltip-wrap:hover .tooltip-box` → 툴팁 호버 표시
- `#sidebar.collapsed` → `overflow: visible` (플로팅 서브메뉴용)
