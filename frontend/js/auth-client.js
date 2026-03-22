const API_BASE = 'http://localhost:3000/api/auth';
const API_NOTIF = 'http://localhost:3000/api/notifikasi';

// ==================== TOKEN ====================

function saveTokenFromURL() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    localStorage.setItem('sb_token', token);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function getToken() {
  return localStorage.getItem('sb_token');
}

function requireLogin() {
  const token = getToken();
  if (!token) {
    window.location.href = '/pages/login.html';
  }
}

// ==================== TOAST ====================

function showToast(message, type = 'success', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed; bottom: 24px; right: 24px;
      display: flex; flex-direction: column; gap: 10px;
      z-index: 9999; pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const colors = {
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', icon: '✅' },
    error:   { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', icon: '❌' },
    info:    { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', icon: 'ℹ️' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#d97706', icon: '⚠️' },
  };
  const c = colors[type] || colors.success;

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${c.bg}; border: 1.5px solid ${c.border}; color: ${c.text};
    padding: 12px 16px; border-radius: 12px;
    font-family: 'DM Sans', sans-serif; font-size: 13.5px; font-weight: 500;
    display: flex; align-items: center; gap: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08); pointer-events: all;
    opacity: 0; transform: translateY(12px);
    transition: opacity 0.25s ease, transform 0.25s ease;
    max-width: 320px; min-width: 200px;
  `;
  toast.innerHTML = `<span>${c.icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ==================== FETCH USER ====================

async function fetchCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  } catch (err) {
    console.error('Gagal fetch user:', err);
    return null;
  }
}

// ==================== UPDATE SIDEBAR ====================

function updateSidebar(user) {
  if (!user) return;

  let metaRef = document.querySelector('meta[name="referrer"]');
  if (!metaRef) {
    metaRef = document.createElement('meta');
    metaRef.name = 'referrer';
    document.head.appendChild(metaRef);
  }
  metaRef.content = 'no-referrer';

  document.querySelectorAll('.user-name').forEach(el => {
    el.textContent = user.nama || 'Pengguna';
  });

 document.querySelectorAll('.user-email').forEach(el => {
  el.innerHTML = '';
  el.textContent = user.email || '';
});

  document.querySelectorAll('.user-avatar').forEach(el => {
    if (user.foto) {
      el.style.overflow = 'hidden';
      el.style.borderRadius = '50%';
      el.style.flexShrink = '0';
      el.style.padding = '0';
      el.style.fontSize = '0';
      el.innerHTML = `<img src="${user.foto}" alt="${user.nama}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;">`;
    }
  });
}

// ==================== POLLING NOTIFIKASI ====================

async function updateNotifBadge() {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(`${API_NOTIF}/unread-count`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    const count = data.count || 0;

    // FIX: Update SEMUA elemen nav-badge di sidebar — selector lebih luas
    // Cari semua .nav-badge di dalam nav-item yang mengarah ke notifikasi
    document.querySelectorAll('.nav-badge').forEach(el => {
      // Pastikan hanya badge di nav-item notifikasi
      const navItem = el.closest('.nav-item');
      if (navItem && (navItem.href?.includes('notifikasi') || navItem.getAttribute('href')?.includes('notifikasi'))) {
        el.textContent = count;
        el.style.display = count > 0 ? 'inline-block' : 'none';
      }
    });

    // Juga update badge dengan id spesifik jika ada (untuk halaman tertentu)
    const namedBadges = ['notifBadge', 'navBadge'];
    namedBadges.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = count;
        el.style.display = count > 0 ? 'inline-block' : 'none';
      }
    });

    // Deteksi notif baru dan tampilkan toast
    const prevCount = parseInt(localStorage.getItem('sb_notif_count') || '0');
    if (count > prevCount && prevCount !== 0) {
      showToast('Kamu punya notifikasi baru! 🔔', 'info');
    }
    localStorage.setItem('sb_notif_count', count);
  } catch (err) {
    // Silent fail
  }
}

function startNotifPolling() {
  updateNotifBadge();
  setInterval(updateNotifBadge, 15000);
}

// ==================== LOGOUT ====================

async function logout() {
  localStorage.removeItem('sb_token');
  localStorage.removeItem('sb_notif_count');
  window.location.href = '/pages/login.html';
}

// ==================== DARK MODE ====================

function initDarkMode() {
  // Terapkan dark mode dari localStorage sebelum render
  const isDark = localStorage.getItem('sb_theme') === 'dark';
  if (isDark) document.documentElement.classList.add('dark');

  // Buat tombol toggle
  const btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.title = 'Toggle Dark/Light Mode';
  btn.setAttribute('aria-label', 'Toggle dark mode');
  btn.addEventListener('click', toggleDarkMode);
  document.body.appendChild(btn);
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('sb_theme', isDark ? 'dark' : 'light');
}

// ==================== INIT ====================

async function initPage() {
  saveTokenFromURL();
  requireLogin();
  initDarkMode();
  const user = await fetchCurrentUser();
  if (user) {
    updateSidebar(user);
    startNotifPolling();
  }
  return user;
}