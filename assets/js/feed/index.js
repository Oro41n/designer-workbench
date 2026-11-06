// 图流入口：adapter 选择、CORS 代理、失败降级、统一 meta
import { getFeedConfig } from './config.js';
import { ADAPTERS } from './adapters.js';

const LOCAL_FALLBACK = [
  { raw: 'assets/img/work-poster.webp', title: 'City festival key visual', author: 'Local archive', authorUrl: '#/portfolio', link: '#/portfolio', license: '站内作品' },
  { raw: 'assets/img/work-packaging.webp', title: 'Mid-autumn packaging', author: 'Local archive', authorUrl: '#/portfolio', link: '#/portfolio', license: '站内作品' },
  { raw: 'assets/img/work-brochure.webp', title: 'Tea brand brochure', author: 'Local archive', authorUrl: '#/portfolio', link: '#/portfolio', license: '站内作品' },
  { raw: 'assets/img/work-identity.webp', title: 'Coffee identity system', author: 'Local archive', authorUrl: '#/portfolio', link: '#/portfolio', license: '站内作品' }
];

function sizedRaw(raw) {
  if (!raw || /^(assets\/|data:|blob:)/.test(raw)) return raw;
  try {
    const u = new URL(raw);
    if (u.hostname === 'images.unsplash.com') {
      const sep = raw.includes('?') ? '&' : '?';
      return `${raw}${sep}w=1400&q=80&fm=jpg&fit=crop`;
    }
    if (u.hostname === 'images.pexels.com') {
      const sep = raw.includes('?') ? '&' : '?';
      return `${raw}${sep}auto=compress&cs=tinysrgb&w=1400`;
    }
  } catch { /* 非绝对 URL */ }
  return raw;
}

// 展示用：直连原图（加载最快）；取色用：走 CORS 代理（否则 Canvas 被污染）
function corsSrc(raw, proxy) {
  if (!raw || /^(assets\/|data:|blob:)/.test(raw)) return raw;
  try {
    const host = new URL(raw).hostname;
    if (host === 'images.unsplash.com' || host === 'images.pexels.com') return sizedRaw(raw);
  } catch { /* 忽略 */ }
  const bare = String(raw).replace(/^https?:\/\//, '');
  return `${proxy}${encodeURIComponent(bare)}&w=1400&q=82&output=jpg`;
}

export function prepItem(item, cfg) {
  const raw = item.raw;
  return {
    ...item,
    raw,
    src: sizedRaw(raw),
    corsSrc: corsSrc(raw, cfg.proxy.image),
    fallbackSrc: raw
  };
}

export async function loadFeed(overrides = {}) {
  const cfg = { ...getFeedConfig(), ...overrides };
  const requested = cfg.source && ADAPTERS[cfg.source] ? cfg.source : 'picsum';
  const keyRequired = ADAPTERS[requested]?.requiresKey;
  const key = keyRequired ? (cfg.keys?.[keyRequired] || '') : '';

  let adapter = ADAPTERS[requested];
  let downgraded = null;
  if (keyRequired && !key) {
    adapter = ADAPTERS.picsum;
    downgraded = `缺少 ${ADAPTERS[requested].label} 的 API Key，已降级为 ${adapter.label}`;
  }

  const meta = {
    sourceId: adapter.id,
    source: adapter.label,
    home: adapter.home,
    license: adapter.license,
    licenseUrl: adapter.licenseUrl,
    refresh: adapter.refresh,
    note: adapter.note,
    fetchedAt: new Date(),
    downgraded,
    fallback: false
  };

  let items = [];
  try {
    items = await adapter.fetch({ count: cfg.count || 8, query: cfg.query || '', key });
    if (!items.length) throw new Error('空结果');
  } catch (err) {
    meta.fallback = true;
    meta.error = String(err?.message || err);
    items = LOCAL_FALLBACK.map((x, i) => ({ id: `local-${i}`, ...x }));
  }
  return { meta, items: items.map(it => prepItem(it, cfg)) };
}

export const FEED_SOURCES = Object.values(ADAPTERS).map(a => ({
  id: a.id, label: a.label, requiresKey: a.requiresKey || null
}));

// 读取图片像素（供主题引擎使用）；失败时返回 null，由调用方回退
export function loadBitmap(url, timeout = 6000) {
  return new Promise(resolve => {
    let done = false;
    const finish = value => { if (!done) { done = true; resolve(value); } };
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    setTimeout(() => finish(null), timeout);
    img.src = url;
  });
}
