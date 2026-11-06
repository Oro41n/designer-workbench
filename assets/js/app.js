// 应用入口（2026 重构）：外壳、路由转场、滚动叙事、光标交互
import { initStore, getState, subscribe, setTheme, applyTheme } from './store.js';
import { initThemeEngine, setMode, refreshTheme } from './theme-engine.js';
import { icon } from './icons.js';
import { subscribeTimer, timeText } from './pomodoro.js';
import { openSearch } from './search.js';
import { openPalette } from './palette.js';
import { hydrateImages } from './images.js';
import home from './views/home.js';
import projects from './views/projects.js';
import boards from './views/boards.js';
import board from './views/board.js';
import portfolio from './views/portfolio.js';
import learn from './views/learn.js';
import library from './views/library.js';
import settings from './views/settings.js';

const NAV = [
  { route: 'portfolio', label: '作品', en: 'Works', icon: 'portfolio' },
  { route: 'projects', label: '项目', en: 'Studio', icon: 'projects' },
  { route: 'boards', label: '画板', en: 'Boards', icon: 'boards' },
  { route: 'learn', label: '学习', en: 'Learn', icon: 'learn' },
  { route: 'library', label: '灵感', en: 'Library', icon: 'library' },
  { route: 'settings', label: '设置', en: 'Settings', icon: 'settings' }
];
const MOBILE_NAV = [
  { route: 'home', label: '首页', icon: 'home' },
  { route: 'portfolio', label: '作品', icon: 'portfolio' },
  { route: 'projects', label: '项目', icon: 'projects' },
  { route: 'boards', label: '画板', icon: 'boards' },
  { route: 'learn', label: '学习', icon: 'learn' }
];
const VIEWS = { home, projects, boards, board, portfolio, learn, library, settings };
const BASE_TITLE = 'Oro — Design × Code';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let viewEl = document.getElementById('view');
let currentView = null;
let currentRoute = '';
let switching = false;
let observer = null;
let parallaxEls = [];
let rafPending = false;

initStore();
initThemeEngine();
setMode(getState().theme === 'light' ? 'light' : 'dark');
syncBodyTheme();
renderShell();
applyTheme();
syncBodyTheme();
renderRoute({ initial: true });
bindGlobal();
bindCursor();
bindScrollEffects();

/* ---------------- 外壳 ---------------- */

function renderShell() {
  const nav = document.getElementById('site-nav');
  if (nav) {
    nav.innerHTML = NAV.map((item, i) => `
      <a href="#/${item.route}" data-route="${item.route}">
        <i>${String(i + 2).padStart(2, '0')}</i>${item.label}
      </a>`).join('');
  }
  const mobile = document.getElementById('mobile-nav');
  if (mobile) {
    mobile.innerHTML = MOBILE_NAV.map(item => `
      <a href="#/${item.route}" data-route="${item.route}" aria-label="${item.label}">
        ${icon(item.icon, 20)}<span>${item.label}</span>
      </a>`).join('');
  }
  updateThemeIcon();
}

function updateThemeIcon() {
  const el = document.getElementById('theme-icon');
  if (el) el.innerHTML = getState().theme === 'dark' ? icon('sun', 18) : icon('moon', 18);
}

function syncBodyTheme() {
  document.body.classList.toggle('night', getState().theme === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getState().theme === 'dark' ? '#0a0a0b' : '#f2efe9');
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [routeKey, param] = raw.split('/');
  const route = VIEWS[routeKey] ? routeKey : 'home';
  return { route, param: param || null };
}

