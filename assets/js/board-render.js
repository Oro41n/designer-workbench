// 画板渲染：Canvas 2D（编辑器 / PNG 导出）与 SVG 生成（预览 / SVG 导出）
import { getImage, getImageURL } from './images.js';
import { escapeHtml } from './util.js';

export const FONT_STACK = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif';
const loaded = new Map();
const pending = new Map();
let measureCtx = null;

function ctxForMeasure() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

export async function loadBoardImage(id) {
  if (!id) return null;
  if (loaded.has(id)) return loaded.get(id);
  if (pending.has(id)) return pending.get(id);
  const job = (async () => {
    const url = await getImageURL(id);
    if (!url) return null;
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { loaded.set(id, img); resolve(img); };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  })();
  pending.set(id, job);
  return job;
}

export function cachedImage(id) {
  return loaded.get(id) || null;
}

export async function imageMapFor(board) {
  const ids = [...new Set((board.objects || []).filter(o => o.type === 'image' && o.imageId).map(o => o.imageId))];
  await Promise.all(ids.map(loadBoardImage));
  return new Map(ids.map(id => [id, cachedImage(id)]).filter(([, img]) => img));
}

export function fontOf(obj) {
  return `${obj.fontWeight || 400} ${Math.max(1, Number(obj.fontSize) || 32)}px ${FONT_STACK}`;
}

