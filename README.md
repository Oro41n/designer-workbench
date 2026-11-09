# 41n 设计工作台 · Designer Workbench

一个面向平面设计师的个人工作台：项目看板、作品集（设计 + 编程）、学习打卡、灵感素材库、番茄钟，以及内置的印前画板工具（类 Figma Lite：无限画布、图层、属性、PNG / SVG 导出）。纯静态站点，原生 HTML / CSS / ES Modules，无构建、无外部 CDN，数据保存在本机浏览器。

- 入口：[`index.html`](index.html)
- 线上地址：[https://oro41n.github.io/designer-workbench/](https://oro41n.github.io/designer-workbench/)（GitHub Pages，`main` 分支根目录）
- 设计概念：**Living Press / 活的印刷机**（v3）——程序化 WebGL 流体影像层 + 由图片主色驱动的全站主题 + 多层影像拼贴 + 遮罩文字揭示。首屏不是静态大图模板：噪声场由时间与指针驱动缓慢呼吸，色相来自当前图流的第一张图。
- 主题：4 个基色（`--bg` / `--ink` / `--accent` / `--accent-2`）由 Canvas 从图片像素提取（40×40 采样 + 5 簇 k-means），并映射为全站的背景 / 文字 / 强调 / 渐变 / 描边；换图时以 900ms 缓动插值过渡，深色与浅色模式都重新计算。每次刷新页面都会重新拉图、重新取色。
- 动效与交互：页面幕布转场、文字遮罩逐行揭示、影像拼贴随光标与滚动分层视差（`data-depth`）、磁性按钮（`data-magnet`）、悬停位移、作品行悬浮大图、自定义光标「VIEW / THEME」。全部遵循 `prefers-reduced-motion`（降级为静态帧）。
- 状态：v3 已完成。首页与六个内页（作品 / 项目 / 画板 / 学习 / 灵感 / 设置）使用同一套 v3 令牌；旧的 `site.css`、`views.css` 已删除，样式集中在 `v3.css`（外壳 + 首页）与 `pages-v3.css`（内页），`app.css` 只保留画板编辑器与基础重置。功能与 `localStorage` / IndexedDB 数据保持兼容，无需迁移。
- 适配：1600 / 1180 / 1000 / 860 / 640 / 390 六档；移动端底部导航，页面无横向滚动。

## 功能

| 模块 | 内容 |
| --- | --- |
| 工作台 `#/home` | 程序化影像首屏（WebGL 流体层 + 影像拼贴视差）、「此刻的颜色」图流（换一批 / 逐张取色）、作品索引（悬停大图）、工作台统计与页脚 |
| 画板架 `#/boards` | 缩略图墙、搜索、示例画板、新建（A4 300dpi / 1080×1080 / 1920×1080 / 1080×1920 / 自定义）、重命名、复制、删除 |
| 画板编辑器 `#/board/:id` | 无限画布、画框、矩形 / 椭圆 / 直线 / 文字 / 图片、图层、属性面板、对齐吸附、撤销重做、保存与导出（详见下文） |
| 项目看板 `#/projects` | 新增 / 编辑 / 删除；客户、类型、状态、截止日期、进度、改稿次数、模板来源、备注、标签；四列看板 / 列表切换；搜索、类型筛选、状态筛选、逾期朱红高亮 |
| 作品集 `#/portfolio` | 设计 / 编程两个分区；封面本地图片上传（自动压缩到长边 ≤ 1600px）；标题、角色、工具、年份、简介、外链；分类筛选、精选标记、详情弹层；空状态引导 |
| 学习区 `#/learn` | 编程 / 英语双线学习记录；连续打卡、本周时长、本周记录数；本周堆叠柱状图；英语生词本（添加 / 标记掌握）；编程学习清单 |
| 灵感库 `#/library` | 收藏网址（名称 / URL / 标签 / 备注）、配色板（点击色块复制 HEX）、常用模板来源 |
| 设置 `#/settings` | 姓名 / 职位 / 城市 / 邮箱 / 简介、头像上传、浅色 / 深色主题、完整 JSON 导出 / 导入（含画板与图片）、存储统计、清除示例数据、二次确认清空全部数据 |

全局：固定顶栏（品牌 / 编号导航 / 命令 / 搜索 / 主题）、移动端底部导航、**命令面板 `⌘K` / `Ctrl+K`**（搜索并跳转页面 / 项目 / 作品 / 画板，执行「新建画板 / 新建项目 / 开始专注 / 切换主题」）、`/` 快捷键搜索、`Esc` 关闭弹层、跳转到主内容的 skip link、可见 focus、`aria` 标签、`prefers-reduced-motion`、空状态、保存状态提示、Toast 反馈。示例数据均带「示例」标记。

## 实时图流与配色引擎（Unsplash）

首页的「此刻的颜色」图流走 **Unsplash 官方 API**，每次打开 / 刷新 / 点「换一批图」都请求一次 `/photos/random`，没有本地快照，也没有「非实时」兜底文案。

| 项 | 实现 |
| --- | --- |
| 请求 | `GET https://api.unsplash.com/photos/random?count=8&orientation=landscape&client_id=<Access Key>`，`cache: 'no-store'`；每次页面加载与「换一批」都是一次新请求 |
| Key 在哪 | **Access Key（client_id）** 写在 [`assets/js/feed/config.js`](assets/js/feed/config.js) 的 `FEED_CONFIG.keys.unsplash`，随静态页面公开下发；这是 Unsplash 允许的公开客户端 key。也可用 `localStorage['dw.feed.v2']` 覆盖 |
| Secret 在哪 | **只在本地 `.env.local`**（已加入 `.gitignore`），用于本机验证脚本；不进任何 HTML / JS / CSS / JSON / README / 截图，仓库与提交历史中不存在 |
| 限流 | Demo 应用 **50 次/小时**。每次页面加载 1 次、换一批 1 次；同一时段多人访问会共享额度，超限返回 429 时页面给出可读提示并切站内备用图 |
| 取色 | 图片直连 `images.unsplash.com`（带 CORS 头），Canvas 40×40 采样 + 5 簇 k-means → `--bg` / `--ink` / `--accent` / `--accent-2` → 900ms 插值过渡。像素读不到时**降级为接口返回的 `color` 字段**做色相种子（`paletteFromSeed`），仍走同一套角色映射与对比度校验 |
| 对比度 | `paletteFromClusters` 内置 WCAG 校验：正文 `ink/bg` ≥ 4.6:1、强调色 ≥ 4.5:1、次强调 ≥ 3:1；`--on-accent` 自动在黑 / 白中选对比更高的一侧。深色与浅色模式各自重算 |
| 署名 | 图流缩略图、当前照片栏、静态降级图与说明区都显示摄影师署名，并链接到 `links.html`（附 `utm_source=41n_workbench&utm_medium=referral`）；照片本身链接同样带 `utm` |
| 下载追踪 | 「下载原图」与「存为画板素材」都会先请求 `links.download_location`（附公开 `client_id`），再打开原图；即使追踪请求被广告拦截器阻断，也不影响取图 |
| 失败兜底 | 403（key 无效 / 无权限）、429（限流）、8 秒超时、网络不可达分别给出中文原因，并显示 `assets/img/work-*.webp` 站内备用图；页面不白屏，取色仍可用 |

> 创意用法（都可用，不是摆设）：
> 1. **配色板一键复制**：把当前图的 `--bg / --ink / --accent / --accent-2` 与 6 个取样色复制成 CSS 变量，直接粘进设计稿或代码。
> 2. **图流入画板**：把当前照片压缩存入 IndexedDB，作为图片对象放进最近一个画板（没有画板时自动建「图流素材」），随后可在画板编辑器里继续排版。
> 3. **滚动联动主题**：相机穿过每张图时，全站令牌跟着该图主色渐变；这也是「主色调随图同步变化」的主链路。

> 说明：`images.weserv.nl` 代理仅保留给没有 CORS 的图源（Picsum / Openverse）；Unsplash 与 Pexels 都直连读像素。Pexels / Openverse 适配器仍在，可用 `source` 切换，但默认不启用。

### Midjourney：没有可接入的公开图流（2026-11-06 实测）

| 路径 | 结果 |
| --- | --- |
| 官方 API / 开发者计划 | 不存在。2026 年仍只有 Discord 与 midjourney.com 网页端，无公开 API、无 SDK、无 Key 申请入口 |
| `www.midjourney.com/explore` 脚本抓取 | `403` + Cloudflare 质询，浏览器可访问，脚本与 GitHub Actions runner 均不可 |
| `/api/app/recent-jobs` | `401`，需要登录态 |
| `cdn.midjourney.com` 直链 | `403`，带 / 不带 Referer 均拒绝热链 |
| 公开镜像 / 授权图流 | 未找到任何可公开访问且许可清晰的 MJ 图流镜像；不采用「伪实时」包装 |

结论：**不接入 Midjourney**。首页图流改用上述图库，并保证「每次加载换图 + 真实取色」。`assets/data/mj-feed.json` 仅作为 v2 的历史数据保留，不再出现在新首页。

## v4 镜头穿图（WebGL 相机）

首页是一段连续的 3D 相机运动，不是 CSS 位移伪装的视差：

- **相机与平面**：原生 WebGL（`assets/js/cam3d.js`）把图流照片放在不同 Z 深度的平面上；滚动进度直接驱动相机沿 Z 轴推进，从画框中间穿过，下一段在画框背后展开。带雾、景深与地面光池，平面允许偏心与轻微倾斜。
- **5 个停靠点**：hero / 图流 / 作品 / 工作台 / 收尾。停靠点不等距，每段有独立关键帧（x/y/z、FOV、roll、pitch、时长），五种运动分别是斜穿、侧移推进、升降、绕行、俯冲；停靠前减速并 settle 0.2–0.4s，滚动带阻尼而非线性跟随；每次加载打乱图片顺序与平面布局。

| 段 | 运动 | 滚动占比 | 17s 录屏约时长 | 控制点 c1 → c2 | FOV / roll / pitch |
| --- | --- | --- | --- | --- | --- |
| 1 | 斜穿 | 18% | 3.1s | `[4.4,2.4,-2.2] → [-1.2,1.4,1.6]` | 54° / -1.6° / 2° |
| 2 | 侧移推进 | 22% | 3.7s | `[5.0,0.6,-2.4] → [4.0,-0.6,2.4]` | 47° / 1.8° / 0° |
| 3 | 升降 | 20% | 3.4s | `[0.4,2.8,-2.4] → [0.2,2.2,2.4]` | 58° / -2.6° / 2° |
| 4 | 绕行 | 25% | 4.3s | `[4.2,-1.8,-1.8] → [1.6,1.8,1.2]` | 51° / 2.2° / 4° |
| 5 | 俯冲 | 15% | 2.6s | `[-1.2,0.8,-0.6] → [0.4,0.6,0.9]` | 62° / -6° / 10° |

> 缓动：每段用 `smootherstep` 连接两端，停靠窗口内额外 settle 0.2–0.4s；滚动输入经临界阻尼弹簧，速度不线性跟随手指 / 滚轮。
- **DOM 覆盖层**：标题、正文、按钮、取色板全部是真实 DOM，可选中、可聚焦、可读屏；没有把文字烘焙进贴图。
- **作品集**：`#/portfolio` 改为 3D 画廊，点作品后相机飞近并由 DOM 详情接管，`Esc` 退回。
- **降级**：`prefers-reduced-motion` 与 ≤900px 视口关闭穿越，退回静态堆叠 / 纵向图流；WebGL 不可用时同样退回静态版。
- **性能记录**：23 个平面，单帧最多 23 个 drawcall（视锥剔除后 2–11）；无头 Edge + SwiftShader 下录屏稳定 15fps，15–20 秒可完整走完 5 段。
- **素材**：`screenshots/v4-cam-scroll-17s.mp4`、`screenshots/v4-cam-*.png`。

## 画板工具（Lite Figma）

从顶栏「画板」进入画板架，新建时选择尺寸预设：A4 300dpi（2480×3508）、1080×1080、1920×1080、1080×1920 或自定义。每个画板记录就是一张画框，打开后进入全屏编辑器（隐藏新顶栏与移动底栏，`Esc` 可退出工具回到选择）。

**画布**

- 平移：按住空格拖拽、鼠标中键拖拽，或选择「手型」工具（H）拖拽。
- 缩放：滚轮（`⌘` / `Ctrl` + 滚轮围绕指针缩放）、`⌘+` / `⌘-`、底部缩放按钮；范围 25%–400%；`⌘0` 适应窗口。
- 标尺与网格可在编辑器底部开关；网格间距随缩放自适应。
- 画框外有裁切标记与 `FRAME 01 · 名称 · 尺寸` 标牌，画框投影用于区分纸面与工作区。

**工具与对象**

`V` 选择、`R` 矩形、`O` 椭圆、`L` 直线、`T` 文字、`I` 图片、`H` 手型。选中后拖动移动；8 个控制点缩放，`Shift` 等比；顶部旋转柄旋转，`Shift` 以 15° 吸附。复制 / 粘贴 / 再制、删除、锁定、隐藏、层级上移 / 下移 / 置顶 / 置底均在右侧面板或快捷键完成。文字可改字号、字重、行高、颜色与对齐，双击进入行内编辑（`⌘Enter` 提交，`Esc` 取消）。图片上传后压缩到长边 ≤ 1600px，存入 IndexedDB 并以离屏图片缓存绘制。

**属性与吸附**

属性面板提供名称、X / Y / W / H、旋转、透明度、填充、混合模式（正常 / 正片叠底 / 滤色）、描边宽度与颜色、圆角，以及文字专属属性。拖动和缩放时显示画框对齐线、对象间吸附参考线与像素网格吸附（可在底部开关）。图层面板列出画框与全部对象，支持选择、重命名（双击）、显隐、锁定、排序。

**历史与保存**

快照式撤销栈保留 100 步（≥ 50 步要求），干净状态后 500ms 防抖自动保存到 IndexedDB `dw-boards` / `boards`，页头显示「保存中 / 已保存」。切到其它页面或关闭标签前会强制落盘；刷新后完整恢复对象树与图片引用。画板架支持新建、重命名、复制、删除；「设置 → 导出 JSON」会同时包含全部画板与图片，便于换设备迁移。

**快捷键**

| 操作 | 快捷键 |
| --- | --- |
| 工具切换 | `V` `R` `O` `L` `T` `I` `H` |
| 平移画布 | 空格 + 拖拽 / 中键拖拽 / 手型工具 |
| 缩放 | 滚轮 / `⌘+` `⌘-` / `⌘0` 适应窗口 |
| 撤销 / 重做 | `⌘Z` / `⌘⇧Z`（或 `⌘Y`） |
| 再制 / 复制 / 粘贴 | `⌘D` / `⌘C` / `⌘V` |
| 删除 | `Delete` / `Backspace` |
| 微移 / 大步移 | 方向键 / `Shift` + 方向键 |
| 保存 | `⌘S`（自动保存之外的立即落盘） |
| 编辑文字 | `Enter`（选中文字对象）/ 双击 |
| 取消选择 / 回到选择工具 | `Esc` |
| 命令面板 | `⌘K` / `Ctrl+K`（全局） |

**导出**

编辑器右上「导出」：PNG 可选 1x / 2x / 3x 与透明背景（不含纸张底色），导出前按画框裁剪；单张上限约 3600 万像素，超出会自动降倍率并在弹层中提示。SVG 导出保留可编辑的 `<text>` 节点与图片（内嵌 dataURL），**不做文字转路径**。导出弹层内显示当前画板的真实缩略预览。

## 技术栈与目录

```text
index.html                 入口（新外壳：顶栏、幕布、光标、滚动进度、内页页脚）
assets/
  css/v3.css               v3 外壳与首页：令牌、顶栏、光标 / 幕布、WebGL 首屏、图流、页脚
  css/pages-v3.css         六个内页（作品 / 项目 / 画板 / 学习 / 灵感 / 设置）+ 弹层 / Toast
  css/app.css              基础重置与画板编辑器（仅编辑器仍使用其舞台配色）
  js/app.js                路由（hash）、外壳渲染、幕布转场、视差 / 揭示 / 光标、全局交互
  js/store.js              localStorage 状态、示例数据、导出 / 导入 / 清空
  js/images.js             IndexedDB 图片压缩、存取、导入导出与 hydrate
  js/boards.js             IndexedDB 画板存取、尺寸预设、示例画板、画板导入导出
  js/board-render.js       Canvas 2D 绘制（编辑器 / PNG）与 SVG 生成（预览 / 导出）
  js/ui.js                 Modal、确认框、危险操作二次确认、Toast、空状态
  js/palette.js            命令面板（⌘K），跨页面 / 项目 / 作品 / 画板搜索与动作
  js/pomodoro.js           全局番茄钟（时间戳计时，跨路由不中断）
  js/search.js             全局搜索
  js/views/*.js            八个页面视图（含画板架与编辑器）
  js/feed/*.js             图流适配器（Unsplash / Picsum / Pexels / Openverse）、CORS 与失败兜底
  js/cam3d.js              首页 WebGL 相机、平面与停靠点
  js/theme-engine.js       像素取色、color 种子降级、WCAG 对比度校验与主题过渡
  js/util.js / icons.js    工具函数与内联 SVG 图标
assets/img/*.webp          站内备用图与示例作品的大幅影像
assets/data/mj-feed.json   v2 历史数据（首页已不引用）
.env.local                 本地验证凭据（gitignore 排除，不入库）
assets/covers/*.svg        未上传封面时的抽象几何兜底封面
screenshots/               1600×900 与 390×844 实跑截图
```

## 数据模型

数据保存在 `localStorage` 的 `dw.state.v1`（约 8 KB 起），图片存在 IndexedDB `dw-images` / object store `images`，画板存在 IndexedDB `dw-boards` / object store `boards`。导出的 JSON 同时包含 state、图片 dataURL 与全部画板。

```ts
state = {
  version: 1,
  profile: { name, role, bio, location, email, avatarId },
  theme: 'light' | 'dark',
  tasks: [{ id, title, done, sample, createdAt }],
  focusSessions: [{ id, date, minutes, sample }],
  projects: [{
    id, title, client, type: '海报'|'画册'|'Logo'|'包装'|'其他',
    status: '洽谈'|'制作'|'修改'|'交付',
    deadline, progress: 0-100, revisions, template, notes,
    tags: string[], sample, createdAt, updatedAt
  }],
  portfolio: [{
    id, section: 'design'|'code', title, role, tools: string[], year,
    summary, category, featured, cover, imageId,
    sample, links: [{ label, url }], createdAt
  }],
  learn: {
    records: [{ id, date, line: 'code'|'english', minutes, topic, notes, sample }],
    checkins: string[], words: [{ id, word, meaning, example, learned, sample }],
    checklist: [{ id, title, done, sample }]
  },
  library: {
    links: [{ id, name, url, tags: string[], notes, sample }],
    palettes: [{ id, name, colors: string[], notes, sample }],
    templates: [{ id, name, url, notes, sample }]
  },
  seeded: boolean
}

board = {
  id, name, width, height, bg, sample,
  createdAt, updatedAt,
  objects: [{
    id, type: 'rect'|'ellipse'|'line'|'text'|'image', name,
    x, y, w, h, rotation, opacity, blend: 'normal'|'multiply'|'screen',
    fill, stroke, strokeWidth, radius, hidden, locked,
    // text
    text, fontSize, fontWeight, lineHeight, align,
    // image（指向 dw-images 中的图片 id）
    imageId
  }]
}
```

导出文件结构：`{ app: 'designer-workbench', version: 2, exportedAt, state, images: { [id]: dataURL }, boards: board[] }`。导入会校验结构并覆盖当前数据，图片写回 IndexedDB、画板写回 `dw-boards`。

## 本地运行

无需安装依赖，任意静态服务器即可：

```bash
python -m http.server 4173
# 打开 http://127.0.0.1:4173/
```

直接双击 `index.html` 也能打开，但浏览器对 `file://` 下的模块 / IndexedDB 限制较多，建议用本地服务器。

## 部署到 GitHub Pages

仓库已按 GitHub Pages 的静态站点方式组织，`main` 分支根目录即站点根目录。推送后在仓库 `Settings → Pages` 选择 `Deploy from a branch`，分支 `main`、目录 `/ (root)`；保存后等待 Actions 构建，访问 `https://<账号>.github.io/designer-workbench/`。hash 路由无需服务端 rewrite。

## 如何替换作品与个人信息

1. 打开「设置」，改姓名、职位、城市、邮箱、简介，上传头像；示例姓名「示例 · 林知夏」会显示「示例」标记，改成自己的信息后标记消失。
2. 打开「作品集」→「新增作品」。封面用本机图片上传，自动压缩；也可以先在 `assets/covers/` 放自己的图，再把 `cover` 字段指向该路径。
3. 新作品默认 `sample: false`；示例作品可在「设置」里点「清除示例数据」一次性移除，或逐条删除。
4. 联系方式默认留空，是否公开由你决定；站内不会上传任何数据。
5. 新视觉的公开展示图在 [`assets/img/`](assets/img/)（WebP），示例作品封面在 `store.js` 的 `designCover()` 中映射；换成自己的作品时优先用作品集里的封面上传。强调色不是写死的：运行时由图流第一张图取色写入 `--bg` / `--ink` / `--accent` / `--accent-2`；想固定品牌色，改 [`assets/css/v3.css`](assets/css/v3.css) 顶部 `:root` 的兜底值（深色 `--accent: #ff4b2b`，浅色 `#cf3418`），并把 `theme-engine.js` 的自动取色关掉即可。内页样式在 [`assets/css/pages-v3.css`](assets/css/pages-v3.css)，编辑器相关令牌仍由 `app.css` 提供。

## 验证与性能

- v3 内页迁移（2026-11-06）：Edge / Playwright 在 1600×900 与 390×844 下遍历作品、项目、画板、学习、灵感、设置六页，均无横向滚动、控制台 / 页面 0 报错；页头标题与面板标题均为 v3 衬线字体，正文背景等于取色得到的 `--bg`。抽检通过：作品设计 / 编程分区切换、作品详情弹层、项目看板 / 列表切换（7 行）、浅色主题切换（设置页背景 `rgb(235,238,242)`）、命令面板（23 条动作）、画板编辑器（隐藏顶栏，画布 1230×818）、移动端底栏（`position: fixed`，页面底部留白 84px 不被遮挡）。
- 使用 Edge（Playwright，Chromium 内核，1600×900）实跑画板全流程：新建 1080×1350 画板 → 矩形 / 文字 / 上传图片 → 拖动、8 点缩放、旋转 → 改填充 / 描边 → 图层排序 → 撤销 / 重做 → 自动保存 → 刷新恢复（3 个对象 + 4 行图层）→ 导出 PNG 2x（2160×2700，349,637 字节）→ 导出 SVG（17,174 字节，含 `<text>` 节点）。命令面板 `⌘K` 搜索「画板」返回 4 条结果，首项为「新建画板」；深浅主题、390×844 三页均无横向滚动（`scrollWidth = clientWidth = 390`），控制台与页面错误均为 0。
- 性能：在编辑器中构造 123 个对象，连续 12 帧 Canvas 绘制平均 **0.65 ms**、最大 **4.4 ms**（约 60fps 预算内；不含历史快照与自动保存的序列化开销）。缩放 / 拖动 / 吸附均通过 `requestAnimationFrame` 合并重绘，图片使用离屏 `Image` 缓存。
- v4 WebGL 相机：23 个平面，单帧 drawcall 2–11（上限 23）；无头 Edge + SwiftShader 录屏稳定 15fps，17 秒走完 5 段。`prefers-reduced-motion` 与 ≤900px 视口自动关闭穿越，退回静态堆叠 / 纵向图流，控制台 0 报错。
- 截图见 [`screenshots/`](screenshots/)：首页桌面 / 浅色 / 移动端（`v3-desktop-*`、`v3-mobile-*`），六个内页桌面（`v3-inner-desktop-*`）与移动端（`v3-inner-mobile-*`），作品详情弹层、项目列表视图、设置浅色、画板编辑器。
- 本轮 Unsplash 实跑截图：`unsplash-hero.png`（首屏）、`unsplash-signal-01.png`（图流 + 摄影师署名 + Unsplash 链接）、`unsplash-palette-compare.png`（同一画面暖橙 / 青绿两组主色对比）、`unsplash-signal-light.png`（浅色模式）、`unsplash-mobile-hero.png` / `unsplash-mobile-signal-full.png`（390×844）、`unsplash-fallback.png`（403 兜底提示 + 站内备用图）。
- v4 镜头穿图截图与录屏：`screenshots/v4-cam-hero.png`、`v4-cam-signal.png`、`v4-cam-works.png`、`v4-cam-pf-intro.png`、`v4-cam-pf-detail.png`、`v4-cam-mobile-hero.png`、`v4-cam-reduced-hero.png`，五段运动关键帧 `v4-cam-motion-1-oblique.png` … `v4-cam-motion-5-dive.png`，以及 `v4-cam-scroll-17s.mp4`。
- 体积（未压缩）：HTML 3.2 KB，CSS 185.0 KB（`app.css` 108.2 / `pages-v3.css` 43.4 / `v3.css` 33.4），JS 303.1 KB；无外部字体与 CDN 请求。首屏影像为 WebP，示例 SVG 仅作兜底。

## 已知限制与未实现

- 数据仅保存在当前浏览器，不跨设备同步；换设备请用「导出 JSON / 导入 JSON」。
- 导入会覆盖当前本机数据（导入前会二次确认），建议先导出备份。
- 画板编辑器每个画板只有一张画框（画框即画板）；多画框排版请新建多个画板。
- **未实现**：多人协作 / 云端同步、组件与实例系统、钢笔路径与矢量节点编辑、布尔运算、分组（⌘G）、自动布局、完整 Figma 文件导入导出。SVG 导出不把文字转成路径；PNG 单张限制约 3600 万像素。
- 移动端可查看画板、选择对象与简单拖动，复杂编辑会提示「建议桌面端」；不支持多点触控双指缩放。
- 筛选与视图状态未写入 URL（路由只记录页面与项目 / 作品 / 画板 id）；刷新后筛选会回到默认。
- 示例作品是抽象几何封面，不代表真实项目；示例项目 / 学习记录 / 示例画板同样带「示例」标记。
- **Midjourney 没有可接入的公开图流**：广场页 / API / CDN 均为 403 或 401，静态 Pages 无法抓取或热链；首页改用 Unsplash 官方 `/photos/random` 并真实取色。`assets/data/mj-feed.json` 只是 v2 的历史数据，页面不再引用。
- **Unsplash Demo 限流 50 次/小时**：额度由应用共享，多人同时访问会更快触发 429；页面会显示原因并切站内备用图，不会白屏。若用于正式流量，应换成生产应用并通过轻量后端代理请求。
- **随机图不是策展**：`/photos/random` 返回全站随机照片，可能与设计主题无关；需要主题化时可在 `config.query` 填关键词，或改走 `/photos` 的策展集合。
- **下载追踪依赖浏览器允许请求**：`download_location` 调用是尽力而为，广告拦截器或离线状态下可能不成功，但图片仍可正常显示。
- 六个内页由 [`assets/css/pages-v3.css`](assets/css/pages-v3.css) 统一覆盖：旧的 `site.css` / `views.css` 已删除，`app.css` 只保留基础重置与画板编辑器；编辑器仍使用自身的舞台配色，不与新外壳共用全部令牌。
- 仓库默认公开、联系方式默认留空、强调色默认朱红，均可按需调整。
