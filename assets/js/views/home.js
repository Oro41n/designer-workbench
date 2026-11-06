// 首页 v3：程序化影像层 + 图流 + 从图片取色驱动全站主题
import { getState, subscribe, } from '../store.js';
import { icon } from '../icons.js';
import { escapeHtml, formatCN, todayISO, weekDates } from '../util.js';
import { hydrateImages } from '../images.js';
import { countBoards } from '../boards.js';
import { loadFeed, loadBitmap } from '../feed/index.js';
import { applyImagePalette, applyPalette, extractPalette, paletteFromClusters, currentColors, onPalette } from '../theme-engine.js';
import { createInkField } from '../ink-field.js';

const ART = {
  '海报': 'assets/img/work-poster.webp',
  '画册': 'assets/img/work-brochure.webp',
  '包装': 'assets/img/work-packaging.webp',
  'Logo': 'assets/img/work-identity.webp',
  'Web': 'assets/img/work-web.webp',
  '编程练习': 'assets/img/work-web.webp'
};

const STILLS = [
  { src: 'assets/img/work-poster.webp', a: '01 / 城市文化节', b: 'Poster · 2025' },
  { src: 'assets/img/work-packaging.webp', a: '02 / 明月 · 礼盒', b: 'Packaging · 2024' },
  { src: 'assets/img/work-brochure.webp', a: '03 / 山茶研究所', b: 'Editorial · 2025' }
];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function thumbOf(src = '') {
  return src.replace(/w=1400/g, 'w=460').replace(/w=1600/g, 'w=460');
}

