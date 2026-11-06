// 画板数据层：每个画板独立保存在 IndexedDB，对象树 + 图片引用
import { uid } from './util.js';

const DB_NAME = 'dw-boards';
const STORE = 'boards';
const VERSION = 1;
const INIT_FLAG = 'dw.boards.init.v1';
let dbPromise = null;

export const PRESETS = [
  { id: 'a4', label: 'A4 · 印刷', sub: '210 × 297 mm / 300dpi', width: 2480, height: 3508 },
  { id: 'square', label: '社交方图', sub: '1080 × 1080 px', width: 1080, height: 1080 },
  { id: 'hd', label: '横屏 · 16:9', sub: '1920 × 1080 px', width: 1920, height: 1080 },
  { id: 'story', label: '竖屏 · 9:16', sub: '1080 × 1920 px', width: 1080, height: 1920 },
  { id: 'custom', label: '自定义', sub: '手动输入尺寸', width: 1200, height: 800 }
];

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('浏览器不支持 IndexedDB'));
    const req = indexedDB.open(DB_NAME, VERSION);
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

export function newObjectId() {
  return uid('ob');
}

export function createBoardRecord({ name = '未命名画板', width = 1080, height = 1350, bg = '#F6F1E4', objects = [] } = {}) {
  return {
    id: uid('board'),
    name,
    width: Math.max(64, Math.round(width)),
    height: Math.max(64, Math.round(height)),
    bg,
    objects,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sample: false
  };
}

export async function listBoards() {
  const list = await withStore('readonly', store => requestToPromise(store.getAll()));
  return (list || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getBoard(id) {
  if (!id) return null;
  return withStore('readonly', store => requestToPromise(store.get(id)));
}

export async function putBoard(board) {
  board.updatedAt = Date.now();
  await withStore('readwrite', store => store.put(board));
  return board;
}

export async function removeBoard(id) {
  await withStore('readwrite', store => store.delete(id));
}

export async function duplicateBoard(id) {
  const source = await getBoard(id);
  if (!source) return null;
  const copy = {
    ...source,
    id: uid('board'),
    name: `${source.name} 副本`,
    objects: (source.objects || []).map(o => ({ ...o, id: newObjectId() })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sample: false
  };
  await putBoard(copy);
  return copy;
}

export async function countBoards() {
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

export async function clearBoards() {
  await withStore('readwrite', store => store.clear());
  try { localStorage.setItem(INIT_FLAG, '1'); } catch { /* ignore */ }
}

export async function deleteSampleBoards() {
  const list = (await listBoards()).filter(b => b.sample);
  await Promise.all(list.map(b => removeBoard(b.id)));
  return list.length;
}

export async function exportBoards() {
  return listBoards();
}

export async function importBoards(list = []) {
  const valid = Array.isArray(list) ? list.filter(b => b && b.id && Array.isArray(b.objects)) : [];
  await Promise.all(valid.map(b => withStore('readwrite', store => store.put({
    ...b,
    updatedAt: b.updatedAt || Date.now(),
    createdAt: b.createdAt || Date.now()
  }))));
  return valid.length;
}

// 首次访问时放一张示例画板（带明确「示例」标记，可删除）
export async function ensureSampleBoard() {
  try {
    if (localStorage.getItem(INIT_FLAG)) return null;
    localStorage.setItem(INIT_FLAG, '1');
    const existing = await listBoards();
    if (existing.length) return null;
    const sample = sampleBoard();
    await putBoard(sample);
    return sample;
  } catch (err) {
    console.warn('示例画板创建失败', err);
    return null;
  }
}

function sampleBoard() {
  const board = createBoardRecord({ name: '示例 · 印前试验 01', width: 1080, height: 1350, bg: '#F6F1E4' });
  board.sample = true;
  const base = {
    rotation: 0, opacity: 1, blend: 'normal', stroke: '#16130E', strokeWidth: 0,
    radius: 0, hidden: false, locked: false
  };
  board.objects = [
    {
      ...base, id: newObjectId(), type: 'rect', name: '朱红底块',
      x: 84, y: 112, w: 912, h: 512, fill: '#A9331F', radius: 2
    },
    {
      ...base, id: newObjectId(), type: 'ellipse', name: '墨色圆',
      x: 612, y: 156, w: 340, h: 340, fill: '#16130E', opacity: .9
    },
    {
      ...base, id: newObjectId(), type: 'rect', name: '纸白方块',
      x: 150, y: 408, w: 296, h: 296, fill: '#F6F1E4', rotation: 14, opacity: .95, blend: 'normal'
    },
    {
      ...base, id: newObjectId(), type: 'line', name: '套准线',
      x: 84, y: 700, w: 912, h: 0, stroke: '#16130E', strokeWidth: 2
    },
    {
      ...base, id: newObjectId(), type: 'text', name: '主标题',
      x: 84, y: 748, w: 912, h: 190, fill: '#16130E',
      text: '印前工作台', fontSize: 132, fontWeight: 600, lineHeight: 1.18, align: 'left'
    },
    {
      ...base, id: newObjectId(), type: 'text', name: '副标题',
      x: 84, y: 960, w: 912, h: 50, fill: '#6C6455',
      text: 'PRINT STUDIO / 2026 · 示例画板', fontSize: 27, fontWeight: 400, lineHeight: 1.4, align: 'left'
    },
    {
      ...base, id: newObjectId(), type: 'text', name: '说明',
      x: 84, y: 1130, w: 640, h: 110, fill: '#3B3428',
      text: '按 ⌘K 打开命令面板，\n或从左侧工具栏开始画。', fontSize: 23, fontWeight: 400, lineHeight: 1.7, align: 'left'
    },
    {
      ...base, id: newObjectId(), type: 'rect', name: '记号条',
      x: 84, y: 1272, w: 76, h: 7, fill: '#A9331F'
    }
  ];
  return board;
}
