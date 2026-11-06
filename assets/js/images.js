// IndexedDB 图片存储：上传图片压缩到最长边 1600px 后存入本地数据库
const DB_NAME = 'dw-images';
const STORE = 'images';
const DB_VERSION = 1;
const urlCache = new Map();
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('浏览器不支持 IndexedDB'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function withStore(mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    try { result = fn(store, tx); } catch (err) { reject(err); return; }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function decode(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* 回退 */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解码失败'));
    img.src = URL.createObjectURL(file);
  });
}

export async function compressImage(file, max = 1600, quality = 0.82) {
  if (!file || !file.type?.startsWith('image/')) throw new Error('请选择图片文件');
  const bitmap = await decode(file);
  const w0 = bitmap.width || bitmap.naturalWidth;
  const h0 = bitmap.height || bitmap.naturalHeight;
  const scale = Math.min(1, max / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#F4F0E7';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('图片压缩失败');
  return { blob, width: w, height: h };
}

export async function saveImage(file, max = 1600) {
  const { blob, width, height } = await compressImage(file, max);
  const id = `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  await withStore('readwrite', store => store.put({
    id, blob, width, height, name: file.name || 'image', createdAt: Date.now()
  }));
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return { id, width, height, url };
}

export async function getImage(id) {
  if (!id) return null;
  return withStore('readonly', store => requestToPromise(store.get(id)));
}

export async function getImageURL(id) {
  if (!id) return '';
  if (urlCache.has(id)) return urlCache.get(id);
  try {
    const rec = await getImage(id);
    if (!rec?.blob) return '';
    const url = URL.createObjectURL(rec.blob);
    urlCache.set(id, url);
    return url;
  } catch (err) {
    console.warn('读取图片失败', err);
    return '';
  }
}

export async function deleteImage(id) {
  if (!id) return;
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
  try { await withStore('readwrite', store => store.delete(id)); } catch (err) { console.warn(err); }
}

export async function countImages() {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch { return 0; }
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function exportImages() {
  const out = {};
  try {
    const db = await openDB();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    for (const rec of records) out[rec.id] = await blobToDataURL(rec.blob);
  } catch (err) {
    console.warn('导出图片失败', err);
  }
  return out;
}

export async function importImages(map = {}) {
  const jobs = Object.entries(map).map(async ([id, dataUrl]) => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await withStore('readwrite', store => store.put({ id, blob, width: 0, height: 0, name: 'imported', createdAt: Date.now() }));
    } catch (err) { console.warn('导入图片失败', id, err); }
  });
  await Promise.all(jobs);
}

// 把 DOM 中带 data-img 的占位图片替换为 IndexedDB 中的真实图片
export async function hydrateImages(root = document) {
  const nodes = [...root.querySelectorAll('img[data-img]')];
  await Promise.all(nodes.map(async node => {
    const id = node.getAttribute('data-img');
    const url = await getImageURL(id);
    if (!url) {
      node.classList.add('is-missing');
      const parent = node.closest('.cover');
      if (parent) parent.classList.add('is-empty');
      return;
    }
    node.src = url;
    node.removeAttribute('data-img');
  }));
}
