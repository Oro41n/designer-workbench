// 通用交互：toast、弹层、确认对话框
import { icon } from './icons.js';
import { escapeHtml } from './util.js';

let toastCount = 0;
const modalStack = [];

export function toast(message, { type = 'info', duration = 2800 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  if (toastCount >= 3) root.firstElementChild?.remove();
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="toast-dot" aria-hidden="true"></span><span>${escapeHtml(message)}</span>`;
  root.appendChild(el);
  toastCount += 1;
  requestAnimationFrame(() => el.classList.add('is-in'));
  const kill = () => {
    el.classList.remove('is-in');
    setTimeout(() => { el.remove(); toastCount -= 1; }, 260);
  };
  setTimeout(kill, duration);
  el.addEventListener('click', kill);
}

function focusables(dialog) {
  return [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0);
}

export function openModal({
  title = '',
  kicker = '',
  body = '',
  footer = '',
  size = 'md',
  className = '',
  onMount = null,
  onClose = null,
  closeOnBackdrop = true
}) {
  const root = document.getElementById('modal-root');
  const previous = document.activeElement;
  const layer = document.createElement('div');
  layer.className = 'modal-layer';
  layer.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal modal--${size} ${className}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header class="modal-head">
        <div class="modal-heading">
          ${kicker ? `<p class="kicker">${escapeHtml(kicker)}</p>` : ''}
          <h2 id="modal-title">${escapeHtml(title)}</h2>
        </div>
        <button type="button" class="icon-btn" data-close aria-label="关闭">${icon('close', 18)}</button>
      </header>
      <div class="modal-body">${body}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </div>`;
  root.appendChild(layer);
  document.body.classList.add('modal-open');

  const dialog = layer.querySelector('.modal');
  const api = {
    layer,
    dialog,
    body: layer.querySelector('.modal-body'),
    footer: layer.querySelector('.modal-foot'),
    close(result) {
      if (!layer.isConnected) return;
      layer.classList.remove('is-in');
      setTimeout(() => layer.remove(), 200);
      const idx = modalStack.indexOf(api);
      if (idx >= 0) modalStack.splice(idx, 1);
      if (!modalStack.length) document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKey, true);
      try { onClose?.(result); } catch (err) { console.error(err); }
      if (previous && previous.focus) previous.focus({ preventScroll: true });
    }
  };
  modalStack.push(api);

  function onKey(e) {
    if (modalStack[modalStack.length - 1] !== api) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      api.close(null);
      return;
    }
    if (e.key === 'Tab') {
      const items = focusables(dialog);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  }

  layer.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) {
      if (e.target.closest('.modal-backdrop') && !closeOnBackdrop) return;
      api.close('close');
    }
  });
  document.addEventListener('keydown', onKey, true);

  requestAnimationFrame(() => layer.classList.add('is-in'));
  setTimeout(() => {
    const first = dialog.querySelector('[autofocus]') || focusables(dialog)[0];
    first?.focus({ preventScroll: true });
  }, 60);

  onMount?.(dialog, api);
  return api;
}

export function confirmDialog({
  title = '确认操作',
  description = '',
  confirmText = '确认',
  cancelText = '取消',
  danger = false
} = {}) {
  return new Promise(resolve => {
    let settled = false;
    const api = openModal({
      title,
      size: 'sm',
      className: 'modal--confirm',
      body: `<p class="confirm-text">${escapeHtml(description)}</p>`,
      footer: `<button type="button" class="btn" data-close>${escapeHtml(cancelText)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${escapeHtml(confirmText)}</button>`,
      onClose: () => { if (!settled) { settled = true; resolve(false); } }
    });
    api.dialog.querySelector('[data-confirm]').addEventListener('click', () => {
      settled = true;
      resolve(true);
      api.close('confirm');
    });
  });
}

// 二次确认（危险操作）：必须勾选确认项
export function dangerDialog({
  title,
  description,
  checkLabel = '我确认要执行此操作',
  confirmText = '确认清空'
} = {}) {
  return new Promise(resolve => {
    let settled = false;
    const api = openModal({
      title,
      size: 'sm',
      body: `<p class="confirm-text">${escapeHtml(description)}</p>
        <label class="check-row">
          <input type="checkbox" data-guard>
          <span>${escapeHtml(checkLabel)}</span>
        </label>`,
      footer: `<button type="button" class="btn" data-close>取消</button>
        <button type="button" class="btn btn-danger" data-confirm disabled>${escapeHtml(confirmText)}</button>`,
      onClose: () => { if (!settled) { settled = true; resolve(false); } }
    });
    const guard = api.dialog.querySelector('[data-guard]');
    const btn = api.dialog.querySelector('[data-confirm]');
    guard.addEventListener('change', () => { btn.disabled = !guard.checked; });
    btn.addEventListener('click', () => {
      if (!guard.checked) return;
      settled = true;
      resolve(true);
      api.close('confirm');
    });
  });
}

export function formValues(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    if (key.endsWith('[]')) {
      const k = key.slice(0, -2);
      (data[k] = data[k] || []).push(String(value).trim());
    } else {
      data[key] = typeof value === 'string' ? value.trim() : value;
    }
  });
  form.querySelectorAll('input[type="checkbox"][name]').forEach(input => {
    data[input.name] = input.checked;
  });
  return data;
}

export function pageHead({ kicker = '', title = '', lede = '', actions = '' }) {
  return `<header class="page-head">
    <div class="page-head-main">
      ${kicker ? `<p class="kicker">${escapeHtml(kicker)}</p>` : ''}
      <h1>${escapeHtml(title)}</h1>
      ${lede ? `<p class="page-lede">${escapeHtml(lede)}</p>` : ''}
    </div>
    ${actions ? `<div class="page-head-actions">${actions}</div>` : ''}
  </header>`;
}

export function emptyState({ title, description, action = '', iconName = 'folder', art = true }) {
  return `<div class="empty">
    ${art ? `<div class="empty-art" aria-hidden="true">${emptyArt()}</div>` : ''}
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(description)}</p>
    ${action}
  </div>`;
}

function emptyArt() {
  return `<svg viewBox="0 0 96 72" width="96" height="72" aria-hidden="true">
    <rect x="4" y="4" width="88" height="64" fill="none" stroke="currentColor" stroke-width="1" opacity=".5"/>
    <rect x="16" y="18" width="30" height="36" fill="none" stroke="currentColor" stroke-width="1" opacity=".7"/>
    <circle cx="66" cy="30" r="12" fill="none" stroke="currentColor" stroke-width="1" opacity=".7"/>
    <path d="M52 54h30" stroke="currentColor" stroke-width="1" opacity=".5"/>
    <path d="M52 60h18" stroke="currentColor" stroke-width="1" opacity=".35"/>
  </svg>`;
}
