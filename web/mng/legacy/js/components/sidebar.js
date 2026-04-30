/* ════════════════════════════════════
   사이드바 컴포넌트
════════════════════════════════════ */

function updateToggleBtn(isOpen) {
  const hamburger = document.getElementById('icon-hamburger');
  const closeIcon = document.getElementById('icon-sidebar-close');
  if (!hamburger || !closeIcon) return;
  if (window.innerWidth < 1024) {
    hamburger.classList.toggle('hidden', isOpen);
    closeIcon.classList.toggle('hidden', !isOpen);
  } else {
    hamburger.classList.remove('hidden');
    closeIcon.classList.add('hidden');
  }
}

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;
  if (window.innerWidth >= 1024) {
    sidebar.classList.toggle('collapsed');
    // 접힘 상태 저장
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed') ? '1' : '0');
  } else {
    const isOpening = !sidebar.classList.contains('mobile-open');
    sidebar.classList.toggle('mobile-open', isOpening);
    if (backdrop) backdrop.classList.toggle('hidden', !isOpening);
    document.body.style.overflow = isOpening ? 'hidden' : '';
    updateToggleBtn(isOpening);
  }
}

// 페이지 로드 시 저장된 접힘 상태 복원
function initSidebarState() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  if (window.innerWidth >= 1024 && localStorage.getItem('sidebarCollapsed') === '1') {
    sidebar.classList.add('collapsed');
  }
}

function closeMobileSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar)  sidebar.classList.remove('mobile-open');
  if (backdrop) backdrop.classList.add('hidden');
  document.body.style.overflow = '';
  updateToggleBtn(false);
}

function toggleSubmenu(id) {
  const submenu = document.getElementById(id + '-submenu');
  const arrow   = document.getElementById(id + '-arrow');
  if (!submenu) return;
  const willOpen = submenu.classList.contains('hidden');
  submenu.classList.toggle('hidden');
  if (arrow) arrow.classList.toggle('open', willOpen);
}

window.addEventListener('resize', function () {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;
  if (window.innerWidth >= 1024) {
    sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.add('hidden');
    document.body.style.overflow = '';
    updateToggleBtn(false);
    // 리사이즈 시 저장된 상태 복원
    if (localStorage.getItem('sidebarCollapsed') === '1') {
      sidebar.classList.add('collapsed');
    }
  } else {
    sidebar.classList.remove('collapsed');
  }
});

// 자동 초기화
initSidebarState();
