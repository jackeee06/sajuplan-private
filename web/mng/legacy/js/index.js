/* ════════════════════════════════════
   메인 진입점 (js/index.js)
════════════════════════════════════ */

async function loadPartials() {
  try {
    const [sidebarRes, headerRes] = await Promise.all([
      fetch('partials/sidebar/sidebar.html'),
      fetch('partials/header/header.html')
    ]);
    if (!sidebarRes.ok) throw new Error('sidebar.html load fail');
    if (!headerRes.ok)  throw new Error('header.html load fail');

    document.getElementById('sidebar-container').innerHTML = await sidebarRes.text();
    document.getElementById('header-container').innerHTML  = await headerRes.text();

    lucide.createIcons();
    if (typeof initDarkMode === 'function') initDarkMode();
    if (typeof initHeaderListeners === 'function') initHeaderListeners();
  } catch (e) {
    console.error('[Admin] Partial load error:', e.message);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadPartials);
} else {
  loadPartials();
}
