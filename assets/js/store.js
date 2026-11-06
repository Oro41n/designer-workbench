// 状态管理：localStorage 持久化 + 示例数据种子
import { todayISO, weekDates, shiftDate, uid } from './util.js';

const KEY = 'dw.state.v1';
const VERSION = 1;

const listeners = new Set();
let state = null;
let saveTimer = null;

function emptyState() {
  return {
    version: VERSION,
    profile: {
      name: '（你的名字）',
      role: '平面设计师',
      bio: '在这里写下你的简介：擅长什么、做过什么、想做什么。',
      location: '',
      email: '',
      avatarId: null
    },
    theme: 'dark',
    tasks: [],
    focusSessions: [],
    projects: [],
    portfolio: [],
    learn: { records: [], checkins: [], words: [], checklist: [] },
    library: { links: [], palettes: [], templates: [] },
    seeded: false
  };
}

function sampleState() {
  const today = todayISO();
  const week = weekDates();
  const designCover = (n) => ({
    poster: 'assets/img/work-poster.webp',
    brochure: 'assets/img/work-brochure.webp',
    packaging: 'assets/img/work-packaging.webp',
    logo: 'assets/img/work-identity.webp',
    app: 'assets/img/work-web.webp',
    code: 'assets/img/work-web.webp'
  }[n] || `assets/covers/${n}.svg`);
  return {
    version: VERSION,
    profile: {
      name: '示例 · 林知夏',
      role: '平面设计师 / 正在学 C++',
      bio: '六年平面设计经验，擅长海报、画册与包装。正在把设计经验翻译成代码，希望做出「美的、能用的」东西。',
      location: '示例 · 杭州',
      email: '',
      avatarId: null
    },
    theme: 'dark',
    tasks: [
      { id: uid('task'), title: '把城市文化节主视觉改到第 3 版', done: false, sample: true, createdAt: Date.now() },
      { id: uid('task'), title: '给茶礼画册补齐第 12–16 页版式', done: false, sample: true, createdAt: Date.now() },
      { id: uid('task'), title: 'C++ 指针练习 40 分钟', done: true, sample: true, createdAt: Date.now() },
      { id: uid('task'), title: '整理本周作品集新增项目', done: false, sample: true, createdAt: Date.now() }
    ],
    focusSessions: [
      { id: uid('focus'), date: shiftDate(today, -2), minutes: 25, sample: true },
      { id: uid('focus'), date: shiftDate(today, -2), minutes: 25, sample: true },
      { id: uid('focus'), date: shiftDate(today, -1), minutes: 50, sample: true },
      { id: uid('focus'), date: shiftDate(today, -1), minutes: 25, sample: true }
    ],
    projects: [
      {
        id: uid('pj'), title: '城市文化节主视觉', client: '示例 · 市文化馆', type: '海报', status: '制作',
        deadline: shiftDate(today, 5), progress: 65, revisions: 2,
        template: '展览海报套版（示例模板）', notes: '主标题用宋体，副标用等线；需要留出赞助商区域。',
        tags: ['主视觉', '大标题'], sample: true, createdAt: Date.now() - 6 * 864e5, updatedAt: Date.now()
      },
      {
        id: uid('pj'), title: '茶品牌三折画册', client: '示例 · 山茶研究所', type: '画册', status: '修改',
        deadline: shiftDate(today, 2), progress: 82, revisions: 3,
        template: '品牌画册 16P 套版（示例）', notes: '客户希望整体更「静」，删掉两处装饰线。',
        tags: ['画册', '版式'], sample: true, createdAt: Date.now() - 12 * 864e5, updatedAt: Date.now()
      },
      {
        id: uid('pj'), title: '咖啡店标识系统', client: '示例 · 半山咖啡', type: 'Logo', status: '洽谈',
        deadline: shiftDate(today, 14), progress: 20, revisions: 0,
        template: '', notes: '先出 3 个方向的草图：字标、图形标、组合标。',
        tags: ['Logo', '品牌'], sample: true, createdAt: Date.now() - 3 * 864e5, updatedAt: Date.now()
      },
      {
        id: uid('pj'), title: '中秋礼盒包装', client: '示例 · 明月点心', type: '包装', status: '制作',
        deadline: shiftDate(today, 9), progress: 45, revisions: 1,
        template: '方形礼盒刀模（示例）', notes: '注意烫金工艺的出血与套准。',
        tags: ['包装', '印刷'], sample: true, createdAt: Date.now() - 9 * 864e5, updatedAt: Date.now()
      },
      {
        id: uid('pj'), title: '音乐节系列海报', client: '示例 · 河岸音乐节', type: '海报', status: '交付',
        deadline: shiftDate(today, -4), progress: 100, revisions: 4,
        template: '', notes: '已交付源文件与 PDF，客户保留后续延展需求。',
        tags: ['海报', '系列'], sample: true, createdAt: Date.now() - 25 * 864e5, updatedAt: Date.now()
      },
      {
        id: uid('pj'), title: '地产项目折页', client: '示例 · 城建置业', type: '其他', status: '修改',
        deadline: shiftDate(today, -1), progress: 70, revisions: 2,
        template: '三折页基础网格（示例）', notes: '销售数据有更新，需要替换第 4 页图表。',
        tags: ['折页', '急'], sample: true, createdAt: Date.now() - 10 * 864e5, updatedAt: Date.now()
      }
    ],
    portfolio: [
      {
        id: uid('work'), section: 'design', title: '城市文化节 · 主视觉', role: '视觉设计 / 排版',
        tools: ['Photoshop', 'Illustrator'], year: '2025', category: '海报', featured: true,
        summary: '以「城市折叠」为概念，用几何色块与宋体大标题建立节日气质，延展到海报、票根与导视。',
        cover: designCover('poster'), imageId: null, sample: true, createdAt: Date.now(),
        links: [{ label: '案例说明', url: '' }]
      },
      {
        id: uid('work'), section: 'design', title: '山茶研究所 · 品牌画册', role: '版式 / 印刷跟进',
        tools: ['InDesign', 'Illustrator'], year: '2025', category: '画册', featured: false,
        summary: '16 页三折画册，用大面积留白和细线网格呈现茶园的安静感；含纸张与专色印刷建议。',
        cover: designCover('brochure'), imageId: null, sample: true, createdAt: Date.now() - 2 * 864e5,
        links: [{ label: '案例说明', url: '' }]
      },
      {
        id: uid('work'), section: 'design', title: '明月 · 中秋礼盒包装', role: '包装设计',
        tools: ['Illustrator', 'CorelDRAW'], year: '2024', category: '包装', featured: true,
        summary: '方形礼盒与手提袋的组合包装，朱红与米白对撞，加入压纹与烫金工艺细节。',
        cover: designCover('packaging'), imageId: null, sample: true, createdAt: Date.now() - 5 * 864e5,
        links: [{ label: '案例说明', url: '' }]
      },
      {
        id: uid('work'), section: 'design', title: '半山咖啡 · 标识系统', role: 'Logo / 品牌基础',
        tools: ['Illustrator'], year: '2024', category: 'Logo', featured: false,
        summary: '以山形与杯口弧线构成字标，输出横竖组合、单色与反白版本，附最小使用规范。',
        cover: designCover('logo'), imageId: null, sample: true, createdAt: Date.now() - 8 * 864e5,
        links: [{ label: '案例说明', url: '' }]
      },
      {
        id: uid('work'), section: 'code', title: '设计工作台（本站）', role: '独立开发',
        tools: ['HTML', 'CSS', 'JavaScript'], year: '2026', category: 'Web',
        featured: true, summary: '原生 ES Modules 的静态应用：项目看板、作品集、学习打卡与番茄钟，数据全部存在本地。',
        cover: designCover('app'), imageId: null, sample: true, createdAt: Date.now(),
        links: [{ label: 'GitHub 仓库', url: 'https://github.com/Oro41n/designer-workbench' }]
      },
      {
        id: uid('work'), section: 'code', title: 'C++ 练习：购物清单', role: '学习练习',
        tools: ['C++', 'g++'], year: '2026', category: '编程练习', featured: false,
        summary: '用 vector 与结构体实现增删改查的小程序，练习指针、引用与文件读写。',
        cover: designCover('code'), imageId: null, sample: true, createdAt: Date.now() - 3 * 864e5,
        links: []
      }
    ],
    learn: {
      records: [
        { id: uid('rec'), date: shiftDate(today, -6), line: 'code', minutes: 45, topic: 'C++ 变量与循环', notes: '把 for 循环写成了 while，后来发现忘了 i++。', sample: true },
        { id: uid('rec'), date: shiftDate(today, -5), line: 'english', minutes: 30, topic: '设计英语：版式词汇', notes: 'grid / margin / bleed 三个词最容易混。', sample: true },
        { id: uid('rec'), date: shiftDate(today, -4), line: 'code', minutes: 60, topic: 'C++ 函数与引用', notes: '引用传参比指针更安全，先习惯 &。', sample: true },
        { id: uid('rec'), date: shiftDate(today, -3), line: 'english', minutes: 20, topic: '听力：设计访谈', notes: '先盲听一遍，再看字幕复盘。', sample: true },
        { id: uid('rec'), date: shiftDate(today, -2), line: 'code', minutes: 40, topic: 'C++ 指针入门', notes: '指针存的是地址，* 是取值，& 是取地址。', sample: true },
        { id: uid('rec'), date: shiftDate(today, -1), line: 'english', minutes: 35, topic: '作品集英文自我介绍', notes: '写了 3 句，准备背下来。', sample: true }
      ],
      checkins: [shiftDate(today, -1), shiftDate(today, -2), shiftDate(today, -3), shiftDate(today, -4)],
      words: [
        { id: uid('w'), word: 'contrast', meaning: '对比；对比度', example: 'Increase the contrast between the title and the background.', learned: true, sample: true },
        { id: uid('w'), word: 'kerning', meaning: '字偶距（两个字符之间的间距）', example: 'Tighten the kerning in the headline.', learned: false, sample: true },
        { id: uid('w'), word: 'bleed', meaning: '出血（印刷裁切线以外的区域）', example: 'Keep 3 mm bleed on each side.', learned: false, sample: true },
        { id: uid('w'), word: 'hierarchy', meaning: '层级；视觉层级', example: 'The hierarchy is not clear enough.', learned: true, sample: true },
        { id: uid('w'), word: 'grid', meaning: '网格；栅格系统', example: 'Align the blocks to a 12-column grid.', learned: false, sample: true }
      ],
      checklist: [
        { id: uid('ck'), title: 'C++ 基础语法（变量、循环、函数）', done: true, sample: true },
        { id: uid('ck'), title: '指针与内存', done: false, sample: true },
        { id: uid('ck'), title: '数组与字符串', done: false, sample: true },
        { id: uid('ck'), title: 'Web 基础：DOM 与事件', done: false, sample: true },
        { id: uid('ck'), title: 'Git 基础（提交与推送）', done: true, sample: true }
      ]
    },
    library: {
      links: [
        { id: uid('lnk'), name: '站酷 ZCOOL', url: 'https://www.zcool.com.cn', tags: ['灵感', '中文'], notes: '看国内商业设计与排版趋势。', sample: true },
        { id: uid('lnk'), name: 'Behance', url: 'https://www.behance.net', tags: ['灵感', '作品集'], notes: '整理作品集结构时参考。', sample: true },
        { id: uid('lnk'), name: 'Dribbble', url: 'https://dribbble.com', tags: ['UI', '配色'], notes: '看小尺寸视觉与配色。', sample: true },
        { id: uid('lnk'), name: 'The Noun Project', url: 'https://thenounproject.com', tags: ['图标', '素材'], notes: '找线性图标参考（注意授权）。', sample: true }
      ],
      palettes: [
        { id: uid('pal'), name: '印刷朱红', colors: ['#C8452D', '#17140F', '#F4F0E7', '#D9C9B6'], notes: '本工作台的主色板。', sample: true },
        { id: uid('pal'), name: '钴蓝夜色', colors: ['#2440A8', '#0F1220', '#E9E7DF', '#8B93A8'], notes: '适合科技类品牌。', sample: true },
        { id: uid('pal'), name: '苔绿与纸', colors: ['#4A5D3A', '#1D2318', '#F1EEE2', '#C3B99F'], notes: '自然、茶叶、手作感。', sample: true }
      ],
      templates: [
        { id: uid('tpl'), name: '展览海报套版（示例占位）', url: 'https://www.zcool.com.cn', notes: '替换标题、日期、赞助商区域即可。', sample: true },
        { id: uid('tpl'), name: '16P 品牌画册网格（示例占位）', url: 'https://www.behance.net', notes: '12 栏网格，页边距 18mm。', sample: true },
        { id: uid('tpl'), name: '方形礼盒刀模（示例占位）', url: '', notes: '含出血与压痕线，使用前核对尺寸。', sample: true }
      ]
    },
    seeded: true
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const seed = sampleState();
      localStorage.setItem(KEY, JSON.stringify(seed));
      return seed;
    }
    return normalize(JSON.parse(raw));
  } catch (err) {
    console.error('读取本地数据失败', err);
    return emptyState();
  }
}

