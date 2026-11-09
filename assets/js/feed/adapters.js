// 图源适配器：统一输出 { id, raw, author, authorUrl, link, title, license, licenseUrl }
// 约定：raw 必须是可以公开访问的原图地址；是否套代理由 index.js 决定

const round = n => Math.round(n);
const seedOf = () => {
  const t = Date.now().toString(36).slice(-4);
  return `${t}${Math.random().toString(36).slice(2, 7)}`;
};

export const picsum = {
  id: 'picsum',
  label: 'Lorem Picsum',
  home: 'https://picsum.photos',
  license: 'Unsplash License',
  licenseUrl: 'https://unsplash.com/license',
  refresh: '每次页面加载都会请求新的随机种子，因此图片每次都不同；不保留历史缓存。备用源，默认不启用。',
  note: 'Lorem Picsum 是公开的随机图片服务，图片全部来自 Unsplash。它是「随机图片流」，不是设计师作品流，也没有 Midjourney 内容。',
  async fetch({ count }) {
    const seeds = Array.from({ length: count }, seedOf);
    return seeds.map((s, i) => ({
      id: `picsum-${s}`,
      raw: `https://picsum.photos/seed/${s}/1600/1000`,
      author: 'Lorem Picsum / Unsplash',
      authorUrl: 'https://picsum.photos',
      link: `https://picsum.photos/seed/${s}/1600/1000`,
      title: `Random plate ${String(i + 1).padStart(2, '0')}`,
      license: 'Unsplash License',
      licenseUrl: 'https://unsplash.com/license'
    }));
  }
};

const UTM = 'utm_source=41n_workbench&utm_medium=referral';
const withUtm = url => {
  if (!url) return '';
  const base = String(url);
  return `${base}${base.includes('?') ? '&' : '?'}${UTM}`;
};

export const unsplash = {
  id: 'unsplash',
  label: 'Unsplash',
  home: `https://unsplash.com/?${UTM}`,
  license: 'Unsplash License',
  licenseUrl: 'https://unsplash.com/license',
  requiresKey: 'unsplash',
  refresh: '每次加载用公开 client_id 调用 /photos/random?count=8（不缓存），刷新页面或点「换一批」都会得到新的一组照片。',
  note: 'Access Key 随前端公开下发，仅用于免授权读接口；Demo 应用限流 50 次/小时。作者、作品页与下载追踪按 Unsplash API 指南标注。',
  async fetch({ count, query, key, signal }) {
    if (!key) throw new Error('缺少 Unsplash Access Key');
    const params = new URLSearchParams({
      count: String(Math.min(Math.max(count, 1), 30)),
      orientation: 'landscape',
      // 官方支持在查询参数里带 client_id，静态站点无需 Authorization 头即可跨域
      client_id: key
    });
    if (query) params.set('query', query);
    const res = await fetch(`https://api.unsplash.com/photos/random?${params}`, {
      cache: 'no-store',
      signal
    });
    if (!res.ok) {
      const err = new Error(`Unsplash HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : [data];
    return list.filter(Boolean).map(p => ({
      id: `unsplash-${p.id}`,
      raw: p.urls?.raw || p.urls?.full || p.urls?.regular,
      author: p.user?.name || 'Unsplash contributor',
      authorUrl: withUtm(p.user?.links?.html) || `https://unsplash.com/?${UTM}`,
      link: withUtm(p.links?.html) || `https://unsplash.com/?${UTM}`,
      // 触发下载时先请求 download_location，再打开原图
      download: p.links?.download || '',
      downloadLocation: p.links?.download_location || '',
      color: p.color || '',
      width: p.width || 0,
      height: p.height || 0,
      title: p.alt_description || p.description || 'Untitled',
      license: 'Unsplash License',
      licenseUrl: 'https://unsplash.com/license'
    }));
  }
};

export const pexels = {
  id: 'pexels',
  label: 'Pexels',
  home: 'https://www.pexels.com',
  license: 'Pexels License',
  licenseUrl: 'https://www.pexels.com/license/',
  requiresKey: 'pexels',
  refresh: '每次加载调用 /v1/curated，返回编辑精选的当下结果；不写入本地缓存。',
  note: '需要免费的 Pexels API Key。作者与作品页按 Pexels 指南标注。',
  async fetch({ count, key }) {
    if (!key) throw new Error('缺少 Pexels API Key');
    const res = await fetch(`https://api.pexels.com/v1/curated?per_page=${Math.min(count, 24)}&page=${1 + Math.floor(Math.random() * 8)}`, {
      headers: { Authorization: key },
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`);
    const data = await res.json();
    return (data.photos || []).map(p => ({
      id: `pexels-${p.id}`,
      raw: p.src.original,
      author: p.photographer || 'Pexels contributor',
      authorUrl: p.photographer_url || 'https://www.pexels.com',
      link: p.url,
      title: p.alt || 'Pexels photo',
      license: 'Pexels License',
      licenseUrl: 'https://www.pexels.com/license/'
    }));
  }
};

export const openverse = {
  id: 'openverse',
  label: 'Openverse',
  home: 'https://openverse.org',
  license: 'CC（逐条标注）',
  licenseUrl: 'https://creativecommons.org/licenses/',
  refresh: '每次加载按关键词请求一次，返回当前索引结果；不使用本地缓存。',
  note: 'Openverse 聚合 CC 授权图片，无需 Key；但部分地区网络可能无法直连 api.openverse.org，失败时会自动降级。',
  async fetch({ count, query }) {
    const params = new URLSearchParams({
      q: query || 'poster design',
      page_size: String(Math.min(count, 20)),
      license_type: 'commercial',
      mature: 'false'
    });
    const res = await fetch(`https://api.openverse.org/v1/images/?${params}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Openverse HTTP ${res.status}`);
    const data = await res.json();
    return (data.results || []).map(p => ({
      id: `ov-${p.id}`,
      raw: p.url,
      author: p.creator || 'Unknown',
      authorUrl: p.creator_url || p.foreign_landing_url || 'https://openverse.org',
      link: p.foreign_landing_url || p.url,
      title: p.title || 'Openverse image',
      license: `${String(p.license || 'cc').toUpperCase()} ${p.license_version || ''}`.trim(),
      licenseUrl: p.license_url || 'https://creativecommons.org/licenses/'
    }));
  }
};

export const ADAPTERS = { picsum, unsplash, pexels, openverse };
