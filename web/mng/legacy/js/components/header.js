/* ════════════════════════════════════
   헤더 컴포넌트
════════════════════════════════════ */

let isDark = false;

function applyDarkMode(dark) {
  isDark = dark;
  document.documentElement.classList.toggle('dark', dark);
  const moon = document.getElementById('icon-moon');
  const sun  = document.getElementById('icon-sun');
  if (moon) moon.classList.toggle('hidden', dark);
  if (sun)  sun.classList.toggle('hidden', !dark);
  localStorage.setItem('darkMode', dark ? '1' : '0');
}

function toggleDarkMode() { applyDarkMode(!isDark); }

function initDarkMode() {
  const saved = localStorage.getItem('darkMode') === '1';
  isDark = saved;
  const moon = document.getElementById('icon-moon');
  const sun  = document.getElementById('icon-sun');
  if (moon) moon.classList.toggle('hidden', saved);
  if (sun)  sun.classList.toggle('hidden', !saved);
}

const dropdowns = {
  notification: {
    dropdown: () => document.getElementById('notification-dropdown'),
    onOpen: () => { const b = document.getElementById('notif-badge'); if (b) b.style.display = 'none'; },
    onClose: () => {}
  },
  user: {
    dropdown: () => document.getElementById('user-dropdown'),
    onOpen: () => { const c = document.getElementById('user-chevron'); if (c) c.style.transform = 'rotate(180deg)'; },
    onClose: () => { const c = document.getElementById('user-chevron'); if (c) c.style.transform = ''; }
  }
};

function toggleDropdown(name) {
  const config = dropdowns[name];
  if (!config) return;
  const el = config.dropdown();
  const isHidden = el.classList.contains('hidden');
  Object.keys(dropdowns).forEach(key => { if (key !== name) closeDropdown(key); });
  if (isHidden) { el.classList.remove('hidden'); config.onOpen(); }
  else { el.classList.add('hidden'); config.onClose(); }
}

function closeDropdown(name) {
  const config = dropdowns[name];
  if (!config) return;
  const el = config.dropdown();
  if (el) { el.classList.add('hidden'); config.onClose(); }
}

function initHeaderListeners() {
  document.addEventListener('click', function (e) {
    const notifWrapper = document.getElementById('notification-wrapper');
    const userWrapper  = document.getElementById('user-wrapper');
    if (notifWrapper && !notifWrapper.contains(e.target)) closeDropdown('notification');
    if (userWrapper  && !userWrapper.contains(e.target))  closeDropdown('user');
  });
}
