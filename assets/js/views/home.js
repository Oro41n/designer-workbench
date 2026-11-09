// 首页 v4.1「镜头穿图」：原生 WebGL 相机沿 Z 轴推进，穿过图流画框
// 5 个停靠点：hero / signal / works / desk / close；文字全部是 DOM 覆盖层
// 移动端、reduced-motion 与 WebGL 失败时退回静态堆叠
import { getState, subscribe } from '../store.js';
import { icon } from '../icons.js';
import { escapeHtml, formatCN, todayISO, weekDates } from '../util.js';
import { hydrateImages, getImageURL } from '../images.js';
import { countBoards } from '../boards.js';
import { loadFeed, loadBitmap, trackDownload } from '../feed/index.js';
import { applyPalette, extractPalette, paletteFromClusters, paletteFromSeed, currentColors, onPalette } from '../theme-engine.js';
import { createCam3D } from '../cam3d.js';
import { toast } from '../ui.js';
import { listBoards, putBoard, createBoardRecord, newObjectId } from '../boards.js';
import { saveImage } from '../images.js';

const ART = {
  '海报': 'assets/img/work-poster.webp',
  '画册': 'assets/img/work-brochure.webp',
  '包装': 'assets/img/work-packaging.webp',
  'Logo': 'assets/img/work-identity.webp',
  'Web': 'assets/img/work-web.webp',
  '编程练习': 'assets/img/work-web.webp'
};

// 镜头编排：5 个停靠点 + 1 个预备关键帧（绕行最高点）
// 每段有独立的控制点、FOV 与 roll；weight 决定滚动占比，因此停靠点不等距
const STOP_Z = [10, 0, -10, -20, -30];
const CAM_OFFSET = 2.4;
const STOP_P = [0, 0.18, 0.4, 0.6, 1];
const WINDOW = 0.045;
const POSE = {
  fov: [54, 47, 58, 51, 62, 45],
  roll: [-1.6, 1.8, -2.6, 2.2, -6, 0.8], // 度
  pitch: [2, 0, 2, 4, 10, 1] // 度，正数=俯视
};
const SEGMENTS = [
  { name: '斜穿', weight: 0.18, c1: [4.4, 2.4, -2.2], c2: [-1.2, 1.4, 1.6] },
  { name: '侧移推进', weight: 0.22, c1: [5.0, 0.6, -2.4], c2: [4.0, -0.6, 2.4] },
  { name: '升降', weight: 0.2, c1: [0.4, 2.8, -2.4], c2: [0.2, 2.2, 2.4] },
  { name: '绕行', weight: 0.25, c1: [4.2, -1.8, -1.8], c2: [1.6, 1.8, 1.2] },
  { name: '俯冲', weight: 0.15, c1: [-1.2, 0.8, -0.6], c2: [0.4, 0.6, 0.9] }
];

const clamp01 = n => Math.min(1, Math.max(0, n));
const smootherstep = t => t * t * t * (t * (t * 6 - 15) + 10);
const rnd = (a, b) => a + Math.random() * (b - a);

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const thumbOf = src => String(src || '').replace(/w=1400/g, 'w=460').replace(/w=1600/g, 'w=460');