export function normalize(input) {
  const base = emptyState();
  if (!input || typeof input !== 'object') return base;
  const merged = { ...base, ...input, version: VERSION };
  merged.profile = { ...base.profile, ...(input.profile || {}) };
  merged.theme = input.theme === 'dark' ? 'dark' : 'light';
  merged.tasks = Array.isArray(input.tasks) ? input.tasks : [];
  merged.focusSessions = Array.isArray(input.focusSessions) ? input.focusSessions : [];
  merged.projects = Array.isArray(input.projects) ? input.projects : [];
  merged.portfolio = Array.isArray(input.portfolio) ? input.portfolio.map(p => ({ ...p, tools: Array.isArray(p.tools) ? p.tools : [], links: Array.isArray(p.links) ? p.links : [] })) : [];
  const learn = input.learn || {};
  merged.learn = {
    records: Array.isArray(learn.records) ? learn.records : [],
    checkins: Array.isArray(learn.checkins) ? learn.checkins : [],
    words: Array.isArray(learn.words) ? learn.words : [],
    checklist: Array.isArray(learn.checklist) ? learn.checklist : []
  };
  const library = input.library || {};
  merged.library = {
    links: Array.isArray(library.links) ? library.links.map(l => ({ ...l, tags: Array.isArray(l.tags) ? l.tags : [] })) : [],
    palettes: Array.isArray(library.palettes) ? library.palettes.map(p => ({ ...p, colors: Array.isArray(p.colors) ? p.colors : [] })) : [],
    templates: Array.isArray(library.templates) ? library.templates : []
  };
  merged.seeded = Boolean(input.seeded);
  return merged;
}

