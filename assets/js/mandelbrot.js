// mandelbrot.js
// esm module. usage:
//   import initMandelbrot from './mandelbrot.js';
//   const stop = initMandelbrot(document.getElementById('viewport'), { maxIter: 500 });
//
// controls:
//   - drag: pan
//   - wheel / trackpad: zoom at cursor
//   - 1/2: halve/double iterations
//   - r: reset view

import * as THREE from 'three';

export function initMandelbrot(container, opts = {}) {
  if (!container) throw new Error('initMandelbrot: container element is required');

  // ---- config (with sane defaults) ----
  const cfg = {
    maxIter: opts.maxIter ?? 100,
    center: opts.center ?? { x: -0.5, y: 0.0 },
    scale: opts.scale ?? 3.0, // vertical extent in complex plane
    minScale: opts.minScale ?? 1e-12,
    maxScale: opts.maxScale ?? 4.0,
    zoomSpeed: opts.zoomSpeed ?? 1.1, // >1
    animate: opts.animate ?? false, // set true for a subtle auto-zoom
  };

  // ---- three.js boilerplate ----
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 5));
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // a single fullscreen quad
  const geo = new THREE.PlaneGeometry(2, 2);

  // ---- shaders ----
  const vert = /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;

  // smooth coloring + simple hsv palette
  const frag = /* glsl */`
    precision highp float;
    varying vec2 vUv;

    uniform vec2  u_center; // complex plane center (x,y)
    uniform float u_scale;  // vertical extent of the view in complex plane
    uniform float u_ratio;  // width/height
    uniform int   u_iter;   // max iterations

    // convert hsv in [0,1] to rgb
    vec3 hsv2rgb(vec3 c){
      vec3 p = abs(fract(c.xxx + vec3(0., 2./6., 4./6.)) * 6. - 3.);
      return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y);
    }

    void main() {
      // map pixel -> complex plane (preserve aspect by scaling x)
      float x = (vUv.x - 0.5) * u_ratio * u_scale + u_center.x;
      float y = (vUv.y - 0.5) * u_scale + u_center.y;

      // mandelbrot iteration
      float zx = 0.0;
      float zy = 0.0;
      float zx2 = 0.0;
      float zy2 = 0.0;

      int i;
      for (i = 0; i < 10000; ++i) {
        if (i >= u_iter) break;
        zy = 2.0 * zx * zy + y;
        zx = zx2 - zy2 + x;
        zx2 = zx * zx;
        zy2 = zy * zy;
        if (zx2 + zy2 > 4.0) break;
      }

      // inside set -> black
      if (i == u_iter) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      // smooth iteration count (log-based) for nicer bands
      float mag = sqrt(zx2 + zy2);
      float nu = float(i) + 1.0 - log2(log2(mag));
      float t = nu / float(u_iter);

      // palette: cycle hue with t, tweak saturation/value for contrast
      vec3 rgb = hsv2rgb(vec3(0.1 + 0.7 * sqrt(t), 0.9-0.25*sqrt(t), 0.0+1.3*sqrt(t) ));
      gl_FragColor = vec4(rgb, 1.0);
    }
  `;

  const uniforms = {
    u_center: { value: new THREE.Vector2(cfg.center.x, cfg.center.y) },
    u_scale:  { value: cfg.scale },
    u_ratio:  { value: container.clientWidth / container.clientHeight },
    u_iter:   { value: cfg.maxIter },
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
  });

  const quad = new THREE.Mesh(geo, mat);
  scene.add(quad);

  // ---- interaction (pan & zoom) ----
  let isDragging = false;
  let lastX = 0, lastY = 0;

  const toComplexScale = () => {
    // pixels -> complex-plane units per pixel
    const h = renderer.domElement.clientHeight;
    return uniforms.u_scale.value / h;
  };

  function onPointerDown(e) {
    isDragging = true;
    const p = pointerPos(e);
    lastX = p.x; lastY = p.y;
    renderer.domElement.setPointerCapture(e.pointerId ?? 1);
  }
  function onPointerUp(e) {
    isDragging = false;
    try { renderer.domElement.releasePointerCapture(e.pointerId ?? 1); } catch (_) {}
  }
  function onPointerMove(e) {
    if (!isDragging) return;
    const p = pointerPos(e);
    const dx = p.x - lastX;
    const dy = p.y - lastY;
    lastX = p.x; lastY = p.y;

    const s = toComplexScale();
    // note: x scaled by aspect ratio because shader scales x by ratio
    const ratio = uniforms.u_ratio.value;
    uniforms.u_center.value.x -= dx * s * ratio;
    uniforms.u_center.value.y += dy * s;
    requestRender();
  }

  function onWheel(e) {
    e.preventDefault();
    // zoom around cursor position
    const rect = renderer.domElement.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    const before = screenToComplex(px, py);
    const factor = (e.deltaY > 0) ? cfg.zoomSpeed : (1.0 / cfg.zoomSpeed);
    uniforms.u_scale.value = THREE.MathUtils.clamp(uniforms.u_scale.value * factor, cfg.minScale, cfg.maxScale);
    // keep the cursor anchored: shift center so the same complex point stays under the cursor
    const after = screenToComplex(px, py);
    uniforms.u_center.value.add(before.sub(after));

    requestRender();
  }

  function onKey(e) {
    if (e.key === '1') {
      uniforms.u_iter.value = Math.max(32, Math.floor(uniforms.u_iter.value / 2));
      requestRender();
    } else if (e.key === '2') {
      uniforms.u_iter.value = Math.min(16384, uniforms.u_iter.value * 2);
      requestRender();
    } else if (e.key.toLowerCase() === 'r') {
      uniforms.u_center.value.set(cfg.center.x, cfg.center.y);
      uniforms.u_scale.value = cfg.scale;
      uniforms.u_iter.value = cfg.maxIter;
      requestRender();
    }
  }

  function pointerPos(e) {
    return { x: e.clientX, y: e.clientY };
  }

  function screenToComplex(px, py) {
    // px,py in [0,1] across the canvas
    const ratio = uniforms.u_ratio.value;
    const x = (px - 0.5) * ratio * uniforms.u_scale.value + uniforms.u_center.value.x;
    const y = (py - 0.5) * uniforms.u_scale.value + uniforms.u_center.value.y;
    return new THREE.Vector2(x, y);
  }

  // ---- resize handling (avoid blur; respect DPR) ----
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    renderer.setSize(w, h, false);
    uniforms.u_ratio.value = w / h;
    requestRender();
  }

  // ---- render loop (render-on-demand + optional auto-zoom) ----
  let needsRender = true;
  function requestRender() { needsRender = true; }

  function render() {
    if (cfg.animate) {
      uniforms.u_scale.value = Math.max(cfg.minScale, uniforms.u_scale.value * 0.9995);
      needsRender = true;
    }
    if (needsRender) {
      renderer.render(scene, camera);
      needsRender = false;
    }
  }

  const loop = (t) => {
    render();
    rafId = renderer.setAnimationLoop ? renderer.setAnimationLoop(loop) : requestAnimationFrame(loop);
  };

  // kick it off
  let rafId = null;
  loop();

  // listeners
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);

  // initial draw
  requestRender();

  // cleanup
  return function destroy() {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('keydown', onKey);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('wheel', onWheel);

    if (renderer.setAnimationLoop) renderer.setAnimationLoop(null);
    if (rafId) cancelAnimationFrame(rafId);

    geo.dispose();
    mat.dispose();
    renderer.dispose();

    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };
}