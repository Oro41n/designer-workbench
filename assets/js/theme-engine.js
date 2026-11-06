// 主题引擎：从图片像素提取 4–6 色，映射为 CSS 变量并平滑过渡
// 取色用 Canvas 真实像素，不做随机/伪造配色；失败时回退品牌色并标记

const DEFAULTS = {
  bg: '#0a0a0c',
  ink: '#f4f1ea',
  accent: '#ff4b2b',
  accent2: '#b06bff'
};

const state = {
  colors: { ...DEFAULTS },
  mode: 'dark',
  palette: null,
  source: null,
  subscribers: new Set(),
  raf: 0
};

/* ---------------- 颜色工具 ---------------- */

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = t => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const chroma = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;

/* ---------------- 取色 ---------------- */

export function extractPalette(img, k = 5) {
  try {
    const size = 40;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const pts = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 180) continue;
      pts.push([data[i], data[i + 1], data[i + 2]]);
    }
    if (pts.length < 60) return null;

    // 以亮度分位点初始化，避免随机导致每次配色跳动
    const sorted = [...pts].sort((a, b) => lum(a) - lum(b));
    let centers = Array.from({ length: k }, (_, i) => sorted[Math.floor((i + 0.5) * sorted.length / k)]);
    let groups = [];

    for (let iter = 0; iter < 9; iter++) {
      groups = Array.from({ length: k }, () => []);
      pts.forEach(p => {
        let best = 0, bestD = Infinity;
        centers.forEach((c, ci) => {
          const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
          if (d < bestD) { bestD = d; best = ci; }
        });
        groups[best].push(p);
      });
      centers = centers.map((c, ci) => {
        const g = groups[ci];
        if (!g.length) return c;
        const sum = g.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
        return sum.map(v => v / g.length);
      });
    }

    return centers
      .map((c, i) => ({ rgb: c.map(Math.round), weight: groups[i].length / pts.length }))
      .filter(c => c.weight > 0.02)
      .sort((a, b) => b.weight - a.weight);
  } catch (err) {
    console.warn('取色失败（可能被跨域限制）', err);
    return null;
  }
}

/* ---------------- 角色映射 ---------------- */

export function paletteFromClusters(clusters, mode = 'dark') {
  if (!clusters || !clusters.length) return null;
  const arr = clusters.map(c => c.rgb);
  const byLum = [...arr].sort((a, b) => lum(a) - lum(b));
  const dark = byLum[0];
  const light = byLum[byLum.length - 1];
  const byChroma = [...arr].filter(c => lum(c) > 0.04 && lum(c) < 0.92).sort((a, b) => chroma(b) - chroma(a));
  const accentBase = byChroma[0] || light;
  const second = byChroma.find(c => Math.abs(rgbToHsl(c)[0] - rgbToHsl(accentBase)[0]) > 22) || byChroma[1] || accentBase;

  const dHsl = rgbToHsl(dark);
  const lHsl = rgbToHsl(light);
  const aHsl = rgbToHsl(accentBase);
  const sHsl = rgbToHsl(second);

  const isDark = mode !== 'light';
  const bg = hslToRgb([dHsl[0], clamp(dHsl[1], 0, isDark ? 0.42 : 0.2), isDark ? 0.075 : 0.935]);
  const ink = hslToRgb([lHsl[0], clamp(lHsl[1], 0, 0.16), isDark ? 0.93 : 0.1]);
  const accent = hslToRgb([aHsl[0], clamp(Math.max(aHsl[1], 0.62), 0.45, 0.95), isDark ? 0.56 : 0.44]);
  const accent2 = hslToRgb([sHsl[0] + 26, clamp(Math.max(sHsl[1], 0.5), 0.35, 0.9), isDark ? 0.52 : 0.46]);

  return {
    bg: rgbToHex(bg),
    ink: rgbToHex(ink),
    accent: rgbToHex(accent),
    accent2: rgbToHex(accent2),
    swatches: clusters.slice(0, 6).map(c => rgbToHex(c.rgb)),
    clusters: clusters.slice(0, 6).map(c => ({ hex: rgbToHex(c.rgb), weight: Math.round(c.weight * 100) }))
  };
}

