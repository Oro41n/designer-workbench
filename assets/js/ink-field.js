// 程序化影像场：WebGL 流体噪声（呼吸感），失败时回退 Canvas2D 渐变
// 颜色来自当前图流取色（dw:palette），不是固定模板

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){
  vUv = (aPos + 1.0) * 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uPtr;
uniform vec3 uBg;
uniform vec3 uA;
uniform vec3 uB;
uniform float uLight;
uniform float uWarp;
uniform float uCam;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p){
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * noise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}

void main(){
  vec2 uv = vUv;
  // 镜头推进：滚动进度轻微改变取样中心，形成"摄影机前移"而不是淡入
  uv.y += uCam * 0.07;
  float ar = uRes.x / max(uRes.y, 1.0);
  vec2 p = vec2(uv.x * ar, uv.y);
  float t = uTime * 0.035;

  // 滚动速度驱动的位移：快速滚动时噪声场被横向拉开
  p += vec2(
    sin(p.y * 3.1 + t * 2.4),
    cos(p.x * 2.4 - t * 1.8)
  ) * uWarp * 0.28;

  vec2 q = vec2(fbm(p * 1.45 + vec2(t, 3.2)), fbm(p * 1.55 + vec2(5.7, -t)));
  vec2 r = vec2(
    fbm(p * 1.8 + q * 1.25 + vec2(1.7, 9.2) + t * 1.6),
    fbm(p * 1.8 + q * 1.25 + vec2(8.3, 2.8) - t * 1.2)
  );
  float f = fbm(p * 1.15 + r * 1.7 + t * 0.6);

  // 呼吸：低频脉动，不是匀速旋转
  float breath = 0.5 + 0.5 * sin(uTime * 0.22);

  vec3 base = mix(vec3(0.016, 0.017, 0.020), vec3(0.95, 0.94, 0.91), uLight);
  vec3 col = base;

  float m1 = smoothstep(0.18, 0.92, f);
  float m2 = smoothstep(0.35, 1.0, r.x * 0.85 + r.y * 0.15);
  float m3 = smoothstep(0.55, 1.0, q.y);

  col = mix(col, uBg, m1 * 0.9);
  col = mix(col, uA, m2 * (0.12 + 0.14 * breath));
  col = mix(col, uB, m3 * 0.09);

  // 光束：缓慢摆动的斜向光
  float beam = pow(max(0.0, sin(uv.x * 2.4 + uv.y * 0.9 + uTime * 0.18)), 26.0);
  col += uB * beam * 0.07;

  // 指针附近的光晕
  vec2 pp = uPtr * vec2(ar, 1.0);
  float d = length(uv * vec2(ar, 1.0) - pp);
  col += uB * exp(-d * 3.9) * 0.16;

  // 暗角与颗粒
  col *= 0.84 + 0.24 * smoothstep(1.25, 0.15, length(uv - 0.5));
  col += (hash(uv * uRes + uTime) - 0.5) * 0.028;

  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('shader', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function rgbToList(rgb = [255, 75, 43]) {
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
}

export function createInkField(canvas) {
  if (!canvas) return null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let gl = null;
  let program = null;
  let uniforms = {};
  let raf = 0;
  let running = true;
  let visible = true;
  let startTime = performance.now();
  let pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  let colors = { bg: [10, 10, 12], accent: [255, 75, 43], accent2: [176, 107, 255], ink: [244, 241, 234] };
  let light = 0;
  let warp = 0;
  let targetWarp = 0;
  let cam = 0;
  let targetCam = 0;
  let ctx2d = null;
  let observer = null;

  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch { gl = null; }

  if (gl) {
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (vs && fs) {
      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.useProgram(program);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(program, 'aPos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        uniforms = {
          time: gl.getUniformLocation(program, 'uTime'),
          res: gl.getUniformLocation(program, 'uRes'),
          ptr: gl.getUniformLocation(program, 'uPtr'),
          bg: gl.getUniformLocation(program, 'uBg'),
          a: gl.getUniformLocation(program, 'uA'),
          b: gl.getUniformLocation(program, 'uB'),
          light: gl.getUniformLocation(program, 'uLight'),
          warp: gl.getUniformLocation(program, 'uWarp'),
          cam: gl.getUniformLocation(program, 'uCam')
        };
      } else {
        program = null;
      }
    }
  }

  if (!gl || !program) {
    ctx2d = canvas.getContext('2d');
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      if (gl) gl.viewport(0, 0, w, h);
    }
  }

  function draw(t) {
    resize();
    const w = canvas.width, h = canvas.height;
    if (gl && program) {
      gl.useProgram(program);
      gl.uniform1f(uniforms.time, t);
      gl.uniform2f(uniforms.res, w, h);
      gl.uniform2f(uniforms.ptr, pointer.x, pointer.y);
      gl.uniform3fv(uniforms.bg, rgbToList(colors.bg));
      gl.uniform3fv(uniforms.a, rgbToList(colors.accent2));
      gl.uniform3fv(uniforms.b, rgbToList(colors.accent));
      gl.uniform1f(uniforms.light, light);
      gl.uniform1f(uniforms.warp, warp);
      gl.uniform1f(uniforms.cam, cam);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }
    if (!ctx2d) return;
    const bg = `rgb(${colors.bg.join(',')})`;
    ctx2d.fillStyle = bg;
    ctx2d.fillRect(0, 0, w, h);
    const breath = 0.5 + 0.5 * Math.sin(t * 0.5);
    const g1 = ctx2d.createRadialGradient(w * (0.25 + pointer.x * 0.2), h * 0.3, 10, w * 0.3, h * 0.3, w * 0.8);
    g1.addColorStop(0, `rgba(${colors.accent2.join(',')},${0.34 + breath * 0.2})`);
    g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx2d.fillStyle = g1;
    ctx2d.fillRect(0, 0, w, h);
    const g2 = ctx2d.createRadialGradient(w * 0.78, h * 0.72, 10, w * 0.7, h * 0.7, w * 0.7);
    g2.addColorStop(0, `rgba(${colors.accent.join(',')},${0.3 + breath * 0.15})`);
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx2d.fillStyle = g2;
    ctx2d.fillRect(0, 0, w, h);
  }

  function loop(now) {
    if (!running) return;
    if (!visible) { raf = requestAnimationFrame(loop); return; }
    if (!reduced) {
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      warp += (targetWarp - warp) * 0.14;
      cam += (targetCam - cam) * 0.08;
    }
    draw(reduced ? 0 : (now - startTime) / 1000);
    if (!reduced) raf = requestAnimationFrame(loop);
  }

  const onPointer = e => {
    pointer.tx = e.clientX / Math.max(1, window.innerWidth);
    pointer.ty = 1 - e.clientY / Math.max(1, window.innerHeight);
  };
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('resize', resize, { passive: true });

  const onPalette = e => {
    const { rgb, mode } = e.detail || {};
    if (!rgb) return;
    colors = { ...colors, ...rgb };
    light = mode === 'light' ? 1 : 0;
    if (reduced) draw(0);
  };
  window.addEventListener('dw:palette', onPalette);

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
    }, { threshold: 0.01 });
    observer.observe(canvas);
  }
  const onVis = () => { running = !document.hidden; if (running && !reduced) cancelAnimationFrame(raf), raf = requestAnimationFrame(loop); };
  document.addEventListener('visibilitychange', onVis);

  raf = requestAnimationFrame(loop);
  if (reduced) draw(0);

  return {
    setColors(next = {}) { colors = { ...colors, ...next }; },
    // 滚动镜头：v 是归一化滚动速度，p 是当前场景进度
    setScroll({ v = 0, p = 0 } = {}) {
      targetWarp = Math.min(1, Math.max(0, v) * 1.4);
      targetCam = Math.min(1, Math.max(0, p));
      if (reduced) {
        warp = targetWarp;
        cam = targetCam;
        draw(0);
      }
    },
    resize,
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', resize);
      window.removeEventListener('dw:palette', onPalette);
      document.removeEventListener('visibilitychange', onVis);
      observer?.disconnect();
    }
  };
}