export function initStore() {
  if (state) return state;
  state = load();
  applyTheme();
  return state;
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach(fn => {
    try { fn(state); } catch (err) { console.error(err); }
  });
}

function emitSave(status, at = null) {
  window.dispatchEvent(new CustomEvent('dw:save', { detail: { status, at } }));
}

function persist() {
  try {
    emitSave('saving');
    localStorage.setItem(KEY, JSON.stringify(state));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      emitSave('saved', new Date());
    }, 120);
  } catch (err) {
    console.error('保存失败', err);
    emitSave('error');
  }
}

export function update(fn, { silent = false } = {}) {
  if (!state) initStore();
  fn(state);
  persist();
  if (!silent) notify();
}

export function saveNow() {
  if (state) persist();
}

export function applyTheme() {
  document.documentElement.dataset.theme = state?.theme === 'dark' ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', state?.theme === 'dark' ? '#131110' : '#F4F0E7');
}

export function setTheme(theme) {
  update(s => { s.theme = theme === 'dark' ? 'dark' : 'light'; });
  applyTheme();
}

export function replaceState(next) {
  state = normalize(next);
  persist();
  applyTheme();
  notify();
}

export function exportData() {
  return JSON.parse(JSON.stringify(state));
}

export function clearSamples() {
  update(s => {
    s.tasks = s.tasks.filter(x => !x.sample);
    s.focusSessions = s.focusSessions.filter(x => !x.sample);
    s.projects = s.projects.filter(x => !x.sample);
    s.portfolio = s.portfolio.filter(x => !x.sample);
    s.learn.records = s.learn.records.filter(x => !x.sample);
    s.learn.words = s.learn.words.filter(x => !x.sample);
    s.learn.checklist = s.learn.checklist.filter(x => !x.sample);
    s.library.links = s.library.links.filter(x => !x.sample);
    s.library.palettes = s.library.palettes.filter(x => !x.sample);
    s.library.templates = s.library.templates.filter(x => !x.sample);
    s.seeded = true;
  });
}

export function clearAll() {
  state = emptyState();
  state.seeded = true;
  persist();
  applyTheme();
  notify();
}

export function storageBytes() {
  try { return localStorage.getItem(KEY)?.length || 0; } catch { return 0; }
}