/* ---------------- 应用 / 过渡 ---------------- */

function applyVars(colors) {
  const root = document.documentElement;
  const mode = state.mode;
  root.style.setProperty('--bg', colors.bg);
  root.style.setProperty('--ink', colors.ink);
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-2', colors.accent2);
  root.style.setProperty('--on-accent', lum(hexToRgb(colors.accent)) > 0.55 ? '#101010' : '#ffffff');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', colors.bg);
  document.body.dataset.scheme = mode;
}

function dispatch() {
  state.subscribers.forEach(fn => { try { fn(state.palette, state); } catch (e) { console.error(e); } });
  window.dispatchEvent(new CustomEvent('dw:palette', {
    detail: {
      palette: state.palette,
      colors: state.colors,
      mode: state.mode,
      rgb: {
        bg: hexToRgb(state.colors.bg),
        ink: hexToRgb(state.colors.ink),
        accent: hexToRgb(state.colors.accent),
        accent2: hexToRgb(state.colors.accent2)
      }
    }
  }));
}

function animateTo(target, duration = 900) {
  const from = { ...state.colors };
  const start = performance.now();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  cancelAnimationFrame(state.raf);
  if (reduced) {
    state.colors = target;
    applyVars(target);
    dispatch();
    return;
  }
  const step = now => {
    const t = clamp((now - start) / duration, 0, 1);
    const e = 1 - Math.pow(1 - t, 3);
    const mix = key => rgbToHex(hexToRgb(from[key]).map((v, i) => v + (hexToRgb(target[key])[i] - v) * e));
    state.colors = { bg: mix('bg'), ink: mix('ink'), accent: mix('accent'), accent2: mix('accent2') };
    applyVars(state.colors);
    dispatch();
    if (t < 1) state.raf = requestAnimationFrame(step);
  };
  state.raf = requestAnimationFrame(step);
}

export function applyPalette(palette, { silent = false } = {}) {
  if (!palette) return;
  state.palette = { ...palette, mode: state.mode };
  animateTo({ bg: palette.bg, ink: palette.ink, accent: palette.accent, accent2: palette.accent2 });
  if (silent) return;
}

export async function applyImagePalette(img, { mode = state.mode } = {}) {
  const clusters = extractPalette(img);
  if (!clusters) {
    state.source = 'fallback';
    return { ok: false, reason: '取色失败：图片未通过 CORS 或像素不可读' };
  }
  const palette = paletteFromClusters(clusters, mode);
  if (!palette) return { ok: false, reason: '取色失败：颜色簇不足' };
  state.source = 'image';
  applyPalette(palette);
  return { ok: true, palette };
}

export function setMode(mode) {
  state.mode = mode === 'light' ? 'light' : 'dark';
  if (state.palette?.clusters) {
    const approx = state.palette.clusters.map(c => ({ rgb: hexToRgb(c.hex), weight: c.weight / 100 }));
    const next = paletteFromClusters(approx, state.mode);
    if (next) state.palette = { ...next, mode: state.mode };
    if (next) animateTo({ bg: next.bg, ink: next.ink, accent: next.accent, accent2: next.accent2 });
    return;
  }
  const lightDefault = {
    bg: '#f4f1ea', ink: '#141210', accent: DEFAULTS.accent, accent2: DEFAULTS.accent2
  };
  animateTo(state.mode === 'dark' ? { ...DEFAULTS } : lightDefault);
}

export function refreshTheme() {
  applyVars(state.colors);
  dispatch();
}

export function onPalette(fn) {
  state.subscribers.add(fn);
  fn(state.palette, state);
  return () => state.subscribers.delete(fn);
}

export function currentColors() { return { ...state.colors, mode: state.mode }; }

export function initThemeEngine() {
  state.colors = { ...DEFAULTS };
  applyVars(state.colors);
  state.palette = { ...DEFAULTS, swatches: Object.values(DEFAULTS), clusters: [], mode: state.mode };
  return state.colors;
}

export function defaultColors() { return { ...DEFAULTS }; }
