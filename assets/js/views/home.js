// 工作台首页：印前工作台 · Bento 非对称布局
import { getState, subscribe, update } from '../store.js';
import { icon } from '../icons.js';
import { toast } from '../ui.js';
import { subscribeTimer, snapshot, toggle, reset, setMode, timeText } from '../pomodoro.js';
import { hydrateImages } from '../images.js';
import { previewSVG } from '../board-render.js';
import { listBoards, ensureSampleBoard } from '../boards.js';
import { openPalette } from '../palette.js';
import {
  escapeHtml, uid, todayISO, weekDates, weekdayLabel, formatShort,
  minutesText, dueInfo, formatCN, greeting, timeAgo
} from '../util.js';

let viewRoot = null;
let boards = [];
let boardsLoaded = false;

export default {
  mount(root) {
    viewRoot = root;
    boards = [];
    boardsLoaded = false;
    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('change', onChange);
    const offStore = subscribe(refresh);
    const offTimer = subscribeTimer(renderTimer);
    refresh();
    loadBoards();
    const timerInterval = setInterval(renderTimer, 1000);
    return {
      destroy() {
        viewRoot = null;
        offStore();
        offTimer();
        clearInterval(timerInterval);
      }
    };
  }
};

async function loadBoards() {
  try {
    await ensureSampleBoard();
    boards = await listBoards();
    boardsLoaded = true;
    if (viewRoot?.isConnected) refresh();
  } catch (err) {
    boardsLoaded = true;
    console.warn('画板读取失败', err);
    if (viewRoot?.isConnected) refresh();
  }
}

