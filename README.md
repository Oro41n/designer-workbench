# Oro 设计工作台 · Designer Workbench

一个面向平面设计师的个人工作台：项目看板、作品集（设计 + 编程）、学习打卡、灵感素材库、番茄钟，以及内置的印前画板工具（类 Figma Lite：无限画布、图层、属性、PNG / SVG 导出）。纯静态站点，原生 HTML / CSS / ES Modules，无构建、无外部 CDN，数据保存在本机浏览器。

- 入口：[`index.html`](index.html)
- 设计概念：**印前工作台 / Print Studio**——纸白与墨色、裁切标记、套准线、标尺与编号系统，用现代网格与编辑排版呈现，不做复古仿制。
- 主题：浅色纸白 `#F2ECDF` / 深色墨黑，强调色为克制的墨红 `#A9331F`（深色主题 `#E56B45`），正文对比度达 WCAG AA。
- 适配：1600 / 1180 / 1000 / 860 / 640 / 390 六档；移动端底部导航，页面无横向滚动；支持 `prefers-reduced-motion`。

## 功能

| 模块 | 内容 |
| --- | --- |
| 工作台 `#/home` | 印前报头（期号 / 日期 / 套准标 / 标尺）、Bento 非对称版式：今日工作面（最近画板预览 + 纸叠层 + 本周统计）、今日重点待办（含完成度条）、番茄钟（25 / 5，开始 / 暂停 / 重置，结束提示并自动切换）、本周专注趋势、最近项目、精选作品、印前短句 |
| 画板架 `#/boards` | 缩略图墙、搜索、示例画板、新建（A4 300dpi / 1080×1080 / 1920×1080 / 1080×1920 / 自定义）、重命名、复制、删除 |
| 画板编辑器 `#/board/:id` | 无限画布、画框、矩形 / 椭圆 / 直线 / 文字 / 图片、图层、属性面板、对齐吸附、撤销重做、保存与导出（详见下文） |
| 项目看板 `#/projects` | 新增 / 编辑 / 删除；客户、类型、状态、截止日期、进度、改稿次数、模板来源、备注、标签；四列看板 / 列表切换；搜索、类型筛选、状态筛选、逾期朱红高亮 |
| 作品集 `#/portfolio` | 设计 / 编程两个分区；封面本地图片上传（自动压缩到长边 ≤ 1600px）；标题、角色、工具、年份、简介、外链；分类筛选、精选标记、详情弹层；空状态引导 |
| 学习区 `#/learn` | 编程 / 英语双线学习记录；连续打卡、本周时长、本周记录数；本周堆叠柱状图；英语生词本（添加 / 标记掌握）；编程学习清单 |
| 灵感库 `#/library` | 收藏网址（名称 / URL / 标签 / 备注）、配色板（点击色块复制 HEX）、常用模板来源 |
| 设置 `#/settings` | 姓名 / 职位 / 城市 / 邮箱 / 简介、头像上传、浅色 / 深色主题、完整 JSON 导出 / 导入（含画板与图片）、存储统计、清除示例数据、二次确认清空全部数据 |

全局：侧边导航、移动端底部导航、**命令面板 `⌘K` / `Ctrl+K`**（搜索并跳转页面 / 项目 / 作品 / 画板，执行「新建画板 / 新建项目 / 开始专注 / 切换主题」）、`/` 快捷键搜索、`Esc` 关闭弹层、跳转到主内容的 skip link、可见 focus、`aria` 标签、`prefers-reduced-motion`、空状态、保存状态提示、Toast 反馈。示例数据均带「示例」标记。

## 画板工具（Lite Figma）

从侧边栏「画板」进入画板架，新建时选择尺寸预设：A4 300dpi（2480×3508）、1080×1080、1920×1080、1080×1920 或自定义。每个画板记录就是一张画框，打开后进入全屏编辑器（隐藏侧边栏与顶部栏，`Esc` 可退出工具回到选择）。

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
index.html                 入口（外壳、侧边栏、顶部栏、弹层与 Toast 容器）
assets/
  css/app.css              设计令牌与全部样式（浅色 / 深色、响应式、reduced-motion）
  js/app.js                路由（hash）、外壳渲染、全局交互
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
assets/covers/*.svg        示例作品的抽象几何封面（自制，非他人品牌素材）
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
5. 主题强调色在 [`assets/css/app.css`](assets/css/app.css) 顶部的 `--accent` / `--accent-deep` 修改（默认浅色 `#A9331F`、深色 `#E56B45`）；切换颜色时建议同步检查深浅两套令牌与对比度。

## 验证与性能

- 使用 Edge（Playwright，Chromium 内核，1600×900）实跑画板全流程：新建 1080×1350 画板 → 矩形 / 文字 / 上传图片 → 拖动、8 点缩放、旋转 → 改填充 / 描边 → 图层排序 → 撤销 / 重做 → 自动保存 → 刷新恢复（3 个对象 + 4 行图层）→ 导出 PNG 2x（2160×2700，349,637 字节）→ 导出 SVG（17,174 字节，含 `<text>` 节点）。命令面板 `⌘K` 搜索「画板」返回 4 条结果，首项为「新建画板」；深浅主题、390×844 三页均无横向滚动（`scrollWidth = clientWidth = 390`），控制台与页面错误均为 0。
- 性能：在编辑器中构造 123 个对象，连续 12 帧 Canvas 绘制平均 **0.65 ms**、最大 **4.4 ms**（约 60fps 预算内；不含历史快照与自动保存的序列化开销）。缩放 / 拖动 / 吸附均通过 `requestAnimationFrame` 合并重绘，图片使用离屏 `Image` 缓存。
- 截图见 [`screenshots/`](screenshots/)：新首页、深色首页、长页、项目看板、画板架、命令面板、画板编辑器（含多个对象与图层）、导出弹层、导出结果（PNG / SVG）、设置（1600×900），移动端首页 / 画板架 / 编辑器（390×844）。
- 体积（未压缩）：HTML 5.1 KB，CSS 110.8 KB，JS 271.6 KB；无外部字体与 CDN 请求。首屏只加载入口与示例 SVG，上传图片按需从 IndexedDB 读取并使用离屏缓存。

## 已知限制与未实现

- 数据仅保存在当前浏览器，不跨设备同步；换设备请用「导出 JSON / 导入 JSON」。
- 导入会覆盖当前本机数据（导入前会二次确认），建议先导出备份。
- 画板编辑器每个画板只有一张画框（画框即画板）；多画框排版请新建多个画板。
- **未实现**：多人协作 / 云端同步、组件与实例系统、钢笔路径与矢量节点编辑、布尔运算、分组（⌘G）、自动布局、完整 Figma 文件导入导出。SVG 导出不把文字转成路径；PNG 单张限制约 3600 万像素。
- 移动端可查看画板、选择对象与简单拖动，复杂编辑会提示「建议桌面端」；不支持多点触控双指缩放。
- 筛选与视图状态未写入 URL（路由只记录页面与项目 / 作品 / 画板 id）；刷新后筛选会回到默认。
- 示例作品是抽象几何封面，不代表真实项目；示例项目 / 学习记录 / 示例画板同样带「示例」标记。
- 仓库默认公开、联系方式默认留空、强调色默认墨红，均可按需调整。
