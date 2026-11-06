// 线性图标集合（内联 SVG，无外部依赖）
const paths = {
  home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5v10h13v-10"/><path d="M9.5 19.5v-5h5v5"/>',
  projects: '<rect x="3.5" y="4.5" width="5" height="15"/><rect x="9.5" y="4.5" width="5" height="9"/><rect x="15.5" y="4.5" width="5" height="12"/>',
  portfolio: '<rect x="3.5" y="4.5" width="17" height="15"/><path d="m3.5 15 4.5-4 4 3.5 3-2.5 5 4.5"/><circle cx="8.5" cy="9" r="1.4"/>',
  learn: '<path d="M4 5.5c2.5-1 5-1 8 1v13c-3-2-5.5-2-8-1z"/><path d="M20 5.5c-2.5-1-5-1-8 1v13c3-2 5.5-2 8-1z"/>',
  library: '<path d="M6.5 4.5h11a1 1 0 0 1 1 1v15l-6.5-4-6.5 4v-15a1 1 0 0 1 1-1z"/><path d="M9 8.5h6"/>',
  settings: '<path d="M4 7h9"/><path d="M17 7h3"/><circle cx="15" cy="7" r="2"/><path d="M4 17h3"/><path d="M11 17h9"/><circle cx="9" cy="17" r="2"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4.5 4.5"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="m14 6 4 4"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6.5 7l1 13h9l1-13"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  star: '<path d="m12 4 2.4 5.3 5.6.6-4.2 3.9 1.2 5.7-5-3.1-5 3.1 1.2-5.7-4.2-3.9 5.6-.6z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 1 0-5.6-5.6l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3A4 4 0 1 0 11 18.6l1.5-1.5"/>',
  copy: '<rect x="8" y="8" width="11" height="11"/><path d="M5 15V5h10"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  download: '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 16v4h16v-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  moon: '<path d="M18 15a6.5 6.5 0 0 1-8-9 7 7 0 1 0 8 9z"/>',
  arrow: '<path d="M5 19 19 5"/><path d="M9 5h10v10"/>',
  play: '<path d="M7 4.5 19 12 7 19.5z"/>',
  pause: '<path d="M8 5v14"/><path d="M16 5v14"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4"/>',
  flame: '<path d="M12 21c4 0 6-2.6 6-6 0-4.4-4-6.5-4-11 0 0-3.5 2.5-3.5 6.5 0-1-1-2.5-1-2.5S6 8.5 6 15c0 3.4 2 6 6 6z"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3.5 2"/>',
  grid: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13"/><path d="m4 6 8 6 8-6"/>',
  pin: '<path d="M12 21s6-5.5 6-10a6 6 0 1 0-12 0c0 4.5 6 10 6 10z"/><circle cx="12" cy="11" r="2.4"/>',
  folder: '<path d="M3.5 6.5h6l2 2h9v11h-17z"/>'
};

export function icon(name, size = 18, cls = '') {
  const body = paths[name] || paths.more;
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