function refresh() {
  const root = viewRoot;
  if (!root?.isConnected) return;
  const state = getState();
  const today = todayISO();
  const week = weekDates();
  const pending = state.tasks.filter(t => !t.done);
  const doneTasks = state.tasks.filter(t => t.done).length;
  const totalTasks = state.tasks.length;
  const taskPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const activeProjects = state.projects.filter(p => p.status !== '交付');
  const focusWeek = state.focusSessions.filter(s => week.includes(s.date));
  const focusMinutes = focusWeek.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  const todaySessions = state.focusSessions.filter(s => s.date === today);
  const doneToday = todaySessions.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  const profileName = (state.profile.name || '（你的名字）').replace(/^示例\s*·\s*/, '');
  const isSampleProfile = /^示例\s*·/.test(state.profile.name || '');
  const recent = [...state.projects].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 3);
  const featured = state.portfolio.filter(w => w.featured).slice(0, 3);
  const latest = boards[0] || null;

  root.innerHTML = `
  <section class="page page--home press-home">
    <header class="home-masthead">
      <div class="masthead-left">
        <div class="masthead-edition">
          <span class="edition-no">No. 01</span>
          <span class="edition-rule" aria-hidden="true"></span>
          <span class="edition-date">${escapeHtml(formatCN(today))}</span>
        </div>
        <p class="kicker">Print studio / 印前工作台</p>
        <h1 class="masthead-title">${escapeHtml(greeting())}，<span class="masthead-name">${escapeHtml(profileName)}</span><span class="masthead-stop">。</span></h1>
        <div class="masthead-facts" aria-label="今日概览">
          <span><b>${pending.length}</b> 件待办</span>
          <i aria-hidden="true"></i>
          <span><b>${activeProjects.length}</b> 个在途项目</span>
          <i aria-hidden="true"></i>
          <span>本周专注 <b>${minutesText(focusMinutes)}</b></span>
        </div>
      </div>
      <div class="masthead-right">
        <svg class="reg-mark" viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="36" r="14" fill="none" stroke="currentColor" stroke-width="1.2"/>
          <circle cx="36" cy="36" r="4" fill="currentColor"/>
          <path d="M36 2v16M36 54v16M2 36h16M54 36h16" stroke="currentColor" stroke-width="1.2"/>
          <path d="M9 9h9M9 9v9M63 9h-9M63 9v9M9 63h9M9 63v-9M63 63h-9M63 63v-9" stroke="currentColor" stroke-width="1"/>
        </svg>
        <p class="masthead-note">${isSampleProfile ? '示例资料 · 可在设置中改成你自己' : '一张纸，一件事。做完再翻下一页。'}</p>
        <div class="hero-actions">
          <button type="button" class="btn btn-primary" data-new-board>${icon('boards', 15)} 新建画板</button>
          <button type="button" class="btn" data-new-project>${icon('plus', 15)} 新建项目</button>
          <button type="button" class="btn btn-ghost" data-palette>${icon('command', 14)} ⌘K 命令</button>
        </div>
      </div>
      <div class="ruler-strip" aria-hidden="true">
        <span class="ruler-strip-ticks"></span>
        <span class="ruler-strip-label">0</span>
        <span class="ruler-strip-label ruler-strip-label--mid">100</span>
        <span class="ruler-strip-label ruler-strip-label--end">200 mm</span>
      </div>
    </header>

    <div class="bento">
      <section class="sheet sheet--surface" aria-labelledby="surface-title">
        ${sheetHead('01', '今日工作面 / Work surface', `<a class="sheet-link" href="#/boards">全部画板 ${icon('arrow', 12)}</a>`)}
        <div class="surface-grid">
          <div class="surface-main">
            ${surfaceBoard(latest)}
            ${boards.length > 1 ? `<div class="surface-strip" aria-label="最近的其它画板">
              ${boards.slice(1, 4).map(b => `<a class="surface-chip" href="#/board/${b.id}">
                <span class="surface-chip-thumb">${previewSVG(b)}</span>
                <span class="surface-chip-name">${escapeHtml(b.name)}</span>
                <span class="surface-chip-meta">${timeAgo(b.updatedAt)}</span>
              </a>`).join('')}
            </div>` : ''}
          </div>
          <aside class="surface-stats">
            <p class="kicker">This week / 本周</p>
            <p class="stat-big">${minutesText(focusMinutes)}</p>
            <p class="stat-caption">专注时长 · ${focusWeek.length} 个番茄</p>
            ${sparkBars(week, focusWeek)}
            <dl class="stat-list">
              <div><dt>今日完成</dt><dd>${doneTasks} / ${state.tasks.length || 0}</dd></div>
              <div><dt>今日专注</dt><dd>${doneToday ? minutesText(doneToday) : '未开始'}</dd></div>
              <div><dt>在途项目</dt><dd>${activeProjects.length}</dd></div>
              <div><dt>画板</dt><dd>${boardsLoaded ? boards.length : '…'}</dd></div>
            </dl>
            <a class="surface-link" href="#/boards">打开画板架 ${icon('arrow', 12)}</a>
          </aside>
        </div>
      </section>

      <section class="sheet sheet--tasks" aria-labelledby="tasks-title">
        ${sheetHead('02', '今日重点 / Tasks', `<span class="sheet-count">${doneTasks}/${state.tasks.length}</span>`)}
        <h2 class="sr-only" id="tasks-title">待办清单</h2>
        <form class="task-add" id="task-form">
          <label class="sr-only" for="task-input">添加一条今日重点</label>
          <input id="task-input" name="title" type="text" placeholder="写下一件今天必须完成的事…" autocomplete="off" maxlength="80">
          <button type="submit" class="task-add-btn" aria-label="添加任务">${icon('plus', 16)}</button>
        </form>
        ${state.tasks.length ? `<ul class="task-list task-list--compact bento-tasks">
          ${state.tasks.map(task => `
            <li class="task ${task.done ? 'is-done' : ''}">
              <label class="task-check">
                <input type="checkbox" data-task-toggle="${task.id}" ${task.done ? 'checked' : ''} aria-label="${escapeHtml(task.done ? '取消完成' : '完成')}：${escapeHtml(task.title)}">
                <span class="check-mark">${icon('check', 12)}</span>
              </label>
              <span class="task-title">${escapeHtml(task.title)}</span>
              ${task.sample ? '<span class="chip chip--tiny">示例</span>' : ''}
              <button type="button" class="icon-btn task-del" data-task-del="${task.id}" aria-label="删除任务：${escapeHtml(task.title)}">${icon('trash', 14)}</button>
            </li>`).join('')}
        </ul>` : `<p class="panel-empty">还没有待办。先写下一件小事，比如「整理参考图」。</p>`}
        ${totalTasks ? `<div class="task-progress">
          <span>剩余 <b>${pending.length}</b> 项</span>
          <span class="task-progress-track" role="img" aria-label="今日完成度 ${taskPct}%"><i style="width:${taskPct}%"></i></span>
          <span class="task-progress-pct">${taskPct}%</span>
        </div>` : ''}
      </section>

      <section class="sheet sheet--timer" aria-labelledby="timer-title">
        ${sheetHead('03', '专注 / Focus', `<span class="sheet-count">25 + 5</span>`)}
        <div class="focus-card">
          <h2 class="sr-only" id="timer-title">专注计时</h2>
          <div class="focus-face" data-timer-dial style="--p:0%">
            <p class="focus-time" data-timer-time aria-live="off">${timeText(snapshot().remaining)}</p>
            <p class="focus-mode-label" data-timer-modelabel>${snapshot().mode === 'focus' ? '专注 25 MIN' : '休息 05 MIN'}</p>
          </div>
          <div class="focus-tabs" role="tablist" aria-label="计时模式">
            <button type="button" role="tab" aria-selected="${snapshot().mode === 'focus'}" data-timer-mode="focus">专注 25</button>
            <button type="button" role="tab" aria-selected="${snapshot().mode === 'break'}" data-timer-mode="break">休息 05</button>
          </div>
          <div class="focus-controls">
            <button type="button" class="btn btn-primary focus-toggle" data-timer-toggle>${snapshot().running ? `${icon('pause', 14)} 暂停` : `${icon('play', 14)} 开始`}</button>
            <button type="button" class="icon-btn" data-timer-reset aria-label="重置计时" title="重置">${icon('reset', 16)}</button>
          </div>
          <p class="focus-foot">今天 <b>${todaySessions.length}</b> 个番茄 · ${doneToday ? minutesText(doneToday) : '还没有开始'}</p>
        </div>
      </section>

      <section class="sheet sheet--week" aria-labelledby="week-title">
        ${sheetHead('04', '专注趋势 / Week', `<span class="sheet-count">${week.length} DAYS</span>`)}
        <h2 class="sr-only" id="week-title">本周专注时长</h2>
        ${focusBars(week, focusWeek)}
      </section>

      <section class="sheet sheet--recent" aria-labelledby="recent-title">
        ${sheetHead('05', '最近项目 / Projects', `<a class="sheet-link" href="#/projects">查看全部 ${icon('arrow', 12)}</a>`)}
        <h2 class="sr-only" id="recent-title">最近项目</h2>
        ${recent.length ? `<div class="recent-list">
          ${recent.map(p => {
            const due = dueInfo(p);
            return `<a class="recent-row" href="#/projects/${p.id}">
              <span class="recent-index">${escapeHtml(p.type)}</span>
              <span class="recent-main">
                <span class="recent-title">${escapeHtml(p.title)} ${p.sample ? '<span class="chip chip--tiny">示例</span>' : ''}</span>
                <span class="recent-meta">${escapeHtml(p.client || '未填客户')} · 改稿 ${p.revisions ?? 0} 次</span>
              </span>
              <span class="recent-progress" aria-label="进度 ${p.progress}%">
                <span class="progress-track"><span class="progress-fill" style="width:${Math.max(0, Math.min(100, Number(p.progress) || 0))}%"></span></span>
                <span class="progress-num">${Math.max(0, Math.min(100, Number(p.progress) || 0))}%</span>
              </span>
              <span class="due due--${due.state}">${escapeHtml(due.text)}</span>
            </a>`;
          }).join('')}
        </div>` : `<p class="panel-empty">还没有项目。点击「新建项目」开始记录。</p>`}
      </section>

      <section class="sheet sheet--featured" aria-labelledby="featured-title">
        ${sheetHead('06', '精选作品 / Selected', `<a class="sheet-link" href="#/portfolio">全部作品 ${icon('arrow', 12)}</a>`)}
        <h2 class="sr-only" id="featured-title">精选作品</h2>
        ${featured.length ? `<div class="featured-grid">
          ${featured.map(w => `
            <a class="featured-card" href="#/portfolio/${w.id}">
              <span class="cover cover--featured">
                ${w.imageId ? `<img data-img="${w.imageId}" alt="${escapeHtml(w.title)} 封面">` : `<img src="${escapeHtml(w.cover || '')}" alt="${escapeHtml(w.title)} 封面" loading="lazy">`}
                ${w.sample ? '<span class="sample-badge">示例</span>' : ''}
              </span>
              <span class="featured-info">
                <span class="featured-title">${escapeHtml(w.title)}</span>
                <span class="featured-meta">${escapeHtml(w.category)} · ${escapeHtml(w.year)}</span>
              </span>
            </a>`).join('')}
        </div>` : `<p class="panel-empty">在作品集里点亮「精选」，这里就会显示。</p>`}
      </section>

      <section class="sheet sheet--quote" aria-label="今日提示">
        <span class="quote-no">07</span>
        <p class="quote-mark" aria-hidden="true">“</p>
        <p class="quote-text">先把一件事做完，<br>再开始下一件。</p>
        <p class="quote-sign">写给自己 · ${escapeHtml(formatShort(today))}</p>
        <svg class="quote-mark-svg" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="9" fill="none" stroke="currentColor" stroke-width=".9"/>
          <path d="M20 3v9M20 28v9M3 20h9M28 20h9" stroke="currentColor" stroke-width=".9"/>
        </svg>
      </section>
    </div>
  </section>`;

  renderTimer();
  hydrateImages(root);
}