export function wrapText(ctx, text, maxWidth, font) {
  ctx.font = font;
  const out = [];
  const paragraphs = String(text ?? '').split('\n');
  for (const para of paragraphs) {
    if (!para) { out.push(''); continue; }
    let line = '';
    for (const ch of [...para]) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [''];
}

function roundRect(ctx, w, h, r) {
  const radius = Math.max(0, Math.min(Number(r) || 0, Math.min(w, h) / 2));
  if (!radius) { ctx.rect(0, 0, w, h); return; }
  ctx.moveTo(radius, 0);
  ctx.lineTo(w - radius, 0);
  ctx.quadraticCurveTo(w, 0, w, radius);
  ctx.lineTo(w, h - radius);
  ctx.quadraticCurveTo(w, h, w - radius, h);
  ctx.lineTo(radius, h);
  ctx.quadraticCurveTo(0, h, 0, h - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
}

function blendOf(blend) {
  if (blend === 'multiply') return 'multiply';
  if (blend === 'screen') return 'screen';
  return 'source-over';
}

export function drawObject(ctx, obj, images = new Map()) {
  if (!obj || obj.hidden) return;
  const w = Math.max(1, Number(obj.w) || 0);
  const h = Math.max(1, Number(obj.h) || 0);
  ctx.save();
  ctx.globalAlpha = obj.opacity == null ? 1 : Math.max(0, Math.min(1, Number(obj.opacity)));
  ctx.globalCompositeOperation = blendOf(obj.blend);
  ctx.translate((Number(obj.x) || 0) + w / 2, (Number(obj.y) || 0) + h / 2);
  ctx.rotate(((Number(obj.rotation) || 0) * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);

  const type = obj.type;
  const strokeW = Number(obj.strokeWidth) || 0;
  const stroke = obj.stroke || '#16130E';

  if (type === 'rect' || type === 'ellipse') {
    ctx.beginPath();
    if (type === 'rect') roundRect(ctx, w, h, obj.radius);
    else ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    if (obj.fill && obj.fill !== 'transparent') {
      ctx.fillStyle = obj.fill;
      ctx.fill();
    }
    if (strokeW > 0) {
      ctx.lineWidth = strokeW;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  } else if (type === 'line') {
    ctx.beginPath();
    if (obj.flip) { ctx.moveTo(0, h); ctx.lineTo(w, 0); }
    else { ctx.moveTo(0, 0); ctx.lineTo(w, h); }
    ctx.lineWidth = Math.max(1, strokeW || 1);
    ctx.strokeStyle = stroke;
    ctx.stroke();
  } else if (type === 'text') {
    const size = Math.max(1, Number(obj.fontSize) || 32);
    const lineHeight = (Number(obj.lineHeight) || 1.4) * size;
    const align = obj.align || 'left';
    ctx.font = fontOf(obj);
    ctx.fillStyle = obj.fill || '#16130E';
    ctx.textBaseline = 'top';
    ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
    const x = align === 'center' ? w / 2 : align === 'right' ? w : 0;
    const lines = wrapText(ctx, obj.text, w, ctx.font);
    lines.forEach((line, i) => ctx.fillText(line, x, i * lineHeight));
  } else if (type === 'image') {
    const img = images.get(obj.imageId) || cachedImage(obj.imageId);
    ctx.beginPath();
    roundRect(ctx, w, h, obj.radius);
    ctx.save();
    ctx.clip();
    if (img) {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const scale = Math.max(w / iw, h / ih);
      const sw = w / scale;
      const sh = h / scale;
      ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, w, h);
    } else {
      ctx.fillStyle = 'rgba(23,20,15,.12)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(246,241,228,.85)';
      ctx.font = `500 ${Math.max(10, Math.min(18, w / 12))}px ${FONT_STACK}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('图片', w / 2, h / 2);
    }
    ctx.restore();
    if (strokeW > 0) {
      ctx.beginPath();
      roundRect(ctx, w, h, obj.radius);
      ctx.lineWidth = strokeW;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawBoardObjects(ctx, board, images = new Map()) {
  (board.objects || []).forEach(obj => drawObject(ctx, obj, images));
}

function num(n) {
  const v = Number(n) || 0;
  return Math.round(v * 100) / 100;
}

function objectSVG(obj, imageUrls = {}, index = 0) {
  if (!obj || obj.hidden) return '';
  const w = Math.max(1, Number(obj.w) || 0);
  const h = Math.max(1, Number(obj.h) || 0);
  const opacity = obj.opacity == null ? 1 : Math.max(0, Math.min(1, Number(obj.opacity)));
  const rotation = Number(obj.rotation) || 0;
  const blend = obj.blend === 'multiply' || obj.blend === 'screen' ? ` style="mix-blend-mode:${obj.blend}"` : '';
  const strokeW = Number(obj.strokeWidth) || 0;
  const stroke = obj.stroke || '#16130E';
  const strokeAttr = strokeW > 0 ? ` stroke="${escapeHtml(stroke)}" stroke-width="${num(strokeW)}"` : '';
  const common = `opacity="${num(opacity)}"${blend}`;
  const transform = `translate(${num((Number(obj.x) || 0) + w / 2)} ${num((Number(obj.y) || 0) + h / 2)}) rotate(${num(rotation)}) translate(${num(-w / 2)} ${num(-h / 2)})`;

  let body = '';
  if (obj.type === 'rect') {
    const fill = obj.fill && obj.fill !== 'transparent' ? ` fill="${escapeHtml(obj.fill)}"` : ' fill="none"';
    body = `<rect width="${num(w)}" height="${num(h)}" rx="${num(obj.radius)}"${fill}${strokeAttr}/>`;
  } else if (obj.type === 'ellipse') {
    const fill = obj.fill && obj.fill !== 'transparent' ? ` fill="${escapeHtml(obj.fill)}"` : ' fill="none"';
    body = `<ellipse cx="${num(w / 2)}" cy="${num(h / 2)}" rx="${num(w / 2)}" ry="${num(h / 2)}"${fill}${strokeAttr}/>`;
  } else if (obj.type === 'line') {
    body = obj.flip
      ? `<line x1="0" y1="${num(h)}" x2="${num(w)}" y2="0" stroke="${escapeHtml(stroke)}" stroke-width="${num(Math.max(1, strokeW || 1))}"${blend}/>`
      : `<line x1="0" y1="0" x2="${num(w)}" y2="${num(h)}" stroke="${escapeHtml(stroke)}" stroke-width="${num(Math.max(1, strokeW || 1))}"${blend}/>`;
  } else if (obj.type === 'text') {
    const size = Math.max(1, Number(obj.fontSize) || 32);
    const lineHeight = (Number(obj.lineHeight) || 1.4) * size;
    const align = obj.align || 'left';
    const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
    const x = align === 'center' ? w / 2 : align === 'right' ? w : 0;
    const lines = wrapText(ctxForMeasure(), obj.text, w, fontOf(obj));
    body = lines.map((line, i) =>
      `<text x="${num(x)}" y="${num(i * lineHeight + size)}" font-family="${escapeHtml(FONT_STACK)}" font-size="${num(size)}" font-weight="${Number(obj.fontWeight) || 400}" fill="${escapeHtml(obj.fill || '#16130E')}" text-anchor="${anchor}">${escapeHtml(line)}</text>`
    ).join('');
  } else if (obj.type === 'image') {
    const href = imageUrls[obj.imageId];
    if (href) {
      const clip = `clip-${index}-${String(obj.id).replace(/[^\w-]/g, '')}`;
      body = `<clipPath id="${clip}"><rect width="${num(w)}" height="${num(h)}" rx="${num(obj.radius)}"/></clipPath>`
        + `<image href="${escapeHtml(href)}" width="${num(w)}" height="${num(h)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`;
    } else {
      body = `<rect width="${num(w)}" height="${num(h)}" rx="${num(obj.radius)}" fill="#D8CCB5"/>`;
    }
  }
  if (!body) return '';
  return `<g transform="${transform}" ${common}>${body}</g>`;
}

export function previewSVG(board, { imageUrls = {} } = {}) {
  if (!board) return '';
  const w = board.width || 1080;
  const h = board.height || 1350;
  const objects = (board.objects || []).map((o, i) => objectSVG(o, imageUrls, i)).join('');
  return `<svg class="board-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(board.name || '画板预览')}" preserveAspectRatio="xMidYMid meet">
    <rect width="${w}" height="${h}" fill="${escapeHtml(board.bg || '#F6F1E4')}"/>
    ${objects}
  </svg>`;
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function collectImageDataURLs(board) {
  const ids = [...new Set((board.objects || []).filter(o => o.type === 'image' && o.imageId).map(o => o.imageId))];
  const entries = await Promise.all(ids.map(async id => {
    try {
      const rec = await getImage(id);
      return rec?.blob ? [id, await blobToDataURL(rec.blob)] : [id, ''];
    } catch { return [id, '']; }
  }));
  return Object.fromEntries(entries.filter(([, url]) => url));
}

export async function boardToSVG(board, { transparent = false } = {}) {
  const imageUrls = await collectImageDataURLs(board);
  const w = Math.round(board.width);
  const h = Math.round(board.height);
  const objects = (board.objects || []).map((o, i) => objectSVG(o, imageUrls, i)).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${transparent ? '' : `<rect width="${w}" height="${h}" fill="${escapeHtml(board.bg || '#F6F1E4')}"/>`}
${objects}
</svg>`;
}

export async function exportBoardCanvas(board, { scale = 1, transparent = false } = {}) {
  const images = await imageMapFor(board);
  const w = Math.round(board.width);
  const h = Math.round(board.height);
  let s = Math.max(1, Math.min(4, Number(scale) || 1));
  const MAX_PIXELS = 36e6;
  if (w * h * s * s > MAX_PIXELS) s = Math.sqrt(MAX_PIXELS / (w * h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * s));
  canvas.height = Math.max(1, Math.round(h * s));
  const ctx = canvas.getContext('2d');
  if (!transparent) {
    ctx.fillStyle = board.bg || '#F6F1E4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.scale(s, s);
  drawBoardObjects(ctx, board, images);
  return { canvas, scale: s };
}
