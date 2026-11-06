// 工作台首页：问候、今日重点、番茄钟、本周专注、最近项目与精选作品
import { getState, subscribe, update } from '../store.js';
import { icon } from '../icons.js';
import { toast } from '../ui.js';
import { subscribeTimer, snapshot, toggle, reset, setMode, timeText, DURATIONS } from '../pomodoro.js';
import { hydrateImages } from '../images.js';
import {
  escapeHtml, uid, todayISO, weekDates, weekdayLabel, formatShort,
  minutesText, dueInfo, formatCN, greeting
} from '../util.js';

export default {
  mount(root) {
    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('change', onChange);
    const offStore = subscribe(refresh);
    const offTimer = subscribeTimer(renderTimer);
    let timerInterval = null;
    refresh();
    timerInterval = setInterval(renderTimer, 1000);
    return {
      destroy() {
        offStore();
        offTimer();
        clearInterval(timerInterval);
      }
    };
  }
};

function refresh() {
  const root = document.getElementById('view');
  if (!root) return;
  const state = getState();
  const today = todayISO();
  const week = weekDates();
  const pending = state.tasks.filter(t => !t.done);
  const activeProjects = state.projects.filter(p => p.status !== '交付');
  const focusWeek = state.focusSessions.filter(s => week.includes(s.date));
  const focusMinutes = focusWeek.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  const focusToday = state.focusSessions.filter(s => s.date === today);
  const doneToday = state.focusSessions.filter(s => s.date === today).reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  const profileName = (state.profile.name || '（你的名字）').replace(/^示例\s*·\s*/, '');
  const isSampleProfile = /^示例\s*·/.test(state.profile.name || '');
  const recent = [...state.projects].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 3);
  const featured = state.portfolio.filter(w => w.featured).slice(0, 3);

  root.innerHTML = `
  <section class="page page--home">
    <header class="home-hero">
      <div class="hero-main">
        <p class="kicker">${escapeHtml(formatCN(today))}</p>
        <h1 class="hero-title">${escapeHtml(greeting())}，<span class="accent">${escapeHtml(profileName)}</span><span class="hero-period">。</span></h1>
        <p class="hero-lede">
          今天还有 <b>${pending.length}</b> 项重点任务，<b>${activeProjects.length}</b> 个项目待推进；
          本周已专注 <b>${minutesText(focusMinutes)}</b>。
          ${isSampleProfile ? `<span class="chip chip--tiny chip--sample">示例资料 · 可在设置中修改</span>` : ''}
        </p>
      </div>
      <div class="hero-actions">
        <button type="button" class="btn btn-primary" data-new-project>${icon('plus', 16)} 新建项目</button>
        <a class="btn" href="#/learn">记录今天的学习</a>
      </div>
    </header>

    <div class="home-grid">
      <div class="home-col home-col--main">
        <section class="panel tasks-panel" aria-labelledby="tasks-title">
          <div class="panel-head">
            <div>
              <p class="kicker">Today / 今日重点</p>
              <h2 id="tasks-title">待办清单</h2>
            </div>
            <span class="panel-count">${state.tasks.filter(t => t.done).length} / ${state.tasks.length} 完成</span>
          </div>
          <form class="task-add" id="task-form">
            <label class="sr-only" for="task-input">添加一条今日重点</label>
            <input id="task-input" name="title" type="text" placeholder="写下一件今天必须完成的事…" autocomplete="off" maxlength="80">
            <button type="submit" class="icon-btn" aria-label="添加任务">${icon('plus', 18)}</button>
          </form>
          ${state.tasks.length ? `<ul class="task-list">
            ${state.tasks.map(task => `
              <li class="task ${task.done ? 'is-done' : ''}">
                <label class="task-check">
                  <input type="checkbox" data-task-toggle="${task.id}" ${task.done ? 'checked' : ''} aria-label="${escapeHtml(task.done ? '取消完成' : '完成')}：${escapeHtml(task.title)}">
                  <span class="check-mark">${icon('check', 12)}</span>
                </label>
                <span class="task-title">${escapeHtml(task.title)}</span>
                ${task.sample ? '<span class="chip chip--tiny">示例</span>' : ''}
                <button type="button" class="icon-btn task-del" data-task-del="${task.id}" aria-label="删除任务：${escapeHtml(task.title)}">${icon('trash', 15)}</button>
              </li>`).join('')}
          </ul>` : `<p class="panel-empty">还没有待办。先写下一件小事，比如「整理参考图」。</p>`}
        </section>

        <section class="recent-section" aria-labelledby="recent-title">
          <div class="section-head">
            <div>
              <p class="kicker">Projects / 项目</p>
              <h2 id="recent-title">最近项目</h2>
            </div>
            <a class="text-link" href="#/projects">查看全部 ${icon('arrow', 13)}</a>
          </div>
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

        <section class="featured-section" aria-labelledby="featured-title">
          <div class="section-head">
            <div>
              <p class="kicker">Selected / 精选</p>
              <h2 id="featured-title">精选作品</h2>
            </div>
            <a class="text-link" href="#/portfolio">全部作品 ${icon('arrow', 13)}</a>
          </div>
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
      </div>

      <div class="home-col home-col--side">
        <section class="panel timer-card" aria-labelledby="timer-title">
          <div class="panel-head">
            <div>
              <p class="kicker">Focus / 番茄钟</p>
              <h2 id="timer-title">专注计时</h2>
            </div>
            <span class="panel-count">${doneToday ? `今天 ${minutesText(doneToday)}` : '今天还没开始'}</span>
          </div>
          <div class="timer-tabs" role="tablist" aria-label="计时模式">
            <button type="button" role="tab" aria-selected="${snapshot().mode === 'focus'}" data-timer-mode="focus">专注 25</button>
            <button type="button" role="tab" aria-selected="${snapshot().mode === 'break'}" data-timer-mode="break">休息 05</button>
          </div>
          <p class="timer-time" data-timer-time aria-live="off">${timeText(snapshot().remaining)}</p>
          <div class="timer-track" aria-hidden="true"><span class="timer-fill" data-timer-fill></span></div>
          <div class="timer-controls">
            <button type="button" class="btn btn-primary" data-timer-toggle>${snapshot().running ? `${icon('pause', 15)} 暂停` : `${icon('play', 15)} 开始`}</button>
            <button type="button" class="btn" data-timer-reset>${icon('reset', 15)} 重置</button>
          </div>
          <p class="timer-foot">今天完成 <b>${focusToday.length}</b> 个番茄 · 本周 <b>${minutesText(focusMinutes)}</b></p>
        </section>

        <section class="panel week-card" aria-labelledby="week-title">
          <div class="panel-head">
            <div>
              <p class="kicker">This week / 本周</p>
              <h2 id="week-title">专注时长</h2>
            </div>
            <span class="week-total">${minutesText(focusMinutes)}</span>
          </div>
          ${barChart(week, focusWeek)}
          <p class="week-legend"><span class="legend-dot"></span> 每个柱子 = 当天累计专注分钟数</p>
        </section>

        <section class="note-card" aria-label="今日提示">
          <p class="note-mark" aria-hidden="true">“</p>
          <p class="note-text">先把一件事做完，再开始下一件。<br>专注是可以被练习的。</p>
          <p class="note-sign">— 写给自己</p>
        </section>
      </div>
    </div>
  </section>`;

  renderTimer();
}