function surfaceBoard(latest) {
  if (!boardsLoaded) {
    return `<div class="surface-empty surface-empty--loading"><span class="surface-loader" aria-hidden="true"></span><p>正在整理纸张…</p></div>`;
  }
  if (!latest) {
    return `<div class="surface-empty">
      <p class="kicker">Blank sheet / 空白纸张</p>
      <h3>还没有画板</h3>
      <p>新建一张画板，在无限画布上排一张海报，或只是随手画几笔。</p>
      <button type="button" class="btn btn-primary" data-new-board>${icon('plus', 15)} 新建画板</button>
    </div>`;
  }
  return `<a class="surface-board" href="#/board/${latest.id}" aria-label="打开画板：${escapeHtml(latest.name)}">
    <span class="surface-board-stack" aria-hidden="true"></span>
    <span class="surface-board-paper">
      ${latest.sample ? '<span class="sample-badge">示例</span>' : ''}
      <span class="surface-board-svg">${previewSVG(latest)}</span>
    </span>
    <span class="surface-board-caption">
      <span class="surface-board-name">${escapeHtml(latest.name)}</span>
      <span class="surface-board-meta">${latest.width} × ${latest.height} px · ${(latest.objects || []).length} 个对象 · 更新于 ${timeAgo(latest.updatedAt)}</span>
    </span>
  </a>`;
}