function updateNav(route) {
  const key = route === 'board' ? 'boards' : route;
  document.querySelectorAll('.site-nav a, .mobile-nav a').forEach(a => {
    const on = a.dataset.route === key;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function labelFor(route) {
  if (route === 'board') return { label: '画板编辑器', index: '07' };
  if (route === 'home') return { label: 'Index', index: '01' };
  const i = NAV.findIndex(n => n.route === route);
  return { label: NAV[i]?.en || 'Index', index: String(i + 2).padStart(2, '0') };
}

function mountView(route, param) {
  currentView?.destroy?.();
  const fresh = document.createElement('main');
  fresh.id = 'view';
  fresh.tabIndex = -1;
  fresh.className = 'view';
  viewEl.replaceWith(fresh);
  viewEl = fresh;
  currentRoute = route;
  document.body.classList.toggle('is-editor', route === 'board');
  document.body.classList.toggle('is-home', route === 'home');
  try {
    currentView = VIEWS[route].mount(viewEl, { param }) || null;
  } catch (err) {
    currentView = null;
    viewEl.innerHTML = `<div class="section"><h1 class="section-title">页面载入失败</h1><p style="color:var(--ink-dim)">${String(err?.message || err)}</p></div>`;
    console.error(err);
  }
  updateNav(route);
  document.title = route === 'home' ? BASE_TITLE : `${NAV.find(n => n.route === route)?.label || '画板'} · Oro`;
  hydrateImages?.(viewEl);
  document.querySelectorAll('.site-nav a').forEach(a => {
    if (a.dataset.route === (route === 'board' ? 'boards' : route)) a.classList.add('is-active');
  });
  bindPageEffects();
  if (route !== 'home') window.scrollTo(0, 0);
}

function renderRoute({ initial = false } = {}) {
  const { route, param } = parseHash();
  if (!location.hash) history.replaceState(null, '', '#/home');
  if (switching) return;
  const { label, index } = labelFor(route);

  if (initial) {
    const veil = document.getElementById('veil');
    const vlabel = document.getElementById('veil-label');
    const vindex = document.getElementById('veil-index');
    if (veil) {
      if (vlabel) vlabel.textContent = 'ORO';
      if (vindex) vindex.textContent = 'DESIGN × CODE';
      veil.classList.add('is-on');
    }
    mountView(route, param);
    setTimeout(() => veil?.classList.remove('is-on'), reducedMotion ? 60 : 900);
    return;
  }

  switching = true;
  const veil = document.getElementById('veil');
  document.getElementById('veil-label').textContent = label;
  document.getElementById('veil-index').textContent = `${index} / INDEX`;
  veil.classList.add('is-on');
  const wait = reducedMotion ? 60 : 430;
  setTimeout(() => {
    mountView(route, param);
    setTimeout(() => veil.classList.remove('is-on'), 40);
    switching = false;
  }, wait);
}

/* ---------------- 滚动 / 视差 / 揭示 ---------------- */

function bindScrollEffects() {
  const progress = document.getElementById('scroll-progress');
  const header = document.getElementById('site-header');
  let lastY = -1;
  const onScroll = () => {
    const y = window.scrollY;
    if (Math.abs(y - lastY) < 1) return;
    lastY = y;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (progress) progress.style.transform = `scaleX(${Math.min(1, y / max)})`;
    header?.classList.toggle('is-solid', y > 36);
    requestParallax();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { requestParallax(); }, { passive: true });
  onScroll();
}

function requestParallax() {
  if (rafPending || reducedMotion) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const vh = window.innerHeight;
    parallaxEls.forEach(({ el, speed }) => {
      const rect = el.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > vh + 200) return;
      const center = rect.top + rect.height / 2 - vh / 2;
      const shift = -center * speed;
      el.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
    });
  });
}

function bindPageEffects() {
  observer?.disconnect();
  parallaxEls = [];
  const targets = viewEl.querySelectorAll('[data-par]');
  targets.forEach(el => {
    parallaxEls.push({ el, speed: parseFloat(el.dataset.par) || 0.06 });
  });

  if (!reducedMotion && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    viewEl.querySelectorAll('.reveal, .reveal-clip').forEach(el => observer.observe(el));
  } else {
    viewEl.querySelectorAll('.reveal, .reveal-clip').forEach(el => el.classList.add('is-in'));
  }

  // 索引行悬浮预览（仅精确指针）
  const preview = document.querySelector('.work-preview');
  if (preview && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let px = 0, py = 0, tx = 0, ty = 0, raf = 0;
    const loop = () => {
      px += (tx - px) * 0.16;
      py += (ty - py) * 0.16;
      preview.style.left = `${px}px`;
      preview.style.top = `${py}px`;
      raf = requestAnimationFrame(loop);
    };
    viewEl.querySelectorAll('.work-row[data-preview], .hv-work[data-preview]').forEach(row => {
      row.addEventListener('pointerenter', () => {
        const src = row.dataset.preview;
        const img = preview.querySelector('img');
        if (img && src && img.getAttribute('src') !== src) img.src = src;
        preview.classList.add('is-on');
        if (!raf) { px = tx; py = ty; raf = requestAnimationFrame(loop); }
      });
      row.addEventListener('pointerleave', () => {
        preview.classList.remove('is-on');
        cancelAnimationFrame(raf); raf = 0;
      });
    });
    viewEl.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    bindPageEffects._cleanupPreview = () => cancelAnimationFrame(raf);
  }

  requestParallax();
  // 让首屏元素在无观察者时也能进入
  requestAnimationFrame(() => {
    viewEl.querySelectorAll('.hero .reveal, .hero .reveal-clip').forEach(el => el.classList.add('is-in'));
  });
}

