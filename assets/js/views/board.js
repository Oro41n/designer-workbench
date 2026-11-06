// 画板编辑器：无限画布、工具、图层、属性、历史、吸附与导出
import { icon } from '../icons.js';
import { openModal, toast } from '../ui.js';
import { escapeHtml, clamp, downloadBlob, downloadFile } from '../util.js';
import { saveImage } from '../images.js';
import { getBoard, putBoard, newObjectId } from '../boards.js';
import {
  drawObject, imageMapFor, loadBoardImage, previewSVG,
  boardToSVG, exportBoardCanvas
} from '../board-render.js';

const TOOLS = [
  { id: 'select', icon: 'cursor', label: '选择', key: 'V' },
  { id: 'rect', icon: 'rect', label: '矩形', key: 'R' },
  { id: 'ellipse', icon: 'ellipse', label: '椭圆', key: 'O' },
  { id: 'line', icon: 'line', label: '直线', key: 'L' },
  { id: 'text', icon: 'text', label: '文字', key: 'T' },
  { id: 'image', icon: 'image', label: '图片', key: 'I' },
  { id: 'hand', icon: 'hand', label: '手型', key: 'H' }
];
const TYPE_NAMES = { rect: '矩形', ellipse: '椭圆', line: '直线', text: '文字', image: '图片' };
const HANDLES = [
  ['nw', -1, -1], ['n', 0, -1], ['ne', 1, -1], ['e', 1, 0],
  ['se', 1, 1], ['s', 0, 1], ['sw', -1, 1], ['w', -1, 0]
];
const MONO = '10px "SFMono-Regular", Consolas, monospace';

