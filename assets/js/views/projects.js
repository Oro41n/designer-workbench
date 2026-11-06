// 项目看板：看板 / 列表两种视图，增删改、搜索、筛选与逾期高亮
import { getState, subscribe, update } from '../store.js';
import { icon } from '../icons.js';
import { pageHead, openModal, confirmDialog, toast, formValues, emptyState } from '../ui.js';
import {
  escapeHtml, uid, TYPES, STATUSES, todayISO, shiftDate, dueInfo, clamp, formatShort, sortByDateDesc
} from '../util.js';

const VIEW_KEY = 'dw.projects.view';

export default {
  mount(root, ctx) {
    let viewMode = localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'board';
    const filters = { q: '', type: '全部', status: '全部' };
    let opened = false;

    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', onKeydown);
    const off = subscribe(() => renderAll());
    renderAll();

    if (ctx?.param) {
      const param = ctx.param;
      history.replaceState(null, '', '#/projects');
      setTimeout(() => {
        if (param === 'new') openEditor(null);
        else if (getState().projects.some(p => p.id === param)) openEditor(param);
      }, 0);
      opened = true;
    }

    return { destroy: () => off() };

    function filtered() {
      const q = filters.q.trim().toLowerCase();
      return getState().projects.filter(p => {
        if (filters.type !== '全部' && p.type !== filters.type) return false;
        if (filters.status !== '全部' && p.status !== filters.status) return false;
        if (!q) return true;
        return [p.title, p.client, p.notes, p.template, p.tags?.join(' '), p.type, p.status]
          .join(' ').toLowerCase().includes(q);
      });
    }

    function renderAll() {
      const state = getState();
      const list = filtered();
      const overdue = state.projects.filter(p => dueInfo(p).state === 'overdue').length;
      const active = state.projects.filter(p => p.status !== '交付').length;
      root.innerHTML = `
        ${pageHead({
          kicker: 'Projects / 项目',
          title: '项目看板',
          lede: `共 ${state.projects.length} 个项目 · ${active} 个进行中${overdue ? ` · ${overdue} 个已逾期` : ''}`,
          actions: `
            <div class="seg" role="group" aria-label="视图切换">
              <button type="button" class="seg-btn ${viewMode === 'board' ? 'is-on' : ''}" data-view="board" aria-pressed="${viewMode === 'board'}">${icon('grid', 15)} 看板</button>
              <button type="button" class="seg-btn ${viewMode === 'list' ? 'is-on' : ''}" data-view="list" aria-pressed="${viewMode === 'list'}">${icon('list', 15)} 列表</button>
            </div>
            <button type="button" class="btn btn-primary" data-new-project>${icon('plus', 16)} 新增项目</button>`
        })}
        <div class="toolbar">
          <div class="toolbar-search">
            ${icon('search', 17)}
            <input type="search" id="pj-search" placeholder="搜索项目、客户、标签…" value="${escapeHtml(filters.q)}" aria-label="搜索项目">
          </div>
          <div class="chip-row" role="group" aria-label="按类型筛选">
            ${['全部', ...TYPES].map(t => `<button type="button" class="chip ${filters.type === t ? 'is-on' : ''}" data-type="${escapeHtml(t)}" aria-pressed="${filters.type === t}">${escapeHtml(t)}</button>`).join('')}
          </div>
          <label class="select-wrap">
            <span class="sr-only">按状态筛选</span>
            <select id="pj-status" aria-label="按状态筛选">
              <option value="全部">全部状态</option>
              ${STATUSES.map(s => `<option value="${s}" ${filters.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="projects-body" id="projects-body"></div>
        <p class="list-note">提示：点击卡片可编辑；截止日期早于今天且未交付的项目会以朱红标出。</p>`;
      renderBody();
    }

    function renderBody() {
      const box = root.querySelector('#projects-body');
      if (!box) return;
      const list = filtered();
      const total = getState().projects.length;
      if (!total) {
        box.innerHTML = emptyState({
          title: '还没有项目',
          description: '把正在做的海报、画册、Logo 或包装记进来，截止日期会帮你盯住进度。',
          action: `<button type="button" class="btn btn-primary" data-new-project>${icon('plus', 16)} 新建第一个项目</button>`
        });
        return;
      }
      if (!list.length) {
        box.innerHTML = emptyState({
          title: '没有匹配的项目',
          description: '换个关键词，或把类型 / 状态筛选放宽一点。',
          action: `<button type="button" class="btn" data-clear-filters>清除筛选</button>`
        });
        return;
      }
      box.innerHTML = viewMode === 'board' ? boardHTML(list) : listHTML(list);
    }

    function boardHTML(list) {
      return `<div class="board">
        ${STATUSES.map(status => {
          const cards = list.filter(p => p.status === status);
          return `<section class="board-col" data-status="${status}" aria-labelledby="col-${status}">
            <header class="board-col-head">
              <h2 id="col-${status}">${status}</h2>
              <span class="board-count">${cards.length}</span>
            </header>
            <div class="board-cards">
              ${cards.length ? cards.map(cardHTML).join('') : `<p class="col-empty">暂无项目</p>`}
              ${status === '洽谈' ? `<button type="button" class="ghost-add" data-new-project>${icon('plus', 15)} 添加项目</button>` : ''}
            </div>
          </section>`;
        }).join('')}
      </div>`;
    }

    function cardHTML(p) {
      const due = dueInfo(p);
      const progress = clamp(p.progress, 0, 100);
      return `<article class="pj-card ${due.state === 'overdue' ? 'is-overdue' : ''}" data-card="${p.id}">
        <div class="pj-top">
          <span class="chip chip--type">${escapeHtml(p.type)}</span>
          ${p.sample ? '<span class="chip chip--tiny chip--sample">示例</span>' : ''}
          <span class="pj-actions">
            <button type="button" class="icon-btn" data-pj-edit="${p.id}" aria-label="编辑项目：${escapeHtml(p.title)}">${icon('edit', 15)}</button>
            <button type="button" class="icon-btn" data-pj-del="${p.id}" aria-label="删除项目：${escapeHtml(p.title)}">${icon('trash', 15)}</button>
          </span>
        </div>
        <h3 class="pj-title"><a href="#/projects/${p.id}" data-pj-open="${p.id}">${escapeHtml(p.title)}</a></h3>
        <p class="pj-client">${escapeHtml(p.client || '未填客户')}</p>
        <div class="pj-progress">
          <span class="progress-track"><span class="progress-fill" style="width:${progress}%"></span></span>
          <span class="progress-num">${progress}%</span>
        </div>
        <div class="pj-meta">
          <span class="due due--${due.state}">${escapeHtml(due.text)}</span>
          <span class="pj-revisions">改稿 ${Number(p.revisions) || 0} 次</span>
        </div>
        ${p.tags?.length ? `<div class="pj-tags">${p.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      </article>`;
    }

    function listHTML(list) {
      return `<div class="pj-table" role="list">
        <div class="pj-tr pj-th" role="presentation">
          <span>项目</span><span>客户</span><span>类型</span><span>状态</span><span>进度</span><span>截止</span><span class="sr-only">操作</span>
        </div>
        ${list.map(p => {
          const due = dueInfo(p);
          const progress = clamp(p.progress, 0, 100);
          return `<div class="pj-tr ${due.state === 'overdue' ? 'is-overdue' : ''}" role="listitem">
            <span class="pj-cell-main">
              <button type="button" class="text-btn" data-pj-open="${p.id}">${escapeHtml(p.title)}</button>
              ${p.sample ? '<span class="chip chip--tiny">示例</span>' : ''}
              <span class="pj-cell-sub">${escapeHtml(p.client || '未填客户')}</span>
            </span>
            <span class="pj-cell-client">${escapeHtml(p.client || '未填客户')}</span>
            <span><span class="chip chip--type">${escapeHtml(p.type)}</span></span>
            <span><span class="status-pill status-${escapeHtml(p.status)}">${escapeHtml(p.status)}</span></span>
            <span class="pj-cell-progress"><span class="progress-track"><span class="progress-fill" style="width:${progress}%"></span></span><span class="progress-num">${progress}%</span></span>
            <span class="due due--${due.state}">${escapeHtml(due.text)}</span>
            <span class="pj-cell-actions">
              <button type="button" class="icon-btn" data-pj-edit="${p.id}" aria-label="编辑项目：${escapeHtml(p.title)}">${icon('edit', 15)}</button>
              <button type="button" class="icon-btn" data-pj-del="${p.id}" aria-label="删除项目：${escapeHtml(p.title)}">${icon('trash', 15)}</button>
            </span>
          </div>`;
        }).join('')}
      </div>`;
    }

    function openEditor(id) {
      const state = getState();
      const p = id ? state.projects.find(x => x.id === id) : null;
      const value = {
        title: p?.title || '',
        client: p?.client || '',
        type: p?.type || '海报',
        status: p?.status || '洽谈',
        deadline: p?.deadline || shiftDate(todayISO(), 7),
        progress: p?.progress ?? 0,
        revisions: p?.revisions ?? 0,
        template: p?.template || '',
        tags: p?.tags?.join('，') || '',
        notes: p?.notes || ''
      };
      const api = openModal({
        kicker: 'Projects / 项目',
        title: p ? '编辑项目' : '新建项目',
        size: 'lg',
        body: `
          <form id="project-form" class="form" novalidate>
            <div class="form-grid">
              <label class="field field--full">
                <span class="field-label">项目标题 <em>必填</em></span>
                <input name="title" value="${escapeHtml(value.title)}" maxlength="60" required placeholder="例如：城市文化节主视觉" autofocus>
              </label>
              <label class="field">
                <span class="field-label">客户</span>
                <input name="client" value="${escapeHtml(value.client)}" maxlength="40" placeholder="客户名称">
              </label>
              <label class="field">
                <span class="field-label">类型</span>
                <select name="type">
                  ${TYPES.map(t => `<option value="${t}" ${value.type === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
              </label>
              <label class="field">
                <span class="field-label">状态</span>
                <select name="status">
                  ${STATUSES.map(s => `<option value="${s}" ${value.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </label>
              <label class="field">
                <span class="field-label">截止日期</span>
                <input type="date" name="deadline" value="${escapeHtml(value.deadline)}">
              </label>
              <label class="field">
                <span class="field-label">进度 <span class="field-value" data-progress-out>${value.progress}%</span></span>
                <input type="range" name="progress" min="0" max="100" step="5" value="${value.progress}" data-progress>
              </label>
              <label class="field">
                <span class="field-label">改稿次数</span>
                <input type="number" name="revisions" min="0" max="99" value="${value.revisions}">
              </label>
              <label class="field field--full">
                <span class="field-label">模板来源</span>
                <input name="template" value="${escapeHtml(value.template)}" maxlength="80" placeholder="例如：展览海报套版 / 自绘">
              </label>
              <label class="field field--full">
                <span class="field-label">标签（用逗号分隔）</span>
                <input name="tags" value="${escapeHtml(value.tags)}" maxlength="80" placeholder="主视觉，大标题">
              </label>
              <label class="field field--full">
                <span class="field-label">备注</span>
                <textarea name="notes" rows="3" maxlength="500" placeholder="客户偏好、印刷要求、待确认事项…">${escapeHtml(value.notes)}</textarea>
              </label>
            </div>
            <div class="form-actions">
              ${p ? `<button type="button" class="btn btn-danger-ghost" data-delete>删除项目</button>` : '<span></span>'}
              <span class="form-actions-right">
                <button type="button" class="btn" data-close>取消</button>
                <button type="submit" class="btn btn-primary">${p ? '保存修改' : '创建项目'}</button>
              </span>
            </div>
          </form>`,
        onMount(dialog) {
          const form = dialog.querySelector('#project-form');
          const progress = form.querySelector('[data-progress]');
          progress.addEventListener('input', () => {
            dialog.querySelector('[data-progress-out]').textContent = `${progress.value}%`;
          });
          form.addEventListener('submit', e => {
            e.preventDefault();
            const data = formValues(form);
            if (!data.title) {
              toast('项目标题不能为空', { type: 'warn' });
              form.querySelector('[name="title"]').focus();
              return;
            }
            const payload = {
              title: data.title,
              client: data.client || '',
              type: data.type,
              status: data.status,
              deadline: data.deadline || '',
              progress: clamp(data.progress, 0, 100),
              revisions: clamp(data.revisions, 0, 99),
              template: data.template || '',
              tags: data.tags.split(/[,，、]/).map(s => s.trim()).filter(Boolean).slice(0, 8),
              notes: data.notes || '',
              updatedAt: Date.now()
            };
            update(s => {
              if (p) {
                const target = s.projects.find(x => x.id === p.id);
                Object.assign(target, payload);
              } else {
                s.projects.unshift({
                  id: uid('pj'), ...payload, sample: false, createdAt: Date.now()
                });
              }
            });
            toast(p ? '项目已更新' : '项目已创建', { type: 'success' });
            api.close('saved');
          });
          const del = form.querySelector('[data-delete]');
          if (del) {
            del.addEventListener('click', async () => {
              const ok = await confirmDialog({
                title: '删除这个项目？',
                description: `「${p.title}」及其进度记录将从本机删除，此操作不可撤销。`,
                confirmText: '删除项目',
                danger: true
              });
              if (!ok) return;
              update(s => { s.projects = s.projects.filter(x => x.id !== p.id); });
              toast('项目已删除');
              api.close('deleted');
            });
          }
        }
      });
    }

    function onClick(e) {
      const viewBtn = e.target.closest('[data-view]');
      if (viewBtn) {
        viewMode = viewBtn.dataset.view;
        localStorage.setItem(VIEW_KEY, viewMode);
        root.querySelectorAll('[data-view]').forEach(b => {
          const on = b.dataset.view === viewMode;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', String(on));
        });
        renderBody();
        return;
      }
      if (e.target.closest('[data-new-project]')) {
        openEditor(null);
        return;
      }
      const typeBtn = e.target.closest('[data-type]');
      if (typeBtn) {
        filters.type = typeBtn.dataset.type;
        renderAll();
        return;
      }
      if (e.target.closest('[data-clear-filters]')) {
        filters.q = '';
        filters.type = '全部';
        filters.status = '全部';
        renderAll();
        return;
      }
      const edit = e.target.closest('[data-pj-edit]');
      if (edit) {
        e.stopPropagation();
        openEditor(edit.dataset.pjEdit);
        return;
      }
      const del = e.target.closest('[data-pj-del]');
      if (del) {
        e.stopPropagation();
        const p = getState().projects.find(x => x.id === del.dataset.pjDel);
        if (!p) return;
        confirmDialog({
          title: '删除项目？',
          description: `「${p.title}」会从看板中移除，此操作不可撤销。`,
          confirmText: '删除',
          danger: true
        }).then(ok => {
          if (!ok) return;
          update(s => { s.projects = s.projects.filter(x => x.id !== p.id); });
          toast('项目已删除');
        });
        return;
      }
      const open = e.target.closest('[data-pj-open]');
      if (open) {
        e.preventDefault();
        openEditor(open.dataset.pjOpen);
        return;
      }
      const card = e.target.closest('[data-card]');
      if (card) openEditor(card.dataset.card);
    }

    function onInput(e) {
      if (e.target.id !== 'pj-search') return;
      filters.q = e.target.value;
      renderBody();
    }

    function onChange(e) {
      if (e.target.id !== 'pj-status') return;
      filters.status = e.target.value;
      renderBody();
    }

    function onKeydown(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const row = e.target.closest('.pj-tr');
      const openBtn = e.target.closest('[data-pj-open], .text-btn');
      if (row && !openBtn && !e.target.closest('button')) {
        e.preventDefault();
        const titleBtn = row.querySelector('[data-pj-open]');
        if (titleBtn) openEditor(titleBtn.dataset.pjOpen);
      }
    }
  }
};