/* ---------------- 光标 ---------------- */

function bindCursor() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const cursor = document.getElementById('cursor');
  if (!cursor) return;
  let x = window.innerWidth / 2, y = window.innerHeight / 2;
  let rx = x, ry = y;

  document.addEventListener('pointermove', e => {
    cursor.classList.add('is-ready');
    x = e.clientX; y = e.clientY;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
    const dot = cursor.querySelector('.cursor-dot');
    if (dot) dot.style.transform = 'translate(-50%, -50%)';
  }, { passive: true });

  const loop = () => {
    rx += (x - rx) * 0.18;
    ry += (y - ry) * 0.18;
    const ring = cursor.querySelector('.cursor-ring');
    if (ring) ring.style.transform = `translate(${rx - x}px, ${ry - y}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  document.addEventListener('pointerover', e => {
    const target = e.target.closest?.('a, button, [role="button"], input, select, textarea, [data-cursor]');
    const type = target?.dataset?.cursor;
    cursor.classList.toggle('is-view', type === 'view');
    cursor.classList.toggle('is-theme', type === 'theme');
    cursor.classList.toggle('is-link', !!target && !type);
    const label = cursor.querySelector('.cursor-label');
    if (label) label.textContent = type === 'theme' ? 'THEME' : 'VIEW';
  });
  document.addEventListener('pointerout', e => {
    if (!e.relatedTarget) { cursor.classList.remove('is-link', 'is-view', 'is-theme'); }
  });
}

/* ---------------- 全局事件 ---------------- */

function bindGlobal() {
  window.addEventListener('hashchange', () => renderRoute());
  window.addEventListener('dw:view-rendered', () => bindPageEffects());

  subscribe(() => {
    syncBodyTheme();
    updateThemeIcon();
  });

  document.getElementById('search-open')?.addEventListener('click', openSearch);
  document.getElementById('palette-open')?.addEventListener('click', openPalette);
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = getState().theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setMode(next);
    syncBodyTheme();
    updateThemeIcon();
    hydrateImages?.(document);
  });

  document.addEventListener('keydown', e => {
    const target = e.target;
    const typing = target instanceof HTMLElement && (
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
    );
    if (e.key === '/' && !typing && !document.body.classList.contains('is-editor')) {
      e.preventDefault();
      openSearch();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openPalette();
    }
  });

  window.addEventListener('dw:save', e => {
    const el = document.getElementById('save-status');
    if (!el) return;
    if (e.detail.status === 'saving') {
      el.textContent = '保存中';
      el.classList.add('is-saving');
    } else if (e.detail.status === 'saved') {
      const d = e.detail.at || new Date();
      el.textContent = `已保存 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      el.classList.remove('is-saving');
      setTimeout(() => { el.textContent = ''; }, 1800);
    } else {
      el.textContent = '保存失败';
    }
  });

  subscribeTimer(snap => {
    if (snap.running) {
      document.title = `${timeText(snap.remaining)} · ${snap.mode === 'focus' ? '专注' : '休息'} — Oro`;
    } else {
      document.title = currentRoute === 'home' ? 'Oro — Design × Code' : `${NAV.find(n => n.route === currentRoute)?.label || '画板'} · Oro`;
    }
  });

  // 供旧页面复用的滚动壳体（编辑器等）
  window.addEventListener('resize', () => {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  });
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}
