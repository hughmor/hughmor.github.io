// tiny canvas engine for a pixel simulation background

let state = {
  running: false,
  ctx: null,
  canvas: null,
  dpr: 1,
  simW: 256,   // simulation grid width
  simH: 256,   // simulation grid height
  scale: 2,    // upscales to viewport
  imageData: null,
  frameReq: 0,
  lastT: 0,
  fpsCap: 60,
  acc: 0,
  params: {
    temperature: 2.269,
  },
  // your ising buffers
  spins: null,         // Int8Array of +1/-1
  rng: null,
};

// simple lcg rng (fast + deterministic)
function makeRNG(seed=123456789){
  let s = seed >>> 0;
  return () => (s = (1664525 * s + 1013904223) >>> 0) / 0xffffffff;
}

function initSimBuffers() {
  const N = state.simW * state.simH;
  state.spins = new Int8Array(N);
  // random ±1 init
  for (let i=0;i<N;i++) state.spins[i] = Math.random() < 0.5 ? -1 : 1;
  state.rng = makeRNG((Math.random()*1e9)|0);
}

function resizeCanvas() {
  const { canvas } = state;
  if (!canvas) return;
  state.dpr = window.devicePixelRatio || 1;

  // match canvas to viewport in device pixels
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width  = Math.floor(cssW * state.dpr);
  canvas.height = Math.floor(cssH * state.dpr);

  // pick simulation grid to roughly match pixels/scale
  state.simW = Math.max(64, Math.floor(canvas.width  / state.scale));
  state.simH = Math.max(64, Math.floor(canvas.height / state.scale));

  // (re)alloc imageData
  state.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  state.imageData = state.ctx.createImageData(state.simW, state.simH);

  initSimBuffers();
}

function calcEnergyDiff(idx) {
    const spins = state.spins;
    const W = state.simW;
    const H = state.simH;
    let energy_old = 0;
    let energy_new = 0;

    // iterate every cell; compute bonds to right and down only (no double count)
    const N = W * H;

    const s = spins[idx];
    const x = idx % W;
    const y = Math.floor(idx / W); // floored division

    // right neighbour (if not on right edge)
    if (x !== W - 1) {
        energy_old -= s * spins[idx + 1];
        energy_new += s * spins[idx + 1];
    }
    // left neighbour (if not on left edge)
    if (x !== 0) {
        energy_old -= s* spins[idx - 1];
        energy_new += s* spins[idx - 1];
    }
    // down neighbor (if not on bottom edge)
    if (y !== H - 1) {
        energy_old -= s * spins[idx + W];
        energy_new += s * spins[idx + W];
    }
    // top neighbor (if not on top edge)
    if (y !== 0) {
        energy_old -= s * spins[idx - W];
        energy_new += s * spins[idx - W];
    }

    return energy_new-energy_old;
}

function metropolisSweep() {
  // *** INSERT YOUR ISING STEP HERE ***
  // placeholder: cheap "bubbling" stand-in so the scaffold animates before you code your kernel
  const { simW: W, simH: H, spins, rng, params } = state;
  const pFlip = Math.min(0.5, Math.max(0.01, Math.abs(params.temperature - 2.269) * 0.15 + 0.03));
  
  // flip a small random subset per frame so we see motion
  const flips = (W*H) >> 6;
//   const e_prev = calcIsingEnergy();
  for (let k=0;k<flips;k++){
    const i = (rng()*W)|0;
    const j = (rng()*H)|0;
    const idx = j*W + i;
    if (rng() < pFlip) spins[idx] *= -1;

    // const e_new = calcIsingEnergy();
    const delta_e = calcEnergyDiff(idx);
    if (Math.exp(-delta_e/params.temperature) > rng()){
        spins[idx] *= -1; // flip back
    }
  }
}

function parseColor(c) {
    if (!c) return [0,0,0];
    c = c.trim().toLowerCase();
    if (c[0] === '#') {
        if (c.length === 4) {
            return [
                parseInt(c[1] + c[1], 16),
                parseInt(c[2] + c[2], 16),
                parseInt(c[3] + c[3], 16)
            ];
        } else if (c.length === 7) {
            return [
                parseInt(c.substr(1,2), 16),
                parseInt(c.substr(3,2), 16),
                parseInt(c.substr(5,2), 16)
            ];
        }
    }
    const m = c.match(/rgba?\(\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)(?:\s*,\s*([0-9.]+))?\s*\)/);
    if (m) {
        const isPerc = m[1].includes('%') || m[2].includes('%') || m[3].includes('%');
        let r = parseFloat(m[1]), g = parseFloat(m[2]), b = parseFloat(m[3]);
        if (isPerc) {
            r = Math.round(r * 2.55);
            g = Math.round(g * 2.55);
            b = Math.round(b * 2.55);
        } else {
            r = Math.round(r); g = Math.round(g); b = Math.round(b);
        }
        return [r, g, b];
    }
    // fallback black
    return [0,0,0];
}

function blitToCanvas() {
  const { simW: W, simH: H, spins, imageData, ctx, canvas, dpr, scale } = state;
  const data = imageData.data;

  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const bg_col = styles.getPropertyValue('--bg').trim();
  const txt_col = styles.getPropertyValue('--hdr').trim();

  const bg_rgb = parseColor(bg_col);
  const txt_rgb = parseColor(txt_col);

  // map spins ±1 → bg / text colors
  for (let idx = 0, p = 0; idx < spins.length; idx++, p += 4) {
      const s = spins[idx];
      const col = s > 0 ? txt_rgb : bg_rgb;
      data[p  ] = col[0];
      data[p+1] = col[1];
      data[p+2] = col[2];
      data[p+3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  // upscale to full canvas
  // drawImage(source, sx,sy,sw,sh, dx,dy,dw,dh)
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    canvas,
    0, 0, W, H,
    0, 0, W*scale, H*scale
  );
}

function tick(ts) {
  if (!state.running) return;

  const maxDt = 1000 / (state.fpsCap || 60);
  if (ts - state.lastT < maxDt) {
    state.frameReq = requestAnimationFrame(tick);
    return;
  }
  state.lastT = ts;

  metropolisSweep();
  blitToCanvas();

  state.frameReq = requestAnimationFrame(tick);
}

export function startSim(canvas, opts={}) {
  if (state.running && canvas === state.canvas) return state;
  state.canvas = canvas;
  state.scale = opts.scale ?? state.scale;
  state.fpsCap = opts.fpsCap ?? state.fpsCap;
  if (opts.temperature != null) state.params.temperature = opts.temperature;

  resizeCanvas();
  state.running = true;
  state.frameReq = requestAnimationFrame(tick);
  return {
    resize: resizeCanvas
  };
}

export function stopSim() {
  state.running = false;
  if (state.frameReq) cancelAnimationFrame(state.frameReq);
}

export function setScrollParam(name, value) {
  // expose a narrow API for scroll-driven params
  if (name in state.params) state.params[name] = value;
}