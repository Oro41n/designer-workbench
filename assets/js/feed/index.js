// 图流入口：adapter 选择、CORS 代理、失败降级、统一 meta
import { getFeedConfig } from './config.js';
import { ADAPTERS } from './adapters.js';

// 接口不可用时的站内备用图（Unsplash 403/429/超时都不会白屏）
const LOCAL_FALLBACK = [
  { raw: 'assets/img/work-poster.webp', title: 'City festival key visual', author: '站内备用图', authorUrl: '#/portfolio', link: '#/portfolio', license: '站内作品', color: '#a9331f' },
  { raw: 'assets/img/work-packaging.webp', title: 'Mid-autumn packaging', author: '站内备用图', authorUrl: '#/portfolio', link: '#/portfolio', license: '站内作品', color: '#b65f2b' },
  { raw: 'assets/img/work-brochure.webp', title: 'Tea brand brochure', author: '站内备用图', authorUrl: '#/portfolio', link: '#/portfolio', license: '站内作品', color: '#3ba4b0' },
  { raw: 'assets/img/work-identity.webp', title: 'Coffee identity system', author: '站内备用图', authorUrl: '#/portfolio', link: '#/portfolio', license: '站内作品', color: '#6b4b2a' }
];

const TIMEOUT_MS = 8000;

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

// 展示用：直连原图（加载最快）；取色用：Unsplash / Pexels 自带 CORS，其余走代理
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
    // 像素读取失败时的主色种子（Unsplash /photos/random 返回的 color 字段）
    paletteSeed: item.color || '',
    fallbackSrc: raw
  };
}

// 403 / 429 / 超时 / 网络分别给出可读原因，供 UI 直接展示
function classifyError(err) {
  const status = err?.status || Number(String(err?.message || '').match(/HTTP (\d{3})/)?.[1] || 0);
  if (status === 401 || status === 403) {
    return { code: 'forbidden', text: 'Unsplash 403：Access Key 无效、已被撤销，或应用没有该接口权限' };
  }
  if (status === 429) {
    return { code: 'rate_limit', text: 'Unsplash 429：Demo 应用每小时最多 50 次请求，已限流；稍后会自动恢复' };
  }
  if (err?.name === 'AbortError') {
    return { code: 'timeout', text: `Unsplash 请求超时（>${TIMEOUT_MS / 1000}s），已切换为站内备用图` };
  }
  return { code: 'network', text: '网络不可达或被浏览器跨域策略拦截，已切换为站内备用图' };
}

export async function loadFeed(overrides = {}) {
  const cfg = { ...getFeedConfig(), ...overrides };
  const requested = cfg.source && ADAPTERS[cfg.source] ? cfg.source : 'unsplash';
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    items = await adapter.fetch({ count: cfg.count || 8, query: cfg.query || '', key, signal: controller.signal });
    if (!items.length) throw new Error('空结果');
  } catch (err) {
    const reason = classifyError(err);
    meta.fallback = true;
    meta.errorCode = reason.code;
    meta.errorText = reason.text;
    meta.errorDetail = String(err?.message || err);
    items = LOCAL_FALLBACK.map((x, i) => ({ id: `local-${i}`, ...x }));
  } finally {
    clearTimeout(timer);
  }
  return { meta, items: items.map(it => prepItem(it, cfg)) };
}

export const FEED_SOURCES = Object.values(ADAPTERS).map(a => ({
  id: a.id, label: a.label, requiresKey: a.requiresKey || null
}));

// 读取图片像素（供主题引擎使用）；失败时返回 null，由调用方回退到 color 种子
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

// Unsplash 下载追踪：先请求 download_location 端点（带公开 client_id），再打开原图
// 注意：fetch 是「尽力而为」，即使被广告拦截器阻断，也不影响用户拿到图片
export function trackDownload(item) {
  const target = item?.download || item?.src || item?.link || '';
  const endpoint = item?.downloadLocation;
  if (endpoint) {
    try {
      const u = new URL(endpoint);
      const key = getFeedConfig().keys?.unsplash || '';
      if (key) u.searchParams.set('client_id', key);
      fetch(u.toString(), { cache: 'no-store', keepalive: true }).catch(() => {});
    } catch { /* 非法 URL 忽略 */ }
  }
  return target;
}
