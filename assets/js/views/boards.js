// 画板架：画板列表、缩略图、新建 / 重命名 / 复制 / 删除
import { icon } from '../icons.js';
import { pageHead, openModal, confirmDialog, toast } from '../ui.js';
import { escapeHtml, timeAgo } from '../util.js';
import { getImageURL } from '../images.js';
import { previewSVG } from '../board-render.js';
import {
  PRESETS, listBoards, ensureSampleBoard, createBoardRecord, putBoard,
  duplicateBoard, removeBoard
} from '../boards.js';

export default {
  mount(root, ctx) {
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    let boards = [];
    let query = '';
    let loaded = false;

    load();

    if (ctx?.param === 'new') {
      history.replaceState(null, '', '#/boards');
      setTimeout(() => openCreate(), 30);
    }

    async function load() {
      await ensureSampleBoard();
      boards = await listBoards();
      loaded = true;
      render();
    }

    function filtered() {
      const q = query.trim().toLowerCase();
      if (!q) return boards;
      return boards.filter(b => [b.name, `${b.width}×${b.height}`].join(' ').toLowerCase().includes(q));
    }

    function render() {
      const list = filtered();
      root.innerHTML = `
        ${pageHead({
          kicker: 'Press sheets / 画板',
          title: '画板架',
          lede: '无限画布上的印前试验：矩形、文字、图片、对齐与吸附，做完直接导出 PNG 或 SVG。每个画板独立保存在本机。',
          actions: `<button type="button" class="btn btn-primary" data-new-board>${icon('plus', 16)} 新建画板</button>`
        })}
        <div class="toolbar">
          <div class="toolbar-search">
            ${icon('search', 17)}
            <input type="search" id="board-search" placeholder="搜索画板名称或尺寸…" value="${escapeHtml(query)}" aria-label="搜索画板">
          </div>
          <span class="board-total">${boards.length} 张画板 · ${loaded ? '本地已同步' : '读取中…'}</span>
        </div>
        <div class="boards-grid" id="boards-grid">
          ${loaded ? (list.length ? list.map((b, i) => boardCard(b, i)).join('') : emptyBoards()) : `<p class="panel-empty">正在读取画板…</p>`}
        </div>`;
      hydratePreviewImages(list);
    }

    function boardCard(b, i) {
      const count = (b.objects || []).length;
      return `<article class="board-card" data-board-card="${b.id}">
        <a class="board-thumb" href="#/board/${b.id}" aria-label="打开画板：${escapeHtml(b.name)}">
          <span class="board-sheet">${previewSVG(b)}</span>
          <span class="board-no">PRESS ${String(i + 1).padStart(2, '0')}</span>
          ${b.sample ? '<span class="sample-badge">示例</span>' : ''}
        </a>
        <div class="board-info">
          <div class="board-title-line">
            <a class="board-title" href="#/board/${b.id}">${escapeHtml(b.name)}</a>
            <span class="board-dims">${b.width} × ${b.height}</span>
          </div>
          <p class="board-sub">${count} 个对象 · ${timeAgo(b.updatedAt)} · ${escapeHtml(b.bg)}</p>
          <div class="board-actions">
            <a class="btn btn-sm" href="#/board/${b.id}">打开画板 ${icon('arrow', 12)}</a>
            <button type="button" class="icon-btn" data-board-duplicate="${b.id}" aria-label="复制画板：${escapeHtml(b.name)}" title="复制">${icon('copy', 15)}</button>
            <button type="button" class="icon-btn" data-board-rename="${b.id}" aria-label="重命名画板：${escapeHtml(b.name)}" title="重命名">${icon('edit', 15)}</button>
            <button type="button" class="icon-btn" data-board-delete="${b.id}" aria-label="删除画板：${escapeHtml(b.name)}" title="删除">${icon('trash', 15)}</button>
          </div>
        </div>
      </article>`;
    }

    function emptyBoards() {
      return `<div class="empty boards-empty">
        <div class="empty-art" aria-hidden="true">
          <svg viewBox="0 0 120 84" width="120" height="84"><rect x="8" y="8" width="104" height="68" stroke="currentColor" fill="none" opacity=".45"/><path d="M8 20h104M8 56h104" stroke="currentColor" opacity=".2"/><path d="M30 8v68M90 8v68" stroke="currentColor" opacity=".2"/><rect x="30" y="20" width="60" height="26" fill="currentColor" opacity=".12"/><circle cx="76" cy="58" r="8" stroke="currentColor" fill="none" opacity=".6"/></svg>
        </div>
        <h3>${query ? '没有匹配的画板' : '还没有画板'}</h3>
        <p>${query ? '换个关键词，或清空搜索。' : '新建一张画板，选好尺寸后就能在无限画布上排版。'}</p>
        <button type="button" class="btn btn-primary" data-new-board>${icon('plus', 15)} 新建画板</button>
      </div>`;
    }

    async function hydratePreviewImages(list) {
      const jobs = list.map(async b => {
        const ids = [...new Set((b.objects || []).filter(o => o.type === 'image' && o.imageId).map(o => o.imageId))];
        if (!ids.length) return;
        const urls = {};
        await Promise.all(ids.map(async id => { const url = await getImageURL(id); if (url) urls[id] = url; }));
        const card = root.querySelector(`[data-board-card="${b.id}"] .board-sheet`);
        if (card) card.innerHTML = previewSVG(b, { imageUrls: urls });
      });
      await Promise.all(jobs);
    }

    function onInput(e) {
      if (!e.target.matches('#board-search')) return;
      query = e.target.value;
      render();
      const input = root.querySelector('#board-search');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }

    function find(id) { return boards.find(b => b.id === id); }

    function openCreate() {
      const body = `
        <p class="form-hint" style="margin-bottom:14px">先定纸张，再开始排版。尺寸之后还能在属性面板里改。</p>
        <div class="preset-grid" role="radiogroup" aria-label="画板尺寸">
          ${PRESETS.map((p, i) => `<button type="button" class="preset-card ${p.id === 'square' ? 'is-on' : ''}" data-preset="${p.id}" role="radio" aria-checked="${p.id === 'square'}">
            <span class="preset-ratio" data-ratio="${p.width / p.height}" aria-hidden="true"><i></i></span>
            <span class="preset-label">${escapeHtml(p.label)}</span>
            <span class="preset-sub">${escapeHtml(p.sub)}</span>
          </button>`).join('')}
        </div>
        <div class="form-grid" style="margin-top:16px">
          <label class="field"><span class="field-label">画板名称</span><input name="name" maxlength="40" value="未命名画板" data-create-name></label>
          <label class="field"><span class="field-label">纸张底色</span><input name="bg" type="color" value="#F6F1E4" data-create-bg></label>
          <label class="field" data-custom-field><span class="field-label">宽度 px</span><input name="width" type="number" min="64" max="8000" value="1200" data-create-width></label>
          <label class="field" data-custom-field><span class="field-label">高度 px</span><input name="height" type="number" min="64" max="8000" value="800" data-create-height></label>
        </div>`;
      let preset = 'square';
      const api = openModal({
        kicker: 'New sheet / 新画板',
        title: '新建画板',
        body,
        size: 'lg',
        footer: `<button type="button" class="btn" data-close>取消</button><button type="button" class="btn btn-primary" data-create-confirm>${icon('plus', 15)} 创建并打开</button>`,
        onMount(dialog) {
          const nameInput = dialog.querySelector('[data-create-name]');
          const bgInput = dialog.querySelector('[data-create-bg]');
          const widthInput = dialog.querySelector('[data-create-width]');
          const heightInput = dialog.querySelector('[data-create-height]');
          const customFields = [...dialog.querySelectorAll('[data-custom-field]')];
          const setPreset = id => {
            preset = id;
            dialog.querySelectorAll('[data-preset]').forEach(btn => {
              const on = btn.dataset.preset === id;
              btn.classList.toggle('is-on', on);
              btn.setAttribute('aria-checked', String(on));
            });
            const p = PRESETS.find(x => x.id === id);
            customFields.forEach(el => { el.style.display = id === 'custom' ? '' : 'none'; });
            if (p && id !== 'custom') {
              widthInput.value = p.width;
              heightInput.value = p.height;
            }
          };
          dialog.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', () => setPreset(btn.dataset.preset)));
          setPreset('square');
          nameInput.focus();
          nameInput.select();
          dialog.querySelector('[data-create-confirm]').addEventListener('click', async () => {
            const name = nameInput.value.trim() || '未命名画板';
            const width = Math.max(64, Math.min(8000, Number(widthInput.value) || 1080));
            const height = Math.max(64, Math.min(8000, Number(heightInput.value) || 1350));
            const board = createBoardRecord({ name, width, height, bg: bgInput.value || '#F6F1E4' });
            board.objects = [];
            await putBoard(board);
            api.close();
            toast(`画板「${name}」已创建`, { type: 'success' });
            location.hash = `#/board/${board.id}`;
          });
        }
      });
    }

    async function onClick(e) {
      if (e.target.closest('[data-new-board]')) { openCreate(); return; }
      const dup = e.target.closest('[data-board-duplicate]');
      if (dup) {
        const copy = await duplicateBoard(dup.dataset.boardDuplicate);
        if (copy) {
          boards = await listBoards();
          render();
          toast(`已复制为「${copy.name}」`, { type: 'success' });
        }
        return;
      }
      const ren = e.target.closest('[data-board-rename]');
      if (ren) {
        const board = find(ren.dataset.boardRename);
        if (!board) return;
        openModal({
          title: '重命名画板',
          size: 'sm',
          body: `<label class="field"><span class="field-label">画板名称</span><input name="name" maxlength="40" value="${escapeHtml(board.name)}" data-rename-input></label>`,
          footer: `<button type="button" class="btn" data-close>取消</button><button type="button" class="btn btn-primary" data-rename-save>保存</button>`,
          onMount(dialog, api) {
            const input = dialog.querySelector('[data-rename-input]');
            input.focus(); input.select();
            const save = async () => {
              const name = input.value.trim();
              if (!name) { input.focus(); return; }
              board.name = name;
              await putBoard(board);
              api.close();
              boards = await listBoards();
              render();
              toast('画板已重命名');
            };
            dialog.querySelector('[data-rename-save]').addEventListener('click', save);
            input.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); save(); } });
          }
        });
        return;
      }
      const del = e.target.closest('[data-board-delete]');
      if (del) {
        const board = find(del.dataset.boardDelete);
        if (!board) return;
        const ok = await confirmDialog({
          title: '删除画板？',
          description: `「${board.name}」及其中的所有对象会从本机删除，无法恢复。`,
          confirmText: '删除画板',
          danger: true
        });
        if (!ok) return;
        await removeBoard(board.id);
        boards = await listBoards();
        render();
        toast('画板已删除');
      }
    }
  }
};
