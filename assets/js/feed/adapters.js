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
  refresh: '每次页面加载都会请求新的随机种子，因此图片每次都不同；不保留历史缓存。',
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

export const unsplash = {
  id: 'unsplash',
  label: 'Unsplash',
  home: 'https://unsplash.com',
  license: 'Unsplash License',
  licenseUrl: 'https://unsplash.com/license',
  requiresKey: 'unsplash',
  refresh: '每次加载调用 /photos/random，返回当下不同的照片；同一会话内不缓存。',
  note: '需要免费的 Unsplash Access Key。图片可直接跨域读取取色；作者与主页按 Unsplash API 指南标注。',
  async fetch({ count, query, key }) {
    if (!key) throw new Error('缺少 Unsplash Access Key');
    const params = new URLSearchParams({ count: String(Math.min(count, 30)), orientation: 'landscape' });
    if (query) params.set('query', query);
    const res = await fetch(`https://api.unsplash.com/photos/random?${params}`, {
      headers: { Authorization: `Client-ID ${key}` },
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`Unsplash HTTP ${res.status}`);
    const list = await res.json();
    return list.map(p => ({
      id: `unsplash-${p.id}`,
      raw: p.urls.raw || p.urls.full,
      author: p.user?.name || 'Unsplash contributor',
      authorUrl: p.user?.links?.html || 'https://unsplash.com',
      link: `${p.links?.html || 'https://unsplash.com'}?utm_source=oro_workbench&utm_medium=referral`,
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
