// 番茄钟：25 分钟专注 / 5 分钟休息，全局运行，不随路由切换而中断
import { getState, update } from './store.js';
import { todayISO, uid } from './util.js';
import { toast } from './ui.js';

export const DURATIONS = { focus: 25 * 60, break: 5 * 60 };
const subs = new Set();
let mode = 'focus';
let remaining = DURATIONS.focus;
let running = false;
let endAt = 0;
let ticker = null;
let completing = false;

function emit() {
  const snap = snapshot();
  subs.forEach(fn => { try { fn(snap); } catch (err) { console.error(err); } });
}

export function snapshot() {
  return {
    mode,
    remaining,
    running,
    total: DURATIONS[mode],
    progress: 1 - remaining / DURATIONS[mode]
  };
}

export function subscribeTimer(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

function tick() {
  if (!running) return;
  const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
  remaining = left;
  if (left <= 0) finish();
  else emit();
}

function startTicker() {
  clearInterval(ticker);
  ticker = setInterval(tick, 1000);
}

function recordSession() {
  const state = getState();
  if (!state) return;
  update(s => {
    s.focusSessions.push({
      id: uid('focus'),
      date: todayISO(),
      minutes: Math.round(DURATIONS.focus / 60),
      sample: false,
      createdAt: Date.now()
    });
  });
}

function finish() {
  if (completing) return;
  completing = true;
  running = false;
  clearInterval(ticker);
  ticker = null;
  const finishedMode = mode;
  if (finishedMode === 'focus') {
    recordSession();
    toast('专注结束，起来走动一下。休息 5 分钟。', { type: 'success', duration: 4200 });
    mode = 'break';
    remaining = DURATIONS.break;
  } else {
    toast('休息结束，开始下一轮专注。', { type: 'info', duration: 3600 });
    mode = 'focus';
    remaining = DURATIONS.focus;
  }
  completing = false;
  window.dispatchEvent(new CustomEvent('dw:pomodoro', { detail: { mode, finished: finishedMode } }));
  emit();
}

export function toggle() {
  if (running) {
    remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    running = false;
    clearInterval(ticker);
    ticker = null;
  } else {
    if (remaining <= 0) remaining = DURATIONS[mode];
    endAt = Date.now() + remaining * 1000;
    running = true;
    startTicker();
  }
  emit();
  document.dispatchEvent(new CustomEvent('dw:timer-ui'));
}

export function reset() {
  running = false;
  clearInterval(ticker);
  ticker = null;
  remaining = DURATIONS[mode];
  emit();
  document.dispatchEvent(new CustomEvent('dw:timer-ui'));
}

export function setMode(next) {
  if (!DURATIONS[next] || next === mode) return;
  mode = next;
  running = false;
  clearInterval(ticker);
  ticker = null;
  remaining = DURATIONS[mode];
  emit();
  document.dispatchEvent(new CustomEvent('dw:timer-ui'));
}

export function timeText(sec = remaining) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
