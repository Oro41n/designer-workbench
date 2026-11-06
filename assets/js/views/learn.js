// 学习区：编程 / 英语双线记录、连续打卡、本周时长柱状图、生词本与编程清单
import { getState, subscribe, update } from '../store.js';
import { icon } from '../icons.js';
import { pageHead, openModal, toast, formValues, emptyState } from '../ui.js';
import {
  escapeHtml, uid, todayISO, weekDates, weekdayLabel, shiftDate, minutesText, formatShort
} from '../util.js';

const LINE_LABEL = { code: '编程', english: '英语' };

export default {
  mount(root) {
    let lineFilter = 'all';
    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('change', onChange);
    const off = subscribe(refresh);
    refresh();
    return { destroy: () => off() };

    function streakInfo() {
      const set = new Set(getState().learn.checkins);
      const today = todayISO();
      let cursor = set.has(today) ? today : shiftDate(today, -1);
      let streak = 0;
      while (set.has(cursor) && streak < 400) {
        streak += 1;
        cursor = shiftDate(cursor, -1);
      }
      return { streak, checkedToday: set.has(today) };
    }

    function refresh() {
      const state = getState();
      const week = weekDates();
      const today = todayISO();
      const weekRecords = state.learn.records.filter(r => week.includes(r.date));
      const weekMinutes = weekRecords.reduce((sum, r) => sum + (Number(r.minutes) || 0), 0);
      const words = state.learn.words;
      const learned = words.filter(w => w.learned).length;
      const { streak, checkedToday } = streakInfo();
      const records = [...state.learn.records]
        .filter(r => lineFilter === 'all' || r.line === lineFilter)
        .sort((a, b) => b.date.localeCompare(a.date));

      root.innerHTML = `
        ${pageHead({
          kicker: 'Learn / 学习区',
          title: '学习区',
          lede: '编程与英语分开记录，连续打卡会累加；每周柱状图只统计本周的分钟数。',
          actions: `
            <button type="button" class="btn ${checkedToday ? '' : 'btn-primary'}" data-checkin ${checkedToday ? 'disabled' : ''}>
              ${icon('flame', 16)} ${checkedToday ? '今日已打卡' : '今日打卡'}
            </button>
            <button type="button" class="btn" data-add-record>${icon('plus', 16)} 添加记录</button>`
        })}

        <div class="stat-strip" role="group" aria-label="学习统计">
          <div class="stat">
            <span class="stat-label">连续打卡</span>
            <span class="stat-value">${streak}<em>天</em></span>
            <span class="stat-sub">${checkedToday ? '今天已打卡' : '今天还没打卡'}</span>
          </div>
          <div class="stat">
            <span class="stat-label">本周学习</span>
            <span class="stat-value">${weekMinutes}<em>分钟</em></span>
            <span class="stat-sub">${minutesText(weekMinutes)}</span>
          </div>
          <div class="stat">
            <span class="stat-label">本周记录</span>
            <span class="stat-value">${weekRecords.length}<em>条</em></span>
            <span class="stat-sub">编程 ${weekRecords.filter(r => r.line === 'code').length} · 英语 ${weekRecords.filter(r => r.line === 'english').length}</span>
          </div>
          <div class="stat">
            <span class="stat-label">生词掌握</span>
            <span class="stat-value">${learned}<em>/ ${words.length}</em></span>
            <span class="stat-sub">标记掌握后会变淡</span>
          </div>
        </div>

        <div class="learn-grid">
          <div class="learn-col">
            <section class="panel chart-panel" aria-labelledby="learn-week-title">
              <div class="panel-head">
                <div>
                  <p class="kicker">This week / 本周</p>
                  <h2 id="learn-week-title">学习时长</h2>
                </div>
                <span class="week-total">${minutesText(weekMinutes)}</span>
              </div>
              ${stackedChart(week, weekRecords)}
              <p class="week-legend"><span class="legend-dot legend-dot--ink"></span> 编程 <span class="legend-dot legend-dot--accent"></span> 英语</p>
            </section>

            <section class="panel records-panel" aria-labelledby="records-title">
              <div class="panel-head">
                <div>
                  <p class="kicker">Log / 记录</p>
                  <h2 id="records-title">学习记录</h2>
                </div>
                <div class="seg seg--sm" role="group" aria-label="按学习线筛选">
                  <button type="button" class="seg-btn ${lineFilter === 'all' ? 'is-on' : ''}" data-line="all" aria-pressed="${lineFilter === 'all'}">全部</button>
                  <button type="button" class="seg-btn ${lineFilter === 'code' ? 'is-on' : ''}" data-line="code" aria-pressed="${lineFilter === 'code'}">编程</button>
                  <button type="button" class="seg-btn ${lineFilter === 'english' ? 'is-on' : ''}" data-line="english" aria-pressed="${lineFilter === 'english'}">英语</button>
                </div>
              </div>
              ${records.length ? `<ul class="record-list">
                ${records.map(r => `<li class="record">
                  <span class="record-date">${formatShort(r.date)}</span>
                  <span class="record-line record-line--${r.line}">${LINE_LABEL[r.line] || '学习'}</span>
                  <span class="record-main">
                    <span class="record-topic">${escapeHtml(r.topic)} ${r.sample ? '<span class="chip chip--tiny">示例</span>' : ''}</span>
                    ${r.notes ? `<span class="record-notes">${escapeHtml(r.notes)}</span>` : ''}
                  </span>
                  <span class="record-minutes">${Number(r.minutes) || 0}′</span>
                  <button type="button" class="icon-btn" data-rec-del="${r.id}" aria-label="删除记录：${escapeHtml(r.topic)}">${icon('trash', 15)}</button>
                </li>`).join('')}
              </ul>` : emptyState({
                title: lineFilter === 'all' ? '还没有学习记录' : `还没有${LINE_LABEL[lineFilter]}记录`,
                description: '记录今天学了什么、花了多久。10 分钟也算数，连续打卡会累积。',
                action: `<button type="button" class="btn btn-primary" data-add-record>${icon('plus', 16)} 添加记录</button>`
              })}
            </section>
          </div>

          <div class="learn-col">
            <section class="panel checklist-panel" aria-labelledby="checklist-title">
              <div class="panel-head">
                <div>
                  <p class="kicker">Coding / 编程</p>
                  <h2 id="checklist-title">编程学习清单</h2>
                </div>
                <span class="panel-count">${state.learn.checklist.filter(c => c.done).length} / ${state.learn.checklist.length}</span>
              </div>
              ${state.learn.checklist.length ? `<ul class="task-list task-list--compact">
                ${state.learn.checklist.map(c => `
                  <li class="task ${c.done ? 'is-done' : ''}">
                    <label class="task-check">
                      <input type="checkbox" data-check-toggle="${c.id}" ${c.done ? 'checked' : ''} aria-label="${escapeHtml(c.title)}">
                      <span class="check-mark">${icon('check', 12)}</span>
                    </label>
                    <span class="task-title">${escapeHtml(c.title)}</span>
                    ${c.sample ? '<span class="chip chip--tiny">示例</span>' : ''}
                    <button type="button" class="icon-btn task-del" data-check-del="${c.id}" aria-label="删除：${escapeHtml(c.title)}">${icon('close', 14)}</button>
                  </li>`).join('')}
              </ul>` : '<p class="panel-empty">添加第一个学习目标，例如「C++ 指针」。</p>'}
              <form class="inline-add" id="check-form">
                <label class="sr-only" for="check-input">添加学习目标</label>
                <input id="check-input" name="title" placeholder="添加一个学习目标…" maxlength="50" autocomplete="off">
                <button type="submit" class="icon-btn" aria-label="添加目标">${icon('plus', 16)}</button>
              </form>
            </section>

            <section class="panel words-panel" aria-labelledby="words-title">
              <div class="panel-head">
                <div>
                  <p class="kicker">English / 英语</p>
                  <h2 id="words-title">生词本</h2>
                </div>
                <span class="panel-count">${learned} 已掌握</span>
              </div>
              <form class="inline-add inline-add--two" id="word-form">
                <label class="sr-only" for="word-input">英文单词</label>
                <input id="word-input" name="word" placeholder="word" maxlength="40" autocomplete="off">
                <label class="sr-only" for="meaning-input">中文释义</label>
                <input id="meaning-input" name="meaning" placeholder="中文释义" maxlength="60" autocomplete="off">
                <button type="submit" class="icon-btn" aria-label="添加生词">${icon('plus', 16)}</button>
              </form>
              ${words.length ? `<ul class="word-list">
                ${words.map(w => `<li class="word ${w.learned ? 'is-learned' : ''}">
                  <span class="word-main">
                    <span class="word-en">${escapeHtml(w.word)} ${w.sample ? '<span class="chip chip--tiny">示例</span>' : ''}</span>
                    <span class="word-cn">${escapeHtml(w.meaning)}</span>
                    ${w.example ? `<span class="word-ex">${escapeHtml(w.example)}</span>` : ''}
                  </span>
                  <button type="button" class="chip chip--tiny ${w.learned ? 'is-on' : ''}" data-word-toggle="${w.id}" aria-pressed="${Boolean(w.learned)}">${w.learned ? '已掌握' : '标记掌握'}</button>
                  <button type="button" class="icon-btn" data-word-del="${w.id}" aria-label="删除生词：${escapeHtml(w.word)}">${icon('trash', 15)}</button>
                </li>`).join('')}
              </ul>` : '<p class="panel-empty">把遇到的设计 / 编程生词记在这里，标记掌握后会变淡。</p>'}
            </section>
          </div>
        </div>`;
    }

    function stackedChart(week, records) {
      const code = week.map(d => records.filter(r => r.date === d && r.line === 'code').reduce((s, r) => s + (Number(r.minutes) || 0), 0));
      const en = week.map(d => records.filter(r => r.date === d && r.line === 'english').reduce((s, r) => s + (Number(r.minutes) || 0), 0));
      const totals = week.map((_, i) => code[i] + en[i]);
      const max = Math.max(30, ...totals);
      const today = todayISO();
      return `<div class="week-chart week-chart--stack" role="img" aria-label="本周学习时长：${week.map((d, i) => `${weekdayLabel(d)} ${totals[i]}分钟`).join('，')}">
        ${week.map((d, i) => `
          <div class="week-bar ${d === today ? 'is-today' : ''}">
            <span class="week-bar-value">${totals[i] || ''}</span>
            <span class="week-bar-track">
              <span class="week-bar-stack" style="height:${totals[i] ? Math.max(6, totals[i] / max * 100) : 0}%">
                <span class="week-bar-code" style="flex:${code[i] || 0}"></span>
                <span class="week-bar-en" style="flex:${en[i] || 0}"></span>
              </span>
            </span>
            <span class="week-bar-label">${weekdayLabel(d)}</span>
          </div>`).join('')}
      </div>`;
    }

    function addRecord() {
      const api = openModal({
        kicker: 'Learn / 记录',
        title: '添加学习记录',
        size: 'md',
        body: `
          <form id="record-form" class="form" novalidate>
            <div class="form-grid">
              <label class="field">
                <span class="field-label">日期</span>
                <input type="date" name="date" value="${todayISO()}">
              </label>
              <label class="field">
                <span class="field-label">学习线</span>
                <select name="line">
                  <option value="code">编程</option>
                  <option value="english">英语</option>
                </select>
              </label>
              <label class="field">
                <span class="field-label">时长（分钟）</span>
                <input type="number" name="minutes" min="1" max="600" value="30">
              </label>
              <label class="field field--full">
                <span class="field-label">主题 <em>必填</em></span>
                <input name="topic" maxlength="60" placeholder="例如：C++ 指针复习 / 设计英语词汇" autofocus>
              </label>
              <label class="field field--full">
                <span class="field-label">笔记</span>
                <textarea name="notes" rows="3" maxlength="300" placeholder="今天卡在哪里？有什么新发现？"></textarea>
              </label>
            </div>
            <div class="form-actions">
              <span></span>
              <span class="form-actions-right">
                <button type="button" class="btn" data-close>取消</button>
                <button type="submit" class="btn btn-primary">保存记录</button>
              </span>
            </div>
          </form>`,
        onMount(dialog) {
          const form = dialog.querySelector('#record-form');
          form.addEventListener('submit', e => {
            e.preventDefault();
            const data = formValues(form);
            if (!data.topic) {
              toast('写一下今天学了什么', { type: 'warn' });
              form.querySelector('[name="topic"]').focus();
              return;
            }
            const minutes = Math.max(1, Math.min(600, Number(data.minutes) || 0));
            update(s => {
              s.learn.records.push({
                id: uid('rec'),
                date: data.date || todayISO(),
                line: data.line === 'english' ? 'english' : 'code',
                minutes,
                topic: data.topic,
                notes: data.notes || '',
                sample: false
              });
            });
            toast('学习记录已保存', { type: 'success' });
            api.close('saved');
          });
        }
      });
    }

    function onClick(e) {
      if (e.target.closest('[data-checkin]') && !e.target.closest('[data-checkin]').disabled) {
        const { checkedToday } = streakInfo();
        if (checkedToday) return;
        update(s => { s.learn.checkins.push(todayISO()); });
        toast('今日打卡成功，继续保持', { type: 'success' });
        return;
      }
      if (e.target.closest('[data-add-record]')) {
        addRecord();
        return;
      }
      const lineBtn = e.target.closest('[data-line]');
      if (lineBtn) {
        lineFilter = lineBtn.dataset.line;
        refresh();
        return;
      }
      const recDel = e.target.closest('[data-rec-del]');
      if (recDel) {
        update(s => { s.learn.records = s.learn.records.filter(r => r.id !== recDel.dataset.recDel); });
        toast('记录已删除');
        return;
      }
      const checkToggle = e.target.closest('[data-check-toggle]');
      if (checkToggle) return; // 由 change 处理
      const checkDel = e.target.closest('[data-check-del]');
      if (checkDel) {
        update(s => { s.learn.checklist = s.learn.checklist.filter(c => c.id !== checkDel.dataset.checkDel); });
        return;
      }
      const wordToggle = e.target.closest('[data-word-toggle]');
      if (wordToggle) {
        update(s => {
          const w = s.learn.words.find(x => x.id === wordToggle.dataset.wordToggle);
          if (w) w.learned = !w.learned;
        });
        return;
      }
      const wordDel = e.target.closest('[data-word-del]');
      if (wordDel) {
        update(s => { s.learn.words = s.learn.words.filter(w => w.id !== wordDel.dataset.wordDel); });
        return;
      }
    }

    function onChange(e) {
      const check = e.target.closest('[data-check-toggle]');
      if (!check) return;
      update(s => {
        const item = s.learn.checklist.find(c => c.id === check.dataset.checkToggle);
        if (item) item.done = check.checked;
      });
      if (check.checked) toast('又掌握一项');
    }

    function onSubmit(e) {
      if (e.target.matches('#word-form')) {
        e.preventDefault();
        const word = e.target.querySelector('#word-input').value.trim();
        const meaning = e.target.querySelector('#meaning-input').value.trim();
        if (!word) { toast('先填英文单词', { type: 'warn' }); return; }
        update(s => {
          s.learn.words.unshift({
            id: uid('w'), word, meaning: meaning || '（待补充释义）', example: '', learned: false, sample: false
          });
        });
        toast('生词已添加');
        setTimeout(() => document.querySelector('#word-input')?.focus(), 120);
        return;
      }
      if (e.target.matches('#check-form')) {
        e.preventDefault();
        const input = e.target.querySelector('#check-input');
        const title = input.value.trim();
        if (!title) { toast('先写一个学习目标', { type: 'warn' }); return; }
        update(s => {
          s.learn.checklist.push({ id: uid('ck'), title, done: false, sample: false });
        });
        input.value = '';
        setTimeout(() => document.querySelector('#check-input')?.focus(), 120);
      }
    }
  }
};
