# Oro 设计工作台 · Designer Workbench

一个面向平面设计师的个人工作台：项目看板、作品集（设计 + 编程）、学习打卡、灵感素材库、番茄钟，以及内置的印前画板工具（类 Figma Lite：无限画布、图层、属性、PNG / SVG 导出）。纯静态站点，原生 HTML / CSS / ES Modules，无构建、无外部 CDN，数据保存在本机浏览器。

- 入口：[`index.html`](index.html)
- 设计概念：**Night Press / 夜间印刷剧场**——近黑底、纸白字、朱红强调，衬线大标题配等宽编号；以大幅影像、整屏分镜、滚动视差、页面幕布转场、悬停大图预览与自定义光标作为主视觉，不做普通后台面板。
- 主题：深色（默认）`#0a0a0b` 底 / `#f2efe8` 字 / 强调 `#ff4b2b`；浅色 `#f2efe9` 底 / `#121110` 字 / 强调 `#cf3418`。正文对比度达 WCAG AA。
- 动效：路由幕布（编号 + 页面名）、入场分镜（`reveal` / `reveal-clip`）、滚动进度条与 `[data-par]` 视差、作品行悬停大图、自定义光标「VIEW」。全部遵循 `prefers-reduced-motion`。
- 适配：1600 / 1180 / 1000 / 860 / 640 / 390 六档；移动端底部导航，页面无横向滚动。

## 功能

| 模块 | 内容 |
| --- | --- |
| 工作台 `#/home` | 整屏影像首屏（视差）、跑马灯、作品索引（悬停大图预览）、精选画廊、Midjourney 灵感快照、工作台统计、页脚；不再使用 Bento 卡片面板 |
| 画板架 `#/boards` | 缩略图墙、搜索、示例画板、新建（A4 300dpi / 1080×1080 / 1920×1080 / 1080×1920 / 自定义）、重命名、复制、删除 |
| 画板编辑器 `#/board/:id` | 无限画布、画框、矩形 / 椭圆 / 直线 / 文字 / 图片、图层、属性面板、对齐吸附、撤销重做、保存与导出（详见下文） |
| 项目看板 `#/projects` | 新增 / 编辑 / 删除；客户、类型、状态、截止日期、进度、改稿次数、模板来源、备注、标签；四列看板 / 列表切换；搜索、类型筛选、状态筛选、逾期朱红高亮 |
| 作品集 `#/portfolio` | 设计 / 编程两个分区；封面本地图片上传（自动压缩到长边 ≤ 1600px）；标题、角色、工具、年份、简介、外链；分类筛选、精选标记、详情弹层；空状态引导 |
| 学习区 `#/learn` | 编程 / 英语双线学习记录；连续打卡、本周时长、本周记录数；本周堆叠柱状图；英语生词本（添加 / 标记掌握）；编程学习清单 |
| 灵感库 `#/library` | 收藏网址（名称 / URL / 标签 / 备注）、配色板（点击色块复制 HEX）、常用模板来源 |
| 设置 `#/settings` | 姓名 / 职位 / 城市 / 邮箱 / 简介、头像上传、浅色 / 深色主题、完整 JSON 导出 / 导入（含画板与图片）、存储统计、清除示例数据、二次确认清空全部数据 |

全局：固定顶栏（品牌 / 编号导航 / 命令 / 搜索 / 主题）、移动端底部导航、**命令面板 `⌘K` / `Ctrl+K`**（搜索并跳转页面 / 项目 / 作品 / 画板，执行「新建画板 / 新建项目 / 开始专注 / 切换主题」）、`/` 快捷键搜索、`Esc` 关闭弹层、跳转到主内容的 skip link、可见 focus、`aria` 标签、`prefers-reduced-motion`、空状态、保存状态提示、Toast 反馈。示例数据均带「示例」标记。

## Midjourney 灵感源：快照 · 非实时

首页的「Midjourney 灵感」区块是**人工策展的快照，不是实时抓取**。页面与卡片上始终标注「快照 · 非实时」、快照日期与最后抓取结果；数据文件为 [`assets/data/mj-feed.json`](assets/data/mj-feed.json)，刷新方式为人工更新（当前 `refreshPolicy: manual`，快照日期 2026-11-06）。

2026-11-06 实测结论（均记录在 JSON 的 `lastAttempt` 字段）：

| 路径 | 结果 |
| --- | --- |
| `www.midjourney.com/explore` 直接抓取 | `403` + Cloudflare「Just a moment」，浏览器可以打开，但脚本/GitHub Actions runner 拿不到页面 |
| `/api/app/recent-jobs` | `401`，需要登录态 |
| `cdn.midjourney.com` 图片直链 | `403`，带 / 不带 `Referer` 均拒绝热链 |
| GitHub Actions 定时抓取 | runner 同样 `403` |
| `wsrv.nl` 图片代理 | `404`，无法作为兜底 |

