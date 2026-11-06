// 灵感 / 素材库：收藏网址、配色板（复制 HEX）与常用模板来源
import { getState, subscribe, update } from '../store.js';
import { icon } from '../icons.js';
import { pageHead, openModal, confirmDialog, toast, formValues, emptyState } from '../ui.js';
import { escapeHtml, uid, safeUrl, hostOf, clampText } from '../util.js';

export default {
  mount(root) {
    root.addEventListener('click', onClick);
    const off = subscribe(refresh);
    refresh();
    return { destroy: () => off() };

    function refresh() {
      const { library } = getState();
      root.innerHTML = `
        ${pageHead({
          kicker: 'Library / 灵感库',
          title: '灵感与素材',
          lede: '收藏常看的网址、把顺手配色存成色板、记下好用的模板来源。点击色块即可复制 HEX。',
          actions: `<button type="button" class="btn btn-primary" data-add-link>${icon('plus', 16)} 收藏网址</button>`
        })}
        <div class="library-grid">
          <section class="panel links-panel" aria-labelledby="links-title">
            <div class="panel-head">
              <div>
                <p class="kicker">Links / 网址</p>
                <h2 id="links-title">收藏网址</h2>
              </div>
              <span class="panel-count">${library.links.length} 条</span>
            </div>
            ${library.links.length ? `<ul class="link-list">
              ${library.links.map(l => `<li class="link-item">
                <span class="link-main">
                  <a class="link-name" href="${escapeHtml(safeUrl(l.url))}" target="_blank" rel="noopener">
                    ${escapeHtml(l.name)} ${l.sample ? '<span class="chip chip--tiny">示例</span>' : ''}
                    <span class="link-ext">${icon('arrow', 12)}</span>
                  </a>
                  <span class="link-host">${escapeHtml(hostOf(l.url))}</span>
                  ${l.notes ? `<span class="link-notes">${escapeHtml(clampText(l.notes, 48))}</span>` : ''}
                  ${l.tags?.length ? `<span class="link-tags">${l.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</span>` : ''}
                </span>
                <button type="button" class="icon-btn" data-link-del="${l.id}" aria-label="删除收藏：${escapeHtml(l.name)}">${icon('trash', 15)}</button>
              </li>`).join('')}
            </ul>` : emptyState({
              title: '还没有收藏网址',
              description: '把常逛的灵感站、素材站或参考链接收进来，标好标签。',
              action: `<button type="button" class="btn" data-add-link>${icon('plus', 15)} 收藏第一个网址</button>`
            })}
          </section>

          <section class="panel palettes-panel" aria-labelledby="palettes-title">
            <div class="panel-head">
              <div>
                <p class="kicker">Palettes / 配色</p>
                <h2 id="palettes-title">配色板</h2>
              </div>
              <button type="button" class="btn btn-sm" data-add-palette>${icon('plus', 14)} 添加</button>
            </div>
            ${library.palettes.length ? `<div class="palette-list">
              ${library.palettes.map(p => `<div class="palette">
                <div class="palette-top">
                  <span class="palette-name">${escapeHtml(p.name)} ${p.sample ? '<span class="chip chip--tiny">示例</span>' : ''}</span>
                  <button type="button" class="icon-btn" data-palette-del="${p.id}" aria-label="删除配色：${escapeHtml(p.name)}">${icon('close', 14)}</button>
                </div>
                <div class="swatches">
                  ${p.colors.map(c => `<button type="button" class="swatch" data-hex="${escapeHtml(c)}" style="--sw:${escapeHtml(c)}" aria-label="复制色值 ${escapeHtml(c)}">
                    <span class="swatch-color"></span>
                    <span class="swatch-hex">${escapeHtml(c)}</span>
                  </button>`).join('')}
                </div>
                ${p.notes ? `<p class="palette-notes">${escapeHtml(p.notes)}</p>` : ''}
              </div>`).join('')}
            </div>` : emptyState({
              title: '还没有配色板',
              description: '把顺手的配色存下来：例如 #C8452D, #17140F, #F4F0E7。',
              action: `<button type="button" class="btn" data-add-palette>${icon('plus', 15)} 新建配色板</button>`
            })}
          </section>

          <section class="panel templates-panel" aria-labelledby="templates-title">
            <div class="panel-head">
              <div>
                <p class="kicker">Templates / 模板</p>
                <h2 id="templates-title">常用模板来源</h2>
              </div>
              <button type="button" class="btn btn-sm" data-add-template>${icon('plus', 14)} 添加模板</button>
            </div>
            ${library.templates.length ? `<div class="template-table" role="list">
              ${library.templates.map(t => `<div class="template-row" role="listitem">
                <span class="template-name">${escapeHtml(t.name)} ${t.sample ? '<span class="chip chip--tiny">示例</span>' : ''}</span>
                ${t.url ? `<a class="template-url" href="${escapeHtml(safeUrl(t.url))}" target="_blank" rel="noopener">${escapeHtml(hostOf(t.url))} ${icon('arrow', 11)}</a>` : '<span class="template-url muted">未填链接</span>'}
                <span class="template-notes">${escapeHtml(t.notes || '—')}</span>
                <button type="button" class="icon-btn" data-template-del="${t.id}" aria-label="删除模板：${escapeHtml(t.name)}">${icon('trash', 15)}</button>
              </div>`).join('')}
            </div>` : emptyState({
              title: '还没有模板来源',
              description: '记下你常用的套版来源、刀模与网格文件，用的时候不用到处翻。',
              action: `<button type="button" class="btn" data-add-template>${icon('plus', 15)} 添加模板来源</button>`
            })}
          </section>
        </div>
        <p class="list-note">示例网址仅作收藏示例，与本工作台无隶属关系；请遵守各站点授权条款。</p>`;
    }

    async function copyHex(hex) {
      try {
        await navigator.clipboard.writeText(hex);
        toast(`已复制 ${hex}`, { type: 'success' });
      } catch {
        const ta = document.createElement('textarea');
        ta.value = hex;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          toast(`已复制 ${hex}`, { type: 'success' });
        } catch {
          toast('复制失败，请手动选择色值', { type: 'warn' });
        }
        ta.remove();
      }
    }

    function addLink() {
      const api = openModal({
        kicker: 'Library / 网址',
        title: '收藏一个网址',
        size: 'md',
        body: `<form id="link-form" class="form" novalidate>
          <div class="form-grid">
            <label class="field field--full"><span class="field-label">名称 <em>必填</em></span><input name="name" maxlength="40" placeholder="例如：站酷 ZCOOL" autofocus></label>
            <label class="field field--full"><span class="field-label">网址 <em>必填</em></span><input name="url" maxlength="200" placeholder="https://…" inputmode="url"></label>
            <label class="field field--full"><span class="field-label">标签（逗号分隔）</span><input name="tags" maxlength="60" placeholder="灵感，配色"></label>
            <label class="field field--full"><span class="field-label">备注</span><textarea name="notes" rows="3" maxlength="200" placeholder="为什么收藏它？"></textarea></label>
          </div>
          <div class="form-actions"><span></span><span class="form-actions-right">
            <button type="button" class="btn" data-close>取消</button>
            <button type="submit" class="btn btn-primary">保存收藏</button>
          </span></div>
        </form>`,
        onMount(dialog) {
          dialog.querySelector('#link-form').addEventListener('submit', e => {
            e.preventDefault();
            const data = formValues(e.target);
            if (!data.name || !data.url) {
              toast('名称和网址都要填写', { type: 'warn' });
              return;
            }
            update(s => {
              s.library.links.unshift({
                id: uid('lnk'), name: data.name, url: safeUrl(data.url),
                tags: data.tags.split(/[,，、]/).map(t => t.trim()).filter(Boolean).slice(0, 6),
                notes: data.notes || '', sample: false
              });
            });
            toast('网址已收藏', { type: 'success' });
            api.close('saved');
          });
        }
      });
    }

    function addPalette() {
      const api = openModal({
        kicker: 'Library / 配色',
        title: '新建配色板',
        size: 'md',
        body: `<form id="palette-form" class="form" novalidate>
          <div class="form-grid">
            <label class="field field--full"><span class="field-label">配色名称 <em>必填</em></span><input name="name" maxlength="40" placeholder="例如：印刷朱红" autofocus></label>
            <label class="field field--full"><span class="field-label">色值（逗号分隔，2–6 个）<em>必填</em></span>
              <input name="colors" maxlength="120" placeholder="#C8452D, #17140F, #F4F0E7">
            </label>
            <label class="field field--full"><span class="field-label">备注</span><input name="notes" maxlength="120" placeholder="适合什么项目？"></label>
          </div>
          <div class="form-actions"><span></span><span class="form-actions-right">
            <button type="button" class="btn" data-close>取消</button>
            <button type="submit" class="btn btn-primary">保存配色</button>
          </span></div>
        </form>`,
        onMount(dialog) {
          dialog.querySelector('#palette-form').addEventListener('submit', e => {
            e.preventDefault();
            const data = formValues(e.target);
            const colors = data.colors.split(/[,，\s]+/).map(c => c.trim().toUpperCase())
              .filter(c => /^#([0-9A-F]{3}|[0-9A-F]{6})$/.test(c));
            if (!data.name || !colors.length) {
              toast('名称和合法色值（如 #C8452D）都要填写', { type: 'warn' });
              return;
            }
            update(s => {
              s.library.palettes.unshift({
                id: uid('pal'), name: data.name, colors: colors.slice(0, 6),
                notes: data.notes || '', sample: false
              });
            });
            toast('配色板已保存', { type: 'success' });
            api.close('saved');
          });
        }
      });
    }

    function addTemplate() {
      const api = openModal({
        kicker: 'Library / 模板',
        title: '添加模板来源',
        size: 'md',
        body: `<form id="template-form" class="form" novalidate>
          <div class="form-grid">
            <label class="field field--full"><span class="field-label">模板名称 <em>必填</em></span><input name="name" maxlength="50" placeholder="例如：展览海报套版" autofocus></label>
            <label class="field field--full"><span class="field-label">来源链接</span><input name="url" maxlength="200" placeholder="https://…（可留空）"></label>
            <label class="field field--full"><span class="field-label">备注</span><textarea name="notes" rows="3" maxlength="200" placeholder="尺寸、网格、使用注意…"></textarea></label>
          </div>
          <div class="form-actions"><span></span><span class="form-actions-right">
            <button type="button" class="btn" data-close>取消</button>
            <button type="submit" class="btn btn-primary">保存模板</button>
          </span></div>
        </form>`,
        onMount(dialog) {
          dialog.querySelector('#template-form').addEventListener('submit', e => {
            e.preventDefault();
            const data = formValues(e.target);
            if (!data.name) { toast('模板名称不能为空', { type: 'warn' }); return; }
            update(s => {
              s.library.templates.push({
                id: uid('tpl'), name: data.name, url: data.url ? safeUrl(data.url) : '',
                notes: data.notes || '', sample: false
              });
            });
            toast('模板来源已保存', { type: 'success' });
            api.close('saved');
          });
        }
      });
    }

    function onClick(e) {
      const hex = e.target.closest('[data-hex]');
      if (hex) { copyHex(hex.dataset.hex); return; }
      if (e.target.closest('[data-add-link]')) { addLink(); return; }
      if (e.target.closest('[data-add-palette]')) { addPalette(); return; }
      if (e.target.closest('[data-add-template]')) { addTemplate(); return; }

      const linkDel = e.target.closest('[data-link-del]');
      if (linkDel) {
        const item = getState().library.links.find(l => l.id === linkDel.dataset.linkDel);
        confirmDialog({
          title: '删除收藏？', description: `「${item?.name || '这条收藏'}」将从灵感库移除。`,
          confirmText: '删除', danger: true
        }).then(ok => {
          if (!ok) return;
          update(s => { s.library.links = s.library.links.filter(l => l.id !== item.id); });
          toast('收藏已删除');
        });
        return;
      }
      const palDel = e.target.closest('[data-palette-del]');
      if (palDel) {
        update(s => { s.library.palettes = s.library.palettes.filter(p => p.id !== palDel.dataset.paletteDel); });
        toast('配色板已删除');
        return;
      }
      const tplDel = e.target.closest('[data-template-del]');
      if (tplDel) {
        update(s => { s.library.templates = s.library.templates.filter(t => t.id !== tplDel.dataset.templateDel); });
        toast('模板来源已删除');
      }
    }
  }
};
