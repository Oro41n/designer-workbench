// 首页（2026 重构）：影像剧场 + 作品索引 + 灵感快照 + 收敛工作台
import { getState, subscribe } from '../store.js';
import { icon } from '../icons.js';
import { escapeHtml, formatCN, todayISO, weekDates } from '../util.js';
import { getImageURL, hydrateImages } from '../images.js';
import { countBoards } from '../boards.js';

const MJ_FALLBACK = {
  source: 'Midjourney 公开广场',
  sourceUrl: 'https://www.midjourney.com/explore',
  mode: 'curated-snapshot',
  updatedAt: '2026-11-06',
  lastAttempt: { at: null, status: 403, note: 'Cloudflare 管理型质询，抓取与热链均被拦截' },
  items: []
};

const ART = {
  '海报': 'assets/img/work-poster.webp',
  '画册': 'assets/img/work-brochure.webp',
  '包装': 'assets/img/work-packaging.webp',
  'Logo': 'assets/img/work-identity.webp',
  'Web': 'assets/img/work-web.webp',
  '编程练习': 'assets/img/work-web.webp'
};

const FALLBACK_FEED = [
  { prompt: 'brutalist concrete interior, single shaft of morning light, dust in the air', model: 'v6.1', author: 'community', tone: 'rgba(255,75,43,.45)' },
  { prompt: 'editorial fashion still life, vermilion silk on black stone, hard flash', model: 'v6.1', author: 'community', tone: 'rgba(180,140,255,.35)' },
  { prompt: 'Japanese book design, oversized negative space, one red page', model: 'niji 6', author: 'community', tone: 'rgba(120,200,255,.3)' },
  { prompt: 'chrome liquid sculpture, studio backdrop, ultra minimal product shot', model: 'v6.1', author: 'community', tone: 'rgba(255,255,255,.22)' },
  { prompt: 'night city through wet glass, cinematic grain, no people', model: 'v6.1', author: 'community', tone: 'rgba(255,190,80,.32)' },
  { prompt: 'risograph poster texture, misregistered ink, abstract geometry', model: 'v6', author: 'community', tone: 'rgba(255,75,43,.32)' }
];

