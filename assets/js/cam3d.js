// cam3d.js — 原生 WebGL 3D 相机（无第三方依赖）
// 图片是不同深度的贴图平面，相机沿 Z 轴推进；文字与按钮全部留在 DOM 层。
// 提供：纹理 CORS 加载、渐变兜底、雾/边框、拾取、帧率与 drawcall 统计。

const VS = `
attribute vec2 aPos;
attribute vec2 aUv;
uniform mat4 uMvp;
varying vec2 vUv;
varying float vDepth;

void main() {
  vec4 clip = uMvp * vec4(aPos, 0.0, 1.0);
  gl_Position = clip;
  vUv = aUv;
  vDepth = clip.w;
}
`;

const FS = `
precision mediump float;
uniform sampler2D uTex;
uniform float uOpacity;
uniform float uBorder;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uFogColor;
uniform vec3 uAccent;
varying vec2 vUv;
varying float vDepth;

void main() {
  vec4 tex = texture2D(uTex, vUv);
  // 画框：靠近 uv 边缘的一圈强调色
  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float inside = smoothstep(0.0, 0.012, edge);
  vec3 col = mix(tex.rgb, uAccent, (1.0 - inside) * uBorder);

  float fog = clamp((vDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  col = mix(col, uFogColor, fog * 0.92);

  gl_FragColor = vec4(col, uOpacity * (1.0 - fog * 0.3));
}
`;

function hexToRgb(hex, fallback = [0, 0, 0]) {
  const s = String(hex || '').replace('#', '');
  if (s.length !== 6) return fallback;
  return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255];
}

function mul(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
  ]);
}

function viewMatrix(x, y, z, roll = 0, pitch = 0) {
  const T = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    -x, -y, -z, 1
  ]);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const Rx = new Float32Array([
    1, 0, 0, 0,
    0, cp, sp, 0,
    0, -sp, cp, 0,
    0, 0, 0, 1
  ]);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const Rz = new Float32Array([
    cr, sr, 0, 0,
    -sr, cr, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
  return mul(mul(Rz, Rx), T);
}

function modelMatrix(x, y, z, w, h, rot = 0) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return new Float32Array([
    c * w, s * w, 0, 0,
    -s * h, c * h, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1
  ]);
}

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