function sheetHead(no, label, aside = '') {
  return `<header class="sheet-head">
    <span class="sheet-no">${no}</span>
    <span class="sheet-label">${escapeHtml(label)}</span>
    ${aside}
    <span class="crop-marks" aria-hidden="true"></span>
  </header>`;
}

function sparkBars(week, sessions) {
  const today = todayISO();
  const totals = week.map(d => sessions.filter(s => s.date === d).reduce((sum, s) => sum + (Number(s.minutes) || 0), 0));
  const max = Math.max(50, ...totals);
  return `<div class="spark-bars" role="img" aria-label="本周每日专注：${week.map((d, i) => `周${weekdayLabel(d)} ${totals[i]} 分钟`).join('，')}">
    ${week.map((d, i) => `<span class="spark-col ${d === today ? 'is-today' : ''}"><span class="spark-fill" style="height:${totals[i] ? Math.max(8, (totals[i] / max) * 100) : 2}%"></span><i>${weekdayLabel(d)}</i></span>`).join('')}
  </div>`;
}

function focusBars(week, sessions) {
  const today = todayISO();
  const totals = week.map(d => sessions.filter(s => s.date === d).reduce((sum, s) => sum + (Number(s.minutes) || 0), 0));
  const max = Math.max(50, ...totals);
  return `<div class="focus-bars" role="img" aria-label="本周每日专注时长柱状图：${week.map((d, i) => `周${weekdayLabel(d)} ${totals[i]} 分钟`).join('，')}">
    ${week.map((d, i) => `
      <div class="focus-bar ${d === today ? 'is-today' : ''}">
        <span class="focus-bar-value">${totals[i] ? totals[i] : ''}</span>
        <span class="focus-bar-track"><span class="focus-bar-fill" style="height:${totals[i] ? Math.max(6, totals[i] / max * 100) : 0}%"></span></span>
        <span class="focus-bar-label">${weekdayLabel(d)}</span>
      </div>`).join('')}
  </div>`;
}

