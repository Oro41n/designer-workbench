// 作品集：设计 / 编程两个分区，封面本地上传（IndexedDB），筛选、精选与详情弹层
import { getState, subscribe, update } from '../store.js';
import { icon } from '../icons.js';
import { pageHead, openModal, confirmDialog, toast, formValues, emptyState } from '../ui.js';
import { escapeHtml, uid, clampText, safeUrl, hostOf } from '../util.js';
import { saveImage, deleteImage, getImageURL, hydrateImages } from '../images.js';

const SECTIONS = { design: '设计', code: '编程' };
const CATEGORIES = {
  design: ['海报', '画册', 'Logo', '包装', '其他'],
  code: ['Web', '编程练习', '其他']
};

export default {
  mount(root, ctx) {
    const filters = { section: 'design', category: '全部', featured: false };
    const ui = {};

    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeydown);
    const off = subscribe(() => renderAll());
    renderAll();

    if (ctx?.param) {
      const id = ctx.param;
      history.replaceState(null, '', '#/portfolio');
      setTimeout(() => {
        if (getState().portfolio.some(w => w.id === id)) openDetail(id);
      }, 0);
    }

    return { destroy: () => off() };

    function renderAll() {
      const state = getState();
      const counts = {
        design: state.portfolio.filter(w => w.section === 'design').length,
        code: state.portfolio.filter(w => w.section === 'code').length
      };
      root.innerHTML = `
        ${pageHead({
          kicker: 'Portfolio / 作品集',
          title: '作品集',
          lede: '设计成果与编程成果分开归档，方便按岗位投递。未上传封面时会显示抽象几何封面。',
          actions: `<button type="button" class="btn btn-primary" data-work-new>${icon('plus', 16)} 新增作品</button>`
        })}
        <div class="portfolio-tabs" role="tablist" aria-label="作品分区">
          ${Object.entries(SECTIONS).map(([key, label]) => `
            <button type="button" role="tab" class="ptab ${filters.section === key ? 'is-on' : ''}" data-section="${key}" aria-selected="${filters.section === key}">
              <span class="ptab-label">${label}</span>
              <span class="ptab-count">${counts[key]}</span>
            </button>`).join('')}
        </div>
        <div class="portfolio-filter">
          <div class="chip-row" role="group" aria-label="按分类筛选">
            ${['全部', ...CATEGORIES[filters.section]].map(c => `
              <button type="button" class="chip ${filters.category === c ? 'is-on' : ''}" data-category="${escapeHtml(c)}" aria-pressed="${filters.category === c}">${escapeHtml(c)}</button>`).join('')}
          </div>
          <button type="button" class="chip chip--star ${filters.featured ? 'is-on' : ''}" data-featured aria-pressed="${filters.featured}">${icon('star', 14)} 仅看精选</button>
        </div>
        <div id="portfolio-body"></div>
        <p class="list-note">封面图：建议 4:3 或 16:9，上传后自动压缩到长边 ≤ 1600px；图片只保存在本机 IndexedDB。</p>`;
      renderBody();
    }

    function currentList() {
      const state = getState();
      return state.portfolio
        .filter(w => w.section === filters.section)
        .filter(w => filters.category === '全部' || w.category === filters.category)
        .filter(w => !filters.featured || w.featured);
    }

    function renderBody() {
      const body = root.querySelector('#portfolio-body');
      if (!body) return;
      const all = getState().portfolio.filter(w => w.section === filters.section);
      if (!all.length) {
        body.innerHTML = emptyState({
          title: `${SECTIONS[filters.section]}分区还没有作品`,
          description: filters.section === 'design'
            ? '把海报、画册、Logo、包装的成品图传进来，写清你的角色与工具，就是一份可投递的作品集。'
            : '把写过的页面、小工具、练习题放进来，附上仓库或在线 demo 链接。',
          action: `<button type="button" class="btn btn-primary" data-work-new>${icon('plus', 16)} 添加${SECTIONS[filters.section]}作品</button>`
        });
        return;
      }
      const list = currentList();
      if (!list.length) {
        body.innerHTML = emptyState({
          title: '没有匹配的作品',
          description: '当前分类下暂无作品，试试切换分类或取消「仅看精选」。',
          action: `<button type="button" class="btn" data-reset-filters>清除筛选</button>`
        });
        return;
      }
      body.innerHTML = `<div class="work-grid">
        ${list.map(workCard).join('')}
      </div>`;
      hydrateImages(body);
    }

    function workCard(w) {
      return `<article class="work-card" data-work="${w.id}">
        <button type="button" class="cover cover--work" data-work-open="${w.id}" aria-label="查看作品：${escapeHtml(w.title)}">
          ${w.imageId
            ? `<img data-img="${w.imageId}" alt="${escapeHtml(w.title)} 封面" loading="lazy">`
            : `<img src="${escapeHtml(w.cover || 'assets/covers/poster.svg')}" alt="${escapeHtml(w.title)} 封面" loading="lazy">`}
          ${w.sample ? '<span class="sample-badge">示例</span>' : ''}
          ${w.featured ? `<span class="featured-badge" aria-label="精选">${icon('star', 12)} 精选</span>` : ''}
        </button>
        <div class="work-body">
          <p class="work-meta">${escapeHtml(w.category)} · ${escapeHtml(w.year || '—')}</p>
          <h3 class="work-title"><button type="button" class="text-btn" data-work-open="${w.id}">${escapeHtml(w.title)}</button></h3>
          <p class="work-role">${escapeHtml(w.role || '未填角色')}</p>
          ${w.summary ? `<p class="work-summary">${escapeHtml(clampText(w.summary, 64))}</p>` : ''}
          <div class="work-foot">
            <div class="work-tools">
              ${(w.tools || []).slice(0, 3).map(t => `<span class="tag tag--mono">${escapeHtml(t)}</span>`).join('')}
            </div>
            ${(w.links || []).filter(l => l.url).length ? `<span class="work-link-hint">${icon('link', 14)} ${(w.links || []).filter(l => l.url).length} 个链接</span>` : ''}
          </div>
        </div>
      </article>`;
    }

    function openDetail(id) {
      const w = getState().portfolio.find(x => x.id === id);
      if (!w) return;
      const links = (w.links || []).filter(l => l.url);
      const api = openModal({
        kicker: `${SECTIONS[w.section]} / ${w.category}`,
        title: w.title,
        size: 'lg',
        className: 'modal--work',
        body: `
          <div class="work-detail">
            <div class="work-detail-cover cover">
              ${w.imageId
                ? `<img data-img="${w.imageId}" alt="${escapeHtml(w.title)} 封面">`
                : `<img src="${escapeHtml(w.cover || 'assets/covers/poster.svg')}" alt="${escapeHtml(w.title)} 封面">`}
              ${w.sample ? '<span class="sample-badge">示例</span>' : ''}
              ${w.featured ? `<span class="featured-badge" aria-label="精选">${icon('star', 12)} 精选</span>` : ''}
            </div>
            <div class="detail-body">
              <dl class="detail-facts">
                <div><dt>年份</dt><dd>${escapeHtml(w.year || '—')}</dd></div>
                <div><dt>角色</dt><dd>${escapeHtml(w.role || '未填')}</dd></div>
                <div><dt>分类</dt><dd>${escapeHtml(w.category)}</dd></div>
                <div><dt>工具</dt><dd>${escapeHtml((w.tools || []).join(' / ') || '—')}</dd></div>
              </dl>
              <p class="work-detail-summary">${escapeHtml(w.summary || '还没有写简介。')}</p>
              ${w.sample ? '<p class="sample-note">这是一条示例作品，用来展示版式结构，不是真实项目。</p>' : ''}
              ${links.length ? `<div class="detail-links">
                ${links.map(l => `<a class="btn btn-sm" href="${escapeHtml(safeUrl(l.url))}" target="_blank" rel="noopener">${icon('link', 14)} ${escapeHtml(l.label || hostOf(l.url))} ${icon('arrow', 12)}</a>`).join('')}
              </div>` : ''}
            </div>
          </div>`,
        footer: `<button type="button" class="btn" data-close>关闭</button>
          <span class="form-actions-right">
            <button type="button" class="btn btn-danger-ghost" data-detail-del>删除</button>
            <button type="button" class="btn btn-primary" data-detail-edit>${icon('edit', 14)} 编辑</button>
          </span>`,
        onMount(dialog) {
          hydrateImages(dialog);
          dialog.querySelector('[data-detail-edit]').addEventListener('click', () => {
            api.close('edit');
            openEditor(w.id);
          });
          dialog.querySelector('[data-detail-del]').addEventListener('click', async () => {
            const ok = await confirmDialog({
              title: '删除这件作品？',
              description: `「${w.title}」会从作品集中移除，封面图片也会一并删除。`,
              confirmText: '删除作品',
              danger: true
            });
            if (!ok) return;
            if (w.imageId) deleteImage(w.imageId);
            update(s => { s.portfolio = s.portfolio.filter(x => x.id !== w.id); });
            toast('作品已删除');
            api.close('deleted');
          });
        }
      });
      hydrateImages(api.dialog);
    }

    function linkRowHTML(label = '', url = '') {
      return `<div class="link-row">
        <input data-link-label placeholder="链接名称，例如 Behance" value="${escapeHtml(label)}" maxlength="30" aria-label="链接名称">
        <input data-link-url placeholder="https://…" value="${escapeHtml(url)}" maxlength="200" aria-label="链接地址">
        <button type="button" class="icon-btn" data-link-del aria-label="移除外链">${icon('close', 15)}</button>
      </div>`;
    }

    function openEditor(id) {
      const w = id ? getState().portfolio.find(x => x.id === id) : null;
      let pendingImageId = null;
      let saved = false;
      const section = w?.section || filters.section;
      const categories = [...new Set([...CATEGORIES[section], ...(w?.category ? [w.category] : [])])];
      const api = openModal({
        kicker: 'Portfolio / 作品',
        title: w ? '编辑作品' : '新增作品',
        size: 'lg',
        body: `
          <form id="work-form" class="form" novalidate>
            <div class="form-grid">
              <label class="field">
                <span class="field-label">分区</span>
                <select name="section" data-section-select>
                  ${Object.entries(SECTIONS).map(([k, v]) => `<option value="${k}" ${section === k ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
              </label>
              <label class="field">
                <span class="field-label">分类</span>
                <select name="category" data-category-select>
                  ${categories.map(c => `<option value="${c}" ${w?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </label>
              <label class="field field--full">
                <span class="field-label">作品标题 <em>必填</em></span>
                <input name="title" value="${escapeHtml(w?.title || '')}" maxlength="60" required placeholder="例如：城市文化节主视觉" autofocus>
              </label>
              <label class="field">
                <span class="field-label">你的角色</span>
                <input name="role" value="${escapeHtml(w?.role || '')}" maxlength="40" placeholder="视觉设计 / 版式">
              </label>
              <label class="field">
                <span class="field-label">年份</span>
                <input name="year" value="${escapeHtml(w?.year || String(new Date().getFullYear()))}" maxlength="4" placeholder="2026">
              </label>
              <label class="field field--full">
                <span class="field-label">使用工具（逗号分隔）</span>
                <input name="tools" value="${escapeHtml((w?.tools || []).join('，'))}" maxlength="80" placeholder="Photoshop，Illustrator">
              </label>
              <label class="field field--full">
                <span class="field-label">简介</span>
                <textarea name="summary" rows="3" maxlength="300" placeholder="项目背景、你的解决方式、结果…">${escapeHtml(w?.summary || '')}</textarea>
              </label>
              <div class="field field--full">
                <span class="field-label">封面图</span>
                <div class="cover-upload">
                  <div class="cover-upload-preview" data-cover-preview>
                    ${w?.imageId
                      ? `<img data-img="${w.imageId}" alt="当前封面">`
                      : w?.cover ? `<img src="${escapeHtml(w.cover)}" alt="当前封面">` : `<span class="upload-empty">${icon('upload', 22)}<em>未选择封面</em></span>`}
                  </div>
                  <div class="cover-upload-meta">
                    <p>上传本地图片，自动压缩到长边 ≤ 1600px，存入本机 IndexedDB。</p>
                    <label class="btn btn-sm">${icon('upload', 14)} 选择图片
                      <input type="file" accept="image/*" data-cover-file hidden>
                    </label>
                    <span class="upload-status" data-upload-status></span>
                  </div>
                </div>
              </div>
              <div class="field field--full">
                <span class="field-label">外链（Behance / 站酷 / 仓库 / 在线 demo）</span>
                <div class="link-rows" data-link-rows></div>
                <button type="button" class="btn btn-sm" data-add-link>${icon('plus', 14)} 添加外链</button>
              </div>
              <label class="check-row field--full">
                <input type="checkbox" name="featured" ${w?.featured ? 'checked' : ''}>
                <span>标为精选（会出现在工作台首页）</span>
              </label>
            </div>
            <div class="form-actions">
              <span></span>
              <span class="form-actions-right">
                <button type="button" class="btn" data-close>取消</button>
                <button type="submit" class="btn btn-primary">${w ? '保存修改' : '添加作品'}</button>
              </span>
            </div>
          </form>`,
        onMount(dialog) {
          hydrateImages(dialog);
          const form = dialog.querySelector('#work-form');
          const rows = dialog.querySelector('[data-link-rows]');
          const links = (w?.links || []).filter(l => l.label || l.url);
          rows.innerHTML = (links.length ? links : [{ label: '', url: '' }]).map(l => linkRowHTML(l.label, l.url)).join('');

          dialog.querySelector('[data-add-link]').addEventListener('click', () => {
            rows.insertAdjacentHTML('beforeend', linkRowHTML());
            rows.lastElementChild.querySelector('input')?.focus();
          });
          rows.addEventListener('click', e => {
            const del = e.target.closest('[data-link-del]');
            if (del) del.closest('.link-row').remove();
          });

          dialog.querySelector('[data-section-select]').addEventListener('change', e => {
            const cat = dialog.querySelector('[data-category-select]');
            cat.innerHTML = CATEGORIES[e.target.value].map(c => `<option value="${c}">${c}</option>`).join('');
          });

          const file = dialog.querySelector('[data-cover-file]');
          const preview = dialog.querySelector('[data-cover-preview]');
          const status = dialog.querySelector('[data-upload-status]');
          file.addEventListener('change', async () => {
            const f = file.files?.[0];
            if (!f) return;
            status.textContent = '压缩并保存中…';
            file.setAttribute('disabled', 'disabled');
            try {
              const res = await saveImage(f, 1600);
              pendingImageId = res.id;
              preview.innerHTML = `<img src="${res.url}" alt="封面预览">`;
              status.textContent = `已压缩 · ${res.width} × ${res.height}px`;
              toast('封面已压缩并保存到本机');
            } catch (err) {
              console.error(err);
              status.textContent = '上传失败，请换一张图片试试';
              toast('图片处理失败', { type: 'warn' });
            } finally {
              file.removeAttribute('disabled');
              file.value = '';
            }
          });

          form.addEventListener('submit', e => {
            e.preventDefault();
            const data = formValues(form);
            if (!data.title) {
              toast('作品标题不能为空', { type: 'warn' });
              form.querySelector('[name="title"]').focus();
              return;
            }
            const nextLinks = [...rows.querySelectorAll('.link-row')].map(row => ({
              label: row.querySelector('[data-link-label]').value.trim(),
              url: safeUrl(row.querySelector('[data-link-url]').value.trim())
            })).filter(l => l.url).slice(0, 4);
            const payload = {
              section: data.section,
              category: data.category,
              title: data.title,
              role: data.role || '',
              year: data.year || '',
              tools: data.tools.split(/[,，、]/).map(s => s.trim()).filter(Boolean).slice(0, 6),
              summary: data.summary || '',
              featured: Boolean(data.featured),
              links: nextLinks,
              imageId: pendingImageId || w?.imageId || null
            };
            update(s => {
              if (w) {
                const target = s.portfolio.find(x => x.id === w.id);
                Object.assign(target, payload);
              } else {
                s.portfolio.unshift({
                  id: uid('work'), ...payload, cover: '', sample: false, createdAt: Date.now()
                });
              }
            });
            if (pendingImageId && w?.imageId && pendingImageId !== w.imageId) deleteImage(w.imageId);
            saved = true;
            toast(w ? '作品已更新' : '作品已添加', { type: 'success' });
            api.close('saved');
          });
        },
        onClose() {
          if (pendingImageId && !saved) deleteImage(pendingImageId);
        }
      });
      hydrateImages(api.dialog);
    }

    function onClick(e) {
      if (e.target.closest('[data-work-new]')) {
        openEditor(null);
        return;
      }
      const sec = e.target.closest('[data-section]');
      if (sec) {
        filters.section = sec.dataset.section;
        filters.category = '全部';
        renderAll();
        return;
      }
      const cat = e.target.closest('[data-category]');
      if (cat) {
        filters.category = cat.dataset.category;
        renderAll();
        return;
      }
      if (e.target.closest('[data-featured]')) {
        filters.featured = !filters.featured;
        renderAll();
        return;
      }
      if (e.target.closest('[data-reset-filters]')) {
        filters.category = '全部';
        filters.featured = false;
        renderAll();
        return;
      }
      const open = e.target.closest('[data-work-open]');
      if (open) {
        e.preventDefault();
        openDetail(open.dataset.workOpen);
        return;
      }
      const card = e.target.closest('[data-work]');
      if (card) openDetail(card.dataset.work);
    }

    function onKeydown(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('[data-work]');
      if (card && e.target === card) {
        e.preventDefault();
        openDetail(card.dataset.work);
      }
    }
  }
};
