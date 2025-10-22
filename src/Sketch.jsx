import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import p5 from "p5";

const K = {
  PILL: "PILL",
  HALF: "HALF",
  SQUARE: "SQUARE",
  PIE: "PIE",
  CIRCLE: "CIRCLE",
  BLANK: "BLANK",
};

const Sketch = forwardRef(function Sketch({ onError, onPaletteChosen }, ref) {
  const host = useRef(null);
  const instRef = useRef(null);

  useEffect(() => {
    const sketch = (p) => {
      // Defaults until first .generate()
      p._params = {
        cols: 14,
        rows: 10,
        showGrid: false,
        maxPills: 5,
        maxHalves: 3,
        weights: { pill: 2, half: 2, square: 2, pie: 2, circle: 2, blank: 5 },
        palettes: [
          ["#19224A", "#3F5DB3", "#6C94EC"], // Blue
          ["#082429", "#0D4B3B", "#1EA672"], // Green
          ["#3A1607", "#762B0B", "#D97917"], // Orange
          ["#420000", "#940821", "#E46C63"], // Red
          ["#27103C", "#673C87", "#AE74D8"], // Purple
        ],
        lockPalette: false,
        lockedIndex: 0,
        randomizePalette: true,
        // App can pin an actual palette here for live updates
        forcePalette: null,
        fitToViewport: true,
        maxCanvasWidth: 1280,
      };

      // Grid state
      let CELL = 70;
      let COLS = 14;
      let ROWS = 10;

      // Layout state
      let occ = [];
      let placedTwo = [];
      let placedSingle = [];

      // Colors
      let BG = "#0B0B0B";
      let SHAPE_COLS = ["#999", "#666"];

      const MAX_TRIES = 200;
      const rnd = (n) => (Math.random() * n) | 0;

      // Cache last canvas size to avoid needless resize loops
      let lastCanvasW = 10;
      let lastCanvasH = 10;

      // ---------- SIZING ----------
      function computeCanvasSize() {
        COLS = Math.max(1, p._params.cols | 0);
        ROWS = Math.max(1, p._params.rows | 0);

        const wrap = host.current?.parentElement; // flex center area
        const maxW = Math.min(
          p._params.maxCanvasWidth || 1280,
          wrap?.clientWidth || window.innerWidth
        );

        const availableH = Math.max(
          200,
          Math.floor((wrap?.clientHeight || window.innerHeight) - 24)
        );

        const cellW = Math.floor(maxW / COLS);
        const cellH = Math.floor(availableH / ROWS);
        CELL = Math.max(4, Math.min(cellW, cellH));

        const w = CELL * COLS;
        const h = CELL * ROWS;

        if (p.width !== w || p.height !== h) {
          p.resizeCanvas(w, h);
          lastCanvasW = w;
          lastCanvasH = h;
        }
      }

      const cellX = (c) => c * CELL;
      const cellY = (r) => r * CELL;

      // ---------- PALETTE ----------
      function applyPalette(pal) {
        if (!pal) return;
        BG = pal[0];
        SHAPE_COLS = [pal[1], pal[2]];
      }

      function choosePalette() {
        // If App is forcing a palette, honor it
        if (
          Array.isArray(p._params.forcePalette) &&
          p._params.forcePalette.length === 3
        ) {
          applyPalette(p._params.forcePalette);
          return p._params.forcePalette;
        }

        const list =
          Array.isArray(p._params.palettes) && p._params.palettes.length
            ? p._params.palettes
            : [BG, ...SHAPE_COLS];

        let pal;
        if (!p._params.randomizePalette && p._params.lockPalette) {
          pal = list[p._params.lockedIndex] || list[0];
        } else {
          pal = list[rnd(list.length)];
        }
        applyPalette(pal);
        return pal;
      }

      // ---------- HELPERS ----------
      function shuffle(triples) {
        for (let i = triples.length - 1; i > 0; i--) {
          const j = rnd(i + 1);
          const t = triples[i];
          triples[i] = triples[j];
          triples[j] = t;
        }
      }

      function pickWeightedSingle() {
        const w = p._params.weights || {};
        const kinds = [K.SQUARE, K.PIE, K.CIRCLE, K.BLANK];
        const weights = [
          w.square ?? 2,
          w.pie ?? 2,
          w.circle ?? 2,
          w.blank ?? 5,
        ].map((v) => Math.max(0, v | 0));
        const sum = weights.reduce((a, b) => a + b, 0);
        if (sum <= 0) return K.BLANK;

        let r = rnd(sum),
          cum = 0;
        for (let i = 0; i < kinds.length; i++) {
          cum += weights[i];
          if (r < cum) return kinds[i];
        }
        return kinds[kinds.length - 1];
      }

      // ---------- BUILD ----------
      function build({ keepPalette }) {
        computeCanvasSize();

        if (keepPalette) {
          // If a forcePalette is provided, apply it; else keep current BG/SHAPE_COLS
          if (
            Array.isArray(p._params.forcePalette) &&
            p._params.forcePalette.length === 3
          ) {
            applyPalette(p._params.forcePalette);
          }
        } else {
          const pal = choosePalette();
          if (typeof onPaletteChosen === "function" && pal)
            onPaletteChosen(pal);
        }

        placedTwo = [];
        placedSingle = [];
        occ = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

        placePills();
        placeHalves();
        fillSingles();
        preventThreeInARow();
      }

      function placePills() {
        const cand = [];
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (c + 1 < COLS) cand.push([r, c, 0]); // H
            if (r + 1 < ROWS) cand.push([r, c, 1]); // V
          }
        }
        shuffle(cand);
        let count = 0;
        const wP = p._params.weights?.pill | 0 || 0;
        const wH = p._params.weights?.half | 0 || 0;
        const denom = Math.max(1, wP + wH);

        for (const [r, c, ori] of cand) {
          if (count >= (p._params.maxPills | 0)) break;
          if (rnd(denom) >= wP) continue;

          const r2 = r + (ori === 1 ? 1 : 0);
          const c2 = c + (ori === 0 ? 1 : 0);
          if (!occ[r][c] && !occ[r2][c2]) {
            occ[r][c] = occ[r2][c2] = true;
            placedTwo.push({
              kind: K.PILL,
              r,
              c,
              orientation: ori,
              col: SHAPE_COLS[rnd(SHAPE_COLS.length)],
            });
            count++;
          }
        }
      }

      function placeHalves() {
        const cand = [];
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (c + 1 < COLS) cand.push([r, c, 0]); // H
            if (r + 1 < ROWS) cand.push([r, c, 1]); // V
          }
        }
        shuffle(cand);
        let count = 0;
        const wP = p._params.weights?.pill | 0 || 0;
        const wH = p._params.weights?.half | 0 || 0;
        const denom = Math.max(1, wP + wH);

        for (const [r, c, ori] of cand) {
          if (count >= (p._params.maxHalves | 0)) break;
          if (rnd(denom) >= wH) continue;

          const r2 = r + (ori === 1 ? 1 : 0);
          const c2 = c + (ori === 0 ? 1 : 0);
          if (!occ[r][c] && !occ[r2][c2]) {
            occ[r][c] = occ[r2][c2] = true;
            placedTwo.push({
              kind: K.HALF,
              r,
              c,
              orientation: ori,
              facing: rnd(2),
              col: SHAPE_COLS[rnd(SHAPE_COLS.length)],
            });
            count++;
          }
        }
      }

      function fillSingles() {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (!occ[r][c]) {
              const kind = pickWeightedSingle();
              const s = {
                kind,
                r,
                c,
                col: SHAPE_COLS[rnd(SHAPE_COLS.length)],
              };
              if (kind === K.PIE) s.corner = rnd(4);
              placedSingle.push(s);
              occ[r][c] = true;
            }
          }
        }
      }

      function preventThreeInARow() {
        const get = (rr, cc) =>
          placedSingle.find((s) => s.r === rr && s.c === cc);
        // Horizontal
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c <= COLS - 3; c++) {
            const a = get(r, c),
              b = get(r, c + 1),
              d = get(r, c + 2);
            if (!a || !b || !d) continue;
            if (a.kind !== K.BLANK && a.kind === b.kind && b.kind === d.kind) {
              const pool = [K.SQUARE, K.PIE, K.CIRCLE].filter(
                (k) => k !== a.kind
              );
              d.kind = pool[rnd(pool.length)];
              d.col = SHAPE_COLS[rnd(SHAPE_COLS.length)];
            }
          }
        }
        // Vertical
        for (let c = 0; c < COLS; c++) {
          for (let r = 0; r <= ROWS - 3; r++) {
            const a = get(r, c),
              b = get(r + 1, c),
              d = get(r + 2, c);
            if (!a || !b || !d) continue;
            if (a.kind !== K.BLANK && a.kind === b.kind && b.kind === d.kind) {
              const pool = [K.SQUARE, K.PIE, K.CIRCLE].filter(
                (k) => k !== a.kind
              );
              d.kind = pool[rnd(pool.length)];
              d.col = SHAPE_COLS[rnd(SHAPE_COLS.length)];
            }
          }
        }
      }

      // ---------- BBOX & DRAW ----------
      function computeBBoxes() {
        const boxes = [];
        for (const t of placedTwo) {
          const w = t.orientation === 0 ? 2 * CELL : CELL;
          const h = t.orientation === 0 ? CELL : 2 * CELL;
          boxes.push({ x: cellX(t.c), y: cellY(t.r), w, h });
        }
        for (const s of placedSingle) {
          if (s.kind === K.BLANK) continue;
          boxes.push({ x: cellX(s.c), y: cellY(s.r), w: CELL, h: CELL });
        }
        return boxes;
      }
      const overlap = (a, b) =>
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y;
      function hasOverlap(boxes) {
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            if (overlap(boxes[i], boxes[j])) return true;
          }
        }
        return false;
      }

      function drawGrid() {
        p.push();
        p.stroke(255, 60);
        p.noFill();
        for (let r = 0; r <= ROWS; r++) p.line(0, r * CELL, p.width, r * CELL);
        for (let c = 0; c <= COLS; c++) p.line(c * CELL, 0, c * CELL, p.height);
        p.pop();
      }

      function drawPieAtCellCorner(r, c, corner, col) {
        const gx = p.createGraphics(CELL, CELL);
        gx.noStroke();
        gx.background(0, 0);
        gx.fill(col);
        const diam = 2 * CELL;
        switch (corner) {
          case 0:
            gx.arc(0, 0, diam, diam, 0, p.HALF_PI, p.PIE);
            break; // TL
          case 1:
            gx.arc(CELL, 0, diam, diam, p.HALF_PI, p.PI, p.PIE);
            break; // TR
          case 2:
            gx.arc(CELL, CELL, diam, diam, p.PI, p.PI + p.HALF_PI, p.PIE);
            break; // BR
          case 3:
            gx.arc(0, CELL, diam, diam, p.PI + p.HALF_PI, p.TWO_PI, p.PIE);
            break; // BL
          default:
            break;
        }
        p.image(gx, cellX(c), cellY(r));
      }

      function drawPill(psh) {
        const x = cellX(psh.c),
          y = cellY(psh.r);
        const w = psh.orientation === 0 ? 2 * CELL : CELL;
        const h = psh.orientation === 0 ? CELL : 2 * CELL;

        const g = p.createGraphics(w, h);
        g.noStroke();
        g.background(0, 0);
        g.fill(psh.col);
        g.ellipseMode(p.CENTER);

        if (psh.orientation === 0) {
          const midW = w - CELL;
          g.rect(CELL / 2, 0, midW, h);
          g.ellipse(CELL / 2, h / 2, CELL, CELL);
          g.ellipse(w - CELL / 2, h / 2, CELL, CELL);
        } else {
          const midH = h - CELL;
          g.rect(0, CELL / 2, w, midH);
          g.ellipse(w / 2, CELL / 2, CELL, CELL);
          g.ellipse(w / 2, h - CELL / 2, CELL, CELL);
        }
        p.image(g, x, y);
      }

      const flipLR = (c) => [1, 0, 3, 2][c] ?? c;
      const flipUD = (c) => [3, 2, 1, 0][c] ?? c;

      function drawHalf(psh) {
        const r = psh.r,
          c = psh.c,
          col = psh.col;
        if (psh.orientation === 0) {
          let leftCorner, rightCorner;
          if (psh.facing === 0) {
            leftCorner = 2;
            rightCorner = 0;
          } // LEFT
          else {
            leftCorner = 1;
            rightCorner = 3;
          } // RIGHT
          leftCorner = flipUD(leftCorner);
          drawPieAtCellCorner(r, c, leftCorner, col);
          drawPieAtCellCorner(r, c + 1, rightCorner, col);
        } else {
          let topCorner, bottomCorner;
          if (psh.facing === 0) {
            topCorner = 3;
            bottomCorner = 1;
          } // UP
          else {
            topCorner = 2;
            bottomCorner = 0;
          } // DOWN
          topCorner = flipLR(topCorner);
          drawPieAtCellCorner(r, c, topCorner, col);
          drawPieAtCellCorner(r + 1, c, bottomCorner, col);
        }
      }

      function drawSquare(s) {
        const g = p.createGraphics(CELL, CELL);
        g.noStroke();
        g.background(0, 0);
        g.fill(s.col);
        g.rect(0, 0, CELL, CELL);
        p.image(g, cellX(s.c), cellY(s.r));
      }

      function drawPie(s) {
        drawPieAtCellCorner(s.r, s.c, s.corner, s.col);
      }

      function drawCircle(s) {
        const g = p.createGraphics(CELL, CELL);
        g.noStroke();
        g.background(0, 0);
        g.fill(s.col);
        g.ellipseMode(p.CORNER);
        g.ellipse(0, 0, CELL, CELL);
        p.image(g, cellX(s.c), cellY(s.r));
      }

      function renderAll() {
        p.background(BG);
        for (const t of placedTwo) if (t.kind === K.PILL) drawPill(t);
        for (const t of placedTwo) if (t.kind === K.HALF) drawHalf(t);
        const drawn = Array.from({ length: ROWS }, () =>
          Array(COLS).fill(false)
        );
        for (const s of placedSingle) {
          if (drawn[s.r][s.c]) continue;
          if (s.kind === K.SQUARE) drawSquare(s);
          else if (s.kind === K.PIE) drawPie(s);
          else if (s.kind === K.CIRCLE) drawCircle(s);
          drawn[s.r][s.c] = true;
        }
        if (p._params.showGrid) drawGrid();
      }

      function regenerate({ keepPalette }) {
        try {
          for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
            build({ keepPalette });
            const boxes = computeBBoxes();
            if (!hasOverlap(boxes)) {
              renderAll();
              return true;
            }
          }
          renderAll();
          return true;
        } catch (e) {
          if (typeof onError === "function") onError(e);
          try {
            p.clear();
          } catch (_) {}
          return false;
        }
      }

      // ---------- SVG EXPORT ----------
      function quarterPath(cx, cy, size, corner) {
        const r = size;
        const x0 = corner === 0 || corner === 3 ? cx : cx + r;
        const y0 = corner === 0 || corner === 1 ? cy + r : cy;
        const x1 = corner === 0 || corner === 3 ? cx + r : cx;
        const y1 = corner === 0 || corner === 1 ? cy : cy + r;
        return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} L ${cx} ${cy} Z`;
      }

      function toSVGString() {
        const w = CELL * COLS;
        const h = CELL * ROWS;
        const parts = [];
        parts.push(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
        );
        parts.push(`<rect width="100%" height="100%" fill="${BG}"/>`);

        for (const t of placedTwo) {
          if (t.kind === K.PILL) {
            const x = cellX(t.c),
              y = cellY(t.r);
            const w2 = t.orientation === 0 ? 2 * CELL : CELL;
            const h2 = t.orientation === 0 ? CELL : 2 * CELL;
            const rx = CELL / 2;
            parts.push(
              `<rect x="${x}" y="${y}" width="${w2}" height="${h2}" rx="${rx}" ry="${rx}" fill="${t.col}"/>`
            );
          } else if (t.kind === K.HALF) {
            const r = t.r,
              c = t.c,
              col = t.col;
            if (t.orientation === 0) {
              let leftCorner = t.facing === 0 ? 2 : 1;
              let rightCorner = t.facing === 0 ? 0 : 3;
              leftCorner = [3, 2, 1, 0][leftCorner]; // flipUD
              parts.push(
                `<path d="${quarterPath(cellX(c), cellY(r), CELL, leftCorner)}" fill="${col}"/>`
              );
              parts.push(
                `<path d="${quarterPath(cellX(c + 1), cellY(r), CELL, rightCorner)}" fill="${col}"/>`
              );
            } else {
              let topCorner = t.facing === 0 ? 3 : 2;
              let bottomCorner = t.facing === 0 ? 1 : 0;
              topCorner = [1, 0, 3, 2][topCorner]; // flipLR
              parts.push(
                `<path d="${quarterPath(cellX(c), cellY(r), CELL, topCorner)}" fill="${col}"/>`
              );
              parts.push(
                `<path d="${quarterPath(cellX(c), cellY(r + 1), CELL, bottomCorner)}" fill="${col}"/>`
              );
            }
          }
        }

        for (const s of placedSingle) {
          if (s.kind === K.BLANK) continue;
          const x = cellX(s.c),
            y = cellY(s.r);
          if (s.kind === K.SQUARE) {
            parts.push(
              `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${s.col}"/>`
            );
          } else if (s.kind === K.CIRCLE) {
            const r = CELL / 2;
            parts.push(
              `<circle cx="${x + r}" cy="${y + r}" r="${r}" fill="${s.col}"/>`
            );
          } else if (s.kind === K.PIE) {
            parts.push(
              `<path d="${quarterPath(x, y, CELL, s.corner)}" fill="${s.col}"/>`
            );
          }
        }

        if (p._params.showGrid) {
          for (let r = 0; r <= ROWS; r++)
            parts.push(
              `<line x1="0" y1="${r * CELL}" x2="${w}" y2="${r * CELL}" stroke="rgba(255,255,255,0.24)" stroke-width="1"/>`
            );
          for (let c = 0; c <= COLS; c++)
            parts.push(
              `<line x1="${c * CELL}" y1="0" x2="${c * CELL}" y2="${h}" stroke="rgba(255,255,255,0.24)" stroke-width="1"/>`
            );
        }

        parts.push(`</svg>`);
        return parts.join("");
      }

      function downloadSVG(filename = "composition.svg") {
        const svg = toSVGString();
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      // ---------- P5 LIFECYCLE ----------
      p.setup = () => {
        p.pixelDensity(2);
        p.createCanvas(lastCanvasW, lastCanvasH);
        p.noLoop();
        regenerate({ keepPalette: false }); // initial can randomize
      };

      p.updateParamsOnly = (newParams) => {
        p._params = { ...p._params, ...newParams };
        // computeCanvasSize() is called inside regenerate
      };

      p.generateNow = (opts = { keepPalette: false }) => regenerate(opts);
      p.exportSVGNow = () => downloadSVG();
    };

    const inst = new p5(sketch, host.current);
    instRef.current = inst;

    // Handle window resize here with rAF throttle and keep the current palette
    let resizeScheduled = false;
    const onResize = () => {
      if (resizeScheduled) return;
      resizeScheduled = true;
      requestAnimationFrame(() => {
        resizeScheduled = false;
        const i = instRef.current;
        if (!i) return;
        // Reuse current params; keep palette to prevent randomization
        i.updateParamsOnly(i._params);
        i.generateNow({ keepPalette: true });
      });
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      instRef.current?.remove();
      instRef.current = null;
    };
  }, [onError, onPaletteChosen]);

  // Imperative API for parent
  useImperativeHandle(
    ref,
    () => ({
      generate: (params, options = { keepPalette: false }) => {
        const inst = instRef.current;
        if (!inst) return;
        inst.updateParamsOnly(params);
        inst.generateNow(options);
      },
      exportSVG: () => instRef.current?.exportSVGNow(),
    }),
    []
  );

  return (
    <div
      ref={host}
      className="w-full h-full flex items-center justify-center"
    />
  );
});

export default Sketch;
