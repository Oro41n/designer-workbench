# Oro 设计工作台 · Designer Workbench

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

## 图流与配色引擎（v3）

首页的「此刻的颜色」图流**不是 Midjourney 抓取**，而是可公开访问、许可清晰的图库；每次加载都重新取图、重新取色。

| 项 | 说明 |
| --- | --- |
| 默认源 | Lorem Picsum（`https://picsum.photos`，随机图片服务，图片来自 Unsplash，遵循 [Unsplash License](https://unsplash.com/license)） |
| 其它源 | Unsplash（需免费 Access Key）、Pexels（需免费 API Key）、Openverse（CC，无需 Key）。全部通过 `assets/js/feed/adapters.js` 实现；仓库不带任何 Key，未填写时视为未接入 |
| 切换方式 | 改 `assets/js/feed/config.js` 的 `source` / `keys`，或在设置页写入 `localStorage['dw.feed.v1']`；不写代码即可换源 |
| 刷新机制 | 每次页面加载生成新的随机种子（Picsum）或请求 `/photos/random`（Unsplash），不缓存历史结果；「换一批」按钮立即重新拉取 |
| 取色 | 图片经 CORS 代理读取像素 → 40×40 缩略 → 5 簇 k-means → 映射 `--bg` / `--ink` / `--accent` / `--accent-2` → 900ms 插值过渡；同一组颜色通过 `dw:palette` 事件驱动首屏 WebGL 着色器，深 / 浅模式各自重算。取色失败时回退品牌色并在面板标注原因 |
| 许可与署名 | 卡片与说明区展示来源、许可链接与作者；Unsplash / Pexels 适配器按各自 API 指南附带作者主页与 `utm` 链接 |
| 限制 | Picsum 的 `v2/list` 接口未返回 CORS 头，因此不使用其作者元数据（卡片署名为「Lorem Picsum / Unsplash」）；`images.weserv.nl` 仅作为读取像素的代理，图片展示仍直连原站；本机（中国内地网络）实测 `api.openverse.org` 连接超时，Openverse 适配器虽已写好但默认不启用，失败会自动降级到 Picsum；网络完全不可用时显示站内备用图并明确标注「非实时」 |

> 密钥策略：仓库与提交历史中没有任何 API Key。Unsplash / Pexels 只有在 `assets/js/feed/config.js` 的 `FEED_CONFIG.keys`（或 `localStorage['dw.feed.v1']`）填入你自己的 Key 后才会发起请求；未配置时页面仍使用 Picsum，不会声称已接入 Unsplash / Pexels。

> 说明：`images.weserv.nl` 是第三方图片代理，用于绕过 CORS 读取像素；如果代理不可用，图片仍能显示，但取色会失败并回退默认色板。

### Midjourney：没有可接入的公开图流（2026-11-06 实测）

| 路径 | 结果 |
| --- | --- |
| 官方 API / 开发者计划 | 不存在。2026 年仍只有 Discord 与 midjourney.com 网页端，无公开 API、无 SDK、无 Key 申请入口 |
| `www.midjourney.com/explore` 脚本抓取 | `403` + Cloudflare 质询，浏览器可访问，脚本与 GitHub Actions runner 均不可 |
| `/api/app/recent-jobs` | `401`，需要登录态 |
| `cdn.midjourney.com` 直链 | `403`，带 / 不带 Referer 均拒绝热链 |
| 公开镜像 / 授权图流 | 未找到任何可公开访问且许可清晰的 MJ 图流镜像；不采用「伪实时」包装 |

结论：v3 **不接入 Midjourney**，页面上直接写明这一点；首页图流改用上述图库，并保证「每次加载换图 + 真实取色」。`assets/data/mj-feed.json` 仅作为 v2 的历史快照保留，标记为「快照 · 非实时」，不再出现在新首页。

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
5. 新视觉的公开展示图在 [`assets/img/`](assets/img/)（WebP），示例作品封面在 `store.js` 的 `designCover()` 中映射；换成自己的作品时优先用作品集里的封面上传。强调色不是写死的：运行时由图流第一张图取色写入 `--bg` / `--ink` / `--accent` / `--accent-2`；想固定品牌色，改 [`assets/css/v3.css`](assets/css/v3.css) 顶部 `:root` 的兜底值（深色 `--accent: #ff4b2b`，浅色 `#cf3418`），并把 `theme-engine.js` 的自动取色关掉即可。内页样式在 [`assets/css/pages-v3.css`](assets/css/pages-v3.css)，编辑器相关令牌仍由 `app.css` 提供。

## 验证与性能

- v3 内页迁移（2026-11-06）：Edge / Playwright 在 1600×900 与 390×844 下遍历作品、项目、画板、学习、灵感、设置六页，均无横向滚动、控制台 / 页面 0 报错；页头标题与面板标题均为 v3 衬线字体，正文背景等于取色得到的 `--bg`。抽检通过：作品设计 / 编程分区切换、作品详情弹层、项目看板 / 列表切换（7 行）、浅色主题切换（设置页背景 `rgb(235,238,242)`）、命令面板（23 条动作）、画板编辑器（隐藏顶栏，画布 1230×818）、移动端底栏（`position: fixed`，页面底部留白 84px 不被遮挡）。
- 使用 Edge（Playwright，Chromium 内核，1600×900）实跑画板全流程：新建 1080×1350 画板 → 矩形 / 文字 / 上传图片 → 拖动、8 点缩放、旋转 → 改填充 / 描边 → 图层排序 → 撤销 / 重做 → 自动保存 → 刷新恢复（3 个对象 + 4 行图层）→ 导出 PNG 2x（2160×2700，349,637 字节）→ 导出 SVG（17,174 字节，含 `<text>` 节点）。命令面板 `⌘K` 搜索「画板」返回 4 条结果，首项为「新建画板」；深浅主题、390×844 三页均无横向滚动（`scrollWidth = clientWidth = 390`），控制台与页面错误均为 0。
- 性能：在编辑器中构造 123 个对象，连续 12 帧 Canvas 绘制平均 **0.65 ms**、最大 **4.4 ms**（约 60fps 预算内；不含历史快照与自动保存的序列化开销）。缩放 / 拖动 / 吸附均通过 `requestAnimationFrame` 合并重绘，图片使用离屏 `Image` 缓存。
- 截图见 [`screenshots/`](screenshots/)：首页桌面 / 浅色 / 移动端（`v3-desktop-*`、`v3-mobile-*`），六个内页桌面（`v3-inner-desktop-*`）与移动端（`v3-inner-mobile-*`），作品详情弹层、项目列表视图、设置浅色、画板编辑器。
- 体积（未压缩）：HTML 3.2 KB，CSS 185.0 KB（`app.css` 108.2 / `pages-v3.css` 43.4 / `v3.css` 33.4），JS 303.1 KB；无外部字体与 CDN 请求。首屏影像为 WebP，示例 SVG 仅作兜底。

## 已知限制与未实现

- 数据仅保存在当前浏览器，不跨设备同步；换设备请用「导出 JSON / 导入 JSON」。
- 导入会覆盖当前本机数据（导入前会二次确认），建议先导出备份。
- 画板编辑器每个画板只有一张画框（画框即画板）；多画框排版请新建多个画板。
- **未实现**：多人协作 / 云端同步、组件与实例系统、钢笔路径与矢量节点编辑、布尔运算、分组（⌘G）、自动布局、完整 Figma 文件导入导出。SVG 导出不把文字转成路径；PNG 单张限制约 3600 万像素。
- 移动端可查看画板、选择对象与简单拖动，复杂编辑会提示「建议桌面端」；不支持多点触控双指缩放。
- 筛选与视图状态未写入 URL（路由只记录页面与项目 / 作品 / 画板 id）；刷新后筛选会回到默认。
- 示例作品是抽象几何封面，不代表真实项目；示例项目 / 学习记录 / 示例画板同样带「示例」标记。
- **Midjourney 没有可接入的公开图流**：广场页 / API / CDN 均为 403 或 401，静态 Pages 无法抓取或热链；v3 首页不接入 MJ，改用 Picsum 等公开图库并真实取色。`assets/data/mj-feed.json` 只是 v2 的人工策展快照（非实时），页面不再展示。
- 六个内页由 [`assets/css/pages-v3.css`](assets/css/pages-v3.css) 统一覆盖：旧的 `site.css` / `views.css` 已删除，`app.css` 只保留基础重置与画板编辑器；编辑器仍使用自身的舞台配色，不与新外壳共用全部令牌。
- 仓库默认公开、联系方式默认留空、强调色默认朱红，均可按需调整。
