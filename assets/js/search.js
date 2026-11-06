// 全局搜索弹层：跨项目、作品、收藏、生词与学习记录
import { getState } from './store.js';
import { openModal } from './ui.js';
import { icon } from './icons.js';
import { escapeHtml, hostOf, clampText, formatShort } from './util.js';

export function openSearch() {
  const state = getState();
  let api;
  const body = `
    <div class="search-field">
      ${icon('search', 20)}
      <input type="search" id="search-input" placeholder="搜索项目、作品、收藏、生词…" autocomplete="off" aria-label="搜索内容">
      <kbd>Esc</kbd>
    </div>
    <div class="search-results" id="search-results" aria-live="polite"></div>
    <p class="search-hint">提示：按 <kbd>/</kbd> 可在任意页面打开搜索，<kbd>Esc</kbd> 关闭。</p>`;

  api = openModal({
    title: '搜索',
    size: 'search',
    className: 'modal--search',
    body,
    onMount(dialog) {
      const input = dialog.querySelector('#search-input');
      const results = dialog.querySelector('#search-results');
      const render = () => {
        const q = input.value.trim().toLowerCase();
        results.innerHTML = q ? search(q, state) : defaultHints(state);
      };
      input.addEventListener('input', render);
      results.addEventListener('click', e => {
        const btn = e.target.closest('[data-go]');
        if (!btn) return;
        const href = btn.dataset.go;
        const external = btn.dataset.external;
        if (external) {
          window.open(external, '_blank', 'noopener');
          return;
        }
        api.close();
        location.hash = href;
      });
      render();
    }
  });
}

function row({ group, title, meta, href, external, badge = '' }) {
  return `<button type="button" class="search-row" data-go="${escapeHtml(href || '#/home')}" ${external ? `data-external="${escapeHtml(external)}"` : ''}>
    <span class="search-row-main">
      <span class="search-group">${escapeHtml(group)}</span>
      <span class="search-title">${escapeHtml(title)}</span>
      <span class="search-meta">${escapeHtml(meta)}</span>
    </span>
    ${badge ? `<span class="chip chip--tiny">${escapeHtml(badge)}</span>` : `<span class="search-arrow">${icon('arrow', 14)}</span>`}
  </button>`;
}

function defaultHints(state) {
  const counts = [
    { label: '项目', value: state.projects.length, href: '#/projects' },
    { label: '作品', value: state.portfolio.length, href: '#/portfolio' },
    { label: '收藏', value: state.library.links.length, href: '#/library' },
    { label: '生词', value: state.learn.words.length, href: '#/learn' }
  ];
  return `<p class="search-empty">输入关键词开始搜索。当前收藏：${counts.map(c => `${escapeHtml(c.label)} ${c.value}`).join(' · ')}</p>`;
}

function search(q, state) {
  const groups = [];
  const projects = state.projects.filter(p =>
    [p.title, p.client, p.notes, p.tags?.join(' '), p.type, p.status].join(' ').toLowerCase().includes(q)
  ).slice(0, 6);
  if (projects.length) {
    groups.push(`<div class="search-group-head">项目</div>` + projects.map(p => row({
      group: p.status, title: p.title, meta: `${p.client || '未填客户'} · ${p.type}`, href: `#/projects/${p.id}`,
      badge: p.sample ? '示例' : ''
    })).join(''));
  }

  const works = state.portfolio.filter(w =>
    [w.title, w.summary, w.role, w.tools?.join(' '), w.category, w.year].join(' ').toLowerCase().includes(q)
  ).slice(0, 6);
  if (works.length) {
    groups.push(`<div class="search-group-head">作品集</div>` + works.map(w => row({
      group: w.section === 'design' ? '设计' : '编程', title: w.title,
      meta: `${w.role || ''} ${w.year || ''}`.trim(), href: `#/portfolio/${w.id}`,
      badge: w.sample ? '示例' : ''
    })).join(''));
  }

  const links = state.library.links.filter(l =>
    [l.name, l.notes, l.tags?.join(' '), l.url].join(' ').toLowerCase().includes(q)
  ).slice(0, 4);
  if (links.length) {
    groups.push(`<div class="search-group-head">灵感收藏</div>` + links.map(l => row({
      group: '网址', title: l.name, meta: `${hostOf(l.url)} · ${clampText(l.notes, 28)}`, href: l.url, external: l.url
    })).join(''));
  }

  const words = state.learn.words.filter(w =>
    [w.word, w.meaning, w.example].join(' ').toLowerCase().includes(q)
  ).slice(0, 4);
  if (words.length) {
    groups.push(`<div class="search-group-head">生词本</div>` + words.map(w => row({
      group: w.learned ? '已掌握' : '待复习', title: w.word, meta: w.meaning, href: '#/learn'
    })).join(''));
  }

  const records = state.learn.records.filter(r =>
    [r.topic, r.notes].join(' ').toLowerCase().includes(q)
  ).slice(0, 4);
  if (records.length) {
    groups.push(`<div class="search-group-head">学习记录</div>` + records.map(r => row({
      group: formatShort(r.date), title: r.topic, meta: `${r.line === 'code' ? '编程' : '英语'} · ${r.minutes} 分钟`, href: '#/learn'
    })).join(''));
  }

  const tasks = state.tasks.filter(t => t.title.toLowerCase().includes(q)).slice(0, 4);
  if (tasks.length) {
    groups.push(`<div class="search-group-head">待办</div>` + tasks.map(t => row({
      group: t.done ? '已完成' : '待办', title: t.title, meta: '工作台', href: '#/home'
    })).join(''));
  }

  if (!groups.length) {
    return `<div class="search-empty-state">
      <p>没有找到「${escapeHtml(q)}」相关内容。</p>
      <p class="muted">换个关键词，或先到项目 / 作品集里添加内容。</p>
    </div>`;
  }
  return groups.join('');
}