export default {
  mount(root, ctx) {
    root.innerHTML = shellHTML();
    const stage = root.querySelector('#ed-stage');
    const canvas = root.querySelector('#ed-canvas');
    const textarea = root.querySelector('#ed-text');
    const layersEl = root.querySelector('#ed-layers');
    const propsEl = root.querySelector('#ed-props');
    const boot = root.querySelector('#ed-boot');
    const nameInput = root.querySelector('#ed-name');
    const metaEl = root.querySelector('#ed-meta');
    const zoomLabel = root.querySelector('#ed-zoom-label');
    const saveEl = root.querySelector('#ed-save');
    const countEl = root.querySelector('#ed-count');
    const fileInput = root.querySelector('#ed-file');
    const editorEl = root.querySelector('.editor');

    let board = null;
    let selectedId = null;
    let tool = 'select';
    let zoom = 1;
    let pan = { x: 0, y: 0 };
    let drag = null;
    let editingId = null;
    let textInitial = '';
    let spaceDown = false;
    let showRulers = true;
    let showGrid = true;
    let pixelSnap = false;
    let guides = [];
    let images = new Map();
    let history = { stack: [], index: 0 };
    let saveTimer = null;
    let dirty = false;
    let rafId = 0;
    let didFit = false;
    let clipboard = null;
    let tokens = readTokens();
    let destroyed = false;
    const cleanups = [];

    const themeObs = new MutationObserver(() => { tokens = readTokens(); schedule(); });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    cleanups.push(() => themeObs.disconnect());

    const ro = new ResizeObserver(() => { resizeCanvas(); if (!didFit) fitBoard(); schedule(); });
    ro.observe(stage);
    cleanups.push(() => ro.disconnect());

    const ctx2d = canvas.getContext('2d');
    setTool('select');

    (async () => {
      const id = ctx?.param;
      const loaded = id ? await getBoard(id) : null;
      if (destroyed) return;
      if (!loaded) {
        boot.innerHTML = `<div class="ed-missing"><p class="kicker">Sheet not found</p><h2>找不到这张画板</h2><p>它可能已被删除。返回画板架重新选择。</p><a class="btn" href="#/boards">返回画板架</a></div>`;
        return;
      }
      board = loaded;
      board.objects = board.objects || [];
      nameInput.value = board.name;
      images = await imageMapFor(board);
      if (destroyed) return;
      boot.remove();
      history.stack = [snapshotBoard()];
      history.index = 0;
      updateHeader();
      updateHistoryUI();
      renderLayers();
      renderProps();
      updateCount();
      setSaveState('已保存', '');
      setTimeout(() => { resizeCanvas(); fitBoard(); }, 0);
    })();

    // ---------- 相机 ----------
    function stageSize() {
      const r = stage.getBoundingClientRect();
      return { w: Math.max(1, r.width), h: Math.max(1, r.height), left: r.left, top: r.top };
    }

    function resizeCanvas() {
      const { w, h } = stageSize();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = Math.round(w * dpr);
      const ch = Math.round(h * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
    }

    function fitBoard() {
      if (!board) return;
      const { w, h } = stageSize();
      const pad = 64;
      const z = clamp(Math.min((w - pad * 2) / board.width, (h - pad * 2) / board.height), 0.25, 4);
      zoom = z;
      pan.x = (w - board.width * zoom) / 2;
      pan.y = (h - board.height * zoom) / 2;
      didFit = true;
      updateZoomLabel();
      schedule();
    }

    function updateZoomLabel() {
      if (zoomLabel) zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
      if (countEl) countEl.textContent = `${board?.objects.length || 0} 个对象`;
    }

    function zoomAt(factor, point) {
      const p = point || { x: stageSize().w / 2, y: stageSize().h / 2 };
      const world = screenToWorld(p);
      zoom = clamp(zoom * factor, 0.25, 4);
      pan.x = p.x - world.x * zoom;
      pan.y = p.y - world.y * zoom;
      updateZoomLabel();
      schedule();
    }

    function screenToWorld(p) {
      return { x: (p.x - pan.x) / zoom, y: (p.y - pan.y) / zoom };
    }

    function stagePoint(e) {
      const r = stage.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    // ---------- 渲染 ----------
    function schedule() {
      if (rafId || destroyed) return;
      rafId = requestAnimationFrame(() => { rafId = 0; draw(); });
    }

    function draw() {
      if (!board) return;
      resizeCanvas();
      const { w, h } = stageSize();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const g = ctx2d;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = tokens.stage;
      g.fillRect(0, 0, canvas.width, canvas.height);

      // 画框阴影 + 纸张
      g.save();
      g.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * pan.x, dpr * pan.y);
      const shadow = 10 / zoom;
      g.fillStyle = 'rgba(0,0,0,.42)';
      g.fillRect(shadow * 0.7, shadow, board.width, board.height);
      g.fillStyle = board.bg || '#F6F1E4';
      g.fillRect(0, 0, board.width, board.height);

      const paperDark = isDarkColor(board.bg);
      if (showGrid) drawGrid(g, paperDark);

      g.save();
      g.beginPath();
      g.rect(0, 0, board.width, board.height);
      g.clip();
      board.objects.forEach(obj => {
        if (obj.id === editingId) return;
        drawObject(g, obj, images);
      });
      g.restore();

      g.lineWidth = 1 / zoom;
      g.strokeStyle = paperDark ? 'rgba(255,255,255,.28)' : 'rgba(23,20,15,.24)';
      g.strokeRect(0, 0, board.width, board.height);
      g.restore();

      // 屏幕空间：裁切标记、标尺、参考线、选择框
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCropMarks(g);
      if (showRulers) drawRulers(g, w, h);
      drawGuides(g);
      drawSelection(g);
      drawFrameLabel(g);

      if (countEl) countEl.textContent = `${board.objects.length} 个对象`;
    }

    function drawGrid(g, paperDark) {
      let step = 10;
      while (step * zoom < 14) step *= 2;
      const minor = paperDark ? 'rgba(255,255,255,.055)' : 'rgba(23,20,15,.055)';
      const major = paperDark ? 'rgba(255,255,255,.11)' : 'rgba(23,20,15,.11)';
      g.lineWidth = 1 / zoom;
      for (let x = 0; x <= board.width; x += step) {
        g.strokeStyle = x % (step * 5) === 0 ? major : minor;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, board.height); g.stroke();
      }
      for (let y = 0; y <= board.height; y += step) {
        g.strokeStyle = y % (step * 5) === 0 ? major : minor;
        g.beginPath(); g.moveTo(0, y); g.lineTo(board.width, y); g.stroke();
      }
    }

    function drawCropMarks(g) {
      const fx = pan.x;
      const fy = pan.y;
      const fw = board.width * zoom;
      const fh = board.height * zoom;
      const offset = 8;
      const len = 16;
      g.strokeStyle = tokens.accent;
      g.lineWidth = 1.5;
      const corner = (x, y, dx, dy) => {
        g.beginPath();
        g.moveTo(x + dx * offset, y + dy * offset);
        g.lineTo(x + dx * (offset + len), y + dy * offset);
        g.moveTo(x + dx * offset, y + dy * offset);
        g.lineTo(x + dx * offset, y + dy * (offset + len));
        g.stroke();
      };
      corner(fx, fy, -1, -1);
      corner(fx + fw, fy, 1, -1);
      corner(fx, fy + fh, -1, 1);
      corner(fx + fw, fy + fh, 1, 1);
    }

    function drawFrameLabel(g) {
      const fx = pan.x;
      const fy = pan.y;
      g.font = `10px "SFMono-Regular", Consolas, monospace`;
      g.fillStyle = 'rgba(240,233,217,.55)';
      g.textBaseline = 'bottom';
      g.textAlign = 'left';
      if (fy > 26) g.fillText(`FRAME 01 · ${board.name} — ${board.width} × ${board.height}px`, fx, fy - 14);
    }

    function drawRulers(g, w, h) {
      const size = 18;
      g.fillStyle = tokens.rulerBg;
      g.fillRect(0, 0, w, size);
      g.fillRect(0, 0, size, h);
      g.strokeStyle = tokens.rulerLine;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, size - 0.5); g.lineTo(w, size - 0.5);
      g.moveTo(size - 0.5, 0); g.lineTo(size - 0.5, h);
      g.stroke();
      g.font = MONO;
      g.fillStyle = tokens.rulerText;
      g.textBaseline = 'top';

      let step = 10;
      while (step * zoom < 52) step *= 5;
      const startX = Math.floor((0 - pan.x) / zoom / step) * step;
      const endX = (w - pan.x) / zoom;
      for (let wx = startX; wx <= endX; wx += step) {
        const sx = Math.round(pan.x + wx * zoom) + 0.5;
        if (sx < size) continue;
        g.strokeStyle = tokens.rulerLine;
        g.beginPath(); g.moveTo(sx, size - 7); g.lineTo(sx, size); g.stroke();
        g.fillText(String(Math.round(wx)), sx + 3, 3);
        for (let k = 1; k < 5; k++) {
          const mx = Math.round(pan.x + (wx + (step / 5) * k) * zoom) + 0.5;
          if (mx < size) continue;
          g.beginPath(); g.moveTo(mx, size - 4); g.lineTo(mx, size); g.stroke();
        }
      }
      const startY = Math.floor((0 - pan.y) / zoom / step) * step;
      const endY = (h - pan.y) / zoom;
      for (let wy = startY; wy <= endY; wy += step) {
        const sy = Math.round(pan.y + wy * zoom) + 0.5;
        if (sy < size) continue;
        g.strokeStyle = tokens.rulerLine;
        g.beginPath(); g.moveTo(size - 7, sy); g.lineTo(size, sy); g.stroke();
        g.save();
        g.translate(3, sy + 3);
        g.rotate(-Math.PI / 2);
        g.fillText(String(Math.round(wy)), 0, 0);
        g.restore();
      }
      g.fillStyle = tokens.rulerBg;
      g.fillRect(0, 0, size, size);
      g.strokeStyle = tokens.rulerLine;
      g.strokeRect(0.5, 0.5, size, size);
    }

    function drawGuides(g) {
      if (!guides.length) return;
      const fx = pan.x;
      const fy = pan.y;
      const fw = board.width * zoom;
      const fh = board.height * zoom;
      g.strokeStyle = tokens.accent;
      g.lineWidth = 1;
      g.setLineDash([4, 4]);
      guides.forEach(guide => {
        g.beginPath();
        if (guide.axis === 'x') {
          const sx = Math.round(pan.x + guide.pos * zoom) + 0.5;
          g.moveTo(sx, fy - 8);
          g.lineTo(sx, fy + fh + 8);
        } else {
          const sy = Math.round(pan.y + guide.pos * zoom) + 0.5;
          g.moveTo(fx - 8, sy);
          g.lineTo(fx + fw + 8, sy);
        }
        g.stroke();
      });
      g.setLineDash([]);
    }

    function selectedObj() {
      return board?.objects.find(o => o.id === selectedId) || null;
    }

    function objectScreenPoints(o) {
      const rad = ((Number(o.rotation) || 0) * Math.PI) / 180;
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      return HANDLES.map(([id, dx, dy]) => {
        const lx = (dx * o.w) / 2;
        const ly = (dy * o.h) / 2;
        const wx = cx + lx * Math.cos(rad) - ly * Math.sin(rad);
        const wy = cy + lx * Math.sin(rad) + ly * Math.cos(rad);
        return { id, x: pan.x + wx * zoom, y: pan.y + wy * zoom };
      });
    }

    function rotationPoint(o) {
      const rad = ((Number(o.rotation) || 0) * Math.PI) / 180;
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      const dist = o.h / 2 + 26 / zoom;
      const wx = cx + dist * Math.sin(rad);
      const wy = cy - dist * Math.cos(rad);
      return { x: pan.x + wx * zoom, y: pan.y + wy * zoom };
    }

    function drawSelection(g) {
      const o = selectedObj();
      if (!o || o.id === editingId) return;
      const pts = objectScreenPoints(o);
      g.strokeStyle = tokens.accent;
      g.lineWidth = 1.25;
      const order = ['nw', 'ne', 'se', 'sw'];
      const byId = Object.fromEntries(pts.map(p => [p.id, p]));
      g.beginPath();
      order.forEach((id, i) => {
        const p = byId[id];
        if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
      });
      g.closePath();
      g.stroke();
      const rot = rotationPoint(o);
      const top = (byId.nw.x + byId.ne.x) / 2;
      const topY = (byId.nw.y + byId.ne.y) / 2;
      g.beginPath();
      g.moveTo(top, topY);
      g.lineTo(rot.x, rot.y);
      g.stroke();
      g.beginPath();
      g.arc(rot.x, rot.y, 4, 0, Math.PI * 2);
      g.fillStyle = '#F6F1E4';
      g.fill();
      g.stroke();
      pts.forEach(p => {
        g.fillStyle = o.locked ? 'rgba(246,241,228,.45)' : '#F6F1E4';
        g.fillRect(p.x - 4, p.y - 4, 8, 8);
        g.strokeRect(p.x - 4, p.y - 4, 8, 8);
      });
      if (o.locked) {
        g.font = MONO;
        g.fillStyle = tokens.accent;
        g.textAlign = 'left';
        g.textBaseline = 'bottom';
        g.fillText('已锁定', byId.nw.x, byId.nw.y - 8);
      }
    }

    function isDarkColor(hex) {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
      if (!m) return false;
      const v = parseInt(m[1], 16);
      const r = (v >> 16) & 255, g2 = (v >> 8) & 255, b = v & 255;
      return (r * 299 + g2 * 587 + b * 114) / 1000 < 128;
    }

    // ---------- 输入交互 ----------
    function hitTest(world) {
      for (let i = board.objects.length - 1; i >= 0; i--) {
        const o = board.objects[i];
        if (o.hidden || o.locked) continue;
        const cx = o.x + o.w / 2;
        const cy = o.y + o.h / 2;
        const rad = -((Number(o.rotation) || 0) * Math.PI) / 180;
        const dx = world.x - cx;
        const dy = world.y - cy;
        const lx = dx * Math.cos(rad) - dy * Math.sin(rad) + o.w / 2;
        const ly = dx * Math.sin(rad) + dy * Math.cos(rad) + o.h / 2;
        if (lx >= 0 && lx <= o.w && ly >= 0 && ly <= o.h) return o;
      }
      return null;
    }

    function handleAt(p) {
      const o = selectedObj();
      if (!o || o.locked) return null;
      const rot = rotationPoint(o);
      if (Math.hypot(p.x - rot.x, p.y - rot.y) <= 10) return 'rotate';
      const pts = objectScreenPoints(o);
      for (const hp of pts) {
        if (Math.abs(p.x - hp.x) <= 7 && Math.abs(p.y - hp.y) <= 7) return hp.id;
      }
      return null;
    }

    function select(id) {
      if (selectedId === id) return;
      selectedId = id;
      renderLayers();
      renderProps();
      schedule();
    }

    function onPointerDown(e) {
      if (!board) return;
      if (e.button === 1 || spaceDown || tool === 'hand') {
        e.preventDefault();
        closeTextEditor();
        const p = stagePoint(e);
        drag = { mode: 'pan', sx: p.x, sy: p.y, pan0: { ...pan } };
        capturePointer(e.pointerId);
        return;
      }
      if (e.button !== 0) return;
      if (!e.target.closest('#ed-canvas')) return;
      closeTextEditor();
      const p = stagePoint(e);
      const world = screenToWorld(p);

      if (tool === 'image') { pickImage(); return; }

      if (tool === 'select') {
        const handle = handleAt(p);
        const sel = selectedObj();
        if (handle && sel) {
          capturePointer(e.pointerId);
          if (handle === 'rotate') {
            const center = { x: pan.x + (sel.x + sel.w / 2) * zoom, y: pan.y + (sel.y + sel.h / 2) * zoom };
            drag = {
              mode: 'rotate', id: sel.id, center,
              startAngle: angleOf(center, p), base: sel.rotation || 0
            };
          } else {
            drag = {
              mode: 'resize', id: sel.id, handle,
              start: world,
              orig: { x: sel.x, y: sel.y, w: sel.w, h: sel.h, rotation: sel.rotation || 0 }
            };
          }
          return;
        }
        const hit = hitTest(world);
        if (hit) {
          if (selectedId !== hit.id) select(hit.id);
          drag = {
            mode: 'move', id: hit.id, start: world,
            orig: { x: hit.x, y: hit.y, w: hit.w, h: hit.h }, moved: false
          };
          capturePointer(e.pointerId);
        } else {
          select(null);
        }
        return;
      }

      if (tool === 'text') {
        createText(world);
        return;
      }
      if (['rect', 'ellipse', 'line'].includes(tool)) {
        const obj = createShape(tool, world, world, e.shiftKey);
        board.objects.push(obj);
        selectedId = obj.id;
        drag = { mode: 'create', id: obj.id, start: world, tool };
        capturePointer(e.pointerId);
        renderLayers();
        renderProps();
        schedule();
      }
    }

    function angleOf(center, p) {
      return (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI;
    }

    function onPointerMove(e) {
      if (!board || !drag) return;
      const p = stagePoint(e);
      const world = screenToWorld(p);

      if (drag.mode === 'pan') {
        pan.x = drag.pan0.x + (p.x - drag.sx);
        pan.y = drag.pan0.y + (p.y - drag.sy);
        schedule();
        return;
      }

      const sel = selectedObj();
      if (!sel) return;

      if (drag.mode === 'move') {
        let nx = drag.orig.x + (world.x - drag.start.x);
        let ny = drag.orig.y + (world.y - drag.start.y);
        const snapped = snapPosition(sel, nx, ny);
        sel.x = snapped.x;
        sel.y = snapped.y;
        guides = snapped.guides;
        if (Math.abs(sel.x - drag.orig.x) > 0.01 || Math.abs(sel.y - drag.orig.y) > 0.01) drag.moved = true;
        syncPropReadouts();
        schedule();
      }

      if (drag.mode === 'resize') {
        const res = resizeRect(drag.orig, drag.handle, world, e.shiftKey);
        sel.x = res.x; sel.y = res.y; sel.w = res.w; sel.h = res.h;
        syncPropReadouts();
        schedule();
      }

      if (drag.mode === 'rotate') {
        let r = drag.base + (angleOf(drag.center, p) - drag.startAngle);
        if (e.shiftKey) r = Math.round(r / 15) * 15;
        sel.rotation = ((Math.round(r * 10) / 10) % 360 + 360) % 360;
        syncPropReadouts();
        schedule();
      }

      if (drag.mode === 'create') {
        const obj = board.objects.find(o => o.id === drag.id);
        if (!obj) return;
        const x = Math.min(drag.start.x, world.x);
        const y = Math.min(drag.start.y, world.y);
        const w = Math.abs(world.x - drag.start.x);
        const h = Math.abs(world.y - drag.start.y);
        if (drag.tool === 'line') {
          obj.x = drag.start.x;
          obj.y = drag.start.y;
          obj.w = world.x - drag.start.x;
          obj.h = world.y - drag.start.y;
          obj.flip = obj.h < 0;
          obj.w = Math.abs(obj.w);
          obj.h = Math.abs(obj.h);
          obj.x = Math.min(drag.start.x, world.x);
          obj.y = Math.min(drag.start.y, world.y);
        } else {
          obj.x = x; obj.y = y; obj.w = Math.max(1, w); obj.h = Math.max(1, h);
        }
        draftResize(obj);
        schedule();
      }
    }

    function capturePointer(id) {
      try { stage.setPointerCapture?.(id); } catch { /* ignore */ }
    }

    function releasePointer(id) {
      try { stage.releasePointerCapture?.(id); } catch { /* ignore */ }
    }

    function onPointerUp(e) {
      if (!drag) return;
      const was = drag;
      drag = null;
      guides = [];
      releasePointer(e.pointerId);
      if (was.mode === 'pan') { schedule(); return; }
      if (was.mode === 'create') {
        const obj = board.objects.find(o => o.id === was.id);
        if (obj) {
          if (was.tool !== 'line' && (obj.w < 5 || obj.h < 5)) {
            obj.w = was.tool === 'rect' ? 260 : 180;
            obj.h = was.tool === 'rect' ? 170 : 180;
            if (was.tool === 'line') obj.w = 300;
          }
          if (was.tool === 'line' && obj.w < 5) { obj.w = 300; obj.h = 0; obj.flip = false; }
        }
        commit();
        renderLayers();
        renderProps();
        setTool('select');
      } else if (was.mode === 'move' && !was.moved) {
        schedule();
      } else {
        commit();
        renderLayers();
        renderProps();
      }
      schedule();
    }

    function draftResize(obj) {
      // 创建过程中仅刷新尺寸读数，不做图层重排
      const fields = propsEl.querySelectorAll('[data-prop="w"], [data-prop="h"], [data-prop="x"], [data-prop="y"]');
      fields.forEach(f => {
        if (document.activeElement !== f) f.value = Math.round(obj[f.dataset.prop]);
      });
    }

    function resizeRect(orig, handle, world, shift) {
      const [ , dx, dy] = HANDLES.find(h => h[0] === handle) || [];
      const rad = ((orig.rotation || 0) * Math.PI) / 180;
      const cx = orig.x + orig.w / 2;
      const cy = orig.y + orig.h / 2;
      const ax = cx - (dx * orig.w) / 2;
      const ay = cy - (dy * orig.h) / 2;
      const anchor = {
        x: ax * Math.cos(rad) - ay * Math.sin(rad) - cx * Math.cos(rad) + cy * Math.sin(rad) + cx,
        y: ax * Math.sin(rad) + ay * Math.cos(rad) - cx * Math.sin(rad) - cy * Math.cos(rad) + cy
      };
      // 上面换算等价于：锚点绕中心旋转后的世界坐标
      anchor.x = cx + (ax - cx) * Math.cos(rad) - (ay - cy) * Math.sin(rad);
      anchor.y = cy + (ax - cx) * Math.sin(rad) + (ay - cy) * Math.cos(rad);
      const vx = world.x - anchor.x;
      const vy = world.y - anchor.y;
      const lx = vx * Math.cos(-rad) - vy * Math.sin(-rad);
      const ly = vx * Math.sin(-rad) + vy * Math.cos(-rad);
      let w = dx === 0 ? orig.w : Math.max(8, dx * lx);
      let h = dy === 0 ? orig.h : Math.max(8, dy * ly);
      if (shift && dx !== 0 && dy !== 0) {
        const ratio = orig.w / orig.h;
        if (w / h > ratio) h = w / ratio;
        else w = h * ratio;
      }
      const nx = anchor.x + (dx * w / 2) * Math.cos(rad) - (dy * h / 2) * Math.sin(rad);
      const ny = anchor.y + (dx * w / 2) * Math.sin(rad) + (dy * h / 2) * Math.cos(rad);
      if (pixelSnap) {
        w = Math.round(w); h = Math.round(h);
      }
      return { x: nx - w / 2, y: ny - h / 2, w, h };
    }

    function snapPosition(obj, nx, ny) {
      const threshold = 6 / zoom;
      const xs = [0, board.width / 2, board.width];
      const ys = [0, board.height / 2, board.height];
      board.objects.forEach(o => {
        if (o.id === obj.id || o.hidden) return;
        xs.push(o.x, o.x + o.w / 2, o.x + o.w);
        ys.push(o.y, o.y + o.h / 2, o.y + o.h);
      });
      const edgesX = [nx, nx + obj.w / 2, nx + obj.w];
      const edgesY = [ny, ny + obj.h / 2, ny + obj.h];
      let bx = null, by = null;
      edgesX.forEach(e => xs.forEach(t => {
        const d = t - e;
        if (Math.abs(d) <= threshold && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, t };
      }));
      edgesY.forEach(e => ys.forEach(t => {
        const d = t - e;
        if (Math.abs(d) <= threshold && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, t };
      }));
      if (pixelSnap) { bx = null; by = null; }
      if (bx) nx += bx.d;
      if (by) ny += by.d;
      if (pixelSnap) { nx = Math.round(nx); ny = Math.round(ny); }
      const nextGuides = [];
      if (bx) nextGuides.push({ axis: 'x', pos: bx.t });
      if (by) nextGuides.push({ axis: 'y', pos: by.t });
      return { x: nx, y: ny, guides: nextGuides };
    }

    function onWheel(e) {
      if (!board) return;
      e.preventDefault();
      const p = stagePoint(e);
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.0022), p);
      } else {
        pan.x -= e.deltaX;
        pan.y -= e.deltaY;
        schedule();
      }
    }

    function onDblClick(e) {
      if (!board || tool !== 'select') return;
      const p = stagePoint(e);
      const hit = hitTest(screenToWorld(p));
      if (hit && hit.type === 'text') {
        select(hit.id);
        openTextEditor(hit.id);
      }
    }

    // ---------- 创建 / 编辑对象 ----------
    function baseObject(type, world) {
      return {
        id: newObjectId(),
        type,
        name: nextName(type),
        x: world.x, y: world.y, w: 1, h: 1,
        rotation: 0, opacity: 1, blend: 'normal',
        fill: tokens.accent, stroke: tokens.ink, strokeWidth: 0, radius: 0,
        hidden: false, locked: false
      };
    }

    function createShape(type, start, end, shift) {
      const obj = baseObject(type, start);
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      if (type === 'line') {
        obj.x = Math.min(start.x, end.x);
        obj.y = Math.min(start.y, end.y);
        obj.w = w; obj.h = h;
        obj.flip = end.y < start.y;
        obj.fill = 'transparent';
        obj.stroke = tokens.ink;
        obj.strokeWidth = 2;
      } else {
        obj.x = x; obj.y = y;
        obj.w = shift ? Math.max(w, h) : w;
        obj.h = shift ? Math.max(w, h) : h;
      }
      return obj;
    }

    function createText(world) {
      const obj = {
        ...baseObject('text', world),
        x: world.x,
        y: world.y,
        w: Math.min(460, Math.max(160, board.width * 0.38)),
        h: 76,
        text: '',
        fontSize: 44,
        fontWeight: 400,
        lineHeight: 1.35,
        align: 'left',
        fill: tokens.ink
      };
      board.objects.push(obj);
      selectedId = obj.id;
      setTool('select');
      renderLayers();
      renderProps();
      commit();
      openTextEditor(obj.id);
    }

    function nextName(type) {
      const base = TYPE_NAMES[type] || '对象';
      let n = 1;
      while (board.objects.some(o => o.name === `${base} ${n}`)) n += 1;
      return `${base} ${n}`;
    }

    function addObject(obj) {
      board.objects.push(obj);
      selectedId = obj.id;
      commit();
      renderLayers();
      renderProps();
      updateZoomLabel();
      schedule();
    }

    function openTextEditor(id) {
      const obj = board.objects.find(o => o.id === id);
      if (!obj) return;
      editingId = id;
      textInitial = obj.text || '';
      const r = stage.getBoundingClientRect();
      const x = pan.x + obj.x * zoom;
      const y = pan.y + obj.y * zoom;
      textarea.value = obj.text || '';
      textarea.style.display = 'block';
      textarea.style.left = `${Math.max(0, x)}px`;
      textarea.style.top = `${Math.max(0, y)}px`;
      textarea.style.width = `${obj.w * zoom}px`;
      textarea.style.height = `${Math.max(36, obj.h * zoom)}px`;
      textarea.style.fontSize = `${Math.max(10, obj.fontSize * zoom)}px`;
      textarea.style.fontWeight = String(obj.fontWeight || 400);
      textarea.style.lineHeight = String(obj.lineHeight || 1.35);
      textarea.style.color = obj.fill;
      textarea.style.textAlign = obj.align || 'left';
      textarea.style.transform = `rotate(${obj.rotation || 0}deg)`;
      textarea.setAttribute('aria-label', `编辑文字：${obj.name}`);
      void r;
      schedule();
      setTimeout(() => { textarea.focus(); textarea.select(); }, 10);
    }

    function onTextInput() {
      const obj = board.objects.find(o => o.id === editingId);
      if (!obj) return;
      obj.text = textarea.value;
      schedule();
    }

    function closeTextEditor(save = true) {
      if (!editingId) return;
      const obj = board.objects.find(o => o.id === editingId);
      if (obj) {
        if (save) {
          obj.text = textarea.value.trimEnd();
          if (!obj.text.trim()) {
            board.objects = board.objects.filter(o => o.id !== obj.id);
            if (selectedId === obj.id) selectedId = null;
            commit();
          } else if (obj.text !== textInitial) {
            commit();
          }
        } else {
          obj.text = textInitial;
          if (!textInitial) board.objects = board.objects.filter(o => o.id !== obj.id);
        }
        syncTextHeight(obj);
      }
      editingId = null;
      textarea.style.display = 'none';
      textarea.value = '';
      renderLayers();
      renderProps();
      updateZoomLabel();
      schedule();
    }

    function syncTextHeight(obj) {
      if (obj.type !== 'text') return;
      const lines = String(obj.text || '').split('\n').length;
      obj.h = Math.max(obj.fontSize * 1.2, lines * obj.fontSize * (obj.lineHeight || 1.35) + 4);
    }

    function pickImage() {
      fileInput.value = '';
      fileInput.click();
    }

    async function onFile(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      setSaveState('压缩图片…', 'is-saving');
      try {
        const res = await saveImage(file, 1600);
        await loadBoardImage(res.id);
        const maxW = board.width * 0.6;
        const maxH = board.height * 0.6;
        const ratio = Math.min(maxW / res.width, maxH / res.height, 1);
        const w = Math.round(res.width * ratio);
        const h = Math.round(res.height * ratio);
        const obj = {
          ...baseObject('image', { x: 0, y: 0 }),
          x: Math.round((board.width - w) / 2),
          y: Math.round((board.height - h) / 2),
          w, h,
          imageId: res.id,
          fill: 'transparent',
          radius: 0
        };
        obj.name = file.name ? file.name.replace(/\.[a-z0-9]+$/i, '') : nextName('image');
        addObject(obj);
        images = await imageMapFor(board);
        setTool('select');
        toast(`已放入图片（压缩至 ${res.width} × ${res.height}）`, { type: 'success' });
        setSaveState('已保存', '');
        schedule();
      } catch (err) {
        console.error(err);
        setSaveState('图片处理失败', 'is-error');
        toast('图片处理失败，请换一张试试', { type: 'error' });
      }
    }

    // ---------- 图层 ----------
    function renderLayers() {
      if (!board) return;
      const rows = [...board.objects].reverse().map((o, i) => {
        const idx = board.objects.length - i;
        return `<div class="layer-row ${o.id === selectedId ? 'is-selected' : ''} ${o.hidden ? 'is-hidden' : ''}" data-layer-id="${o.id}">
          <button type="button" class="layer-icon-btn" data-layer-eye="${o.id}" aria-label="${o.hidden ? '显示' : '隐藏'} ${escapeHtml(o.name)}" title="${o.hidden ? '显示' : '隐藏'}">${icon(o.hidden ? 'eyeOff' : 'eye', 14)}</button>
          <button type="button" class="layer-icon-btn ${o.locked ? 'is-on' : ''}" data-layer-lock="${o.id}" aria-label="${o.locked ? '解锁' : '锁定'} ${escapeHtml(o.name)}" title="${o.locked ? '解锁' : '锁定'}">${icon(o.locked ? 'lock' : 'unlock', 13)}</button>
          <span class="layer-type" aria-hidden="true">${icon(o.type === 'image' ? 'image' : o.type, 13)}</span>
          <span class="layer-name" data-layer-name="${o.id}" title="双击重命名">${escapeHtml(o.name)}</span>
          <span class="layer-order">${String(idx).padStart(2, '0')}</span>
        </div>`;
      }).join('');
      layersEl.innerHTML = `
        <div class="layer-row layer-frame ${selectedId ? '' : 'is-selected'}" data-layer-frame>
          <span class="layer-icon-btn" aria-hidden="true">${icon('boards', 14)}</span>
          <span class="layer-icon-btn" aria-hidden="true">${icon('lock', 13)}</span>
          <span class="layer-type" aria-hidden="true">${icon('layers', 13)}</span>
          <span class="layer-name">画框 · ${escapeHtml(board.name)}</span>
          <span class="layer-order">${board.objects.length ? '00' : ''}</span>
        </div>
        ${rows || '<p class="layer-empty">画框还是空的。<br>用左侧工具放一个矩形或文字。</p>'}`;
    }

    function onLayersClick(e) {
      const eye = e.target.closest('[data-layer-eye]');
      if (eye) {
        const o = board.objects.find(x => x.id === eye.dataset.layerEye);
        if (o) { o.hidden = !o.hidden; commit(); renderLayers(); renderProps(); schedule(); }
        return;
      }
      const lock = e.target.closest('[data-layer-lock]');
      if (lock) {
        const o = board.objects.find(x => x.id === lock.dataset.layerLock);
        if (o) { o.locked = !o.locked; commit(); renderLayers(); renderProps(); schedule(); }
        return;
      }
      const row = e.target.closest('[data-layer-id]');
      if (row) { select(row.dataset.layerId); return; }
      if (e.target.closest('[data-layer-frame]')) select(null);
    }

    function onLayersDblClick(e) {
      const nameEl = e.target.closest('[data-layer-name]');
      if (!nameEl || nameEl.closest('.layer-frame')) return;
      const id = nameEl.dataset.layerName;
      const o = board.objects.find(x => x.id === id);
      if (!o) return;
      const input = document.createElement('input');
      input.className = 'layer-name-input';
      input.value = o.name;
      input.setAttribute('aria-label', '重命名对象');
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      let cancelled = false;
      const finish = save => {
        if (save && input.value.trim()) o.name = input.value.trim();
        commit();
        renderLayers();
        renderProps();
      };
      input.addEventListener('blur', () => finish(!cancelled), { once: true });
      input.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
        if (ev.key === 'Escape') { ev.preventDefault(); cancelled = true; input.value = o.name; input.blur(); }
      });
    }

    // ---------- 属性 ----------
    function renderProps() {
      if (!board) return;
      const o = selectedObj();
      if (!o) {
        propsEl.innerHTML = `
          <div class="prop-head"><p class="kicker">Frame / 画框</p><span class="prop-badge">01</span></div>
          <div class="prop-sec">
            <label class="prop-line"><span>名称</span><input type="text" data-board-prop="name" value="${escapeHtml(board.name)}" maxlength="40"></label>
            <div class="prop-grid">
              <label class="prop-line"><span>宽 W</span><input type="number" data-board-prop="width" value="${Math.round(board.width)}" min="64" max="8000"></label>
              <label class="prop-line"><span>高 H</span><input type="number" data-board-prop="height" value="${Math.round(board.height)}" min="64" max="8000"></label>
            </div>
            <label class="prop-line"><span>纸张底色</span><input type="color" data-board-prop="bg" value="${escapeHtml(board.bg || '#F6F1E4')}"></label>
          </div>
          <div class="prop-sec">
            <p class="prop-label">视图</p>
            <div class="prop-row">
              <button type="button" class="prop-btn ${showRulers ? 'is-on' : ''}" data-act="toggle-rulers">${icon('ruler', 14)} 标尺</button>
              <button type="button" class="prop-btn ${showGrid ? 'is-on' : ''}" data-act="toggle-grid">${icon('grid', 14)} 网格</button>
              <button type="button" class="prop-btn ${pixelSnap ? 'is-on' : ''}" data-act="toggle-pixel">像素吸附</button>
            </div>
            <button type="button" class="prop-btn prop-btn--wide" data-act="zoom-fit">${icon('fit', 14)} 适应窗口</button>
          </div>
          <p class="prop-hint">选中对象后在这里调整位置、填充、描边与文字。双击文字对象可直接编辑内容。</p>`;
        return;
      }
      const textFields = o.type === 'text' ? `
        <div class="prop-sec">
          <p class="prop-label">文字</p>
          <textarea class="prop-textarea" data-prop="text" rows="3" aria-label="文字内容">${escapeHtml(o.text || '')}</textarea>
          <div class="prop-grid">
            <label class="prop-line"><span>字号</span><input type="number" data-prop="fontSize" value="${Math.round(o.fontSize || 32)}" min="4" max="400"></label>
            <label class="prop-line"><span>行高</span><input type="number" step="0.05" data-prop="lineHeight" value="${o.lineHeight || 1.4}" min="0.8" max="4"></label>
          </div>
          <div class="prop-row">
            <select class="prop-select" data-prop="fontWeight" aria-label="字重">
              ${['300', '400', '500', '600', '700'].map(w => `<option value="${w}" ${String(o.fontWeight) === w ? 'selected' : ''}>${w}</option>`).join('')}
            </select>
            <div class="seg seg--tiny" role="group" aria-label="文字对齐">
              ${['left', 'center', 'right'].map(al => `<button type="button" class="seg-btn ${(o.align || 'left') === al ? 'is-on' : ''}" data-align="${al}" aria-label="${al}">${al === 'left' ? '左' : al === 'center' ? '中' : '右'}</button>`).join('')}
            </div>
          </div>
        </div>` : '';
      const strokeField = o.type !== 'text' && o.type !== 'image' ? `
        <div class="prop-sec">
          <p class="prop-label">描边</p>
          <div class="prop-row">
            <input type="color" data-prop="stroke" value="${escapeHtml(o.stroke || '#16130E')}" aria-label="描边颜色">
            <input type="number" data-prop="strokeWidth" value="${Number(o.strokeWidth) || 0}" min="0" max="80" step="0.5" aria-label="描边宽度" class="prop-num">
          </div>
        </div>` : '';
      const radiusField = o.type === 'rect' || o.type === 'image' ? `
        <div class="prop-sec">
          <label class="prop-line"><span>圆角</span><input type="number" data-prop="radius" value="${Number(o.radius) || 0}" min="0" max="600"></label>
        </div>` : '';
      propsEl.innerHTML = `
        <div class="prop-head">
          <p class="kicker">Object / 对象</p>
          <span class="prop-badge">${escapeHtml(TYPE_NAMES[o.type] || o.type)}</span>
        </div>
        <div class="prop-sec">
          <label class="prop-line"><span>名称</span><input type="text" data-prop="name" value="${escapeHtml(o.name)}" maxlength="40"></label>
          <div class="prop-grid">
            <label class="prop-line"><span>X</span><input type="number" data-prop="x" value="${Math.round(o.x)}"></label>
            <label class="prop-line"><span>Y</span><input type="number" data-prop="y" value="${Math.round(o.y)}"></label>
            <label class="prop-line"><span>宽 W</span><input type="number" data-prop="w" value="${Math.round(o.w)}" min="1"></label>
            <label class="prop-line"><span>高 H</span><input type="number" data-prop="h" value="${Math.round(o.h)}" min="1"></label>
            <label class="prop-line"><span>旋转</span><input type="number" data-prop="rotation" value="${Math.round(o.rotation || 0)}" min="-360" max="360"></label>
            <label class="prop-line"><span>透明度</span><input type="number" data-prop="opacity" value="${Math.round((o.opacity ?? 1) * 100)}" min="0" max="100"></label>
          </div>
        </div>
        ${textFields}
        ${o.type !== 'image' ? `<div class="prop-sec">
          <label class="prop-line"><span>填充</span><input type="color" data-prop="fill" value="${escapeHtml(isHex(o.fill) ? o.fill : '#A9331F')}"></label>
          <div class="prop-row">
            <span class="prop-hex">${escapeHtml(isHex(o.fill) ? o.fill.toUpperCase() : '无填充')}</span>
            <select class="prop-select" data-prop="blend" aria-label="混合模式">
              <option value="normal" ${(o.blend || 'normal') === 'normal' ? 'selected' : ''}>正常</option>
              <option value="multiply" ${o.blend === 'multiply' ? 'selected' : ''}>正片叠底</option>
              <option value="screen" ${o.blend === 'screen' ? 'selected' : ''}>滤色</option>
            </select>
          </div>
        </div>` : ''}
        ${strokeField}
        ${radiusField}
        <div class="prop-sec">
          <p class="prop-label">对齐到画框</p>
          <div class="align-grid">
            <button type="button" class="prop-btn" data-align-box="left">左</button>
            <button type="button" class="prop-btn" data-align-box="hcenter">水平居中</button>
            <button type="button" class="prop-btn" data-align-box="right">右</button>
            <button type="button" class="prop-btn" data-align-box="top">上</button>
            <button type="button" class="prop-btn" data-align-box="vcenter">垂直居中</button>
            <button type="button" class="prop-btn" data-align-box="bottom">下</button>
          </div>
        </div>
        <div class="prop-sec">
          <p class="prop-label">层级</p>
          <div class="prop-row">
            <button type="button" class="prop-btn" data-z="up" title="上移一层">${icon('up', 14)}</button>
            <button type="button" class="prop-btn" data-z="down" title="下移一层">${icon('down', 14)}</button>
            <button type="button" class="prop-btn" data-z="top" title="置顶">${icon('front', 14)}</button>
            <button type="button" class="prop-btn" data-z="bottom" title="置底">${icon('back', 14)}</button>
          </div>
        </div>
        <div class="prop-sec">
          <div class="prop-row">
            <button type="button" class="prop-btn ${o.locked ? 'is-on' : ''}" data-act="toggle-lock">${icon(o.locked ? 'lock' : 'unlock', 14)} ${o.locked ? '已锁定' : '锁定'}</button>
            <button type="button" class="prop-btn ${o.hidden ? 'is-on' : ''}" data-act="toggle-hide">${icon(o.hidden ? 'eyeOff' : 'eye', 14)} ${o.hidden ? '已隐藏' : '隐藏'}</button>
          </div>
          <div class="prop-row">
            <button type="button" class="prop-btn" data-act="duplicate">${icon('copy', 14)} 再制</button>
            <button type="button" class="prop-btn prop-btn--danger" data-act="delete">${icon('trash', 14)} 删除</button>
          </div>
        </div>`;
    }

    function isHex(v) {
      return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
    }

    function syncPropReadouts() {
      const o = selectedObj();
      if (!o) return;
      ['x', 'y', 'w', 'h', 'rotation'].forEach(p => {
        const el = propsEl.querySelector(`[data-prop="${p}"]`);
        if (el && document.activeElement !== el) el.value = Math.round(o[p] ?? 0);
      });
    }

    function onPropsInput(e) {
      const t = e.target;
      const o = selectedObj();
      if (!o) return;
      if (t.dataset.prop === 'fill') {
        o.fill = t.value;
        const hex = propsEl.querySelector('.prop-hex');
        if (hex) hex.textContent = t.value.toUpperCase();
        schedule();
      } else if (t.dataset.prop === 'opacity') {
        o.opacity = clamp(Number(t.value) / 100, 0, 1);
        schedule();
      } else if (t.dataset.prop === 'text') {
        o.text = t.value;
        schedule();
      } else if (t.dataset.prop === 'stroke') {
        o.stroke = t.value;
        schedule();
      } else if (t.dataset.prop === 'fontSize') {
        const v = Math.max(4, Math.min(400, Number(t.value) || 32));
        o.fontSize = v;
        schedule();
      }
    }

    function onPropsChange(e) {
      const t = e.target;
      const o = selectedObj();
      const bp = t.dataset.boardProp;
      if (bp) {
        if (bp === 'name') {
          board.name = t.value.trim() || board.name;
          nameInput.value = board.name;
        } else if (bp === 'width' || bp === 'height') {
          const v = Math.max(64, Math.min(8000, Math.round(Number(t.value) || board[bp])));
          board[bp] = v;
          updateHeader();
          setTimeout(() => { if (!didFit) fitBoard(); else schedule(); }, 0);
          renderLayers();
        } else if (bp === 'bg') {
          board.bg = t.value;
        }
        commit();
        updateCount();
        schedule();
        return;
      }
      if (!o) return;
      const p = t.dataset.prop;
      if (!p) return;
      if (p === 'name') o.name = t.value.trim() || o.name;
      else if (p === 'text') o.text = t.value;
      else if (['x', 'y', 'w', 'h'].includes(p)) {
        let v = Number(t.value);
        if (!Number.isFinite(v)) v = o[p];
        if (p === 'w' || p === 'h') v = Math.max(1, v);
        o[p] = v;
        if (o.type === 'text' && p === 'w') syncTextHeight(o);
      } else if (p === 'rotation') o.rotation = clamp(Number(t.value) || 0, -360, 360);
      else if (p === 'opacity') o.opacity = clamp((Number(t.value) || 0) / 100, 0, 1);
      else if (p === 'fontSize') { o.fontSize = Math.max(4, Math.min(400, Number(t.value) || 32)); syncTextHeight(o); }
      else if (p === 'lineHeight') o.lineHeight = clamp(Number(t.value) || 1.4, 0.8, 4);
      else if (p === 'fontWeight') o.fontWeight = Number(t.value) || 400;
      else if (p === 'strokeWidth') o.strokeWidth = Math.max(0, Number(t.value) || 0);
      else if (p === 'radius') o.radius = Math.max(0, Number(t.value) || 0);
      else if (p === 'fill') o.fill = t.value;
      else if (p === 'stroke') o.stroke = t.value;
      else if (p === 'blend') o.blend = t.value;

      if (p === 'text') syncTextHeight(o);
      commit();
      renderLayers();
      if (['name', 'x', 'y', 'w', 'h', 'rotation', 'opacity'].includes(p)) syncPropReadouts();
      schedule();
    }

    function alignToBoard(mode) {
      const o = selectedObj();
      if (!o) return;
      if (mode === 'left') o.x = 0;
      if (mode === 'right') o.x = board.width - o.w;
      if (mode === 'hcenter') o.x = (board.width - o.w) / 2;
      if (mode === 'top') o.y = 0;
      if (mode === 'bottom') o.y = board.height - o.h;
      if (mode === 'vcenter') o.y = (board.height - o.h) / 2;
      commit();
      syncPropReadouts();
      schedule();
    }

    function reorder(mode) {
      const o = selectedObj();
      if (!o) return;
      const i = board.objects.indexOf(o);
      if (mode === 'up' && i < board.objects.length - 1) {
        board.objects.splice(i, 1); board.objects.splice(i + 1, 0, o);
      } else if (mode === 'down' && i > 0) {
        board.objects.splice(i, 1); board.objects.splice(i - 1, 0, o);
      } else if (mode === 'top' && i < board.objects.length - 1) {
        board.objects.splice(i, 1); board.objects.push(o);
      } else if (mode === 'bottom' && i > 0) {
        board.objects.splice(i, 1); board.objects.unshift(o);
      }
      commit();
      renderLayers();
      schedule();
    }

    function duplicateSelected() {
      const o = selectedObj();
      if (!o) return;
      const copy = JSON.parse(JSON.stringify(o));
      copy.id = newObjectId();
      copy.name = `${o.name} 副本`;
      copy.x = o.x + 20;
      copy.y = o.y + 20;
      addObject(copy);
    }

    function deleteSelected() {
      const o = selectedObj();
      if (!o) return;
      board.objects = board.objects.filter(x => x.id !== o.id);
      selectedId = null;
      commit();
      renderLayers();
      renderProps();
      schedule();
    }

    function onPropsClick(e) {
      const align = e.target.closest('[data-align-box]');
      if (align) { alignToBoard(align.dataset.alignBox); return; }
      const z = e.target.closest('[data-z]');
      if (z) { reorder(z.dataset.z); return; }
      const al = e.target.closest('[data-align]');
      if (al) {
        const o = selectedObj();
        if (o) { o.align = al.dataset.align; commit(); renderProps(); schedule(); }
        return;
      }
      const act = e.target.closest('[data-act]');
      if (act) { handleAction(act.dataset.act); }
    }

    // ---------- 历史 / 保存 ----------
    function snapshotBoard() {
      return JSON.stringify({
        name: board.name,
        width: board.width,
        height: board.height,
        bg: board.bg,
        objects: board.objects
      });
    }

    function commit() {
      if (!board) return;
      const snap = snapshotBoard();
      if (history.stack[history.index] === snap) { queueSave(); return; }
      history.stack = history.stack.slice(0, history.index + 1);
      history.stack.push(snap);
      if (history.stack.length > 100) history.stack.shift();
      history.index = history.stack.length - 1;
      dirty = true;
      updateHistoryUI();
      queueSave();
      updateCount();
    }

    function restore(snap) {
      const data = JSON.parse(snap);
      board.name = data.name;
      board.width = data.width;
      board.height = data.height;
      board.bg = data.bg;
      board.objects = data.objects;
      nameInput.value = board.name;
      if (selectedId && !board.objects.some(o => o.id === selectedId)) selectedId = null;
      updateHeader();
      renderLayers();
      renderProps();
      updateZoomLabel();
      schedule();
    }

    function undo() {
      if (history.index <= 0) return;
      closeTextEditor();
      history.index -= 1;
      restore(history.stack[history.index]);
      updateHistoryUI();
      queueSave();
      toast('已撤销');
    }

    function redo() {
      if (history.index >= history.stack.length - 1) return;
      closeTextEditor();
      history.index += 1;
      restore(history.stack[history.index]);
      updateHistoryUI();
      queueSave();
      toast('已重做');
    }

    function updateHistoryUI() {
      const undoBtn = root.querySelector('[data-act="undo"]');
      const redoBtn = root.querySelector('[data-act="redo"]');
      if (undoBtn) undoBtn.disabled = history.index <= 0;
      if (redoBtn) redoBtn.disabled = history.index >= history.stack.length - 1;
    }

    function queueSave() {
      fillDirty();
      if (saveTimer) clearTimeout(saveTimer);
      setSaveState('保存中…', 'is-saving');
      saveTimer = setTimeout(async () => {
        try {
          await putBoard(board);
          setSaveState(`已保存 ${timeNow()}`, 'is-saved');
          dirty = false;
        } catch (err) {
          console.error(err);
          setSaveState('保存失败', 'is-error');
        }
      }, 500);
    }

    function fillDirty() { dirty = true; }

    async function flushSave() {
      if (!board || !dirty) return;
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      try { await putBoard(board); dirty = false; } catch { /* ignore */ }
    }

    function timeNow() {
      const d = new Date();
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function setSaveState(text, cls) {
      saveEl.textContent = text;
      saveEl.className = `ed-save ${cls || ''}`;
    }

    function updateHeader() {
      if (!board) return;
      metaEl.textContent = `${board.width} × ${board.height} px · ${board.objects.length} 个对象`;
      document.title = `${board.name} · 画板 — Oro 印前工作台`;
    }

    function updateCount() {
      updateHeader();
      updateZoomLabel();
    }

    // ---------- 工具 / 动作 ----------
    function setTool(next) {
      tool = next;
      editorEl.dataset.tool = next;
      root.querySelectorAll('[data-tool]').forEach(btn => {
        const on = btn.dataset.tool === next;
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', String(on));
      });
    }

    function handleAction(act) {
      switch (act) {
        case 'undo': undo(); break;
        case 'redo': redo(); break;
        case 'zoom-in': zoomAt(1.25); break;
        case 'zoom-out': zoomAt(0.8); break;
        case 'zoom-fit': fitBoard(); break;
        case 'toggle-rulers': showRulers = !showRulers; renderProps(); schedule(); break;
        case 'toggle-grid': showGrid = !showGrid; renderProps(); schedule(); break;
        case 'toggle-pixel': pixelSnap = !pixelSnap; renderProps(); break;
        case 'toggle-lock': {
          const o = selectedObj();
          if (o) { o.locked = !o.locked; commit(); renderLayers(); renderProps(); schedule(); }
          break;
        }
        case 'toggle-hide': {
          const o = selectedObj();
          if (o) { o.hidden = !o.hidden; commit(); renderLayers(); renderProps(); schedule(); }
          break;
        }
        case 'duplicate': duplicateSelected(); break;
        case 'delete': deleteSelected(); break;
        case 'export': openExport(); break;
        case 'help': openHelp(); break;
        case 'edit-text': { const o = selectedObj(); if (o?.type === 'text') openTextEditor(o.id); break; }
        default: break;
      }
    }

    // ---------- 导出 ----------
    function openExport() {
      let scale = 1;
      const maxPixels = 36e6;
      const imageUrls = {};
      images.forEach((img, id) => { if (img?.src) imageUrls[id] = img.src; });
      const body = `
        <div class="export-panel">
          <div class="export-preview">
            <span class="export-frame">${previewSVG(board, { imageUrls })}</span>
            <div>
              <p class="kicker">Frame 01</p>
              <h3>${escapeHtml(board.name)}</h3>
              <p class="muted" id="export-dim">${board.width} × ${board.height} px</p>
            </div>
          </div>
          <div class="prop-sec">
            <p class="prop-label">倍率</p>
            <div class="seg" role="group" aria-label="导出倍率">
              ${[1, 2, 3].map(s => `<button type="button" class="seg-btn ${s === 1 ? 'is-on' : ''}" data-scale="${s}">${s}x</button>`).join('')}
            </div>
            <label class="check-row" style="margin-top:14px"><input type="checkbox" id="export-transparent"><span>透明背景（不含纸张底色）</span></label>
          </div>
          <div class="export-note">
            <p>PNG 按画框裁剪；SVG 导出保留可编辑的文字节点，<b>不做文字转路径</b>。超大尺寸会自动限制在约 3600 万像素内。</p>
          </div>
        </div>`;
      openModal({
        kicker: 'Export / 导出',
        title: '导出画板',
        size: 'md',
        body,
        footer: `<button type="button" class="btn" data-close>取消</button>
          <button type="button" class="btn" data-export-svg>${icon('export', 15)} 导出 SVG</button>
          <button type="button" class="btn btn-primary" id="export-png">导出 PNG</button>`,
        onMount(dialog, api) {
          const dim = dialog.querySelector('#export-dim');
          const updateDim = () => {
            const transparent = dialog.querySelector('#export-transparent').checked;
            let s = scale;
            if (board.width * board.height * s * s > maxPixels) s = Math.sqrt(maxPixels / (board.width * board.height));
            const ew = Math.round(board.width * s);
            const eh = Math.round(board.height * s);
            dim.textContent = `${ew} × ${eh} px${s !== scale ? '（已限制）' : ''}${transparent ? ' · 透明' : ''}`;
          };
          dialog.querySelectorAll('[data-scale]').forEach(btn => btn.addEventListener('click', () => {
            scale = Number(btn.dataset.scale);
            dialog.querySelectorAll('[data-scale]').forEach(b => b.classList.toggle('is-on', b === btn));
            updateDim();
          }));
          dialog.querySelector('#export-transparent').addEventListener('change', updateDim);
          updateDim();
          dialog.querySelector('[data-export-svg]').addEventListener('click', async () => {
            try {
              const transparent = dialog.querySelector('#export-transparent').checked;
              const svg = await boardToSVG(board, { transparent });
              downloadFile(`${safeName()}.svg`, svg, 'image/svg+xml');
              api.close();
              toast('SVG 已导出（文字保持为文本节点）', { type: 'success' });
            } catch (err) {
              console.error(err);
              toast('SVG 导出失败', { type: 'error' });
            }
          });
          dialog.querySelector('#export-png').addEventListener('click', async e => {
            const btn = e.currentTarget;
            const transparent = dialog.querySelector('#export-transparent').checked;
            btn.disabled = true;
            const label = btn.textContent;
            btn.textContent = '导出中…';
            try {
              const { canvas: out, scale: actual } = await exportBoardCanvas(board, { scale, transparent });
              const blob = await new Promise(resolve => out.toBlob(resolve, 'image/png'));
              if (!blob) throw new Error('PNG 生成失败');
              downloadBlob(`${safeName()}@${Math.round(actual * 10) / 10}x.png`, blob);
              api.close();
              toast(`PNG 已导出：${out.width} × ${out.height} px`, { type: 'success' });
            } catch (err) {
              console.error(err);
              toast('PNG 导出失败，可能尺寸过大', { type: 'error' });
              btn.disabled = false;
              btn.textContent = label;
            }
          });
        }
      });
    }

    function safeName() {
      return (board.name || 'board').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '') || 'board';
    }

    function openHelp() {
      openModal({
        title: '画板快捷键',
        size: 'md',
        body: `
          <div class="shortcut-grid">
            <p class="prop-label">工具</p>
            <dl>
              <div><dt>V</dt><dd>选择 / 移动</dd></div>
              <div><dt>R</dt><dd>矩形</dd></div>
              <div><dt>O</dt><dd>椭圆</dd></div>
              <div><dt>L</dt><dd>直线</dd></div>
              <div><dt>T</dt><dd>文字</dd></div>
              <div><dt>I</dt><dd>上传图片</dd></div>
              <div><dt>H / 空格</dt><dd>平移画布</dd></div>
            </dl>
            <p class="prop-label">编辑</p>
            <dl>
              <div><dt>⌘Z / Ctrl+Z</dt><dd>撤销</dd></div>
              <div><dt>⌘⇧Z</dt><dd>重做</dd></div>
              <div><dt>⌘D</dt><dd>再制</dd></div>
              <div><dt>⌘C / ⌘V</dt><dd>复制 / 粘贴</dd></div>
              <div><dt>Delete</dt><dd>删除</dd></div>
              <div><dt>方向键</dt><dd>移动 1px（Shift 10px）</dd></div>
              <div><dt>Shift</dt><dd>等比缩放 / 15° 旋转</dd></div>
            </dl>
            <p class="prop-label">视图</p>
            <dl>
              <div><dt>⌘+ / ⌘−</dt><dd>缩放</dd></div>
              <div><dt>⌘0</dt><dd>适应窗口</dd></div>
              <div><dt>Ctrl + 滚轮</dt><dd>以光标为中心缩放</dd></div>
              <div><dt>滚轮</dt><dd>平移</dd></div>
            </dl>
          </div>`,
        footer: '<button type="button" class="btn" data-close>知道了</button>'
      });
    }

    function copySelected() {
      const o = selectedObj();
      if (!o) return;
      clipboard = JSON.stringify(o);
      toast('已复制对象');
    }

    function pasteClipboard() {
      if (!clipboard) return;
      try {
        const o = JSON.parse(clipboard);
        o.id = newObjectId();
        o.name = `${o.name} 副本`;
        o.x += 24; o.y += 24;
        addObject(o);
        toast('已粘贴');
      } catch { /* ignore */ }
    }

    // ---------- 键盘 ----------
    function isTyping(el) {
      return el instanceof HTMLElement && (
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
      );
    }

    function onKeyDown(e) {
      if (destroyed || !board) return;
      if (document.querySelector('.modal-layer')) return;
      const typing = isTyping(e.target);
      const meta = e.metaKey || e.ctrlKey;

      if (e.code === 'Space' && !typing) {
        spaceDown = true;
        e.preventDefault();
        return;
      }

      if (meta) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo(); else undo();
          return;
        }
        if (key === 'y') { e.preventDefault(); redo(); return; }
        if (key === 'd') { e.preventDefault(); duplicateSelected(); return; }
        if (key === 'c' && !typing) { e.preventDefault(); copySelected(); return; }
        if (key === 'v' && !typing) { e.preventDefault(); pasteClipboard(); return; }
        if (key === 's') { e.preventDefault(); fillDirty(); flushSave(); setSaveState('已保存', 'is-saved'); return; }
        if (key === '0') { e.preventDefault(); fitBoard(); return; }
        if (key === '=' || key === '+') { e.preventDefault(); zoomAt(1.25); return; }
        if (key === '-') { e.preventDefault(); zoomAt(0.8); return; }
        return;
      }

      if (typing) return;

      if (e.key === 'Escape') {
        if (editingId) { closeTextEditor(false); return; }
        if (tool !== 'select') setTool('select');
        else select(null);
        return;
      }
      const toolKey = { v: 'select', r: 'rect', o: 'ellipse', l: 'line', t: 'text', h: 'hand', i: 'image' }[e.key.toLowerCase()];
      if (toolKey) {
        if (toolKey === 'image') pickImage();
        else setTool(toolKey);
        e.preventDefault();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObj()) { e.preventDefault(); deleteSelected(); }
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const o = selectedObj();
        if (!o) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowUp') o.y -= step;
        if (e.key === 'ArrowDown') o.y += step;
        if (e.key === 'ArrowLeft') o.x -= step;
        if (e.key === 'ArrowRight') o.x += step;
        commit();
        syncPropReadouts();
        schedule();
        return;
      }
      if (e.key === 'Enter' && selectedObj()?.type === 'text') {
        e.preventDefault();
        openTextEditor(selectedObj().id);
      }
    }

    function onKeyUp(e) {
      if (e.code === 'Space') spaceDown = false;
    }

    // ---------- 事件绑定 ----------
    const canvasPointerDown = onPointerDown;
    const canvasPointerMove = onPointerMove;
    const canvasPointerUp = onPointerUp;
    stage.addEventListener('pointerdown', canvasPointerDown);
    stage.addEventListener('pointermove', canvasPointerMove);
    stage.addEventListener('pointerup', canvasPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('dblclick', onDblClick);
    textarea.addEventListener('input', onTextInput);
    textarea.addEventListener('blur', () => closeTextEditor(true));
    textarea.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); closeTextEditor(false); }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); closeTextEditor(true); }
    });
    fileInput.addEventListener('change', onFile);
    layersEl.addEventListener('click', onLayersClick);
    layersEl.addEventListener('dblclick', onLayersDblClick);
    propsEl.addEventListener('input', onPropsInput);
    propsEl.addEventListener('change', onPropsChange);
    propsEl.addEventListener('click', onPropsClick);
    nameInput.addEventListener('change', () => {
      const v = nameInput.value.trim();
      if (!v) { nameInput.value = board.name; return; }
      board.name = v;
      updateHeader();
      commit();
      renderLayers();
      renderProps();
    });

    const rootClick = e => {
      const toolBtn = e.target.closest('.ed-tool[data-tool]');
      if (toolBtn) {
        if (toolBtn.dataset.tool === 'image') pickImage();
        else setTool(toolBtn.dataset.tool);
        return;
      }
      const act = e.target.closest('[data-act]');
      if (act && !act.closest('#ed-props')) handleAction(act.dataset.act);
    };
    root.addEventListener('click', rootClick);

    const onResize = () => { resizeCanvas(); schedule(); };
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    const onVis = () => { if (document.visibilityState === 'hidden') flushSave(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', flushSave);

    cleanups.push(() => {
      stage.removeEventListener('pointerdown', canvasPointerDown);
      stage.removeEventListener('pointermove', canvasPointerMove);
      stage.removeEventListener('pointerup', canvasPointerUp);
      stage.removeEventListener('pointercancel', onPointerUp);
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('dblclick', onDblClick);
      textarea.removeEventListener('input', onTextInput);
      fileInput.removeEventListener('change', onFile);
      layersEl.removeEventListener('click', onLayersClick);
      layersEl.removeEventListener('dblclick', onLayersDblClick);
      propsEl.removeEventListener('input', onPropsInput);
      propsEl.removeEventListener('change', onPropsChange);
      propsEl.removeEventListener('click', onPropsClick);
      root.removeEventListener('click', rootClick);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', flushSave);
      if (saveTimer) clearTimeout(saveTimer);
      if (rafId) cancelAnimationFrame(rafId);
    });

    return {
      destroy() {
        destroyed = true;
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        try { if (board && dirty) putBoard(board); } catch { /* ignore */ }
        cleanups.forEach(fn => { try { fn(); } catch { /* ignore */ } });
      }
    };
  }
};

