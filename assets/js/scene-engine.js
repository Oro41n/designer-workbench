// 场景镜头引擎：把滚动位置翻译成统一的镜头语言
// 每个 [data-scene] 拿到 --p / --enter / --exit，内部图层只用 CSS 变量驱动
// 不使用淡入；可见场景才计算，滚动速度单独传给 WebGL 层做位移

const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

export function initScenes(root, { onFrame } = {}) {
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let scenes = [];
  let raf = 0;
  let running = true;
  let lastY = window.scrollY;
  let smoothV = 0;
  let mx = 0;
  let my = 0;
  let tx = 0;
  let ty = 0;
  let vh = window.innerHeight;

  function read() {
    vh = window.innerHeight;
    const y = window.scrollY;
    const rawV = Math.abs(y - lastY) / Math.max(1, vh * 0.35);
    smoothV += (Math.min(1, rawV) - smoothV) * 0.16;
    lastY = y;

    // 指针镜头：只有精确指针才参与，触屏不抢手势
    if (finePointer.matches) {
      mx += (tx - mx) * 0.08;
      my += (ty - my) * 0.08;
    } else {
      mx += (0 - mx) * 0.1;
      my += (0 - my) * 0.1;
    }
    root.style.setProperty('--mx', mx.toFixed(3));
    root.style.setProperty('--my', my.toFixed(3));
    root.style.setProperty('--sv', smoothV.toFixed(3));

    const active = [];
    scenes.forEach(scene => {
      const rect = scene.getBoundingClientRect();
      if (rect.bottom < -vh * 0.4 || rect.top > vh * 1.5) return;
      active.push(scene);

      const h = Math.max(vh, scene.offsetHeight);
      const span = Math.max(1, h - vh);
      const p = clamp(-rect.top / span);
      const enter = clamp((vh - rect.top) / Math.max(1, Math.min(vh, h)));
      const exit = clamp((vh - rect.bottom) / vh);
      scene.style.setProperty('--p', p.toFixed(4));
      scene.style.setProperty('--enter', enter.toFixed(4));
      scene.style.setProperty('--exit', exit.toFixed(4));
    });

    onFrame?.({ v: smoothV, y, active });
  }

  function loop() {
    if (!running) return;
    if (document.hidden) {
      raf = requestAnimationFrame(loop);
      return;
    }
    read();
    raf = requestAnimationFrame(loop);
  }

  function onPointer(e) {
    tx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
    ty = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
  }

  function refresh() {
    scenes = [...root.querySelectorAll('[data-scene]')];
    if (reduceQuery.matches) {
      scenes.forEach(scene => {
        scene.style.setProperty('--p', '0.25');
        scene.style.setProperty('--enter', '1');
        scene.style.setProperty('--exit', '0');
      });
    }
    read();
    return scenes;
  }

  scenes = [...root.querySelectorAll('[data-scene]')];
  if (reduceQuery.matches) {
    scenes.forEach(scene => {
      scene.style.setProperty('--p', '0.25');
      scene.style.setProperty('--enter', '1');
      scene.style.setProperty('--exit', '0');
    });
    root.style.setProperty('--mx', '0');
    root.style.setProperty('--my', '0');
    root.style.setProperty('--sv', '0');
  } else {
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('resize', read, { passive: true });
    raf = requestAnimationFrame(loop);
  }

  return {
    refresh,
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', read);
    }
  };
}
