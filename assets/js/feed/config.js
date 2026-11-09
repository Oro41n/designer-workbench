// 图流配置：换源只需改这里（或在设置页写入 localStorage）
// source 可选：unsplash | picsum | pexels | openverse
// 说明：这里的 Access Key 是「客户端公开 key」，会随静态页面一起下发；
// Unsplash Demo 应用限流 50 次/小时。Secret Key 绝不入库，只放本地 .env.local（已 gitignore）。
export const FEED_CONFIG = {
  source: 'unsplash',
  count: 8,
  // 空 query = /photos/random 全站随机；每次加载/换一批都是一次新请求，不缓存
  query: '',
  // 图片代理：仅在目标图源没有 CORS 时兜底读像素（Unsplash / Pexels 直连即可读）
  proxy: {
    image: 'https://images.weserv.nl/?url=',
    json: 'https://api.allorigins.win/raw?url='
  },
  keys: {
    // 公开 Access Key（client_id）：只用于 /photos/random 等免授权读接口
    unsplash: 'TuvMNeUw9jXJeylU8ZN7Fwlv4uNoc5DRmPodpOcsIso',
    pexels: ''
  },
  // Unsplash API 要求的来源标记；所有图片链接都会带上
  utm: 'utm_source=41n_workbench&utm_medium=referral'
};

// v2：旧版本存过 source=picsum，换 key 以免老配置把默认图源锁在备用源
const KEY = 'dw.feed.v2';

export function getFeedConfig() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { saved = {}; }
  return {
    ...FEED_CONFIG,
    ...saved,
    proxy: { ...FEED_CONFIG.proxy, ...(saved.proxy || {}) },
    keys: { ...FEED_CONFIG.keys, ...(saved.keys || {}) }
  };
}

export function setFeedConfig(patch = {}) {
  const next = {
    ...getFeedConfig(),
    ...patch,
    proxy: { ...getFeedConfig().proxy, ...(patch.proxy || {}) },
    keys: { ...getFeedConfig().keys, ...(patch.keys || {}) }
  };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 忽略隐私模式写入失败 */ }
  return next;
}