function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  return {
    stage: cs.getPropertyValue('--stage').trim() || '#24211B',
    paper: cs.getPropertyValue('--paper-2').trim() || '#F6F1E4',
    ink: cs.getPropertyValue('--ink').trim() || '#16130E',
    accent: cs.getPropertyValue('--accent').trim() || '#A9331F',
    rulerBg: cs.getPropertyValue('--stage-ruler').trim() || '#1D1A15',
    rulerLine: cs.getPropertyValue('--stage-line').trim() || '#4A4334',
    rulerText: cs.getPropertyValue('--stage-text').trim() || '#9E9482'
  };
}

function shellHTML() {
  return `
  <div class="editor" data-tool="select">
    <header class="ed-top">
      <a class="ed-back" href="#/boards" title="返回画板架"><span aria-hidden="true">←</span><span class="ed-back-text">画板架</span></a>
      <div class="ed-doc">
        <p class="ed-kicker">Press sheet / 画板</p>
        <input class="ed-name" id="ed-name" maxlength="40" aria-label="画板名称">
      </div>
      <p class="ed-meta" id="ed-meta"></p>
      <div class="ed-top-actions">
        <div class="ed-icon-pair">
          <button type="button" class="icon-btn" data-act="undo" aria-label="撤销" title="撤销 ⌘Z">${icon('undo', 17)}</button>
          <button type="button" class="icon-btn" data-act="redo" aria-label="重做" title="重做 ⌘⇧Z">${icon('redo', 17)}</button>
        </div>
        <div class="ed-zoom">
          <button type="button" class="icon-btn" data-act="zoom-out" aria-label="缩小" title="缩小">${icon('zoomOut', 16)}</button>
          <span id="ed-zoom-label">100%</span>
          <button type="button" class="icon-btn" data-act="zoom-in" aria-label="放大" title="放大">${icon('zoomIn', 16)}</button>
          <button type="button" class="icon-btn" data-act="zoom-fit" aria-label="适应窗口" title="适应窗口 ⌘0">${icon('fit', 16)}</button>
        </div>
        <button type="button" class="btn btn-sm ed-export-btn" data-act="export">${icon('export', 15)} <span>导出</span></button>
        <button type="button" class="icon-btn ed-help-btn" data-act="help" aria-label="快捷键说明" title="快捷键">?</button>
      </div>
    </header>

    <div class="ed-body">
      <nav class="ed-tools" aria-label="画板工具">
        ${TOOLS.map(t => `<button type="button" class="ed-tool ${t.id === 'select' ? 'is-on' : ''}" data-tool="${t.id}" aria-pressed="${t.id === 'select'}" aria-label="${t.label}" title="${t.label} ${t.key}">
          <span class="ed-tool-icon">${icon(t.icon, 18)}</span>
          <span class="ed-tool-key">${t.key}</span>
        </button>`).join('')}
        <span class="ed-tool-sep" aria-hidden="true"></span>
        <button type="button" class="ed-tool ed-tool--ghost is-on" data-act="toggle-rulers" title="标尺开关" aria-label="标尺开关">${icon('ruler', 17)}</button>
        <button type="button" class="ed-tool ed-tool--ghost is-on" data-act="toggle-grid" title="网格开关" aria-label="网格开关">${icon('grid', 17)}</button>
      </nav>

      <div class="ed-stage" id="ed-stage" tabindex="0" aria-label="画板画布">
        <canvas id="ed-canvas"></canvas>
        <textarea id="ed-text" class="ed-text" spellcheck="false"></textarea>
        <div class="ed-mobile-note">建议桌面端进行复杂编辑 · 单指拖动对象，顶部按钮缩放</div>
        <div class="ed-boot" id="ed-boot"><span class="ed-boot-mark" aria-hidden="true"></span><p>正在打开画板…</p></div>
      </div>

      <aside class="ed-panels" aria-label="图层与属性">
        <section class="ed-layers-panel">
          <header class="ed-panel-head"><p class="kicker">Layers</p><span>图层</span></header>
          <div class="ed-layers" id="ed-layers"></div>
          <p class="ed-layers-hint">双击名称可重命名 · 眼睛控制显隐</p>
        </section>
        <section class="ed-props-panel">
          <header class="ed-panel-head"><p class="kicker">Inspector</p><span>属性</span></header>
          <div class="ed-props" id="ed-props"></div>
        </section>
      </aside>
    </div>

    <footer class="ed-foot">
      <span id="ed-count">0 个对象</span>
      <span class="ed-foot-sep" aria-hidden="true">·</span>
      <span id="ed-save" class="ed-save">已保存</span>
      <span class="ed-foot-hint">空格 / 中键平移 · Ctrl 滚轮缩放 · ↑↓ 微调 · ⌘K 命令</span>
    </footer>
    <input type="file" id="ed-file" accept="image/*" hidden>
  </div>`;
}