export default {
  mount(root, ctx) {
    let feed = null;
    let boardCount = 0;
    let off = null;
    let destroyed = false;

    render();
    off = subscribe(() => render());
    loadFeed();
    countBoards().then(n => {
      if (destroyed) return;
      boardCount = n;
      root.querySelectorAll('[data-boards]').forEach(el => { el.textContent = String(n); });
    });

    return {
      destroy() {
        destroyed = true;
        off?.();
        document.querySelectorAll('body > .work-preview').forEach(el => el.remove());
      }
    };

    function coverOf(work) {
      if (work.imageId) return '';
      if (work.sample && ART[work.category]) return ART[work.category];
      return work.cover || ART[work.category] || 'assets/img/work-poster.webp';
    }

    async function render() {
      const state = getState();
      const works = [...state.portfolio].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
      const featured = works.slice(0, 6);
      const week = weekDates();
      const focusMinutes = state.focusSessions
        .filter(s => s.date && week.includes(s.date))
        .reduce((sum, s) => sum + (s.minutes || 0), 0);
      const activeProjects = state.projects.filter(p => p.status !== '交付');
      const tasks = [...state.tasks].sort((a, b) => Number(a.done) - Number(b.done)).slice(0, 4);
      const nextDeadline = state.projects
        .filter(p => p.status !== '交付' && p.deadline)
        .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];

      const name = String(state.profile.name || '').replace(/^示例\s*·\s*/, '').trim() || '你的名字';
      const rawName = state.profile.name || '';
      const isSample = rawName.startsWith('示例');

      root.innerHTML = `
      <section class="hero">
        <div class="hero-media">
          <img src="assets/img/hero.webp" alt="深色桌面上的朱红纸张印刷作品" data-par="0.06">
        </div>
        <div class="hero-scrim"></div>

        <div class="hero-top">
          <span><i class="pulse"></i>Open for work · 2026</span>
          <span>${escapeHtml(state.profile.location || '远程 / 中国')}</span>
          <span>Portfolio &amp; Workbench</span>
        </div>

        <div class="hero-copy">
          <div class="hero-eyebrow">Graphic design / Front-end</div>
          <h1 class="hero-title">
            <span class="line"><span>ORO<em>®</em></span></span>
            <span class="line line--sub"><span>Design × Code</span></span>
          </h1>
        </div>

        <div class="hero-foot">
          <p class="hero-lede">
            ${escapeHtml(name)}${isSample ? '（示例资料）' : ''} · ${escapeHtml(state.profile.role || '平面设计师')}。
            把纸上的排版经验，翻译成屏幕上的交互。这里同时归档<strong>设计作品</strong>与<strong>编程作品</strong>。
          </p>
          <div class="hero-meta">
            <div>基于<b>${works.length} 件作品</b></div>
            <div>本周专注<b>${focusMinutes} 分钟</b></div>
            <div>画板<b><span data-boards>${boardCount}</span> 张</b></div>
          </div>
        </div>

        <a class="scroll-cue" href="#works" aria-label="滚动到作品">
          Scroll
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M12 4v15"/><path d="m6 13 6 6 6-6"/></svg>
        </a>
      </section>

      <div class="ticker" aria-hidden="true">
        <div class="ticker-track">
          ${tickerGroup()}
          ${tickerGroup()}
        </div>
      </div>

      <section class="section" id="works">
        <div class="section-head reveal">
          <div>
            <div class="section-kicker">01 / Selected works</div>
            <h2 class="section-title">作品选集</h2>
          </div>
          <a class="section-link" href="#/portfolio">全部作品 ${icon('arrow', 12)}</a>
        </div>
        <div class="works-list reveal" data-stagger>
          ${featured.map((w, i) => `
            <a class="work-row" href="#/portfolio/${w.id}" data-preview="${coverOf(w)}" data-cursor="view" style="--i:${i}">
              <span class="w-index">${String(i + 1).padStart(2, '0')}</span>
              <span class="w-title">${escapeHtml(w.title)}</span>
              <span class="w-meta">${escapeHtml(w.section === 'code' ? 'CODE' : (w.category || 'DESIGN'))} / ${escapeHtml(w.role || '')}</span>
              <span class="w-year">${escapeHtml(w.year || '')}</span>
              <span class="w-arrow">${icon('arrow', 16)}</span>
            </a>`).join('')}
        </div>
        <div class="work-preview" aria-hidden="true"><img alt=""></div>
      </section>

      <section class="section">
        <div class="section-head reveal">
          <div>
            <div class="section-kicker">02 / In the wild</div>
            <h2 class="section-title">纸面之外</h2>
          </div>
          <a class="section-link" href="#/boards">打开画板 ${icon('arrow', 12)}</a>
        </div>
        <div class="gallery">
          <figure class="gal-fig gal-a reveal-clip">
            <div class="gal-wrap"><img src="assets/img/work-poster.webp" alt="城市文化节主视觉：混凝土墙上的朱红几何海报" data-par="0.04"></div>
            <figcaption><span>01 / 城市文化节 · 主视觉</span><span>Poster series · 2025</span></figcaption>
          </figure>
          <figure class="gal-fig gal-b reveal-clip">
            <div class="gal-wrap"><img src="assets/img/work-packaging.webp" alt="朱红压纹礼盒与烫金标签" data-par="0.08"></div>
            <figcaption><span>02 / 明月 · 礼盒</span><span>Packaging · 2024</span></figcaption>
          </figure>
          <figure class="gal-fig gal-c reveal-clip">
            <div class="gal-wrap"><img src="assets/img/work-brochure.webp" alt="摊开的画册，右侧为整页朱红" data-par="0.06"></div>
            <figcaption><span>03 / 山茶研究所 · 画册</span><span>Editorial · 2025</span></figcaption>
          </figure>
          <div class="gal-note reveal">
            「好的排版先解决<em>秩序</em>，再谈<em>风格</em>。
            我做平面，也写前端，习惯用同一套网格处理纸与屏幕。」
          </div>
        </div>
      </section>

      <section class="section" id="feed">
        <div class="section-head reveal">
          <div>
            <div class="section-kicker">03 / Inspiration</div>
            <h2 class="section-title">Midjourney 快照</h2>
          </div>
          <p class="feed-head-note" id="feed-meta">正在读取快照…</p>
        </div>
        <div class="feed-grid" id="feed-grid">${feedCards(FALLBACK_FEED, MJ_FALLBACK)}</div>
        <p class="feed-note" id="feed-note">
          来源：Midjourney 公开广场（explore）。该站点由 Cloudflare 管理型质询保护，第三方站点抓取与图片热链均返回 403；
          因此这里展示的是<strong>人工策展的提示词快照</strong>，不是实时流，也不冒充原图。具体刷新与限制见 README。
        </p>
      </section>

      <section class="section">
        <div class="section-head reveal">
          <div>
            <div class="section-kicker">04 / The desk</div>
            <h2 class="section-title">工作台仍在</h2>
          </div>
          <a class="section-link" href="#/projects">进入项目 ${icon('arrow', 12)}</a>
        </div>
        <div class="desk-grid">
          <div class="reveal">
            <div class="stats">
              <div class="stat"><b>${activeProjects.length}</b><span>进行中的项目</span></div>
              <div class="stat"><b>${focusMinutes}</b><span>本周专注 / 分钟</span></div>
              <div class="stat"><b><span data-boards>${boardCount}</span></b><span>画板</span></div>
              <div class="stat"><b>${works.length}</b><span>归档作品</span></div>
              <div class="stat-note">
                ${nextDeadline
                  ? `最近截止：${escapeHtml(nextDeadline.title)} · ${escapeHtml(formatCN(nextDeadline.deadline))}`
                  : '暂无临近截止的项目。'}
              </div>
            </div>
            <div class="desk-shortcuts">
              <a href="#/boards">${icon('boards', 14)} 画板</a>
              <a href="#/learn">${icon('learn', 14)} 学习</a>
              <a href="#/library">${icon('library', 14)} 灵感库</a>
              <a href="#/settings">${icon('settings', 14)} 设置</a>
              <a href="#/portfolio">${icon('plus', 14)} 新增作品</a>
            </div>
          </div>
          <div class="desk-tasks reveal">
            <h3>Today / ${escapeHtml(formatCN(todayISO()))}</h3>
            ${tasks.length ? tasks.map(t => `
              <div class="task-line ${t.done ? 'is-done' : ''}">
                <span class="dot"></span><span class="t">${escapeHtml(t.title)}</span>
              </div>`).join('') : '<p class="task-empty">今天还没有任务。去项目页拆一条吧。</p>'}
            <p class="task-empty" style="margin-top:14px;font-size:11px;color:var(--ink-faint)">
              任务、项目与作品数据均保存在本机浏览器，不会上传服务器。
            </p>
          </div>
        </div>
      </section>

      <footer class="site-foot">
        <h2 class="foot-title reveal">Let’s make<br><em>something</em> worth printing.</h2>
        <div class="foot-grid reveal">
          <div class="foot-col">
            <h4>Index</h4>
            <a href="#/portfolio">作品</a>
            <a href="#/projects">项目</a>
            <a href="#/boards">画板</a>
          </div>
          <div class="foot-col">
            <h4>Practice</h4>
            <a href="#/learn">学习记录</a>
            <a href="#/library">灵感库</a>
            <a href="#/settings">设置</a>
          </div>
          <div class="foot-col">
            <h4>Elsewhere</h4>
            <a href="https://github.com/Oro41n/designer-workbench" target="_blank" rel="noopener">GitHub ↗</a>
            ${state.profile.email ? `<a href="mailto:${escapeHtml(state.profile.email)}">${escapeHtml(state.profile.email)}</a>` : '<a href="#/settings">填写邮箱 ↗</a>'}
            <a href="https://www.midjourney.com/explore" target="_blank" rel="noopener">Midjourney Explore ↗</a>
          </div>
          <div class="foot-col">
            <h4>Status</h4>
            <p>${escapeHtml(state.profile.location || '远程 / 中国')}</p>
            <p>Open for work · 2026</p>
            <p>本地优先 / 无后端</p>
          </div>
        </div>
        <div class="foot-baseline">
          <span>© 2026 Oro — Design × Code</span>
          <span>Native HTML / CSS / ES Modules</span>
          <span>静态站点 · 数据留在本机</span>
        </div>
      </footer>`;

      hydrateImages?.(root);
      if (feed) applyFeed(feed);
      // 预览层挂到 body，避免固定定位被祖先 transform 影响
      const pv = root.querySelector('.work-preview');
      if (pv) {
        document.querySelectorAll('body > .work-preview').forEach(el => el.remove());
        document.body.appendChild(pv);
      }
      window.dispatchEvent(new CustomEvent('dw:view-rendered'));
    }

    function tickerGroup() {
      const items = ['Poster', 'Identity', 'Packaging', 'Editorial', 'Web', 'Motion'];
      return items.map((t, i) => `<span><i>${String(i + 1).padStart(2, '0')}</i>${t}</span>`).join('');
    }

    function feedCards(items, meta) {
      const list = items.map((item, i) => `
        <a class="feed-card" href="${escapeHtml(item.url || meta.sourceUrl)}" target="_blank" rel="noopener" style="--tone:${item.tone || 'rgba(255,75,43,.35)'}">
          <div class="fc-top"><span>MJ / ${String(i + 1).padStart(2, '0')}</span><span>${escapeHtml(item.model || 'v6.1')}</span></div>
          <div class="fc-prompt">${escapeHtml(item.prompt)}</div>
          <div class="fc-foot"><span>${escapeHtml(item.author || 'community')}</span><span class="fc-link">explore ↗</span></div>
        </a>`).join('');
      return list || `<p class="task-empty">快照为空。</p>`;
    }

    function applyFeed(data) {
      const grid = root.querySelector('#feed-grid');
      const meta = root.querySelector('#feed-meta');
      if (!grid || !meta) return;
      const items = (data.items && data.items.length ? data.items : FALLBACK_FEED).map((it, i) => ({
        ...it,
        tone: it.tone || FALLBACK_FEED[i % FALLBACK_FEED.length].tone
      }));
      grid.innerHTML = feedCards(items, data);
      const attempt = data.lastAttempt?.at ? `最后一次抓取尝试 ${data.lastAttempt.at}` : '抓取尝试：暂无记录';
      meta.innerHTML = `<span class="chip"><i class="dot"></i>快照 · 非实时</span><br>
        ${escapeHtml(data.source || 'Midjourney 公开广场')} ·
        更新 ${escapeHtml(data.updatedAt || '—')} ·
        ${escapeHtml(attempt)}`;
      const note = root.querySelector('#feed-note');
      if (note && data.lastAttempt?.status) {
        note.innerHTML = `来源：<a href="${escapeHtml(data.sourceUrl)}" target="_blank" rel="noopener">Midjourney 公开广场（explore）</a>。
          GitHub Actions 定时任务与本地直连均返回 HTTP ${escapeHtml(String(data.lastAttempt.status))}（Cloudflare 管理型质询），
          图片 CDN 同样拒绝第三方引用。故本区为<strong>人工策展的提示词快照</strong>，不宣称实时；每条链接指向原站查看原图。
          刷新机制与限制见 README。`;
      }
    }

    async function loadFeed() {
      try {
        const res = await fetch('assets/data/mj-feed.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        feed = await res.json();
      } catch (err) {
        feed = MJ_FALLBACK;
      }
      if (!destroyed) applyFeed(feed);
    }
  }
};