export default {
  mount(root) {
    let feed = null;
    let boardCount = 0;
    let cam = null;
    let raf = 0;
    let lastTime = 0;
    let journeyTop = 0;
    let journeySpan = 1;
    let progress = -1;
    let pSmooth = 0;
    let pVel = 0;
    let progressReady = false;
    let anchors = [];
    let paths = [];
    let activeStop = -1;
    let paletteIndex = -1;
    let palettes = [];
    let paletteSources = [];
    let off = null;
    let offPalette = null;
    let clockTimer = 0;
    let destroyed = false;
    let lastHud = 0;
    let readyCount = 0;
    const cleanups = [];
    const staticMode = reducedMotion() || window.matchMedia('(max-width: 900px)').matches;

    render();
    off = subscribe(() => refreshStats());
    let lastRef = null;
    offPalette = onPalette(palette => {
      if (palette === lastRef) return;
      lastRef = palette;
      if (!paletteIndex || paletteIndex < 0) paintSwatches(palette);
    });

    countBoards().then(n => {
      if (destroyed) return;
      boardCount = n;
      root.querySelectorAll('[data-boards]').forEach(el => { el.textContent = String(n); });
    });

    loadFeed().then(data => {
      if (destroyed) return;
      feed = data;
      applyFeed();
      buildScene();
      extractPalettes();
    }).catch(err => {
      console.warn('图流加载失败', err);
      root.querySelector('[data-feed-status]')?.replaceChildren(document.createTextNode('图流连接失败，使用站内备用图'));
    });

    bindChrome();
    startLoop();

    return {
      destroy() {
        destroyed = true;
        cancelAnimationFrame(raf);
        off?.();
        offPalette?.();
        cam?.destroy();
        clearInterval(clockTimer);
        cleanups.forEach(fn => { try { fn(); } catch { /* noop */ } });
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
      const isSample = (state.profile.name || '').startsWith('示例');

      root.innerHTML = `
      <section class="cam-journey ${staticMode ? 'is-static' : ''}" data-journey>
        <div class="cam-stage">
          <canvas class="cam-gl" data-cam aria-hidden="true"></canvas>
          <div class="cam-light" aria-hidden="true"></div>
          <div class="cam-vignette" aria-hidden="true"></div>
          <div class="cam-loading" data-loading><i></i>镜头装填中 · 正在取图</div>
          <div class="cam-perf" data-perf hidden></div>

          <div class="cam-stops">
            <section class="cam-stop cam-stop--hero" data-stop="0" aria-label="首页">
              <div class="cam-copy">
                <figure class="cam-static"><img alt="图流影像" data-static="0"><figcaption class="cam-figcap" data-static-credit></figcaption></figure>
                <p class="cam-kicker"><span>01</span> Index / Camera through the image</p>
                <h1 class="cam-type" aria-label="41n — Design × Code">41n<em>.</em></h1>
                <p class="cam-line">Design <b>×</b> Code · 镜头穿图</p>
                <p class="cam-note"><b>${escapeHtml(name)}</b>${isSample ? '（示例资料）' : ''} · ${escapeHtml(state.profile.role || '平面设计师')}。
                  整页是一段连续的相机运动：图片是不同深度的平面，滚动只推进镜头。
                  每个停靠点的文字都留在 DOM 层，可选中、可聚焦。</p>
                <aside class="cam-palette" aria-label="当前取色">
                  <div class="cam-swatches" data-swatches>
                    ${[0, 1, 2, 3, 4].map(() => '<i class="cam-swatch"></i>').join('')}
                  </div>
                  <p class="cam-hex" data-hex>等待图流取色…</p>
                  <p class="cam-src" data-theme-source><b>取色中</b> · 颜色跟随穿过的图</p>
                </aside>
                <div class="cam-stat-grid">
                  <div class="cam-stat"><b>${works.length}</b><span>归档作品</span></div>
                  <div class="cam-stat"><b>${activeProjects.length}</b><span>进行中项目</span></div>
                  <div class="cam-stat"><b>${focusMinutes}</b><span>本周专注 / 分钟</span></div>
                  <div class="cam-stat"><b><span data-boards>${boardCount}</span></b><span>画板</span></div>
                </div>
              </div>
            </section>

            <section class="cam-stop cam-stop--signal" data-stop="1" aria-label="图流">
              <div class="cam-copy">
                <figure class="cam-static"><img alt="图流影像" data-static="1"><figcaption class="cam-figcap" data-static-credit></figcaption></figure>
                <p class="cam-kicker"><span>02</span> Live signal / 图流</p>
                <h2 class="cam-type cam-type--sm">此刻的<em>颜色</em></h2>
                <p class="cam-note">相机穿过每一张图时，整站配色跟着那张图的主色变化。点下方缩略图可手动锁定任意一张的取色；每张图都标注摄影师与 Unsplash 原图链接。</p>
                <aside class="cam-palette" aria-label="图流取色">
                  <div class="cam-swatches" data-swatches>
                    ${[0, 1, 2, 3, 4].map(() => '<i class="cam-swatch"></i>').join('')}
                  </div>
                  <p class="cam-hex" data-hex>读取中</p>
                  <p class="cam-src" data-theme-source><b>取色中</b> · 来自图流</p>
                </aside>
                <div class="cam-rail" data-rail aria-label="选择图流中任意一张取色"></div>
                <p class="cam-credit" data-credit>
                  <span class="cam-credit-k">Photo</span>
                  <a data-credit-link href="https://unsplash.com/?utm_source=41n_workbench&utm_medium=referral" target="_blank" rel="noopener"><b data-credit-author>—</b> ↗</a>
                  <span data-credit-source>· 来源 <a href="https://unsplash.com/?utm_source=41n_workbench&utm_medium=referral" target="_blank" rel="noopener">Unsplash</a></span>
                </p>
                <div class="cam-actions">
                  <button type="button" data-refresh>换一批图</button>
                  <button type="button" data-copy-palette>复制配色</button>
                  <button type="button" data-save-board>存为画板素材</button>
                  <button type="button" data-download>下载原图</button>
                </div>
                <p class="cam-src" data-feed-status style="margin-top:10px">正在连接图源…</p>
                <p class="cam-alert" data-feed-alert hidden></p>
                <p class="cam-note cam-note--feed" data-feed-note>正在读取图源与许可信息…</p>
                <p class="cam-credits-all" data-credits-all></p>
              </div>
            </section>

            <section class="cam-stop cam-stop--works" data-stop="2" aria-label="作品选集">
              <div class="cam-copy cam-copy--right">
                <figure class="cam-static"><img alt="作品影像" data-static="2"><figcaption class="cam-figcap" data-static-credit></figcaption></figure>
                <p class="cam-kicker"><span>03</span> Selected works</p>
                <h2 class="cam-type cam-type--sm">作品<em>选集</em></h2>
                <div class="cam-list">
                  ${featured.map(w => `<a href="#/portfolio/${w.id}">
                    <span>${escapeHtml(w.title)}</span>
                    <span>${escapeHtml(w.category || '')} · ${escapeHtml(w.year || '—')}</span>
                  </a>`).join('') || '<p class="cam-note">还没有作品，去作品页添加第一件。</p>'}
                </div>
                <div class="cam-actions">
                  <a href="#/portfolio">全部作品 ${icon('arrow', 12)}</a>
                </div>
              </div>
            </section>

            <section class="cam-stop cam-stop--desk" data-stop="3" aria-label="工作台">
              <div class="cam-copy">
                <figure class="cam-static"><img alt="工作台影像" data-static="3"><figcaption class="cam-figcap" data-static-credit></figcaption></figure>
                <p class="cam-kicker"><span>04</span> The desk</p>
                <h2 class="cam-type cam-type--sm">工作台<em>仍在</em></h2>
                <div class="cam-stat-grid">
                  <div class="cam-stat"><b data-stat="projects">${activeProjects.length}</b><span>进行中的项目</span></div>
                  <div class="cam-stat"><b data-stat="focus">${focusMinutes}</b><span>本周专注 / 分钟</span></div>
                  <div class="cam-stat"><b data-stat="boards">${boardCount}</b><span>画板</span></div>
                  <div class="cam-stat"><b data-stat="works">${works.length}</b><span>归档作品</span></div>
                </div>
                <p class="cam-note">任务、项目与作品数据都保存在本机浏览器，不上传服务器。画板、学习与灵感库仍在原来的工作台里。</p>
                <div class="cam-list">
                  <div class="cam-src" style="padding:10px 0">Today / ${escapeHtml(formatCN(todayISO()))} · ${tasks.filter(t => t.done).length} / ${tasks.length}</div>
                  ${tasks.length ? tasks.map(t => `<a href="#/projects"><span>${t.done ? '已完成' : '待办'} · ${escapeHtml(t.title)}</span><span>${t.done ? 'DONE' : 'OPEN'}</span></a>`).join('') : '<p class="cam-note">今天还没有任务。去项目页拆一条吧。</p>'}
                </div>
                <div class="cam-actions"><a href="#/projects">进入项目 ${icon('arrow', 12)}</a></div>
              </div>
            </section>

            <section class="cam-stop cam-stop--close" data-stop="4" aria-label="结束">
              <div class="cam-center">
                <figure class="cam-static"><img alt="结尾影像" data-static="4"><figcaption class="cam-figcap" data-static-credit></figcaption></figure>
                <p class="cam-kicker" style="justify-content:center"><span>05</span> End of the journey</p>
                <h2 class="cam-type" aria-label="Let's make something worth printing.">Let’s make<br>something<br>worth <em>printing</em>.</h2>
                <div class="cam-list" style="max-width:620px;margin-left:auto;margin-right:auto;text-align:left">
                  <a href="#/portfolio"><span>作品</span><span>Portfolio</span></a>
                  <a href="#/projects"><span>项目</span><span>Projects</span></a>
                  <a href="#/boards"><span>画板</span><span>Boards</span></a>
                  <a href="#/learn"><span>学习记录</span><span>Learn</span></a>
                  <a href="https://github.com/Oro41n/designer-workbench" target="_blank" rel="noopener"><span>GitHub</span><span>↗</span></a>
                </div>
                <p class="cam-src" style="margin-top:22px">© 2026 41n — Design × Code · 数据保存在本机</p>
              </div>
            </section>
          </div>

          <nav class="cam-dots" aria-label="场景跳转">
            ${['首页', '图流', '作品', '工作台', '结束'].map((label, i) => `
              <button type="button" data-jump="${i}" aria-label="跳到${label}"><i></i>${String(i + 1).padStart(2, '0')}</button>`).join('')}
          </nav>
          <div class="cam-progress" aria-hidden="true"><i data-bar></i></div>
          <div class="cam-hint">Scroll / 相机推进 · 穿过画框</div>
        </div>
      </section>`;

      hydrateImages?.(root);
      paintSwatches(null);
      window.dispatchEvent(new CustomEvent('dw:view-rendered'));
    }

    function coverOf(work) {
      if (work.imageId) return '';
      if (work.sample && ART[work.category]) return ART[work.category];
      return work.cover || ART[work.category] || 'assets/img/work-poster.webp';
    }

    /* ---------------- 图流 ---------------- */

    function applyFeed() {
      const meta = feed.meta;
      // 每次加载打乱图流顺序，画面组合与配色起点都不重复
      for (let i = feed.items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [feed.items[i], feed.items[j]] = [feed.items[j], feed.items[i]];
      }
      const items = feed.items;
      paletteIndex = items.length ? 0 : -1;
      const status = root.querySelector('[data-feed-status]');
      const note = root.querySelector('[data-feed-note]');
      if (status) status.textContent = `${meta.source} · ${meta.fallback ? '已降级为站内备用图' : '实时'} · Demo 50 次/小时`;

      root.querySelectorAll('[data-static]').forEach(img => {
        if (!items.length) return;
        // 备用图只有 4 张时按取模复用，避免第 5 个停靠点出现空图
        const it = items[Number(img.dataset.static) % items.length];
        img.src = it.src;
        const cap = img.closest('figure')?.querySelector('[data-static-credit]');
        if (cap) {
          const isLocal = it.license === '站内作品' || String(it.link || '').startsWith('#');
          cap.innerHTML = isLocal
            ? `本地备用图 · ${escapeHtml(it.title || '站内作品')}`
            : `Photo · <a href="${escapeHtml(it.link || '#')}" target="_blank" rel="noopener">${escapeHtml(it.author || 'Unsplash contributor')}</a> / Unsplash`;
        }
      });

      const rail = root.querySelector('[data-rail]');
      if (rail) {
        rail.innerHTML = items.slice(0, 8).map((it, i) => `
          <button type="button" data-pick="${i}" class="cam-shot ${i === 0 ? 'is-on' : ''}"
            title="${escapeHtml(it.title || '')} · ${escapeHtml(it.author || '')}"
            aria-label="取第 ${i + 1} 张图的颜色，摄影 ${escapeHtml(it.author || '')}">
            <img src="${escapeHtml(thumbOf(it.src))}" alt="" loading="lazy" decoding="async">
            <span>${String(i + 1).padStart(2, '0')}</span>
          </button>`).join('');
        rail.querySelectorAll('[data-pick]').forEach(btn => {
          btn.addEventListener('click', () => selectImage(Number(btn.dataset.pick)));
        });
      }

      // 每张图都授予摄影师署名与原图链接，避免只署当前一张
      const creditAll = root.querySelector('[data-credits-all]');
      if (creditAll) {
        const seen = new Set();
        const names = items.slice(0, 8).filter(it => {
          if (!it || seen.has(it.author)) return false;
          seen.add(it.author);
          return true;
        });
        creditAll.innerHTML = `图流摄影：${names.map(it => `<a href="${escapeHtml(it.authorUrl || '#')}" target="_blank" rel="noopener">${escapeHtml(it.author || 'Unsplash contributor')}</a>`).join(' · ')}`;
      }

      const alert = root.querySelector('[data-feed-alert]');
      if (alert) {
        if (meta.fallback) {
          alert.hidden = false;
          alert.innerHTML = `<b>图源暂不可用</b> · ${escapeHtml(meta.errorText || '网络不可用')}。已显示站内备用图，页面与取色仍可使用；稍后刷新或点「换一批图」会重试。`;
        } else {
          alert.hidden = true;
          alert.textContent = '';
        }
      }

      if (note) {
        const license = `<a href="${escapeHtml(meta.licenseUrl || '#')}" target="_blank" rel="noopener">${escapeHtml(meta.license || '')}</a>`;
        const fetched = meta.fetchedAt ? meta.fetchedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
        note.innerHTML = `<strong>图源：</strong><a href="${escapeHtml(meta.home || '#')}" target="_blank" rel="noopener">${escapeHtml(meta.source)}</a>
          · 许可：${license} · 本次拉取 ${fetched}
          ${meta.fallback ? `<br><span class="warn">${escapeHtml(meta.errorText || '接口不可用')}；当前显示站内备用图。</span>` : ''}
          <br>Unsplash /photos/random 每次请求返回新照片，刷新页面或点「换一批」即换图，不做本地缓存。`;
      }

      updateCredit(0);
      // 先用接口 color 字段给出即时配色，像素取色完成后再无缝替换
      const first = items[0];
      if (first?.paletteSeed) {
        const seeded = paletteFromSeed(first.paletteSeed, currentColors().mode);
        if (seeded) {
          palettes[0] = seeded;
          applyPalette(seeded);
          paintSwatches(seeded);
          setThemeSource(0, 'seed');
        }
      }
    }

    async function extractPalettes() {
      const items = feed?.items || [];
      palettes = new Array(items.length);
      paletteSources = new Array(items.length);
      for (let i = 0; i < Math.min(items.length, 8); i++) {
        if (destroyed) return;
        let pal = null;
        let kind = 'pixels';
        const img = await loadBitmap(thumbOf(items[i].corsSrc), 5000);
        if (img) {
          const clusters = extractPalette(img);
          if (clusters) pal = paletteFromClusters(clusters, currentColors().mode);
        }
        // 降级路径：图片无法跨域读像素时，用 /photos/random 返回的 color 字段做种子
        if (!pal && items[i].paletteSeed) {
          pal = paletteFromSeed(items[i].paletteSeed, currentColors().mode);
          kind = 'seed';
        }
        if (!pal) continue;
        palettes[i] = pal;
        paletteSources[i] = kind;
        if (i === 0 && paletteIndex === 0) {
          applyPalette(pal);
          paintSwatches(pal);
          paintRail(0);
          setThemeSource(0, kind);
        }
      }
    }

    function paintRail(index) {
      root.querySelectorAll('[data-pick]').forEach(btn => {
        btn.classList.toggle('is-on', Number(btn.dataset.pick) === index);
      });
    }

    function updateCredit(index) {
      const it = feed?.items?.[index];
      const author = root.querySelector('[data-credit-author]');
      const link = root.querySelector('[data-credit-link]');
      const source = root.querySelector('[data-credit-source]');
      const isLocal = it?.license === '站内作品' || String(it?.link || '').startsWith('#');
      if (author) author.textContent = it?.author || 'Unsplash contributor';
      if (link && it?.link) link.href = it.link;
      if (source) source.hidden = isLocal;
      root.querySelector('[data-credit] .cam-credit-k')?.replaceChildren(document.createTextNode(isLocal ? 'LOCAL' : 'Photo'));
    }

    function setThemeSource(index, kind) {
      const it = feed?.items?.[index];
      root.querySelectorAll('[data-theme-source]').forEach(el => {
        el.innerHTML = `<b>取自第 ${String(index + 1).padStart(2, '0')} 张</b> · ${kind === 'seed' ? 'color 字段种子（跨域取色不可用）' : '像素取色'}<br>${escapeHtml(it?.author || '')} · ${escapeHtml(it?.license || feed?.meta.license || '')}`;
      });
    }

    function selectImage(index) {
      let pal = palettes[index];
      const it = feed?.items?.[index];
      if (!pal && it?.paletteSeed) {
        pal = paletteFromSeed(it.paletteSeed, currentColors().mode);
        palettes[index] = pal;
        paletteSources[index] = 'seed';
      }
      paletteIndex = index;
      paintRail(index);
      updateCredit(index);
      if (!pal) return;
      applyPalette(pal);
      paintSwatches(pal);
      setThemeSource(index, paletteSources[index] || 'pixels');
    }

    function paintSwatches(palette) {
      const boxes = root.querySelectorAll('[data-swatches]');
      if (!boxes.length) return;
      const c = currentColors();
      const roles = palette?.bg
        ? [palette.bg, palette.ink, palette.accent, palette.accent2]
        : [c.bg, c.ink, c.accent, c.accent2];
      boxes.forEach(box => {
        box.innerHTML = roles.map(h => `<i class="cam-swatch" style="background:${h}" title="${h}"></i>`).join('');
      });
      root.querySelectorAll('[data-hex]').forEach(hex => {
        hex.innerHTML = `<span>BG ${roles[0].toUpperCase()} · ACC ${roles[2].toUpperCase()}</span>`;
      });
    }

    /* ---------------- 3D 场景 ---------------- */

    function buildScene() {
      const journey = root.querySelector('[data-journey]');
      const canvas = root.querySelector('[data-cam]');
      if (!journey || staticMode) {
        journey?.classList.add('is-ready');
        return;
      }

      cam = createCam3D(canvas, {
        fogNear: 2,
        fogFar: 46,
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

      const colors = currentColors();
      cam.setPalette(colors);
      cam.setCamera({ x: 0, y: 0, z: 14, fov: POSE.fov[0] }, { instant: true });

      const items = feed?.items || [];
      const ready = () => {
        readyCount++;
        if (readyCount >= 3) journey.classList.add('is-ready');
      };
      const after = () => setTimeout(() => journey.classList.add('is-ready'), 3500);

      // 5 个画框：位置、深度、倾角每次加载都不同，避免每次走同一条直线
      let cursor = 0;
      const nextItem = () => (items.length ? items[cursor++ % items.length] : null);
      const portals = STOP_Z.map((z, i) => {
        const it = nextItem();
        const spot = {
          x: rnd(-1.1, 1.1),
          y: rnd(-0.7, 0.7),
          z: z + rnd(-1.2, 1.2),
          rot: rnd(-0.05, 0.05)
        };
        cam.addPlane({
          id: `portal-${i}`,
          url: it?.corsSrc,
          ...spot, w: 6.4, h: 3.6, border: true,
          paletteIndex: i,
          onReady: ready
        });
        return spot;
      });
      buildAnchors(portals);
      cam.setCamera(camPoseAt(0), { instant: true });

      // 穿行段的侧向图片，制造景深
      const side = [
        { z: 5.2, x: -3.4, y: 1.1, w: 2.4, h: 1.5 },
        { z: 4.2, x: 3.8, y: -0.9, w: 2.2, h: 1.4 },
        { z: -4.6, x: -4.1, y: -0.4, w: 2.6, h: 1.6 },
        { z: -6.2, x: 3.6, y: 1.2, w: 2.2, h: 1.4 },
        { z: -14.5, x: 4.0, y: -1.0, w: 2.5, h: 1.6 },
        { z: -16.2, x: -3.8, y: 0.9, w: 2.3, h: 1.4 },
        { z: -23.4, x: -4.2, y: -0.7, w: 2.6, h: 1.7 },
        { z: -24.6, x: 4.2, y: 1.0, w: 2.4, h: 1.5 },
        // 升降段的高位平面：相机上浮时不至于整片空黑
        { z: -9.0, x: -5.0, y: 3.0, w: 2.3, h: 1.5 },
        { z: -11.6, x: 4.4, y: 2.8, w: 2.2, h: 1.4 },
        // 绕行/俯冲段的近景，避免结尾两段大面积空黑
        { z: -26.4, x: -3.6, y: 1.2, w: 2.4, h: 1.6 },
        { z: -28.4, x: 3.8, y: -0.9, w: 2.4, h: 1.6 }
      ];
      side.forEach(p => {
        const it = nextItem();
        cam.addPlane({
          ...p,
          x: p.x + rnd(-1.0, 1.0),
          y: p.y + rnd(-0.6, 0.6),
          z: p.z + rnd(-0.9, 0.9),
          rot: rnd(-0.12, 0.12),
          url: it?.corsSrc, onReady: ready
        });
      });

      // 作品封面：穿向作品停靠点的途中掠过
      (async () => {
        const works = [...getState().portfolio].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)).slice(0, 4);
        for (let i = 0; i < works.length; i++) {
          const w = works[i];
          let url = coverOf(w);
          if (w.imageId) {
            try { url = await getImageURL(w.imageId); } catch { url = ''; }
          }
          if (destroyed) return;
          cam?.addPlane({
            id: `work-${w.id}`,
            url,
            z: -1.2 - i * 2.1,
            x: i % 2 ? 3.4 : -3.4,
            y: i < 2 ? 0.9 : -0.8,
            w: 2.6, h: 1.8,
            border: true,
            onReady: ready,
            data: w
          });
        }
      })();

      // 雾中的两块光平面
      cam.addPlane({ z: -12.4, x: 2.9, y: 1.4, w: 3.2, h: 2, opacity: 0.55 });
      cam.addPlane({ z: -18.2, x: -2.8, y: -1.2, w: 3.4, h: 2.1, opacity: 0.45 });

      after();
      measure();
    }

    /* ---------------- 镜头路径 ---------------- */

    // 每个停靠点的相机位取画框前方 2.4，并留出偏移让画框偏离画面中心
    function buildAnchors(portals) {
      anchors = portals.map((p, i) => ({
        x: p.x + (i === 0 ? 0.55 : (i % 2 ? -0.95 : 0.95)),
        y: p.y + (i % 2 ? -0.5 : 0.45),
        z: p.z + CAM_OFFSET
      }));
      const close = portals[4] || portals[portals.length - 1];
      // 绕行最高点（不是停靠点），之后俯冲进最后一帧
      anchors.splice(4, 0, {
        x: close.x + rnd(2.4, 3.2),
        y: close.y + rnd(1.4, 2.0),
        z: close.z + 5.8
      });
      anchors[5] = { x: close.x + 0.35, y: close.y + 0.2, z: close.z + CAM_OFFSET };
      // 控制点每次加载都做 ±18% 扰动，路径不重复
      paths = SEGMENTS.map(s => ({
        c1: s.c1.map(v => v * rnd(0.82, 1.18)),
        c2: s.c2.map(v => v * rnd(0.82, 1.18))
      }));
    }

    function camPoseAt(p) {
      if (!anchors.length) return { x: 0, y: 0, z: 14, fov: POSE.fov[0], roll: 0, pitch: 0 };
      let acc = 0;
      let seg = SEGMENTS.length - 1;
      for (let i = 0; i < SEGMENTS.length; i++) {
        if (p <= acc + SEGMENTS[i].weight + 1e-9) { seg = i; break; }
        acc += SEGMENTS[i].weight;
      }
      const s = SEGMENTS[seg];
      const raw = clamp01((p - acc) / s.weight);
      // 每段最后 ~10% 不再前进：落点前有 0.2–0.4s 的 settle
      const t = smootherstep(clamp01(raw / 0.9));
      const A = anchors[seg] || anchors[0];
      const B = anchors[seg + 1] || A;
      const cp = paths[seg] || { c1: s.c1, c2: s.c2 };
      const c1x = A.x + cp.c1[0], c1y = A.y + cp.c1[1], c1z = A.z + cp.c1[2];
      const c2x = B.x + cp.c2[0], c2y = B.y + cp.c2[1], c2z = B.z + cp.c2[2];
      const u = 1 - t;
      const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
      const fov = POSE.fov[seg] + (POSE.fov[seg + 1] - POSE.fov[seg]) * t;
      const rollDeg = POSE.roll[seg] + (POSE.roll[seg + 1] - POSE.roll[seg]) * t;
      const pitchDeg = POSE.pitch[seg] + (POSE.pitch[seg + 1] - POSE.pitch[seg]) * t;
      return {
        x: w0 * A.x + w1 * c1x + w2 * c2x + w3 * B.x,
        y: w0 * A.y + w1 * c1y + w2 * c2y + w3 * B.y,
        z: w0 * A.z + w1 * c1z + w2 * c2z + w3 * B.z,
        fov,
        roll: (rollDeg * Math.PI) / 180,
        pitch: (pitchDeg * Math.PI) / 180
      };
    }

    /* ---------------- 滚动 / 相机 ---------------- */

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
        updateJourney(dt);
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

    function updateJourney(dt = 0.016) {
      const journey = root.querySelector('[data-journey]');
      if (!journey) return;
      const target = staticMode ? 0 : clamp01((window.scrollY - journeyTop) / journeySpan);
      if (!progressReady) {
        pSmooth = target;
        progressReady = true;
      }
      // 临界阻尼弹簧：镜头带惯性跟随滚动，停下时自然 settle，不线性硬跟
      const omega = 6.4;
      const h = dt / 2;
      for (let i = 0; i < 2; i++) {
        const a = (target - pSmooth) * omega * omega - pVel * 2 * omega;
        pVel += a * h;
        pSmooth += pVel * h;
      }
      pSmooth = clamp01(pSmooth);
      if (Math.abs(target - pSmooth) < 0.0004 && Math.abs(pVel) < 0.004) {
        pSmooth = target;
        pVel = 0;
      }
      const p = pSmooth;
      // 只有「已到位」时才跳过重绘；否则弹簧仍在收敛，文字透明度必须跟着更新
      if (Math.abs(p - progress) < 0.00025 && Math.abs(target - p) < 0.00025) return;
      progress = p;

      const bar = root.querySelector('[data-bar]');
      if (bar) bar.style.transform = `scaleX(${p})`;

      if (staticMode) return;

      root.querySelectorAll('[data-stop]').forEach(el => {
        const i = Number(el.dataset.stop);
        const q = (p - STOP_P[i]) / WINDOW;
        // 1.4 倍增益：停靠点附近有一小段完全不透明，避免弹簧残留滞后让文字发虚
        const o = Math.min(1, Math.max(0, 1 - Math.abs(q)) * 1.4);
        el.style.opacity = o.toFixed(3);
        el.style.transform = `translateY(${(q * 26).toFixed(1)}px)`;
        const live = o > 0.24;
        if (live !== el.classList.contains('is-live')) {
          el.classList.toggle('is-live', live);
          el.toggleAttribute('inert', !live);
        }
      });

      const nearest = STOP_P.reduce((best, v, i) => (Math.abs(p - v) < Math.abs(p - STOP_P[best]) ? i : best), 0);
      if (nearest !== activeStop) {
        activeStop = nearest;
        root.querySelectorAll('[data-jump]').forEach((b, i) => b.classList.toggle('is-on', i === nearest));
      }

      if (cam) {
        const pose = camPoseAt(p);
        cam.setCamera(pose);
        followPalette(pose.z);
      }
    }

    function followPalette(camZ) {
      const planes = cam?.planes || [];
      let passed = null;
      for (const plane of planes) {
        if (plane.paletteIndex == null) continue;
        if (plane.z > camZ) continue;
        if (!passed || plane.z > passed.z) passed = plane;
      }
      if (!passed) return;
      if (passed.paletteIndex === paletteIndex) return;
      paletteIndex = passed.paletteIndex;
      paintRail(paletteIndex);
      setTimeout(() => selectImage(paletteIndex), 0);
    }

    /* ---------------- 外壳 ---------------- */

    function bindChrome() {
      const clock = root.querySelector('[data-clock]');
      if (clock) {
        const tickClock = () => { clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false }); };
        tickClock();
        clockTimer = setInterval(tickClock, 1000);
      }

      const onMove = e => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = -((e.clientY / window.innerHeight) * 2 - 1);
        cam?.setPointer(nx, ny);
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      cleanups.push(() => window.removeEventListener('pointermove', onMove));

      const onResize = () => { measure(); cam?.resize(); };
      window.addEventListener('resize', onResize);
      cleanups.push(() => window.removeEventListener('resize', onResize));

      root.querySelector('[data-refresh]')?.addEventListener('click', async e => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = '拉取中…';
        try {
          const data = await loadFeed();
          if (destroyed) return;
          feed = data;
          applyFeed();
          cam?.destroy();
          cam = null;
          readyCount = 0;
          buildScene();
          palettes = [];
          paletteSources = [];
          extractPalettes();
          btn.textContent = '换一批图';
        } catch {
          btn.textContent = '失败，重试';
        } finally {
          btn.disabled = false;
        }
      });

      root.querySelector('[data-copy-palette]')?.addEventListener('click', async e => {
        const btn = e.currentTarget;
        const c = currentColors();
        const pal = palettes[paletteIndex];
        const swatches = pal?.swatches || [c.bg, c.ink, c.accent, c.accent2];
        const text = `:root {\n  --bg: ${c.bg};\n  --ink: ${c.ink};\n  --accent: ${c.accent};\n  --accent-2: ${c.accent2};\n}\n/* swatches: ${swatches.join(' ')} */`;
        try {
          await navigator.clipboard.writeText(text);
          toast('配色已复制为 CSS 变量', { type: 'success' });
        } catch {
          toast('浏览器拒绝了剪贴板写入，请手动选择色块', { type: 'error' });
        }
        btn.textContent = '已复制';
        setTimeout(() => { if (!destroyed) btn.textContent = '复制配色'; }, 1600);
      });

      // Unsplash 条款：触发下载时必须先请求 download_location，再打开原图
      root.querySelector('[data-download]')?.addEventListener('click', e => {
        const it = feed?.items?.[paletteIndex];
        if (!it) return;
        const target = trackDownload(it);
        if (target) window.open(target, '_blank', 'noopener');
        const btn = e.currentTarget;
        btn.textContent = '已记录下载';
        setTimeout(() => { if (!destroyed) btn.textContent = '下载原图'; }, 1600);
      });

      root.querySelector('[data-save-board]')?.addEventListener('click', async e => {
        const btn = e.currentTarget;
        const it = feed?.items?.[paletteIndex];
        if (!it) return;
        btn.disabled = true;
        btn.textContent = '保存中…';
        try {
          // 存进画板也是一次「使用」，同样触发下载追踪
          trackDownload(it);
          const res = await fetch(it.corsSrc || it.src, { mode: 'cors', cache: 'no-store' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const ext = (blob.type || 'image/jpeg').includes('png') ? 'png' : 'jpg';
          const file = new File([blob], `${it.id || 'unsplash'}.${ext}`, { type: blob.type || 'image/jpeg' });
          const saved = await saveImage(file, 1600);
          let board = (await listBoards())[0];
          if (!board) board = createBoardRecord({ name: '图流素材', width: 1080, height: 1350 });
          const ratio = Math.min(board.width * 0.8 / saved.width, board.height * 0.8 / saved.height, 1);
          const w = Math.round(saved.width * ratio);
          const h = Math.round(saved.height * ratio);
          board.objects.push({
            id: newObjectId(), type: 'image', name: `Unsplash · ${it.author || 'photo'}`,
            x: Math.round((board.width - w) / 2), y: Math.round((board.height - h) / 2),
            w, h, imageId: saved.id, fill: 'transparent', radius: 0, rotation: 0, opacity: 1,
            blend: 'normal', stroke: '#16130E', strokeWidth: 0, hidden: false, locked: false
          });
          board.sample = false;
          await putBoard(board);
          toast(`已存入画板「${board.name}」`, { type: 'success' });
          btn.textContent = '已存入画板';
        } catch (err) {
          console.warn('存入画板失败', err);
          toast('存入失败：图片跨域或本机存储不可用', { type: 'error' });
          btn.textContent = '保存失败';
        } finally {
          btn.disabled = false;
          setTimeout(() => { if (!destroyed) btn.textContent = '存为画板素材'; }, 1800);
        }
      });

      root.querySelectorAll('[data-jump]').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.jump);
          const journey = root.querySelector('[data-journey]');
          if (!journey || staticMode) {
            root.querySelector(`[data-stop="${i}"]`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
            return;
          }
          window.scrollTo({ top: journeyTop + STOP_P[i] * journeySpan, behavior: 'smooth' });
        });
      });

      if (new URLSearchParams(location.search).has('perf')) {
        const hud = root.querySelector('[data-perf]');
        if (hud) hud.hidden = false;
      }
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
      root.querySelectorAll('[data-boards]').forEach(el => { el.textContent = String(boardCount); });
    }
  }
};