export default {
  mount(root, ctx = {}) {
    let feed = null;
    let boardCount = 0;
    let off = null;
    let field = null;
    let clockTimer = 0;
    let raf = 0;
    let destroyed = false;
    let activeIndex = 0;
    let palettes = [];
    let offPalette = null;
    const cleanups = [];

    render();
    off = subscribe(() => refreshStats());
    let lastPaletteRef = null;
    offPalette = onPalette(palette => {
      if (palette === lastPaletteRef) return;
      lastPaletteRef = palette;
      if (palette?.bg) paintSwatches(palette);
    });

    loadFeed().then(data => {
      if (destroyed) return;
      feed = data;
      applyFeed();
    }).catch(err => {
      console.warn('图流加载失败', err);
    });

    countBoards().then(n => {
      if (destroyed) return;
      boardCount = n;
      root.querySelectorAll('[data-boards]').forEach(el => { el.textContent = String(n); });
    });

    bindChrome();
    bindMotion();

    return {
      destroy() {
        destroyed = true;
        off?.();
        offPalette?.();
        field?.destroy();
        clearInterval(clockTimer);
        cancelAnimationFrame(raf);
        cleanups.forEach(fn => { try { fn(); } catch { /* noop */ } });
        document.querySelectorAll('body > .hv-work-preview, body > .work-preview').forEach(el => el.remove());
      }
    };

    /* ---------------- 结构 ---------------- */

    function render() {
      const state = getState();
      const works = [...state.portfolio].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
      const featured = works.slice(0, 6);
      const week = weekDates();
      const focusMinutes = state.focusSessions
        .filter(s => s.date && week.includes(s.date))
        .reduce((sum, s) => sum + (s.minutes || 0), 0);
      const activeProjects = state.projects.filter(p => p.status !== '交付');
      const tasks = [...state.tasks].sort((a, b) => Number(a.done) - Number(b.done)).slice(0, 4);
      const name = String(state.profile.name || '').replace(/^示例\s*·\s*/, '').trim() || '你的名字';
      const rawName = state.profile.name || '';
      const isSample = rawName.startsWith('示例');

      root.innerHTML = `
      <section class="hv-hero" id="top">
        <canvas class="hv-field" data-field aria-hidden="true"></canvas>
        <div class="hv-grid" aria-hidden="true"></div>

        <div class="hv-hero-top">
          <span class="hv-live"><i></i>Live palette signal</span>
          <span class="hv-clock" data-clock>--:--:--</span>
        </div>

        <div class="hv-hero-main">
          <div class="hv-copy">
            <p class="hv-kicker"><span>01</span> Index / Portfolio &amp; Workbench</p>
            <h1 class="hv-title">
              <span class="mask-line"><span style="--d:0">41n<em>®</em></span></span>
              <span class="mask-line"><span style="--d:1"><span class="hv-sub">Design <b>×</b> Code</span></span></span>
            </h1>
            <p class="hv-note">
              ${escapeHtml(name)}${isSample ? '（示例资料）' : ''} · ${escapeHtml(state.profile.role || '平面设计师')}。
              纸上的排版经验，正在被翻译成屏幕里的交互。这里同时归档设计与编程作品，
              并让一束随图像变化的颜色，决定这个页面此刻的样子。
            </p>
          </div>
          <div class="hv-visual">
            <div class="hv-stage" aria-hidden="true">
              <figure class="hv-plate hv-plate--a" data-depth="14"><img alt="" data-plate="0"><figcaption>Signal 01</figcaption></figure>
              <figure class="hv-plate hv-plate--b" data-depth="26"><img alt="" data-plate="1"><figcaption>Signal 02</figcaption></figure>
              <figure class="hv-plate hv-plate--c" data-depth="42"><img alt="" data-plate="2"><figcaption>03</figcaption></figure>
            </div>
            <aside class="hv-side" aria-label="当前配色">
              <span class="hv-side-label">Palette / 当前取色</span>
              <div class="hv-swatches" data-swatches>
                ${[0, 1, 2, 3, 4].map(() => '<i class="hv-swatch" style="background:var(--bg-3)"></i>').join('')}
              </div>
              <p class="hv-hex" data-hex>等待图流…</p>
              <p class="hv-src" data-theme-source><b>取色中</b> · 来自图流第一张</p>
            </aside>
          </div>
        </div>

        <div class="hv-hero-foot">
          <div class="hv-stats">
            <div class="hv-stat"><b>${works.length}</b><span>归档作品</span></div>
            <div class="hv-stat"><b>${activeProjects.length}</b><span>进行中项目</span></div>
            <div class="hv-stat"><b>${focusMinutes}</b><span>本周专注 / 分钟</span></div>
            <div class="hv-stat"><b><span data-boards>${boardCount}</span></b><span>画板</span></div>
          </div>
          <a class="hv-scroll" href="#signals" data-magnet="8">
            Scroll to signal
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M12 4v15"/><path d="m6 13 6 6 6-6"/></svg>
          </a>
        </div>
      </section>

      <section class="hv-sec hv-signal" id="signals">
        <header class="hv-sec-head">
          <div>
            <p class="hv-sec-kicker"><span>02</span> Live signal / 图流</p>
            <h2 class="hv-sec-title">此刻的<em>颜色</em></h2>
          </div>
          <div class="hv-feed-tools">
            <span class="hv-feed-status" data-feed-status><i></i>正在连接图源…</span>
            <button type="button" class="hv-btn" data-refresh data-magnet="10">换一批</button>
          </div>
        </header>
        <div class="hv-rail" data-rail aria-label="图流，点击任意一张以取色">
          ${[0, 1, 2, 3, 4, 5].map(i => cardSkeleton(i)).join('')}
        </div>
        <p class="hv-feed-note" data-feed-note>
          正在读取图源与许可信息…
        </p>
      </section>

      <section class="hv-sec" id="works">
        <header class="hv-sec-head">
          <div>
            <p class="hv-sec-kicker"><span>03</span> Selected works</p>
            <h2 class="hv-sec-title">作品选集</h2>
          </div>
          <a class="hv-btn" href="#/portfolio" data-magnet="10">全部作品 ${icon('arrow', 12)}</a>
        </header>
        <div class="hv-works-list">
          ${featured.map((w, i) => `
            <a class="hv-work hv-reveal" href="#/portfolio/${w.id}" data-preview="${coverOf(w)}" data-cursor="view" style="--i:${i}">
              <span class="hv-work-i">${String(i + 1).padStart(2, '0')}</span>
              <h3 class="hv-work-t">${escapeHtml(w.title)}</h3>
              <span class="hv-work-m">${escapeHtml(w.section === 'code' ? 'CODE' : (w.category || 'DESIGN'))} / ${escapeHtml(w.role || '')}</span>
              <span class="hv-work-y">${escapeHtml(w.year || '')}</span>
              <span class="hv-work-a">↗</span>
            </a>`).join('') || '<p class="hv-task-empty">还没有作品，去作品页添加第一件。</p>'}
        </div>
        <div class="hv-work-preview" aria-hidden="true"><img alt=""></div>
      </section>

      <section class="hv-sec">
        <header class="hv-sec-head">
          <div>
            <p class="hv-sec-kicker"><span>04</span> Beyond the sheet</p>
            <h2 class="hv-sec-title">纸面<em>之外</em></h2>
          </div>
          <a class="hv-btn" href="#/boards" data-magnet="10">打开画板 ${icon('arrow', 12)}</a>
        </header>
        <div class="hv-stills">
          ${STILLS.map((s, i) => `
            <figure class="hv-still hv-still--${['a', 'b', 'c'][i]} hv-reveal">
              <div class="hv-still-fig" data-depth="${[10, 20, 30][i]}">
                <img src="${s.src}" alt="${escapeHtml(s.a)}" loading="lazy">
              </div>
              <figcaption><span>${escapeHtml(s.a)}</span><span>${escapeHtml(s.b)}</span></figcaption>
            </figure>`).join('')}
          <p class="hv-quote hv-reveal">
            「好的排版先解决<em>秩序</em>，再谈<em>风格</em>。
            我做平面，也写前端，习惯用同一套网格处理纸与屏幕。」
          </p>
        </div>
      </section>

      <section class="hv-sec">
        <header class="hv-sec-head">
          <div>
            <p class="hv-sec-kicker"><span>05</span> The desk</p>
            <h2 class="hv-sec-title">工作台<em>仍在</em></h2>
          </div>
          <a class="hv-btn" href="#/projects" data-magnet="10">进入项目 ${icon('arrow', 12)}</a>
        </header>
        <div class="hv-desk">
          <div>
            <div class="hv-stat-grid">
              <div class="hv-stat-cell"><b data-stat="projects">${activeProjects.length}</b><span>进行中的项目</span></div>
              <div class="hv-stat-cell"><b data-stat="focus">${focusMinutes}</b><span>本周专注 / 分钟</span></div>
              <div class="hv-stat-cell"><b data-stat="boards">${boardCount}</b><span>画板</span></div>
              <div class="hv-stat-cell"><b data-stat="works">${works.length}</b><span>归档作品</span></div>
            </div>
            <p class="hv-desk-note">任务、项目与作品数据均保存在本机浏览器，不会上传服务器。</p>
            <div class="hv-shortcuts">
              <a class="hv-shortcut" href="#/boards">${icon('boards', 13)} 画板</a>
              <a class="hv-shortcut" href="#/learn">${icon('learn', 13)} 学习</a>
              <a class="hv-shortcut" href="#/library">${icon('library', 13)} 灵感库</a>
              <a class="hv-shortcut" href="#/settings">${icon('settings', 13)} 设置</a>
              <a class="hv-shortcut" href="#/portfolio">${icon('plus', 13)} 新增作品</a>
            </div>
          </div>
          <div>
            <div class="hv-tasks-head"><span>Today / ${escapeHtml(formatCN(todayISO()))}</span><b>${tasks.filter(t => t.done).length} / ${tasks.length}</b></div>
            ${tasks.length ? tasks.map(t => `
              <div class="hv-task ${t.done ? 'is-done' : ''}">
                <i></i><span>${escapeHtml(t.title)}</span>
              </div>`).join('') : '<p class="hv-task-empty">今天还没有任务。去项目页拆一条吧。</p>'}
          </div>
        </div>
      </section>

      <footer class="hv-foot">
        <h2 class="hv-foot-title">Let’s make<br><em>something</em> worth printing.</h2>
        <div class="hv-foot-grid">
          <div class="hv-foot-col">
            <h4>Index</h4>
            <a href="#/portfolio">作品</a>
            <a href="#/projects">项目</a>
            <a href="#/boards">画板</a>
          </div>
          <div class="hv-foot-col">
            <h4>Practice</h4>
            <a href="#/learn">学习记录</a>
            <a href="#/library">灵感库</a>
            <a href="#/settings">设置</a>
          </div>
          <div class="hv-foot-col">
            <h4>Elsewhere</h4>
            <a href="https://github.com/Oro41n/designer-workbench" target="_blank" rel="noopener">GitHub ↗</a>
            ${state.profile.email ? `<a href="mailto:${escapeHtml(state.profile.email)}">${escapeHtml(state.profile.email)}</a>` : '<a href="#/settings">填写邮箱 ↗</a>'}
            <a href="#/library">灵感链接 ↗</a>
          </div>
          <div class="hv-foot-col">
            <h4>Status</h4>
            <p>${escapeHtml(state.profile.location || '远程 / 中国')}</p>
            <p>Open for work · 2026</p>
            <p>本地优先 / 无后端</p>
          </div>
        </div>
        <div class="hv-foot-baseline">
          <span>© 2026 41n — Design × Code</span>
          <span>Native HTML / CSS / ES Modules + WebGL</span>
          <span>静态站点 · 数据留在本机</span>
        </div>
      </footer>`;

      hydrateImages?.(root);
      const preview = root.querySelector('.hv-work-preview');
      if (preview) {
        document.querySelectorAll('body > .hv-work-preview, body > .work-preview').forEach(el => el.remove());
        document.body.appendChild(preview);
      }
      paintSwatches(null);
      window.dispatchEvent(new CustomEvent('dw:view-rendered'));
    }

    function coverOf(work) {
      if (work.imageId) return '';
      if (work.sample && ART[work.category]) return ART[work.category];
      return work.cover || ART[work.category] || 'assets/img/work-poster.webp';
    }

    function cardSkeleton(i) {
      return `
        <button type="button" class="hv-card" data-card="${i}" disabled>
          <figure class="hv-card-fig">
            <img alt="" loading="lazy">
            <span class="hv-card-veil"></span>
            <span class="hv-card-idx">${String(i + 1).padStart(2, '0')}</span>
            <span class="hv-card-mark">当前主题</span>
          </figure>
          <span class="hv-card-meta"><b>读取中</b><span class="hv-card-dots"></span></span>
        </button>`;
    }

    /* ---------------- 图流 ---------------- */

    function applyFeed() {
      const meta = feed.meta;
      const items = feed.items;
      const rail = root.querySelector('[data-rail]');
      const status = root.querySelector('[data-feed-status]');
      const note = root.querySelector('[data-feed-note]');
      if (!rail || !status || !note) return;

      status.innerHTML = `<i></i>${escapeHtml(meta.source)} · ${meta.fallback ? '已降级' : '已连接'}`;
      rail.innerHTML = items.map((it, i) => `
        <button type="button" class="hv-card" data-card="${i}" data-cursor="theme"
          title="${escapeHtml(it.title || '')} · ${escapeHtml(it.author || '')}">
          <figure class="hv-card-fig">
            <img src="${escapeHtml(it.src)}" data-fallback="${escapeHtml(it.fallbackSrc || '')}" alt="${escapeHtml(it.title || '图片流')}" loading="lazy">
            <span class="hv-card-veil"></span>
            <span class="hv-card-idx">${String(i + 1).padStart(2, '0')}</span>
            <span class="hv-card-mark">当前主题</span>
          </figure>
          <span class="hv-card-meta">
            <b>${escapeHtml(it.author || '')}</b>
            <span class="hv-card-dots" data-dots="${i}"></span>
          </span>
        </button>`).join('');

      rail.querySelectorAll('.hv-card').forEach(card => {
        const img = card.querySelector('img');
        img.addEventListener('error', () => {
          if (img.dataset.fallback && img.src !== img.dataset.fallback) img.src = img.dataset.fallback;
        });
        card.addEventListener('click', () => selectCard(Number(card.dataset.card)));
      });

      const license = `<a href="${escapeHtml(meta.licenseUrl || '#')}" target="_blank" rel="noopener">${escapeHtml(meta.license || '')}</a>`;
      const fetched = meta.fetchedAt ? meta.fetchedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
      note.innerHTML = `
        <strong>图源：</strong><a href="${escapeHtml(meta.home || '#')}" target="_blank" rel="noopener">${escapeHtml(meta.source)}</a>
        · 许可：${license}
        · 本次拉取 ${fetched}
        · ${escapeHtml(meta.refresh || '')}
        ${meta.fallback ? `<br><span class="warn">当前显示的是站内备用图（${escapeHtml(meta.error || '网络不可用')}），配色仍来自图片本身，但不是实时图流。</span>` : ''}
        ${meta.downgraded ? `<br><span class="warn">${escapeHtml(meta.downgraded)}</span>` : ''}
        <br><strong>说明：</strong>${escapeHtml(meta.note || '')}
        Midjourney 至今没有公开 API 或可授权抓取的图流，因此这里不展示「伪实时」的 MJ 内容。`;

      // 首张图驱动主题
      selectCard(0, { silent: true });

      // 为每张卡片补取颜色，用于色点与点击后的即时切换
      extractAll(items);
      paintPlates(items);
    }

    function paintPlates(items) {
      root.querySelectorAll('[data-plate]').forEach(img => {
        const idx = Number(img.dataset.plate);
        const it = items[idx] || items[0];
        if (!it) return;
        img.src = it.src;
        img.closest('.hv-plate')?.classList.add('is-ready');
      });
    }

    async function extractAll(items) {
      palettes = new Array(items.length);
      for (let i = 0; i < items.length; i++) {
        if (destroyed) return;
        const img = await loadBitmap(thumbOf(items[i].corsSrc), 5000);
        if (!img) continue;
        const clusters = extractPalette(img);
        if (!clusters) continue;
        palettes[i] = paletteFromClusters(clusters, currentColors().mode);
        paintDots(i);
        if (i === activeIndex) {
          applyPalette(palettes[i]);
          paintSwatches(palettes[i]);
        }
      }
    }

    function paintDots(i) {
      const dots = root.querySelector(`[data-dots="${i}"]`);
      if (!dots || !palettes[i]) return;
      dots.innerHTML = palettes[i].swatches.slice(0, 4)
        .map(hex => `<i style="background:${hex}"></i>`).join('');
    }

    async function selectCard(index, { silent = false } = {}) {
      const items = feed?.items || [];
      if (!items[index]) return;
      activeIndex = index;
      root.querySelectorAll('.hv-card').forEach(card => {
        card.classList.toggle('is-active', Number(card.dataset.card) === index);
      });

      if (palettes[index]) {
        applyPalette(palettes[index]);
        paintSwatches(palettes[index]);
      }
      const it = items[index];
      const themeSource = root.querySelector('[data-theme-source]');
      if (themeSource) {
        themeSource.innerHTML = `<b>取自第 ${String(index + 1).padStart(2, '0')} 张</b><br>${escapeHtml(it.author || '')} · ${escapeHtml(it.license || feed.meta.license || '')}`;
      }
      if (silent) return;
      // 点击后以原图重新取色，避免缩略图误差
      const img = await loadBitmap(it.corsSrc, 7000);
      if (!img || destroyed) return;
      const result = await applyImagePalette(img);
      if (!result.ok) {
        const themeSourceEl = root.querySelector('[data-theme-source]');
        if (themeSourceEl) themeSourceEl.innerHTML = `<b>取色失败</b><br>${escapeHtml(result.reason || '')}`;
      }
      paintSwatches(result.palette || palettes[index]);
    }

    function paintSwatches(palette) {
      const box = root.querySelector('[data-swatches]');
      const hex = root.querySelector('[data-hex]');
      if (!box) return;
      const c = currentColors();
      const roles = palette?.bg
        ? [palette.bg, palette.ink, palette.accent, palette.accent2]
        : [c.bg, c.ink, c.accent, c.accent2];
      box.innerHTML = roles.map(h => `<i class="hv-swatch" style="background:${h}" title="${h}"></i>`).join('');
      if (hex) {
        hex.innerHTML = `<span>BG ${roles[0].toUpperCase()} · INK ${roles[1].toUpperCase()}</span><span>ACC ${roles[2].toUpperCase()} · ACC2 ${roles[3].toUpperCase()}</span>`;
      }
    }

    /* ---------------- 外壳交互 ---------------- */

    function bindChrome() {
      field = createInkField(root.querySelector('[data-field]'));

      const clock = root.querySelector('[data-clock]');
      const tick = () => {
        if (clock) clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      };
      tick();
      clockTimer = setInterval(tick, 1000);

      root.querySelector('[data-refresh]')?.addEventListener('click', async e => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = '拉取中…';
        try {
          const data = await loadFeed();
          if (destroyed) return;
          feed = data;
          applyFeed();
          btn.textContent = '换一批';
        } catch (err) {
          btn.textContent = '失败，重试';
        } finally {
          btn.disabled = false;
        }
      });

      // 首屏文字遮罩揭示
      requestAnimationFrame(() => root.querySelector('.hv-hero')?.classList.add('is-in'));

      // 章节揭示
      if ('IntersectionObserver' in window && !reducedMotion()) {
        const io = new IntersectionObserver(entries => {
          entries.forEach(en => {
            if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
          });
        }, { threshold: 0.15, rootMargin: '0px 0px -6%' });
        root.querySelectorAll('.hv-reveal').forEach(el => io.observe(el));
        cleanups.push(() => io.disconnect());
      } else {
        root.querySelectorAll('.hv-reveal').forEach(el => el.classList.add('is-in'));
      }
    }

    function bindMotion() {
      if (reducedMotion()) return;
      const plates = [...root.querySelectorAll('[data-depth]')];
      if (!plates.length) return;
      let nx = 0, ny = 0, tx = 0, ty = 0, sp = 0, running = true;
      const loop = () => {
        if (!running) return;
        nx += (tx - nx) * 0.07;
        ny += (ty - ny) * 0.07;
        const vh = window.innerHeight;
        sp = Math.min(1, Math.max(0, window.scrollY / vh));
        plates.forEach(el => {
          const d = Number(el.dataset.depth) || 10;
          const y = -ny * d + sp * d * 1.5;
          el.style.transform = `translate3d(${(-nx * d).toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
        });
        raf = requestAnimationFrame(loop);
      };
      const onPointer = e => {
        tx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
        ty = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
      };
      window.addEventListener('pointermove', onPointer, { passive: true });
      cleanups.push(() => { running = false; window.removeEventListener('pointermove', onPointer); });
      raf = requestAnimationFrame(loop);

      // 磁性元素
      root.querySelectorAll('[data-magnet]').forEach(el => {
        const strength = Number(el.dataset.magnet) || 8;
        const onMove = e => {
          const rect = el.getBoundingClientRect();
          const dx = (e.clientX - (rect.left + rect.width / 2)) / rect.width * strength;
          const dy = (e.clientY - (rect.top + rect.height / 2)) / rect.height * strength;
          el.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
        };
        const onLeave = () => { el.style.transform = ''; };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
        cleanups.push(() => {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerleave', onLeave);
        });
      });
    }

    function refreshStats() {
      const state = getState();
      const week = weekDates();
      const focusMinutes = state.focusSessions.filter(s => s.date && week.includes(s.date)).reduce((n, s) => n + (s.minutes || 0), 0);
      const set = (key, val) => {
        const el = root.querySelector(`[data-stat="${key}"]`);
        if (el) el.textContent = String(val);
      };
      set('projects', state.projects.filter(p => p.status !== '交付').length);
      set('focus', focusMinutes);
      set('works', state.portfolio.length);
      set('boards', boardCount);
    }
  }
};
