# Oro 设计工作台 · Designer Workbench

一个面向平面设计师的个人工作台：项目看板、作品集（设计 + 编程）、学习打卡、灵感素材库与番茄钟。纯静态站点，原生 HTML / CSS / ES Modules，无构建、无外部 CDN，数据保存在本机浏览器。

- 入口：[`index.html`](index.html)
- 风格：编辑感极简，暖白纸面 / 墨黑主题 + 单一朱红强调色 `#C8452D`；中文系统字体栈；纸张噪点与细网格纹理由 CSS / SVG 生成。
- 适配：1440 / 1024 / 390 三档；移动端底部导航，页面无横向滚动。

## 功能

| 模块 | 内容 |
| --- | --- |
| 工作台 `#/home` | 日期与问候、今日重点待办（勾选 / 删除）、番茄钟（25 / 5，开始 / 暂停 / 重置，结束提示并自动切换）、本周专注柱状图、最近项目、精选作品 |
| 项目看板 `#/projects` | 新增 / 编辑 / 删除；客户、类型、状态、截止日期、进度、改稿次数、模板来源、备注、标签；四列看板 / 列表切换；搜索、类型筛选、状态筛选、逾期朱红高亮 |
| 作品集 `#/portfolio` | 设计 / 编程两个分区；封面本地图片上传（自动压缩到长边 ≤ 1600px）；标题、角色、工具、年份、简介、外链；分类筛选、精选标记、详情弹层；空状态引导 |
| 学习区 `#/learn` | 编程 / 英语双线学习记录；连续打卡、本周时长、本周记录数；本周堆叠柱状图；英语生词本（添加 / 标记掌握）；编程学习清单 |
| 灵感库 `#/library` | 收藏网址（名称 / URL / 标签 / 备注）、配色板（点击色块复制 HEX）、常用模板来源 |
| 设置 `#/settings` | 姓名 / 职位 / 城市 / 邮箱 / 简介、头像上传、浅色 / 深色主题、完整 JSON 导出 / 导入、存储统计、清除示例数据、二次确认清空全部数据 |

全局：侧边导航、移动端底部导航、`/` 快捷键搜索、`Esc` 关闭弹层、跳转到主内容的 skip link、可见 focus、`aria` 标签、`prefers-reduced-motion`、空状态、保存状态提示、Toast 反馈。示例数据均带「示例」标记。

## 技术栈与目录

```text
index.html                 入口（外壳、侧边栏、顶部栏、弹层与 Toast 容器）
assets/
  css/app.css              设计令牌与全部样式（浅色 / 深色、响应式、reduced-motion）
  js/app.js                路由（hash）、外壳渲染、全局交互
  js/store.js              localStorage 状态、示例数据、导出 / 导入 / 清空
  js/images.js             IndexedDB 图片压缩、存取、导入导出与 hydrate
  js/ui.js                 Modal、确认框、危险操作二次确认、Toast、空状态
  js/pomodoro.js           全局番茄钟（时间戳计时，跨路由不中断）
  js/search.js             全局搜索
  js/views/*.js            六个页面视图
  js/util.js / icons.js    工具函数与内联 SVG 图标
assets/covers/*.svg        示例作品的抽象几何封面（自制，非他人品牌素材）
screenshots/               1600×900 与 390×844 实跑截图
```

## 数据模型

数据保存在 `localStorage` 的 `dw.state.v1`（约 8 KB 起），封面与头像存在 IndexedDB `dw-images` / object store `images`。导出的 JSON 同时包含 state 与图片 dataURL。

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
```

导出文件结构：`{ app: 'designer-workbench', version: 1, exportedAt, state, images: { [id]: dataURL } }`。导入会校验结构并覆盖当前数据，图片写回 IndexedDB。

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
5. 主题强调色在 [`assets/css/app.css`](assets/css/app.css) 顶部的 `--accent` / `--accent-deep` 修改；切换朱红以外的颜色时建议同步改深浅两套令牌。

## 验证与性能

- 使用 Edge（Playwright，Chromium 内核）实跑 58 项检查全部通过：路由、待办、番茄钟开始 / 暂停 / 重置、项目增删改查、搜索与筛选、封面上传压缩、作品筛选与详情、删除、学习记录与打卡、生词与清单、色块复制 HEX、搜索快捷键、主题切换、JSON 导出 / 导入、清空二次确认、390×844 无横向滚动、控制台 0 报错。
- 截图见 [`screenshots/`](screenshots/)：首页、项目看板、作品集、学习区、灵感库、设置（1600×900），移动端首页 / 项目（390×844）。
- 体积（未压缩）：HTML 3.9 KB，CSS 60.9 KB，JS 约 143 KB，示例 SVG 封面与图标约 15 KB；无外部字体与 CDN 请求。首屏只加载入口与示例 SVG，上传图片按需从 IndexedDB 读取并使用 `loading="lazy"`。

## 已知限制与可改点

- 数据仅保存在当前浏览器，不跨设备同步；换设备请用「导出 JSON / 导入 JSON」。
- 导入会覆盖当前本机数据（导入前会二次确认），建议先导出备份。
- 筛选与视图状态未写入 URL（路由只记录页面与项目 / 作品 id）；刷新后筛选会回到默认。
- 示例作品是抽象几何封面，不代表真实项目；示例项目 / 学习记录同样带「示例」标记。
- 仓库默认公开、联系方式默认留空、强调色默认朱红，均可按需调整。
