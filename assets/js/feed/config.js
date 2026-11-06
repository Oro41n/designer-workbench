// 图流配置：换源只需改这里（或在设置页写入 localStorage）
// source 可选：picsum | unsplash | pexels | openverse
export const FEED_CONFIG = {
  source: 'picsum',
  count: 8,
  query: 'editorial design typography poster',
  // 图片代理：仅为让 Canvas 能读取像素取色（CORS），不改变图片内容
  proxy: {
    image: 'https://images.weserv.nl/?url=',
    json: 'https://api.allorigins.win/raw?url='
  },
  // 填 key 后自动启用对应图库；也可在设置页保存到 localStorage
  keys: { unsplash: '', pexels: '' }
};

const KEY = 'dw.feed.v1';

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