export function createCam3D(canvas, options = {}) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return { ok: false, reason: 'no-webgl' };

  const opts = {
    fov: options.fov || 50,
    near: options.near || 0.6,
    far: options.far || 70,
    fogNear: options.fogNear || 2,
    fogFar: options.fogFar || 50
  };

  const program = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('cam3d shader', gl.getShaderInfoLog(sh));
      return { ok: false, reason: 'shader' };
    }
    gl.attachShader(program, sh);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('cam3d link', gl.getProgramInfoLog(program));
    return { ok: false, reason: 'link' };
  }
  gl.useProgram(program);

  const loc = {
    aPos: gl.getAttribLocation(program, 'aPos'),
    aUv: gl.getAttribLocation(program, 'aUv'),
    mvp: gl.getUniformLocation(program, 'uMvp'),
    tex: gl.getUniformLocation(program, 'uTex'),
    opacity: gl.getUniformLocation(program, 'uOpacity'),
    border: gl.getUniformLocation(program, 'uBorder'),
    fogNear: gl.getUniformLocation(program, 'uFogNear'),
    fogFar: gl.getUniformLocation(program, 'uFogFar'),
    fogColor: gl.getUniformLocation(program, 'uFogColor'),
    accent: gl.getUniformLocation(program, 'uAccent')
  };

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -0.5, -0.5, 0, 0,
    0.5, -0.5, 1, 0,
    -0.5, 0.5, 0, 1,
    0.5, 0.5, 1, 1
  ]), gl.STATIC_DRAW);
  const index = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 2, 1, 3]), gl.STATIC_DRAW);

  gl.enableVertexAttribArray(loc.aPos);
  gl.vertexAttribPointer(loc.aPos, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(loc.aUv);
  gl.vertexAttribPointer(loc.aUv, 2, gl.FLOAT, false, 16, 8);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.CULL_FACE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const palette = { bg: '#0a0a0c', ink: '#f4f1ea', accent: '#ff4b2b', accent2: '#b06bff' };
  let fogRgb = [0.04, 0.04, 0.05];
  let accentRgb = [1, 0.29, 0.17];

  let dpr = 1;
  let width = 1;
  let height = 1;
  let aspect = 1;
  let pendingResize = true;

  const planes = [];
  const cam = { x: 0, y: 0, z: 14, fov: opts.fov, roll: 0, pitch: 0 };
  const target = { x: 0, y: 0, z: 14, fov: opts.fov, roll: 0, pitch: 0 };
  const pointer = { x: 0, y: 0 };
  let destroyed = false;
  let lost = false;

  const fpsSamples = [];
  let drawcalls = 0;
  let lastFrame = 0;
  let worstFps = 60;
  let onFail = options.onFail || null;

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    lost = true;
    onFail?.('context-lost');
  }, false);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = Math.max(1, Math.round(rect.width * dpr));
    height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    aspect = width / height;
    pendingResize = false;
  }

  function makeGradient(seed = 1) {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, size, size);
    // 柔和的体积光，不做硬条纹
    const cx = size * (0.32 + ((seed * 13) % 40) / 100);
    const cy = size * (0.36 + ((seed * 7) % 32) / 100);
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, size * 0.72);
    g.addColorStop(0, palette.accent2 || palette.accent);
    g.addColorStop(0.42, palette.accent);
    g.addColorStop(1, palette.bg);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // 低对比噪点，避免色带
    ctx.globalAlpha = 0.06;
    let s = seed * 9301 + 49297;
    for (let i = 0; i < 260; i++) {
      s = (s * 9301 + 49297) % 233280;
      const x = (s / 233280) * size;
      s = (s * 9301 + 49297) % 233280;
      const y = (s / 233280) * size;
      ctx.fillStyle = i % 2 ? palette.ink : palette.accent2;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function upload(source) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return tex;
  }

  function addPlane(def) {
    const plane = {
      id: def.id || `p${planes.length}`,
      x: def.x || 0, y: def.y || 0, z: def.z || 0,
      w: def.w || 4, h: def.h || 2.6,
      rot: def.rot || 0,
      border: def.border ? 1 : 0,
      opacity: def.opacity == null ? 1 : def.opacity,
      paletteIndex: def.paletteIndex ?? null,
      tex: upload(makeGradient(planes.length + 1)),
      ready: false,
      data: def.data || null
    };
    planes.push(plane);

    const url = def.url;
    if (!url) {
      plane.ready = true;
      def.onReady?.(plane, false);
      return plane;
    }

    const img = new Image();
    img.decoding = 'async';
    if (/^(https?:)/i.test(url)) img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (destroyed) return;
      try {
        const tex = upload(img);
        if (plane.tex) gl.deleteTexture(plane.tex);
        plane.tex = tex;
        plane.ready = true;
        def.onReady?.(plane, true);
      } catch (err) {
        console.warn('cam3d: 纹理无法上传，保留渐变兜底', err);
        plane.ready = true;
        def.onReady?.(plane, false);
      }
    };
    img.onerror = () => {
      if (destroyed) return;
      plane.ready = true;
      def.onReady?.(plane, false);
    };
    img.src = url;
    return plane;
  }

  function clearPlanes() {
    for (const p of planes) {
      if (p.tex) gl.deleteTexture(p.tex);
    }
    planes.length = 0;
  }

  function setPalette(next = {}) {
    Object.assign(palette, next);
    fogRgb = hexToRgb(palette.bg, fogRgb);
    accentRgb = hexToRgb(palette.accent, accentRgb);
  }

  function setCamera(next, { instant = false } = {}) {
    if (next.x != null) target.x = next.x;
    if (next.y != null) target.y = next.y;
    if (next.z != null) target.z = next.z;
    if (next.fov != null) target.fov = next.fov;
    if (next.roll != null) target.roll = next.roll;
    if (next.pitch != null) target.pitch = next.pitch;
    if (instant) {
      cam.x = target.x;
      cam.y = target.y;
      cam.z = target.z;
      cam.fov = target.fov;
      cam.roll = target.roll;
      cam.pitch = target.pitch;
    }
  }

  function setPointer(nx, ny) {
    pointer.x = clamp(nx, -1, 1);
    pointer.y = clamp(ny, -1, 1);
  }

  function frame(dt = 1 / 60) {
    if (destroyed || lost) return { fps: 0, drawcalls: 0 };
    if (pendingResize) resize();

    const k = Math.min(1, dt * 7);
    cam.x += (target.x - cam.x) * k;
    cam.y += (target.y - cam.y) * k;
    cam.z += (target.z - cam.z) * k;
    cam.fov += (target.fov - cam.fov) * k;
    cam.roll += (target.roll - cam.roll) * k;
    cam.pitch += (target.pitch - cam.pitch) * k;

    const px = pointer.x * 0.35;
    const py = pointer.y * 0.22;

    gl.viewport(0, 0, width, height);
    gl.clearColor(fogRgb[0], fogRgb[1], fogRgb[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);

    const proj = perspective((cam.fov * Math.PI) / 180, aspect, opts.near, opts.far);
    const view = viewMatrix(cam.x + px, cam.y + py, cam.z, cam.roll, cam.pitch);

    const visible = planes
      .filter(p => p.z < cam.z - 0.18)
      .sort((a, b) => (cam.z - b.z) - (cam.z - a.z));

    drawcalls = 0;
    for (const p of visible) {
      const t = cam.z - p.z;
      const fade = clamp((t - 0.18) / 0.8, 0, 1);
      const mvp = mul(mul(proj, view), modelMatrix(p.x, p.y, p.z, p.w, p.h, p.rot));
      gl.uniformMatrix4fv(loc.mvp, false, mvp);
      gl.uniform1f(loc.opacity, p.opacity * fade);
      gl.uniform1f(loc.border, p.border);
      gl.uniform1f(loc.fogNear, opts.fogNear);
      gl.uniform1f(loc.fogFar, opts.fogFar);
      gl.uniform3fv(loc.fogColor, fogRgb);
      gl.uniform3fv(loc.accent, accentRgb);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, p.tex);
      gl.uniform1i(loc.tex, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.vertexAttribPointer(loc.aPos, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(loc.aUv, 2, gl.FLOAT, false, 16, 8);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      drawcalls++;
    }

    if (lastFrame) {
      const ms = Math.max(0.1, dt * 1000);
      fpsSamples.push(1000 / ms);
      if (fpsSamples.length > 40) fpsSamples.shift();
    }
    lastFrame = 1;
    const fps = fpsSamples.length
      ? Math.round(fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length)
      : 0;
    if (fps) worstFps = Math.min(worstFps, fps);
    return { fps, drawcalls, planes: visible.length };
  }

  function stats() {
    return {
      fps: fpsSamples.length ? Math.round(fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length) : 0,
      worstFps: Math.round(worstFps),
      drawcalls,
      planes: planes.length,
      ready: planes.filter(p => p.ready).length
    };
  }

  function hitTest(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = 1 - ((clientY - rect.top) / rect.height) * 2;
    const tan = Math.tan((cam.fov * Math.PI) / 360);
    const dirX = nx * tan * aspect;
    const dirY = ny * tan;
    const eyeX = cam.x + pointer.x * 0.35;
    const eyeY = cam.y + pointer.y * 0.22;
    const hits = [];
    for (const p of planes) {
      const t = cam.z - p.z;
      if (t <= 0.5) continue;
      const hx = eyeX + dirX * t;
      const hy = eyeY + dirY * t;
      if (Math.abs(hx - p.x) <= p.w / 2 && Math.abs(hy - p.y) <= p.h / 2) hits.push({ plane: p, t });
    }
    hits.sort((a, b) => a.t - b.t);
    return hits[0]?.plane || null;
  }

  function destroy() {
    destroyed = true;
    clearPlanes();
    gl.deleteBuffer(quad);
    gl.deleteBuffer(index);
    gl.deleteProgram(program);
  }

  window.addEventListener('resize', () => { pendingResize = true; });

  return {
    ok: true,
    addPlane,
    clearPlanes,
    setPalette,
    setCamera,
    setPointer,
    frame,
    stats,
    hitTest,
    resize: () => { pendingResize = true; },
    destroy,
    get palette() { return { ...palette }; },
    get planes() { return planes; }
  };
}