function barChart(week, sessions) {
  const today = todayISO();
  const totals = week.map(d => sessions.filter(s => s.date === d).reduce((sum, s) => sum + (Number(s.minutes) || 0), 0));
  const max = Math.max(50, ...totals);
  return `<div class="week-chart" role="img" aria-label="本周每日专注时长柱状图：${week.map((d, i) => `周${weekdayLabel(d)} ${totals[i]} 分钟`).join('，')}">
    ${week.map((d, i) => `
      <div class="week-bar ${d === today ? 'is-today' : ''}">
        <span class="week-bar-value">${totals[i] ? totals[i] : ''}</span>
        <span class="week-bar-track"><span class="week-bar-fill" style="height:${totals[i] ? Math.max(6, totals[i] / max * 100) : 0}%"></span></span>
        <span class="week-bar-label">${weekdayLabel(d)}</span>
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
  const btn = document.querySelector('[data-timer-toggle]');
  if (btn) btn.innerHTML = snap.running ? `${icon('pause', 15)} 暂停` : `${icon('play', 15)} 开始`;
  document.querySelectorAll('[data-timer-mode]').forEach(tab => {
    tab.setAttribute('aria-selected', String(tab.dataset.timerMode === snap.mode));
  });
  const card = document.querySelector('.timer-card');
  if (card) card.dataset.mode = snap.mode;
}

function onClick(e) {
  const target = e.target.closest('[data-new-project], [data-task-del], [data-timer-toggle], [data-timer-reset], [data-timer-mode]');
  if (!target) return;

  if (target.matches('[data-new-project]')) {
    location.hash = '#/projects/new';
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
