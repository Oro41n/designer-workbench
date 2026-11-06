// 设置：个人资料、头像、主题、数据导出/导入与清空
import { getState, subscribe, update, setTheme, exportData, replaceState, clearSamples, clearAll, storageBytes } from '../store.js';
import { icon } from '../icons.js';
import { pageHead, toast, confirmDialog, dangerDialog, formValues } from '../ui.js';
import { escapeHtml, downloadFile, todayISO, bytesText } from '../util.js';
import { saveImage, deleteImage, countImages, exportImages, importImages, hydrateImages } from '../images.js';
import { countBoards, exportBoards, importBoards, clearBoards, deleteSampleBoards } from '../boards.js';

export default {
  mount(root) {
    root.addEventListener('submit', onSubmit);
    root.addEventListener('change', onChange);
    root.addEventListener('click', onClick);
    const off = subscribe(refresh);
    refresh();
    refreshStats();
    return { destroy: () => off() };

    function sampleCount() {
      const s = getState();
      return s.tasks.filter(x => x.sample).length + s.focusSessions.filter(x => x.sample).length
        + s.projects.filter(x => x.sample).length + s.portfolio.filter(x => x.sample).length
        + s.learn.records.filter(x => x.sample).length + s.learn.words.filter(x => x.sample).length
        + s.learn.checklist.filter(x => x.sample).length + s.library.links.filter(x => x.sample).length
        + s.library.palettes.filter(x => x.sample).length + s.library.templates.filter(x => x.sample).length;
    }

    function refresh() {
      const state = getState();
      const { profile } = state;
      const samples = sampleCount();
      root.innerHTML = `
        ${pageHead({
          kicker: 'Settings / 设置',
          title: '设置',
          lede: '资料、主题与数据都在本机。换电脑时用「导出 JSON」带走全部内容（含封面图片）。',
          actions: `<button type="button" class="btn" data-export>${icon('download', 16)} 导出 JSON</button>`
        })}
        <div class="settings-grid">
          <section class="panel profile-panel" aria-labelledby="profile-title">
            <div class="panel-head">
              <div><p class="kicker">Profile / 资料</p><h2 id="profile-title">个人资料</h2></div>
            </div>
            <div class="avatar-upload">
              <div class="avatar avatar--lg" id="avatar-preview">
                ${profile.avatarId ? `<img data-img="${profile.avatarId}" alt="头像">` : escapeHtml(initials(profile.name))}
              </div>
              <div class="avatar-upload-meta">
                <p>头像会压缩到 512px，存进 IndexedDB。</p>
                <div class="avatar-actions">
                  <label class="btn btn-sm">${icon('upload', 14)} 上传头像
                    <input type="file" accept="image/*" data-avatar-file hidden>
                  </label>
                  ${profile.avatarId ? `<button type="button" class="btn btn-sm btn-danger-ghost" data-avatar-remove>移除</button>` : ''}
                </div>
                <span class="upload-status" data-avatar-status></span>
              </div>
            </div>
            <form id="profile-form" class="form">
              <div class="form-grid">
                <label class="field"><span class="field-label">姓名</span><input name="name" maxlength="30" value="${escapeHtml(profile.name)}" placeholder="你的名字"></label>
                <label class="field"><span class="field-label">职位 / 身份</span><input name="role" maxlength="40" value="${escapeHtml(profile.role)}" placeholder="平面设计师"></label>
                <label class="field"><span class="field-label">所在城市</span><input name="location" maxlength="30" value="${escapeHtml(profile.location || '')}" placeholder="可留空"></label>
                <label class="field"><span class="field-label">联系邮箱</span><input name="email" type="email" maxlength="60" value="${escapeHtml(profile.email || '')}" placeholder="可留空，不公开"></label>
                <label class="field field--full"><span class="field-label">简介</span><textarea name="bio" rows="4" maxlength="300" placeholder="擅长什么、做过什么、想找什么样的工作…">${escapeHtml(profile.bio)}</textarea></label>
              </div>
              <div class="form-actions">
                <span class="form-hint">这些信息只保存在本机，不会上传。</span>
                <button type="submit" class="btn btn-primary">保存资料</button>
              </div>
            </form>
          </section>

          <div class="settings-col">
            <section class="panel theme-panel" aria-labelledby="theme-title">
              <div class="panel-head">
                <div><p class="kicker">Appearance / 外观</p><h2 id="theme-title">主题</h2></div>
              </div>
              <div class="theme-options" role="radiogroup" aria-label="主题">
                <button type="button" class="theme-option ${state.theme === 'light' ? 'is-on' : ''}" data-theme="light" role="radio" aria-checked="${state.theme === 'light'}">
                  <span class="theme-preview theme-preview--light">
                    <span class="tp-bar"></span><span class="tp-block"></span><span class="tp-line"></span>
                  </span>
                  <span class="theme-label">${icon('sun', 15)} 浅色 · 纸张</span>
                </button>
                <button type="button" class="theme-option ${state.theme === 'dark' ? 'is-on' : ''}" data-theme="dark" role="radio" aria-checked="${state.theme === 'dark'}">
                  <span class="theme-preview theme-preview--dark">
                    <span class="tp-bar"></span><span class="tp-block"></span><span class="tp-line"></span>
                  </span>
                  <span class="theme-label">${icon('moon', 15)} 深色 · 墨黑</span>
                </button>
              </div>
              <p class="panel-hint">强调色为墨红 #A9331F（深色主题 #E56B45），纸张与墨色随主题切换。</p>
            </section>

            <section class="panel data-panel" aria-labelledby="data-title">
              <div class="panel-head">
                <div><p class="kicker">Data / 数据</p><h2 id="data-title">备份与清理</h2></div>
              </div>
              <div class="data-actions">
                <button type="button" class="btn" data-export>${icon('download', 15)} 导出完整 JSON</button>
                <label class="btn">${icon('upload', 15)} 导入 JSON
                  <input type="file" accept="application/json,.json" data-import-file hidden>
                </label>
              </div>
              <div class="storage-stats" aria-label="本地存储统计">
                <div><span>项目</span><b>${state.projects.length}</b></div>
                <div><span>作品</span><b>${state.portfolio.length}</b></div>
                <div><span>学习记录</span><b>${state.learn.records.length}</b></div>
                <div><span>画板</span><b data-board-count>…</b></div>
                <div><span>数据体积</span><b>${bytesText(storageBytes())}</b></div>
                <div><span>图片</span><b data-image-count>…</b></div>
              </div>
              <div class="danger-zone">
                <p class="danger-title">清理数据</p>
                <div class="danger-actions">
                  <button type="button" class="btn btn-sm" data-clear-samples ${samples ? '' : 'disabled'}>清除示例数据（${samples} 条）</button>
                  <button type="button" class="btn btn-sm btn-danger-ghost" data-clear-all>清空全部数据</button>
                </div>
                <p class="panel-hint">清空全部数据需要二次确认，且包含头像与封面图片，不可恢复。建议先导出备份。</p>
              </div>
            </section>
          </div>
        </div>

        <section class="panel about-panel" aria-labelledby="about-title">
          <div class="panel-head">
            <div><p class="kicker">About / 关于</p><h2 id="about-title">关于这个工作台</h2></div>
            <span class="chip chip--tiny">v1.1</span>
          </div>
          <div class="about-grid">
            <p>纯静态站点：原生 HTML / CSS / ES Modules，无构建、无外部 CDN。项目、作品、学习与收藏数据存在 <code>localStorage</code>；每张画板的对象树独立存在 <code>IndexedDB</code>，图片长边压缩到 ≤ 1600px。</p>
            <dl class="about-facts">
              <div><dt>主题</dt><dd>纸白 / 墨黑，墨红强调，WCAG AA</dd></div>
              <div><dt>字体</dt><dd>中文系统字体栈，不请求境外字体</dd></div>
              <div><dt>快捷键</dt><dd><kbd>⌘K</kbd> 命令面板 · <kbd>/</kbd> 搜索 · <kbd>Esc</kbd> 关闭弹层</dd></div>
              <div><dt>仓库</dt><dd><a href="https://github.com/Oro41n/designer-workbench" target="_blank" rel="noopener">github.com/Oro41n/designer-workbench</a></dd></div>
            </dl>
          </div>
        </section>`;
      hydrateImages(root);
      refreshStats();
    }

    async function refreshStats() {
      const imgEl = root.querySelector('[data-image-count]');
      const boardEl = root.querySelector('[data-board-count]');
      if (imgEl) imgEl.textContent = String(await countImages());
      if (boardEl) boardEl.textContent = String(await countBoards());
    }

    async function handleExport() {
      toast('正在打包数据与图片…');
      const images = await exportImages();
      const boards = await exportBoards();
      const payload = {
        app: 'designer-workbench',
        version: 2,
        exportedAt: new Date().toISOString(),
        state: exportData(),
        images,
        boards
      };
      downloadFile(`designer-workbench-${todayISO()}.json`, JSON.stringify(payload, null, 2));
      toast(`导出完成（含 ${Object.keys(images).length} 张图片）`, { type: 'success' });
    }

    async function handleImport(file) {
      if (!file) return;
      const text = await file.text();
      let parsed;
      try { parsed = JSON.parse(text); }
      catch { toast('文件不是合法的 JSON', { type: 'warn' }); return; }
      const nextState = parsed.state || parsed;
      if (!nextState || typeof nextState !== 'object' || !Array.isArray(nextState.projects) || !nextState.profile) {
        toast('这不像是本工作台导出的备份文件', { type: 'warn' });
        return;
      }
      const ok = await confirmDialog({
        title: '导入并覆盖当前数据？',
        description: '当前本机数据会被备份文件替换。建议先导出一次当前数据。',
        confirmText: '导入并覆盖',
        danger: true
      });
      if (!ok) return;
      replaceState(nextState);
      if (parsed.images) await importImages(parsed.images);
      if (Array.isArray(parsed.boards)) await importBoards(parsed.boards);
      toast('导入完成', { type: 'success' });
      hydrateImages(document);
      refresh();
    }

    function initials(name = '') {
      const clean = String(name).replace(/^示例\s*·\s*/, '').trim();
      return clean ? [...clean].slice(0, 2).join('').toUpperCase() : '我';
    }

    async function onSubmit(e) {
      if (e.target.matches('#profile-form')) {
        e.preventDefault();
        const data = formValues(e.target);
        update(s => {
          s.profile.name = data.name || '（你的名字）';
          s.profile.role = data.role || '平面设计师';
          s.profile.location = data.location || '';
          s.profile.email = data.email || '';
          s.profile.bio = data.bio || '';
        });
        toast('资料已保存', { type: 'success' });
      }
    }

    async function onChange(e) {
      if (e.target.matches('[data-avatar-file]')) {
        const file = e.target.files?.[0];
        if (!file) return;
        const status = root.querySelector('[data-avatar-status]');
        if (status) status.textContent = '处理中…';
        try {
          const oldId = getState().profile.avatarId;
          const res = await saveImage(file, 512);
          update(s => { s.profile.avatarId = res.id; });
          if (oldId) deleteImage(oldId);
          toast('头像已更新', { type: 'success' });
          refresh();
        } catch (err) {
          console.error(err);
          toast('头像上传失败，请换一张图片', { type: 'warn' });
        } finally {
          e.target.value = '';
        }
        return;
      }
      if (e.target.matches('[data-import-file]')) {
        const file = e.target.files?.[0];
        await handleImport(file);
        e.target.value = '';
      }
    }

    function onClick(e) {
      // 注意：<html data-theme> 也带 data-theme，必须限定到主题按钮
      const theme = e.target.closest('button[data-theme]');
      if (theme) {
        setTheme(theme.dataset.theme);
        toast(theme.dataset.theme === 'dark' ? '已切换到深色主题' : '已切换到浅色主题');
        refresh();
        return;
      }
      if (e.target.closest('[data-export]')) { handleExport(); return; }
      if (e.target.closest('[data-avatar-remove]')) {
        const oldId = getState().profile.avatarId;
        update(s => { s.profile.avatarId = null; });
        if (oldId) deleteImage(oldId);
        toast('头像已移除');
        refresh();
        return;
      }
      if (e.target.closest('[data-clear-samples]')) {
        confirmDialog({
          title: '清除示例数据？',
          description: `会删除 ${sampleCount()} 条标记为「示例」的记录，你自己添加的内容会保留。`,
          confirmText: '清除示例',
          danger: false
        }).then(ok => {
          if (!ok) return;
          clearSamples();
          deleteSampleBoards();
          toast('示例数据已清除');
          refresh();
        });
        return;
      }
      if (e.target.closest('[data-clear-all]')) {
        dangerDialog({
          title: '清空全部数据',
          description: '项目、作品、学习记录、收藏、头像与上传的封面图片都会被删除，且无法恢复。',
          checkLabel: '我确认清空全部数据，且已导出备份',
          confirmText: '清空全部数据'
        }).then(async ok => {
          if (!ok) return;
          const images = await exportImages();
          await Promise.all(Object.keys(images).map(id => deleteImage(id)));
          await clearBoards();
          clearAll();
          toast('全部数据已清空');
          refresh();
        });
      }
    }
  }
};
