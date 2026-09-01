// assets/js/three_body_p5.js
export async function mountThreeBody(rootEl, opts = {}) {
  if (!window.p5) {
    throw new Error('p5 not found. include <script src="{{ "/assets/p5/p5.min.js" | relative_url }}"></script> in your layout.');
  }

  // --- config (override via opts) ---
  const ASPECT = opts.aspect ?? (16 / 9);
  const COLS   = Math.max(1, Math.floor(opts.cols ??  Math.round((rootEl.clientWidth||800) / 100)));
  const ROWS   = Math.max(1, Math.floor(opts.rows ??  Math.round((COLS / ASPECT))));

  // colors
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const bg_col = styles.getPropertyValue('--bg').trim();
  const txt_col = styles.getPropertyValue('--hdr').trim();

  const N_PER_CELL = 3;
  const G    = 1.0;
  const EPS2 = 25.0; // softening^2 (px^2)

  const CELL_COLORS = [
    [255, 0, 0],
    [0, 200, 0],
    [0, 0, 255],
  ];

  // --- state ---
  let movers = [];
  let cellCenters = [];
  let trailLayer = null;
  let canvas = null;

  // size helper (css pixels)
  function measure() {
    const w = rootEl.clientWidth || 800;
    const h = Math.round(w / ASPECT);
    // choose a sane cap so we don't murder the gpu with >2x dpr
    const dpr = Math.min(window.devicePixelRatio || 1, opts.maxDPR ?? 2);
    return { w, h, dpr };
  }

  const sketch = (p) => {
    // dynamic geometry derived from current canvas size
    let pitchX, pitchY, minPitch, jitter, planetRad;

    class Mover {
      constructor({ pos, vel = p.createVector(0, 0), mass = 1, col = [127,127,127] }) {
        this.mass = mass;
        this.sqr_m = Math.sqrt(mass);
        this.position = pos.copy();
        this.prev = pos.copy();
        this.velocity = vel.copy();
        this.acceleration = p.createVector(0, 0);
        this.col = p.color(...col);
      }
      applyForce(force) {
        const f = p5.Vector.div(force, this.mass);
        this.acceleration.add(f);
      }
      update() {
        this.velocity.add(this.acceleration);
        this.prev.set(this.position);
        this.position.add(this.velocity);
        this.acceleration.mult(0);
      }
      show() {
        p.stroke(0);
        p.strokeWeight(1);
        p.fill(this.col);
        p.ellipse(this.position.x, this.position.y, planetRad*this.sqr_m, planetRad*this.sqr_m);
      }
      checkEdges() {
        if (this.position.x > p.width)  { this.position.x = p.width;  this.velocity.x *= -1; }
        else if (this.position.x < 0)   { this.position.x = 0;        this.velocity.x *= -1; }
        if (this.position.y > p.height) { this.position.y = p.height; this.velocity.y *= -1; }
        else if (this.position.y < 0)   { this.position.y = 0;        this.velocity.y *= -1; }
      }
    }

    function recomputeDerived() {
      pitchX   = p.width  / COLS;
      pitchY   = p.height / ROWS;
      minPitch = Math.min(pitchX, pitchY);
      // visuals scale with element size
      jitter    = 0.35 * minPitch;
      planetRad = 0.1 * minPitch; //Math.max(2, 0.18 * minPitch);
    }

    function createBodies() {
      movers = [];
      cellCenters = [];
      for (let i = 0; i < COLS; i++) {
        movers.push([]);
        cellCenters.push([]);
        for (let j = 0; j < ROWS; j++) {
          const cell = [];
          const cx = (i + 0.5) * pitchX;
          const cy = (j + 0.5) * pitchY;
          cellCenters[i].push(p.createVector(cx, cy));

          for (let k = 0; k < N_PER_CELL; k++) {
            const offset = p5.Vector.random2D().mult(p.random(-jitter, jitter));
            const pos = p.createVector(cx, cy).add(offset);
            const vel = p5.Vector.random2D().mult(p.random(0.2));
            const mass = p.random(0.5, 2.0);
            const col = CELL_COLORS[k % CELL_COLORS.length];
            cell.push(new Mover({ pos, vel, mass, col }));
          }
          movers[i].push(cell);
        }
      }
    }

    p.setup = () => {
      const { w, h, dpr } = measure();
      // important: set pixel density BEFORE making graphics so both buffers match
      p.pixelDensity(dpr);
      canvas = p.createCanvas(w, h);
      canvas.parent(rootEl);

      // better text/line crispness at high dpr; mostly harmless otherwise
      canvas.elt.style.imageRendering = 'auto';

      trailLayer = p.createGraphics(p.width, p.height);
      trailLayer.pixelDensity(p.pixelDensity()); // match main canvas dpr
      trailLayer.background(bg_col);

      recomputeDerived();
      createBodies();
    };

    p.windowResized = () => {
      const { w, h, dpr } = measure();
      if (w !== p.width || h !== p.height || dpr !== p.pixelDensity()) {
        // stash old trails and recreate buffers at new dpr/size
        const old = trailLayer;
        p.pixelDensity(dpr);
        p.resizeCanvas(w, h);
        trailLayer = p.createGraphics(w, h);
        trailLayer.pixelDensity(p.pixelDensity());
        // draw old trails scaled into the new buffer (will look fine if aspect kept)
        trailLayer.image(old, 0, 0, w, h);

        recomputeDerived();
        createBodies();
      }
    };

    p.draw = () => {
      p.background(bg_col);

      // forces per cell
      for (let i = 0; i < movers.length; i++) {
        for (let j = 0; j < movers[i].length; j++) {
          const cell = movers[i][j];
          const n = cell.length;

          for (let k = 0; k < n; k++) {
            const mover = cell[k];
            mover.acceleration.mult(0);

            const r = p5.Vector.sub(cellCenters[i][j], mover.position);
            const r2 = r.magSq();
            if (r2 > 1e-12) {
              const fk = 1e-4 * mover.mass / Math.max(r2, EPS2);
              // const fk = 1e-5*r2;
              mover.applyForce(r.copy().setMag(fk));
            }
          }

          for (let a = 0; a < n; a++) {
            for (let b = a + 1; b < n; b++) {
              const A = cell[a], B = cell[b];
              const r = p5.Vector.sub(B.position, A.position);
              const r2 = r.magSq(); if (r2 < 1e-12) continue;
              const denom = Math.max(r2, EPS2);
              const fmag  = (G * A.mass * B.mass) / denom;
              const fAB   = r.copy().setMag(fmag);
              A.applyForce(fAB);
              B.applyForce(fAB.copy().mult(-1));
            }
          }
        }
      }

      // integrate + trails
      for (let i = 0; i < movers.length; i++) {
        for (let j = 0; j < movers[i].length; j++) {
          const cell = movers[i][j];
          for (let k = 0; k < cell.length; k++) {
            const m = cell[k];
            m.update();

            trailLayer.stroke(m.col);
            trailLayer.strokeWeight(1);
            trailLayer.line(m.prev.x, m.prev.y, m.position.x, m.position.y);

            m.checkEdges();
          }
        }
      }

      // composite
      p.image(trailLayer, 0, 0);
      for (let i = 0; i < movers.length; i++) {
        for (let j = 0; j < movers[i].length; j++) {
          for (let k = 0; k < movers[i][j].length; k++) {
            movers[i][j][k].show();
          }
        }
      }
    };
  };

  const instance = new window.p5(sketch);

  function unmount() {
    try { instance.remove(); } catch {}
    rootEl.innerHTML = '';
  }
  return { unmount };
}