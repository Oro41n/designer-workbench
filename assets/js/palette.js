// 命令面板：⌘/Ctrl + K，跳转与执行常用操作
import { getState, setTheme } from './store.js';
import { openModal, toast } from './ui.js';
import { icon } from './icons.js';
import { escapeHtml, clampText } from './util.js';
import { listBoards } from './boards.js';
import { snapshot, toggle as toggleTimer } from './pomodoro.js';

let activeApi = null;

export async function openPalette() {
  if (activeApi) { activeApi.close(); return; }
  let boards = [];
  try { boards = await listBoards(); } catch { /* IndexedDB 不可用时仍可使用其它命令 */ }
  const state = getState();

  const groups = [
    {
      title: '动作 / Actions',
      items: [
        { label: '新建画板', meta: '选择纸张尺寸，开始一张新画面', icon: 'boards', href: '#/boards/new' },
        { label: '新建项目', meta: '记录客户、截止日期与进度', icon: 'plus', href: '#/projects/new' },
        { label: timerActionLabel(), meta: '25 分钟专注 / 5 分钟休息', icon: 'clock', action: 'focus' },
        { label: `切换到${state.theme === 'dark' ? '浅色' : '深色'}主题`, meta: '纸张 / 墨黑', icon: state.theme === 'dark' ? 'sun' : 'moon', action: 'theme' }
      ]
    },
    {
      title: '画板 / Boards',
      items: boards.map(b => ({
        label: b.name, meta: `${b.width} × ${b.height} · ${(b.objects || []).length} 个对象`, icon: 'boards',
        href: `#/board/${b.id}`, badge: b.sample ? '示例' : ''
      }))
    },
    {
      title: '项目 / Projects',
      items: state.projects.slice(0, 8).map(p => ({
        label: p.title, meta: `${p.client || '未填客户'} · ${p.status}`, icon: 'projects',
        href: `#/projects/${p.id}`, badge: p.sample ? '示例' : ''
      }))
    },
    {
      title: '作品 / Works',
      items: state.portfolio.slice(0, 8).map(w => ({
        label: w.title, meta: `${w.category} · ${w.year}`, icon: 'portfolio',
        href: `#/portfolio/${w.id}`, badge: w.sample ? '示例' : ''
      }))
    },
    {
      title: '页面 / Pages',
      items: [
        { label: '工作台', meta: '今日重点与专注趋势', icon: 'home', href: '#/home' },
        { label: '项目看板', meta: '项目状态与截止日期', icon: 'projects', href: '#/projects' },
        { label: '画板架', meta: '所有画板与缩略图', icon: 'boards', href: '#/boards' },
        { label: '作品集', meta: '设计与编程作品', icon: 'portfolio', href: '#/portfolio' },
        { label: '学习区', meta: '学习记录与生词本', icon: 'learn', href: '#/learn' },
        { label: '灵感库', meta: '收藏、配色与模板', icon: 'library', href: '#/library' },
        { label: '设置', meta: '资料、主题与数据', icon: 'settings', href: '#/settings' }
      ]
    }
  ].filter(g => g.items.length);

  const flat = groups.flatMap(g => g.items);
  let active = 0;

  const body = `
    <div class="cmd">
      <div class="cmd-field">
        ${icon('command', 18)}
        <input type="text" id="cmd-input" placeholder="输入命令，或搜索画板 / 项目 / 作品…" autocomplete="off" aria-label="命令搜索" aria-controls="cmd-list">
        <kbd>Esc</kbd>
      </div>
      <div class="cmd-list" id="cmd-list" role="listbox" aria-label="命令结果"></div>
      <p class="cmd-foot"><span>↑↓ 选择</span><span>Enter 执行</span><span>⌘K 关闭</span></p>
    </div>`;

  activeApi = openModal({
    kicker: 'Command / 命令',
    title: '命令面板',
    size: 'search',
    className: 'modal--palette',
    body,
    onClose() { activeApi = null; },
    onMount(dialog, api) {
      const input = dialog.querySelector('#cmd-input');
      const list = dialog.querySelector('#cmd-list');

      const render = () => {
        const q = input.value.trim().toLowerCase();
        const visible = groups
          .map(g => ({ ...g, items: g.items.filter(it => !q || [it.label, it.meta, g.title].join(' ').toLowerCase().includes(q)) }))
          .filter(g => g.items.length);
        const shown = visible.flatMap(g => g.items);
        if (active >= shown.length) active = Math.max(0, shown.length - 1);
        if (!shown.length) {
          list.innerHTML = `<div class="search-empty-state"><p>没有找到「${escapeHtml(input.value.trim())}」</p><p class="muted">试试「画板」「项目」「专注」。</p></div>`;
          return;
        }
        let i = 0;
        list.innerHTML = visible.map(g => `
          <p class="cmd-group">${escapeHtml(g.title)}</p>
          ${g.items.map(it => {
            const idx = i++;
            return `<button type="button" role="option" aria-selected="${idx === active}" class="cmd-row ${idx === active ? 'is-active' : ''}" data-cmd-index="${idx}">
              <span class="cmd-icon">${icon(it.icon || 'more', 16)}</span>
              <span class="cmd-main">
                <span class="cmd-title">${escapeHtml(it.label)}${it.badge ? `<span class="chip chip--tiny chip--sample">${escapeHtml(it.badge)}</span>` : ''}</span>
                <span class="cmd-meta">${escapeHtml(clampText(it.meta, 52))}</span>
              </span>
              ${it.keys ? `<kbd>${escapeHtml(it.keys)}</kbd>` : `<span class="cmd-enter">${icon('arrow', 13)}</span>`}
            </button>`;
          }).join('')}
        `).join('');
        list.querySelector('.cmd-row.is-active')?.scrollIntoView({ block: 'nearest' });
      };

      const run = item => {
        if (!item) return;
        api.close();
        if (item.action === 'theme') {
          const next = getState().theme === 'dark' ? 'light' : 'dark';
          setTheme(next);
          toast(next === 'dark' ? '已切换到深色主题' : '已切换到浅色主题');
          return;
        }
        if (item.action === 'focus') {
          if (snapshot().running) toast('专注已经在计时');
          else { toggleTimer(); toast('开始 25 分钟专注', { type: 'success' }); }
          if (location.hash !== '#/home') location.hash = '#/home';
          return;
        }
        if (item.href) location.hash = item.href;
      };

      const currentItems = () => {
        const q = input.value.trim().toLowerCase();
        return groups
          .map(g => ({ ...g, items: g.items.filter(it => !q || [it.label, it.meta, g.title].join(' ').toLowerCase().includes(q)) }))
          .filter(g => g.items.length)
          .flatMap(g => g.items);
      };

      input.addEventListener('input', () => { active = 0; render(); });
      input.addEventListener('keydown', e => {
        const items = currentItems();
        if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); render(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); render(); }
        else if (e.key === 'Enter') { e.preventDefault(); run(items[active]); }
        else if (e.key === 'Escape') { e.preventDefault(); api.close(); }
      });
      list.addEventListener('click', e => {
        const row = e.target.closest('[data-cmd-index]');
        if (!row) return;
        run(currentItems()[Number(row.dataset.cmdIndex)]);
      });
      render();
      setTimeout(() => input.focus(), 30);
    }
  });
}

function timerActionLabel() {
  return snapshot().running ? '专注进行中 · 查看计时' : '开始专注';
}
