/**
 * datepicker.js — 커스텀 날짜 선택 컴포넌트
 * - 브라우저 기본 달력 대신 커스텀 팝업 캘린더를 표시
 * - 다크모드 지원 (html.dark 클래스 감지)
 * - 외부 클릭 시 닫힘
 */

(function () {
  'use strict';

  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const MONTHS = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  // 현재 열려 있는 피커 인스턴스
  let openPicker = null;

  /**
   * 특정 input 요소에 커스텀 데이트피커를 초기화
   * @param {HTMLElement} wrapper  - data-datepicker="true" 를 가진 부모 div
   */
  function initDatepicker(wrapper) {
    const input    = wrapper.querySelector('.datepicker-input');
    const dropdown = wrapper.querySelector('.datepicker-dropdown');

    if (!input || !dropdown) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let state = {
      year:     today.getFullYear(),
      month:    today.getMonth(),   // 0-indexed
      selected: null,               // Date | null
    };

    /* ── 렌더링 ── */
    function render() {
      dropdown.innerHTML = '';

      const isDark = document.documentElement.classList.contains('dark');

      /* 헤더 */
      const header = el('div', 'flex items-center justify-between px-2 mb-4');

      const prevBtn = el('button', [
        'w-8 h-8 flex items-center justify-center rounded-lg',
        'text-gray-500 dark:text-gray-400',
        'hover:bg-gray-100 dark:hover:bg-gray-700 transition',
      ].join(' '));
      prevBtn.type = 'button';
      prevBtn.innerHTML = chevronSVG('left');
      prevBtn.addEventListener('click', () => {
        state.month--;
        if (state.month < 0) { state.month = 11; state.year--; }
        render();
      });

      const title = el('span', 'text-sm font-semibold text-gray-800 dark:text-white');
      title.textContent = `${state.year}년 ${MONTHS[state.month]}`;

      const nextBtn = el('button', [
        'w-8 h-8 flex items-center justify-center rounded-lg',
        'text-gray-500 dark:text-gray-400',
        'hover:bg-gray-100 dark:hover:bg-gray-700 transition',
      ].join(' '));
      nextBtn.type = 'button';
      nextBtn.innerHTML = chevronSVG('right');
      nextBtn.addEventListener('click', () => {
        state.month++;
        if (state.month > 11) { state.month = 0; state.year++; }
        render();
      });

      header.append(prevBtn, title, nextBtn);
      dropdown.appendChild(header);

      /* 요일 헤더 */
      const dayHeader = el('div', 'grid grid-cols-7 mb-1');
      DAYS.forEach(d => {
        const cell = el('div', 'h-8 flex items-center justify-center text-xs font-medium text-gray-400 dark:text-gray-500');
        cell.textContent = d;
        dayHeader.appendChild(cell);
      });
      dropdown.appendChild(dayHeader);

      /* 날짜 그리드 */
      const grid = el('div', 'grid grid-cols-7 gap-y-0.5 place-items-center');

      const firstDay = new Date(state.year, state.month, 1).getDay();  // 0=Sun
      const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
      const daysInPrev  = new Date(state.year, state.month, 0).getDate();

      // 이전 달 빈 셀 채우기
      for (let i = 0; i < firstDay; i++) {
        const d = daysInPrev - firstDay + 1 + i;
        grid.appendChild(dayCell(d, 'other'));
      }

      // 이번 달 날짜
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(state.year, state.month, d);
        const isToday    = date.getTime() === today.getTime();
        const isSelected = state.selected && date.getTime() === state.selected.getTime();

        const cell = dayCell(d, isSelected ? 'selected' : isToday ? 'today' : 'normal');
        cell.addEventListener('click', () => {
          state.selected = date;
          // input 값 업데이트 (YYYY-MM-DD 형식)
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          input.value = `${y}-${m}-${day}`;
          input.dataset.value = `${y}-${m}-${day}`;
          closePicker();
        });
        grid.appendChild(cell);
      }

      // 다음 달 채우기 (6주 고정)
      const total = firstDay + daysInMonth;
      const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
      for (let d = 1; d <= remaining; d++) {
        grid.appendChild(dayCell(d, 'other'));
      }

      dropdown.appendChild(grid);
    }

    /* ── 열기/닫기 ── */
    function openPicker_() {
      if (openPicker && openPicker !== closePicker) openPicker();
      openPicker = closePicker;
      render();
      dropdown.classList.remove('hidden');
      // 현재 선택값이 있으면 해당 월로 이동
      if (state.selected) {
        state.year  = state.selected.getFullYear();
        state.month = state.selected.getMonth();
        render();
      }
    }

    function closePicker() {
      dropdown.classList.add('hidden');
      if (openPicker === closePicker) openPicker = null;
    }

    input.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropdown.classList.contains('hidden')) {
        openPicker_();
      } else {
        closePicker();
      }
    });

    // 캘린더 내 클릭이 문서로 전파되지 않도록
    dropdown.addEventListener('click', (e) => e.stopPropagation());

    // 이미 값이 입력돼 있으면 state에 반영
    if (input.dataset.value) {
      const parts = input.dataset.value.split('-');
      if (parts.length === 3) {
        state.selected = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        state.year  = state.selected.getFullYear();
        state.month = state.selected.getMonth();
      }
    }
  }

  /* ── 유틸리티 ── */

  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function dayCell(day, type) {
    const cell = el('button', buildCellClass(type));
    cell.type = 'button';
    cell.textContent = day;
    return cell;
  }

  function buildCellClass(type) {
    const base = 'h-8 w-8 flex-shrink-0 flex items-center justify-center text-sm rounded-full transition ';
    if (type === 'selected') {
      return base + 'bg-brand-500 text-white font-semibold hover:bg-brand-600';
    }
    if (type === 'today') {
      return base + 'border border-brand-500 text-brand-500 dark:text-brand-400 font-semibold hover:bg-brand-50 dark:hover:bg-brand-500/10';
    }
    if (type === 'other') {
      return base + 'text-gray-300 dark:text-gray-600 cursor-default pointer-events-none';
    }
    // normal
    return base + 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700';
  }

  function chevronSVG(dir) {
    const d = dir === 'left'
      ? 'M15 19l-7-7 7-7'
      : 'M9 5l7 7-7 7';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="${dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'}"></polyline></svg>`;
  }

  /* ── 전역 클릭 → 닫기 ── */
  document.addEventListener('click', () => {
    if (openPicker) {
      openPicker();
      openPicker = null;
    }
  });

  /* ── DOM 준비 후 초기화 ── */
  function init() {
    document.querySelectorAll('[data-datepicker="true"]').forEach(initDatepicker);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
