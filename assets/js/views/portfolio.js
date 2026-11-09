// 作品集 v4.1「3D 画廊」：真实相机沿 X 轴穿过一组不同深度的画框
// 点作品相机飞近，详情以整屏层接管；Esc 退回。移动端与 reduced-motion 退回纵向网格。
import { getState, subscribe, update } from '../store.js';
import { icon } from '../icons.js';
import { openModal, confirmDialog, toast, formValues, emptyState } from '../ui.js';
import { escapeHtml, uid, clampText, safeUrl, hostOf } from '../util.js';
import { saveImage, deleteImage, hydrateImages, getImageURL } from '../images.js';
import { createCam3D } from '../cam3d.js';

const SECTIONS = { design: '设计', code: '编程' };
const CATEGORIES = {
  design: ['海报', '画册', 'Logo', '包装', '其他'],
  code: ['Web', '编程练习', '其他']
};
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default {
  mount(root, ctx) {
    const filters = { section: 'design', category: '全部', featured: false };
    let cam = null;
    let raf = 0;
    let lastTime = 0;
    let journeyTop = 0;
    let journeySpan = 1;
    let progress = -1;
    let activeIndex = -1;
    let detail = null;
    let detailKeyHandler = null;
    let detailFromFly = false;
    let flying = false;
    let flyTimer = 0;
    let readyCount = 0;
    let destroyed = false;
    let currentWorks = [];
    let lastHud = 0;
    const staticMode = reducedMotion() || window.matchMedia('(max-width: 900px)').matches;

    root.addEventListener('click', onClick);
    const off = subscribe(() => renderAll());
    renderAll();

    if (ctx?.param) {
      const id = ctx.param;
      history.replaceState(null, '', '#/portfolio');
      setTimeout(() => {
        if (getState().portfolio.some(w => w.id === id)) openDetail(id, { fly: false });
      }, 0);
    }

    return {
      destroy() {
        destroyed = true;
        off();
        root.removeEventListener('click', onClick);
        cancelAnimationFrame(raf);
        clearTimeout(flyTimer);
        cam?.destroy();
        closeDetail(true);
      }
    };

    /* ---------------- 页面结构 ---------------- */

    function renderAll() {
      closeDetail(true);
      destroyScene();
      const state = getState();
      const counts = {
        design: state.portfolio.filter(w => w.section === 'design').length,
        code: state.portfolio.filter(w => w.section === 'code').length
      };
      const list = currentList();
      const total = counts.design + counts.code;
      currentWorks = list;

      root.innerHTML = `
        <section class="pf3-intro">
          <div>
            <div class="pf3-head">
              <div>
                <p class="cam-kicker"><span>01</span> Portfolio / 作品集</p>
                <h1 class="pf3-title" aria-label="作品集">
                  <span>作品</span>
                  <span class="pf3-title--b">集<em>${total}</em></span>
                </h1>
              </div>
              <button type="button" class="btn btn-primary" data-work-new>${icon('plus', 16)} 新增作品</button>
            </div>

            <p class="pf3-lede">桌面端是一条真实的 3D 画廊：作品是不同深度的画框，滚动只推进相机。
              点开任意作品，镜头先飞近画框，再由整屏详情接管；按 Esc 退回画廊。
              手机与 reduced-motion 自动退回纵向��读。</p>

            <div class="pf-controls">
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
            </div>
            <p class="pf-note">封面建议 4:3 或 16:9；上传后自动压缩到长边 ≤ 1600px，图片只保存在本机 IndexedDB。</p>
          </div>
        </section>

        ${list.length ? sceneHTML(list) : `
        <section class="pf3-empty">
          ${emptyState({
            title: `${SECTIONS[filters.section]}分区还没有作品`,
            description: filters.section === 'design'
              ? '把海报、画册、Logo、包装的成品图传进来，写清你的角色与工具，就是一份可投递的作品集。'
              : '把写过的页面、小工具、练习题放进来，附上仓库或在线 demo 链接。',
            action: `<button type="button" class="btn btn-primary" data-work-new>${icon('plus', 16)} 添加${SECTIONS[filters.section]}作品</button>`
          })}
        </section>`}
      `;

      hydrateImages(root);
      if (list.length) initScene();
      window.dispatchEvent(new CustomEvent('dw:view-rendered'));
    }

    function sceneHTML(list) {
      return `
      <section class="pf3-journey ${staticMode ? 'is-static' : ''}" data-journey style="--n:${list.length}">
        <div class="pf3-stage">
          <canvas class="pf3-canvas" data-cam aria-hidden="true"></canvas>
          <div class="pf3-shade" aria-hidden="true"></div>
          <div class="pf3-loading" data-loading>相机装填中 · 正在取封面</div>
          <div class="cam-perf" data-perf hidden></div>

          <header class="pf3-headline">
            <div>
              <p class="cam-kicker"><span>02</span> Spatial index</p>
              <h2>${SECTIONS[filters.section]} / ${filters.category === '全部' ? '全部作品' : escapeHtml(filters.category)}</h2>
            </div>
            <p>Move camera →</p>
          </header>

          <div class="pf3-caption" data-caption aria-live="polite"></div>

          <div class="pf3-static">
            ${list.map((w, i) => staticCard(w, i, list.length)).join('')}
          </div>

          <div class="pf3-hint">Click<br>a frame</div>
          <footer class="pf3-foot">
            <span>滚动推进相机</span>
            <div class="pf3-bar"><i data-bar></i></div>
            <span>${String(list.length).padStart(2, '0')} works · Esc 退回</span>
          </footer>
        </div>
      </section>`;
    }

    function staticCard(w, i, total) {
      return `<button type="button" class="pf3-card" data-work-open="${w.id}" aria-label="查看作品：${escapeHtml(w.title)}">
        <figure>
          ${w.imageId
            ? `<img data-img="${w.imageId}" alt="${escapeHtml(w.title)} 封面">`
            : `<img src="${escapeHtml(w.cover || 'assets/covers/poster.svg')}" alt="${escapeHtml(w.title)} 封面" loading="${i < 3 ? 'eager' : 'lazy'}">`}
        </figure>
        <h3>${escapeHtml(w.title)}</h3>
        <p>${escapeHtml(w.category)} · ${escapeHtml(w.year || '—')} · ${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</p>
      </button>`;
    }

    function currentList() {
      const state = getState();
      return state.portfolio
        .filter(w => w.section === filters.section)
        .filter(w => filters.category === '全部' || w.category === filters.category)
        .filter(w => !filters.featured || w.featured);
    }

    function coverURL(w) {
      if (w.imageId) return getImageURL(w.imageId).catch(() => '');
      return Promise.resolve(w.cover || 'assets/covers/poster.svg');
    }

    /* ---------------- 3D 画廊 ---------------- */

    function initScene() {
      const journey = root.querySelector('[data-journey]');
      const canvas = root.querySelector('[data-cam]');
      if (!journey || staticMode) {
        journey?.classList.add('is-ready');
        updateCaption(0);
        return;
      }

      cam = createCam3D(canvas, {
        fogNear: 2,
        fogFar: 17,
        onFail: () => {
          cam = null;
          journey.classList.add('is-static');
          journey.classList.add('is-ready');
        }
      });
      if (!cam?.ok) {
        cam = null;
        journey.classList.add('is-static');
        journey.classList.add('is-ready');
        return;
      }
      cam.setPalette(currentColorsSafe());
      cam.setCamera({ x: 0, y: 0, z: 5.6 }, { instant: true });

      const n = currentWorks.length;
      const spacing = n > 1 ? Math.min(4.8, 16 / (n - 1)) : 0;
      const width = spacing * (n - 1);
      const ready = () => {
        readyCount++;
        if (readyCount >= Math.min(3, n)) journey.classList.add('is-ready');
      };

      currentWorks.forEach((w, i) => {
        const z = i % 2 ? -1.3 : 0.5;
        coverURL(w).then(url => {
          if (destroyed || !cam) return;
          cam.addPlane({
            id: `g-${w.id}`,
            url,
            x: i * spacing - width / 2,
            y: i % 2 ? 0.18 : -0.12,
            z,
            w: 4.6, h: 3.4,
            border: true,
            data: { work: w, index: i },
            onReady: ready
          });
        });
      });

      measure();
      setTimeout(() => journey.classList.add('is-ready'), 3200);

      canvas.addEventListener('click', e => {
        if (flying) return;
        const plane = cam?.hitTest(e.clientX, e.clientY);
        const work = plane?.data?.work;
        if (work) startFly(work, plane);
      });
      canvas.addEventListener('pointermove', e => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = -((e.clientY / window.innerHeight) * 2 - 1);
        cam?.setPointer(nx, ny);
      });
      canvas.addEventListener('pointerleave', () => cam?.setPointer(0, 0));

      if (new URLSearchParams(location.search).has('perf')) {
        const hud = root.querySelector('[data-perf]');
        if (hud) hud.hidden = false;
      }

      startLoop();
      updateCaption(0);
    }

    function currentColorsSafe() {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      const accent2 = getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim();
      return { bg, ink, accent, accent2 };
    }

    function measure() {
      const journey = root.querySelector('[data-journey]');
      if (!journey) return;
      journeyTop = journey.getBoundingClientRect().top + window.scrollY;
      journeySpan = Math.max(1, journey.offsetHeight - window.innerHeight);
    }

    function startLoop() {
      const tick = now => {
        if (destroyed) return;
        const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016;
        lastTime = now;
        if (!flying) updateJourney();
        if (cam) {
          const stats = cam.frame(dt);
          if (now - lastHud > 700) {
            lastHud = now;
            const hud = root.querySelector('[data-perf]');
            if (hud && !hud.hidden) hud.textContent = `FPS ${stats.fps} · DRAW ${stats.drawcalls} · PLANES ${stats.planes}`;
            window.__camStats = cam.stats();
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    function updateJourney() {
      const journey = root.querySelector('[data-journey]');
      if (!journey) return;
      const p = Math.min(1, Math.max(0, (window.scrollY - journeyTop) / journeySpan));
      if (Math.abs(p - progress) < 0.0008) return;
      progress = p;
      const bar = root.querySelector('[data-bar]');
      if (bar) bar.style.transform = `scaleX(${p})`;

      const n = currentWorks.length;
      if (!n) return;
      const spacing = n > 1 ? Math.min(4.8, 16 / (n - 1)) : 0;
      const width = spacing * (n - 1);
      cam?.setCamera({ x: -width / 2 + p * width, y: 0, z: 5.6 });

      const idx = Math.max(0, Math.min(n - 1, Math.round(p * (n - 1))));
      updateCaption(idx);
    }

    function updateCaption(idx) {
      if (idx === activeIndex) return;
      activeIndex = idx;
      const w = currentWorks[idx];
      const cap = root.querySelector('[data-caption]');
      if (!cap || !w) return;
      cap.innerHTML = `<h3>${escapeHtml(w.title)}</h3><p>${escapeHtml(w.category)} · ${escapeHtml(w.year || '—')} · ${String(idx + 1).padStart(2, '0')} / ${String(currentWorks.length).padStart(2, '0')}</p>`;
    }

    function startFly(work, plane) {
      flying = true;
      detailFromFly = true;
      document.body.classList.add('is-pf-detail');
      cam?.setCamera({ x: plane.x, y: plane.y, z: plane.z + 2.4 });
      flyTimer = setTimeout(() => {
        if (destroyed) return;
        flying = false;
        openDetail(work.id, { fly: false, fromFly: true });
      }, 720);
    }

    function restoreCamera() {
      const journey = root.querySelector('[data-journey]');
      if (!cam || !journey) return;
      measure();
      const p = Math.min(1, Math.max(0, (window.scrollY - journeyTop) / journeySpan));
      const n = currentWorks.length;
      const spacing = n > 1 ? Math.min(4.8, 16 / (n - 1)) : 0;
      const width = spacing * (n - 1);
      cam.setCamera({ x: -width / 2 + p * width, y: 0, z: 5.6 });
    }

    function destroyScene() {
      cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(flyTimer);
      flying = false;
      cam?.destroy();
      cam = null;
      progress = -1;
      activeIndex = -1;
      readyCount = 0;
    }

    /* ---------------- 整屏详情 ---------------- */

    function openDetail(id, opts = {}) {
      closeDetail(true);
      const w = getState().portfolio.find(x => x.id === id);
      if (!w) return;
      const links = (w.links || []).filter(l => l.url);
      const all = getState().portfolio.filter(x => x.section === w.section);
      const idx = all.findIndex(x => x.id === w.id);
      const sectionLabel = SECTIONS[w.section] || w.section;
      detailFromFly = Boolean(opts.fromFly);

      detail = document.createElement('div');
      detail.className = 'pf-detail';
      detail.id = 'pf-detail';
      detail.setAttribute('role', 'dialog');
      detail.setAttribute('aria-modal', 'true');
      detail.setAttribute('aria-label', `${w.title} 详情`);
      detail.innerHTML = `
        <div class="pf-detail-inner">
          <figure class="pf-detail-media">
            <div class="pf-detail-img">
              ${w.imageId
                ? `<img data-img="${w.imageId}" alt="${escapeHtml(w.title)} 封面">`
                : `<img src="${escapeHtml(w.cover || 'assets/covers/poster.svg')}" alt="${escapeHtml(w.title)} 封面">`}
            </div>
            <span class="pf-detail-stamp">${sectionLabel} / ${escapeHtml(w.category)} · ${String(Math.max(0, idx) + 1).padStart(2, '0')} — ${String(all.length).padStart(2, '0')}</span>
          </figure>

          <div class="pf-detail-body">
            <button type="button" class="pf-detail-close" data-detail-close>关闭 · Esc</button>
            <p class="pf-detail-kicker">Portfolio / ${escapeHtml(w.category)} / ${escapeHtml(w.year || '—')}</p>
            <h2 class="pf-detail-title">${escapeHtml(w.title)}</h2>
            <dl class="pf-detail-facts">
              <div><dt>年份</dt><dd>${escapeHtml(w.year || '—')}</dd></div>
              <div><dt>角色</dt><dd>${escapeHtml(w.role || '未填')}</dd></div>
              <div><dt>分类</dt><dd>${escapeHtml(w.category)}</dd></div>
              <div><dt>工具</dt><dd>${escapeHtml((w.tools || []).join(' / ') || '—')}</dd></div>
            </dl>
            <p class="pf-detail-summary">${escapeHtml(w.summary || '还没有写简介。')}</p>
            ${w.sample ? '<p class="pf-detail-kicker">示例作品，仅用于展示版式结构，不是真实项目。</p>' : ''}
            ${links.length ? `<div class="pf-detail-links">
              ${links.map(l => `<a class="btn btn-sm" href="${escapeHtml(safeUrl(l.url))}" target="_blank" rel="noopener">${icon('link', 14)} ${escapeHtml(l.label || hostOf(l.url))} ${icon('arrow', 12)}</a>`).join('')}
            </div>` : ''}
            <div class="pf-detail-actions">
              <button type="button" class="btn btn-danger-ghost" data-detail-del>删除</button>
              <button type="button" class="btn btn-primary" data-detail-edit>${icon('edit', 14)} 编辑</button>
            </div>
          </div>
        </div>`;

      document.body.appendChild(detail);
      document.body.classList.add('is-pf-detail');
      hydrateImages(detail);

      requestAnimationFrame(() => detail.classList.add('is-open'));
      detail.querySelector('[data-detail-close]').focus({ preventScroll: true });

      detail.querySelector('[data-detail-close]').addEventListener('click', () => closeDetail());
      detail.querySelector('[data-detail-edit]').addEventListener('click', () => {
        closeDetail(true);
        openEditor(w.id);
      });
      detail.querySelector('[data-detail-del]').addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: '删除这件作品？',
          description: `「${w.title}」会从作品集中移除，封面图片也会一并删除。`,
          confirmText: '删除作品',
          danger: true
        });
        if (!ok) return;
        if (w.imageId) deleteImage(w.imageId);
        closeDetail(true);
        update(s => { s.portfolio = s.portfolio.filter(x => x.id !== w.id); });
        toast('作品已删除');
      });

      detailKeyHandler = e => {
        if (e.key === 'Escape') closeDetail();
      };
      document.addEventListener('keydown', detailKeyHandler);
    }

    function closeDetail(instant = false) {
      if (detailKeyHandler) {
        document.removeEventListener('keydown', detailKeyHandler);
        detailKeyHandler = null;
      }
      document.body.classList.remove('is-pf-detail');
      const fromFly = detailFromFly;
      detailFromFly = false;
      if (!detail) {
        if (fromFly) restoreCamera();
        return;
      }
      const node = detail;
      detail = null;
      node.classList.remove('is-open');
      if (instant) {
        node.remove();
      } else {
        setTimeout(() => node.remove(), 860);
        restoreCamera();
      }
    }

    /* ---------------- 编辑器（保留原有表单） ---------------- */

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
                <span>标为精选（会出现在首页场景里）</span>
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

    /* ---------------- 事件 ---------------- */

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
      const open = e.target.closest('[data-work-open]');
      if (open) {
        e.preventDefault();
        openDetail(open.dataset.workOpen, { fly: false });
      }
    }
  }
};
