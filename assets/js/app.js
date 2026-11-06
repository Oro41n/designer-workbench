// 应用入口：外壳渲染、路由、全局交互
import { initStore, getState, subscribe, setTheme, applyTheme } from './store.js';
import { icon } from './icons.js';
import { todayISO, formatCN } from './util.js';
import { getImageURL, hydrateImages } from './images.js';
import { subscribeTimer, timeText } from './pomodoro.js';
import { openSearch } from './search.js';
import home from './views/home.js';
import projects from './views/projects.js';
import portfolio from './views/portfolio.js';
import learn from './views/learn.js';
import library from './views/library.js';
import settings from './views/settings.js';

const NAV = [
  { route: 'home', label: '工作台', en: 'Desk', icon: 'home' },
  { route: 'projects', label: '项目看板', en: 'Projects', icon: 'projects' },
  { route: 'portfolio', label: '作品集', en: 'Portfolio', icon: 'portfolio' },
  { route: 'learn', label: '学习区', en: 'Learn', icon: 'learn' },
  { route: 'library', label: '灵感库', en: 'Library', icon: 'library' },
  { route: 'settings', label: '设置', en: 'Settings', icon: 'settings' }
];

const VIEWS = { home, projects, portfolio, learn, library, settings };
const BASE_TITLE = 'Oro 设计工作台';

let viewEl = document.getElementById('view');
let currentView = null;
let currentRoute = '';

initStore();
renderShell();
applyTheme();
renderProfile();
updateDate();
renderRoute();
bindGlobal();

function renderShell() {
  const sideNav = document.getElementById('side-nav');
  sideNav.innerHTML = NAV.map((item, i) => `
    <a class="nav-item" href="#/${item.route}" data-route="${item.route}">
      <span class="nav-index">${String(i + 1).padStart(2, '0')}</span>
      <span class="nav-icon">${icon(item.icon, 18)}</span>
      <span class="nav-label">${item.label}</span>
    </a>`).join('');

  const mobileNav = document.getElementById('mobile-nav');
  mobileNav.innerHTML = NAV.map(item => `
    <a class="mnav-item" href="#/${item.route}" data-route="${item.route}" aria-label="${item.label}">
      <span class="mnav-icon">${icon(item.icon, 20)}</span>
      <span class="mnav-label">${item.label.replace('项目看板', '项目').replace('学习区', '学习').replace('灵感库', '灵感')}</span>
    </a>`).join('');

  document.getElementById('theme-icon').innerHTML = getState().theme === 'dark' ? icon('sun', 18) : icon('moon', 18);
}

function updateDate() {
  const el = document.getElementById('topbar-date');
  if (el) el.textContent = formatCN(todayISO()).replace('星期', ' · 星期');
}

function initials(name = '') {
  const clean = String(name).replace(/^示例\s*·\s*/, '').trim();
  if (!clean) return '我';
  const chars = [...clean];
  return chars.slice(0, 2).join('').toUpperCase();
}

async function renderProfile() {
  const { profile } = getState();
  const name = profile.name || '（你的名字）';
  const role = profile.role || '平面设计师';
  document.getElementById('side-name').textContent = name;
  document.getElementById('side-role').textContent = role;
  const sideAvatar = document.getElementById('side-avatar');
  const topAvatar = document.getElementById('top-avatar-inner');
  const avatarText = initials(name);
  if (topAvatar) topAvatar.textContent = avatarText;
  if (sideAvatar) {
    sideAvatar.textContent = avatarText;
    sideAvatar.style.backgroundImage = '';
  }
  if (profile.avatarId) {
    const url = await getImageURL(profile.avatarId);
    if (url) {
      if (sideAvatar) { sideAvatar.style.backgroundImage = `url("${url}")`; sideAvatar.textContent = ''; }
      if (topAvatar) { topAvatar.innerHTML = ''; topAvatar.style.backgroundImage = `url("${url}")`; }
    }
  }
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [routeKey, param] = raw.split('/');
  const route = VIEWS[routeKey] ? routeKey : 'home';
  return { route, param: param || null };
}

function updateNav(route) {
  document.querySelectorAll('.nav-item, .mnav-item').forEach(a => {
    const active = a.dataset.route === route;
    a.classList.toggle('is-active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const meta = NAV.find(n => n.route === route) || NAV[0];
  const section = document.getElementById('topbar-section');
  if (section) section.textContent = meta.label;
}

function renderRoute() {
  const { route, param } = parseHash();
  if (!location.hash) {
    history.replaceState(null, '', '#/home');
  }
  currentView?.destroy?.();
  // 每次切换路由替换 <main> 节点，避免旧视图挂在同一节点上的事件监听残留
  const fresh = document.createElement('main');
  fresh.id = 'view';
  fresh.tabIndex = -1;
  fresh.className = 'view is-entering';
  viewEl.replaceWith(fresh);
  viewEl = fresh;
  currentRoute = route;
  currentView = VIEWS[route].mount(viewEl, { param });
  updateNav(route);
  document.title = `${NAV.find(n => n.route === route)?.label || '工作台'} · ${BASE_TITLE}`;
  if (route !== 'home') window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  hydrateImages(viewEl);
}

function bindGlobal() {
  window.addEventListener('hashchange', renderRoute);

  subscribe(() => {
    renderProfile();
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) themeIcon.innerHTML = getState().theme === 'dark' ? icon('sun', 18) : icon('moon', 18);
  });

  document.getElementById('search-open').addEventListener('click', openSearch);

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = getState().theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.getElementById('theme-icon').innerHTML = next === 'dark' ? icon('sun', 18) : icon('moon', 18);
    hydrateImages(document);
  });

  document.addEventListener('keydown', e => {
    const target = e.target;
    const typing = target instanceof HTMLElement && (
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
    );
    if (e.key === '/' && !typing) {
      e.preventDefault();
      openSearch();
    }
  });

  window.addEventListener('dw:save', e => {
    const el = document.getElementById('save-status');
    if (!el) return;
    if (e.detail.status === 'saving') {
      el.textContent = '保存中…';
      el.classList.add('is-saving');
    } else if (e.detail.status === 'saved') {
      const d = e.detail.at || new Date();
      el.textContent = `已保存 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      el.classList.remove('is-saving');
      el.classList.add('is-saved');
      setTimeout(() => el.classList.remove('is-saved'), 800);
    } else {
      el.textContent = '保存失败';
      el.classList.add('is-error');
    }
  });

  subscribeTimer(snap => {
    if (snap.running) {
      document.title = `${timeText(snap.remaining)} · ${snap.mode === 'focus' ? '专注' : '休息'} — ${BASE_TITLE}`;
    } else {
      document.title = `${NAV.find(n => n.route === currentRoute)?.label || '工作台'} · ${BASE_TITLE}`;
    }
  });
}