因此纯静态 Pages 既不能抓取也不能热链 Midjourney 广场图。这里不做伪造实时：只保留 6 条人工策展的提示词快照，失败时用本地兜底数据，绝不改写时间或伪装成实时。若后续切换到支持 API 的图库（用户仍在评估），只需替换 `assets/data/mj-feed.json` 的生成脚本与 `freshness` 文案，页面结构无需改动。

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
  css/site.css             新视觉系统：设计令牌、外壳、首页、动效、移动端底部导航
  css/views.css            六个内页的视觉迁移覆盖层（作品 / 项目 / 画板 / 学习 / 灵感 / 设置）
  css/app.css              旧版样式与画板编辑器（保留以兼容编辑器与既有组件）
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
  js/util.js / icons.js    工具函数与内联 SVG 图标
assets/img/*.webp          首页与示例作品的大幅影像（AI 生成后转 WebP，无外部图库）
assets/data/mj-feed.json   Midjourney 人工策展快照 + 403 抓取记录（非实时）
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
5. 新视觉的公开展示图在 [`assets/img/`](assets/img/)（WebP），示例作品封面在 `store.js` 的 `designCover()` 中映射；换成自己的作品时优先用作品集里的封面上传。主题强调色在新系统令牌 [`assets/css/site.css`](assets/css/site.css) 顶部修改（深色 `--accent: #ff4b2b`，浅色 `#cf3418`）；编辑器相关令牌仍由 `app.css` 提供。

## 验证与性能

- 新版内页（2026-11-06）：Edge / Playwright 在 1600×900 与 390×844 下遍历作品、项目、画板、学习、灵感、设置六页，均无横向滚动、控制台 0 报错；作品详情弹层、项目新建弹层、看板 / 列表切换（7 行）、学习记录弹层、收藏网址弹层、浅色主题切换、命令面板与 `/` 搜索全部通过；画板编辑器仍为全屏 900px（隐藏新顶栏，画布 818px）。
- 使用 Edge（Playwright，Chromium 内核，1600×900）实跑画板全流程：新建 1080×1350 画板 → 矩形 / 文字 / 上传图片 → 拖动、8 点缩放、旋转 → 改填充 / 描边 → 图层排序 → 撤销 / 重做 → 自动保存 → 刷新恢复（3 个对象 + 4 行图层）→ 导出 PNG 2x（2160×2700，349,637 字节）→ 导出 SVG（17,174 字节，含 `<text>` 节点）。命令面板 `⌘K` 搜索「画板」返回 4 条结果，首项为「新建画板」；深浅主题、390×844 三页均无横向滚动（`scrollWidth = clientWidth = 390`），控制台与页面错误均为 0。
- 性能：在编辑器中构造 123 个对象，连续 12 帧 Canvas 绘制平均 **0.65 ms**、最大 **4.4 ms**（约 60fps 预算内；不含历史快照与自动保存的序列化开销）。缩放 / 拖动 / 吸附均通过 `requestAnimationFrame` 合并重绘，图片使用离屏 `Image` 缓存。
- 截图见 [`screenshots/`](screenshots/)：新版首页（深色 / 浅色 / 移动端 / 悬停预览）、六个内页桌面与移动端（`inner-desktop-*` / `inner-mobile-*`）、作品详情弹层、项目列表、设置浅色、画板编辑器、命令面板与搜索。
- 体积（未压缩）：HTML 3.2 KB，CSS 154.8 KB，JS 267.1 KB；无外部字体与 CDN 请求。首屏影像为 WebP，示例 SVG 仅作兜底。

## 已知限制与未实现

- 数据仅保存在当前浏览器，不跨设备同步；换设备请用「导出 JSON / 导入 JSON」。
- 导入会覆盖当前本机数据（导入前会二次确认），建议先导出备份。
- 画板编辑器每个画板只有一张画框（画框即画板）；多画框排版请新建多个画板。
- **未实现**：多人协作 / 云端同步、组件与实例系统、钢笔路径与矢量节点编辑、布尔运算、分组（⌘G）、自动布局、完整 Figma 文件导入导出。SVG 导出不把文字转成路径；PNG 单张限制约 3600 万像素。
- 移动端可查看画板、选择对象与简单拖动，复杂编辑会提示「建议桌面端」；不支持多点触控双指缩放。
- 筛选与视图状态未写入 URL（路由只记录页面与项目 / 作品 / 画板 id）；刷新后筛选会回到默认。
- 示例作品是抽象几何封面，不代表真实项目；示例项目 / 学习记录 / 示例画板同样带「示例」标记。
- **Midjourney 区块是人工策展快照，不是实时数据**：广场页 / API / CDN 均有 403 或 401 限制，静态 Pages 无法抓取或热链；页面已如实标注「快照 · 非实时」、快照日期与最后抓取 403。换用支持 API 的图库后再替换数据源与刷新策略。
- 六个内页通过 `views.css` 覆盖旧样式实现迁移；画板编辑器仍使用 `app.css` 的舞台配色与组件，不与新外壳共用全部令牌。
- 仓库默认公开、联系方式默认留空、强调色默认朱红，均可按需调整。