function renderTimer() {
  const timeEl = document.querySelector('[data-timer-time]');
  if (!timeEl) return;
  const snap = snapshot();
  timeEl.textContent = timeText(snap.remaining);
  const fill = document.querySelector('[data-timer-fill]');
  if (fill) fill.style.width = `${Math.round(snap.progress * 100)}%`;
  const dial = document.querySelector('[data-timer-dial]');
  if (dial) dial.style.setProperty('--p', `${Math.round(snap.progress * 100)}%`);
  const modeLabel = document.querySelector('[data-timer-modelabel]');
  if (modeLabel) modeLabel.textContent = snap.mode === 'focus' ? '专注 25 MIN' : '休息 05 MIN';
  const btn = document.querySelector('[data-timer-toggle]');
  if (btn) btn.innerHTML = snap.running ? `${icon('pause', 14)} 暂停` : `${icon('play', 14)} 开始`;
  document.querySelectorAll('[data-timer-mode]').forEach(tab => {
    tab.setAttribute('aria-selected', String(tab.dataset.timerMode === snap.mode));
  });
  const card = document.querySelector('.sheet--timer');
  if (card) card.dataset.mode = snap.mode;
}

function onClick(e) {
  const target = e.target.closest('[data-new-board], [data-new-project], [data-palette], [data-task-del], [data-timer-toggle], [data-timer-reset], [data-timer-mode]');
  if (!target) return;

  if (target.matches('[data-new-board]')) {
    location.hash = '#/boards/new';
    return;
  }
  if (target.matches('[data-new-project]')) {
    location.hash = '#/projects/new';
    return;
  }
  if (target.matches('[data-palette]')) {
    openPalette();
    return;
  }
  if (target.dataset.taskDel) {
    update(s => { s.tasks = s.tasks.filter(t => t.id !== target.dataset.taskDel); });
    toast('任务已删除');
    return;
  }
  if (target.matches('[data-timer-toggle]')) {
    toggle();
    renderTimer();
    return;
  }
  if (target.matches('[data-timer-reset]')) {
    reset();
    renderTimer();
    toast('计时已重置');
    return;
  }
  if (target.dataset.timerMode) {
    setMode(target.dataset.timerMode);
    renderTimer();
  }
}

function onSubmit(e) {
  if (!e.target.matches('#task-form')) return;
  e.preventDefault();
  const input = e.target.querySelector('#task-input');
  const title = input.value.trim();
  if (!title) {
    toast('先写点什么再添加', { type: 'warn' });
    input.focus();
    return;
  }
  update(s => {
    s.tasks.unshift({ id: uid('task'), title, done: false, createdAt: Date.now() });
  });
  input.value = '';
  toast('已加入今日重点');
  setTimeout(() => {
    const again = document.querySelector('#task-input');
    again?.focus();
  }, 120);
}

function onChange(e) {
  const box = e.target.closest('[data-task-toggle]');
  if (!box) return;
  const id = box.dataset.taskToggle;
  update(s => {
    const task = s.tasks.find(t => t.id === id);
    if (task) task.done = box.checked;
  });
  if (box.checked) toast('完成一件，继续下一件');
}

