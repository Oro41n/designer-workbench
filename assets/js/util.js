// 通用工具函数
export const TYPES = ['海报', '画册', 'Logo', '包装', '其他'];
export const STATUSES = ['洽谈', '制作', '修改', '交付'];
export const STATUS_EN = { 洽谈: 'talk', 制作: 'work', 修改: 'revise', 交付: 'done' };

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Number(n) || 0));
}

function pad(n) { return String(n).padStart(2, '0'); }

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function shiftDate(iso, days) {
  const d = parseISO(iso) || new Date();
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

export function weekDates(anchor = new Date()) {
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const day = (d.getDay() + 6) % 7; // 周一为 0
  d.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return isoOf(x);
  });
}

export function weekdayLabel(iso) {
  const d = parseISO(iso);
  return d ? ['一', '二', '三', '四', '五', '六', '日'][(d.getDay() + 6) % 7] : '';
}

export function formatCN(iso) {
  const d = parseISO(iso) || new Date();
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(d);
}

export function formatShort(iso) {
  const d = parseISO(iso);
  if (!d) return '未设置';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatFull(iso) {
  const d = parseISO(iso);
  if (!d) return '未设置';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return '夜深了';
  if (h < 8) return '早上好';
  if (h < 11) return '上午好';
  if (h < 13) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

export function dueInfo(project) {
  if (!project.deadline) return { text: '未设置截止', state: 'none', days: null };
  const today = parseISO(todayISO());
  const due = parseISO(project.deadline);
  if (!due) return { text: '未设置截止', state: 'none', days: null };
  const days = Math.round((due - today) / 86400000);
  if (project.status === '交付') {
    return { text: formatShort(project.deadline) + ' 已交付', state: 'done', days };
  }
  if (days < 0) return { text: `逾期 ${-days} 天`, state: 'overdue', days };
  if (days === 0) return { text: '今天截止', state: 'today', days };
  if (days === 1) return { text: '明天截止', state: 'soon', days };
  return { text: `${formatShort(project.deadline)} 截止`, state: days <= 3 ? 'soon' : 'normal', days };
}

export function minutesText(m) {
  m = Number(m) || 0;
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} 小时 ${rest} 分` : `${h} 小时`;
}

export function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadFile(filename, text, type = 'application/json') {
  downloadBlob(filename, new Blob([text], { type }));
}

export function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - (Number(ts) || 0));
  if (diff < 60e3) return '刚刚';
  if (diff < 3600e3) return `${Math.floor(diff / 60e3)} 分钟前`;
  if (diff < 86400e3) return `${Math.floor(diff / 3600e3)} 小时前`;
  const d = new Date(Number(ts));
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function bytesText(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function safeUrl(url = '') {
  const t = String(url).trim();
  if (!t) return '';
  if (/^(https?:|mailto:)/i.test(t)) return t;
  if (t.startsWith('#')) return t;
  return `https://${t}`;
}

export function hostOf(url = '') {
  try { return new URL(safeUrl(url)).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

export function uidList(input = '') {
  return String(input).split(/[,，、]/).map(s => s.trim()).filter(Boolean);
}

export function sortByDateDesc(list, key = 'date') {
  return [...list].sort((a, b) => String(b[key]).localeCompare(String(a[key])));
}

export function clampText(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}
