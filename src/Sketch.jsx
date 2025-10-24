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

  // keep latest callbacks
  const onErrorRef = useRef(onError);
  const onPaletteChosenRef = useRef(onPaletteChosen);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    onPaletteChosenRef.current = onPaletteChosen;
  }, [onPaletteChosen]);

  useEffect(() => {
    const sketch = (p) => {
      // ---------- PARAMS ----------
      p._params = {
        cols: 14,
        rows: 10,
        showGrid: false,
        maxPills: 5,
        maxHalves: 3,
        weights: { pill: 2, half: 2, square: 2, pie: 2, circle: 2, blank: 5 },
        palettes: [
          ["#19224A", "#3F5DB3", "#6C94EC"],
          ["#082429", "#0D4B3B", "#1EA672"],
          ["#3A1607", "#762B0B", "#D97917"],
          ["#420000", "#940821", "#E46C63"],
          ["#27103C", "#673C87", "#AE74D8"],
        ],
        lockPalette: false,
        lockedIndex: 0,
        randomizePalette: true,
        forcePalette: null,
        fitToViewport: true,
        maxCanvasWidth: 1280,
      };

      // ---------- STATE ----------
      let CELL = 70;
      let COLS = 14;
      let ROWS = 10;

      let occ = [];
      let placedTwo = [];
      let placedSingle = [];

      let BG = "#0B0B0B";
      let SHAPE_COLS = ["#999", "#666"];

      const MAX_TRIES = 200;
      const rnd = (n) => (Math.random() * n) | 0;

      let lastTargetW = 0;
      let lastTargetH = 0;
      let isRendering = false;

      // ---------- SIZING ----------
      function measureWrapper() {
        const wrap = host.current?.parentElement;

        // Width: respect maxCanvasWidth as before
        const wrapW = Math.floor(
          Math.min(
            p._params.maxCanvasWidth || 1280,
            wrap?.clientWidth || window.innerWidth
          )
        );

        // Height: fill available viewport but never exceed 900px
        const hostTop = host.current
          ? host.current.getBoundingClientRect().top
          : 0;
        const availableH = Math.max(
          200,
          Math.floor(window.innerHeight - hostTop - 24) // minus padding margin
        );

        const wrapH = Math.min(availableH, 1200);
        return { wrapW, wrapH };
      }

      function computeTargetSize() {
        COLS = Math.max(1, p._params.cols | 0);
        ROWS = Math.max(1, p._params.rows | 0);

        const { wrapW, wrapH } = measureWrapper();
        const cellW = Math.floor(wrapW / COLS);
        const cellH = Math.floor(wrapH / ROWS);

        CELL = Math.max(4, Math.min(cellW, cellH));

        const targetW = CELL * COLS;
        const targetH = CELL * ROWS;

        return { targetW, targetH };
      }

      function computeTargetSize() {
        COLS = Math.max(1, p._params.cols | 0);
        ROWS = Math.max(1, p._params.rows | 0);
        const { wrapW, wrapH } = measureWrapper();
        const cellW = Math.floor(wrapW / COLS);
        const cellH = Math.floor(wrapH / ROWS);
        CELL = Math.max(4, Math.min(cellW, cellH));
        const targetW = CELL * COLS;
        const targetH = CELL * ROWS;
        return { targetW, targetH };
      }

      function applySizeIfNeeded() {
        const { targetW, targetH } = computeTargetSize();
        const changed = targetW !== lastTargetW || targetH !== lastTargetH;
        lastTargetW = targetW;
        lastTargetH = targetH;
        if (p.width !== targetW || p.height !== targetH) {
          p.resizeCanvas(targetW, targetH);
          return true;
        }
        return changed;
      }

      const cellX = (c) => c * CELL;
      const cellY = (r) => r * CELL;

      // --- PALETTE ---
      function applyPalette(pal) {
        if (!pal) return;
        BG = pal[0];
        SHAPE_COLS = [pal[1], pal[2]];
      }

      // Only decide locked vs random. DO NOT read forcePalette here.
      function choosePaletteRandomOrLocked() {
        const list =
          Array.isArray(p._params.palettes) && p._params.palettes.length
            ? p._params.palettes
            : [BG, ...SHAPE_COLS];

        let pal;
        if (!p._params.randomizePalette && p._params.lockPalette) {
          pal = list[p._params.lockedIndex] || list[0];
        } else {
          pal = list[Math.floor(Math.random() * list.length)];
        }
        applyPalette(pal);
        return pal;
      }

      function choosePalette() {
        // use forced palette during live updates
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
      function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = rnd(i + 1);
          [arr[i], arr[j]] = [arr[j], arr[i]];
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

      // ---------- REUSABLE BUFFERS ----------
      let bufCell = null; // CELL × CELL
      let bufH2 = null; // 2CELL × CELL
      let bufV2 = null; // CELL × 2CELL

      function ensureBuffers() {
        const W = Math.max(1, CELL);
        const H = W;
        if (!bufCell || bufCell.width !== W || bufCell.height !== H) {
          try {
            bufCell?.remove?.();
          } catch (_) {}
          bufCell = p.createGraphics(W, H);
        }
        if (!bufH2 || bufH2.width !== 2 * W || bufH2.height !== H) {
          try {
            bufH2?.remove?.();
          } catch (_) {}
          bufH2 = p.createGraphics(2 * W, H);
        }
        if (!bufV2 || bufV2.width !== W || bufV2.height !== 2 * H) {
          try {
            bufV2?.remove?.();
          } catch (_) {}
          bufV2 = p.createGraphics(W, 2 * H);
        }
      }

      // ---------- BUILD ----------
      function build({ keepPalette }) {
        applySizeIfNeeded();

        if (
          keepPalette &&
          Array.isArray(p._params.forcePalette) &&
          p._params.forcePalette.length === 3
        ) {
          // stick with the last palette while resizing / live edits
          applyPalette(p._params.forcePalette);
        } else {
          // pick locked or random; report it back so React can “stick” it for next live edits
          const pal = choosePaletteRandomOrLocked();
          onPaletteChosenRef.current?.(pal);
        }

        placedTwo = [];
        placedSingle = [];
        occ = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

        placeTwoCellShapes();
        fillSingles();
        preventThreeInARow();
      }

      // unified two-cell placement to avoid overlaps
      function placeTwoCellShapes() {
        const pairs = [];
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (c + 1 < COLS) pairs.push({ r, c, orientation: 0 });
            if (r + 1 < ROWS) pairs.push({ r, c, orientation: 1 });
          }
        }
        shuffle(pairs);

        const wP = p._params.weights?.pill | 0 || 0;
        const wH = p._params.weights?.half | 0 || 0;
        const denom = Math.max(1, wP + wH);

        let pillCount = 0;
        let halfCount = 0;
        const maxP = p._params.maxPills | 0;
        const maxH = p._params.maxHalves | 0;

        for (const pair of pairs) {
          if (pillCount >= maxP && halfCount >= maxH) break;

          const { r, c, orientation } = pair;
          const r2 = r + (orientation === 1 ? 1 : 0);
          const c2 = c + (orientation === 0 ? 1 : 0);
          if (occ[r][c] || occ[r2][c2]) continue;

          const pick = rnd(denom);
          const choosePill = pick < wP;

          if (choosePill && pillCount < maxP) {
            occ[r][c] = occ[r2][c2] = true;
            placedTwo.push({
              kind: K.PILL,
              r,
              c,
              orientation,
              col: SHAPE_COLS[rnd(SHAPE_COLS.length)],
            });
            pillCount++;
          } else if (!choosePill && halfCount < maxH) {
            occ[r][c] = occ[r2][c2] = true;
            placedTwo.push({
              kind: K.HALF,
              r,
              c,
              orientation,
              facing: rnd(2),
              col: SHAPE_COLS[rnd(SHAPE_COLS.length)],
            });
            halfCount++;
          }
        }
      }

      function fillSingles() {
        const singlesByKey = new Map();
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (!occ[r][c]) {
              const kind = pickWeightedSingle();
              const s = { kind, r, c, col: SHAPE_COLS[rnd(SHAPE_COLS.length)] };
              if (kind === K.PIE) s.corner = rnd(4);
              const k = `${r},${c}`;
              if (!singlesByKey.has(k)) {
                singlesByKey.set(k, s);
                occ[r][c] = true;
              }
            }
          }
        }
        placedSingle = Array.from(singlesByKey.values());
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

      // ---------- DRAW ----------
      function drawGrid() {
        p.push();
        p.stroke(255, 60);
        p.noFill();
        for (let r = 0; r <= ROWS; r++) p.line(0, r * CELL, p.width, r * CELL);
        for (let c = 0; c <= COLS; c++) p.line(c * CELL, 0, c * CELL, p.height);
        p.pop();
      }

      function drawPieAtCellCorner(r, c, corner, col) {
        const gx = bufCell; // CELL×CELL off-screen buffer
        gx.clear();
        gx.noStroke();
        gx.fill(col);

        const ctx = gx.drawingContext; // native CanvasRenderingContext2D
        const R = CELL; // radius
        // centers at the cell's corners (same as SVG export)
        const centers = [
          [0, 0], // 0: TL  -> fill lower-right
          [CELL, 0], // 1: TR  -> fill lower-left
          [CELL, CELL], // 2: BR  -> fill upper-left
          [0, CELL], // 3: BL  -> fill upper-right
        ];
        // start/end angles in radians (0 at +X, increasing clockwise in canvas)
        const angles = [
          [0, Math.PI / 2], // TL  (→ down)
          [Math.PI / 2, Math.PI], // TR
          [Math.PI, (3 * Math.PI) / 2], // BR
          [(3 * Math.PI) / 2, Math.PI * 2], // BL
        ];

        const [cx, cy] = centers[corner] || centers[0];
        const [a0, a1] = angles[corner] || angles[0];

        // Use the off-screen context to draw a triangle-fan wedge (center → arc → close)
        ctx.save();
        // ensure fill color matches gx.fill(col)
        // p5 already set the fillStyle; no extra work needed
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a0, a1, false);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Blit the buffer at the cell origin
        p.image(gx, c * CELL, r * CELL);
      }

      function drawPill(psh) {
        const x = cellX(psh.c),
          y = cellY(psh.r);
        const horiz = psh.orientation === 0;
        const g = horiz ? bufH2 : bufV2;
        g.clear();
        g.noStroke();
        g.fill(psh.col);
        if (horiz) g.rect(0, 0, 2 * CELL, CELL, CELL / 2);
        else g.rect(0, 0, CELL, 2 * CELL, CELL / 2);
        p.image(g, x, y);
      }

      const flipLR = (c) => [1, 0, 3, 2][c] ?? c;
      const flipUD = (c) => [3, 2, 1, 0][c] ?? c;

      function drawHalf(psh) {
        const r = psh.r,
          c = psh.c,
          col = psh.col;
        if (psh.orientation === 0) {
          let leftCorner = psh.facing === 0 ? 2 : 1;
          let rightCorner = psh.facing === 0 ? 0 : 3;
          leftCorner = flipUD(leftCorner);
          drawPieAtCellCorner(r, c, leftCorner, col);
          drawPieAtCellCorner(r, c + 1, rightCorner, col);
        } else {
          let topCorner = psh.facing === 0 ? 3 : 2;
          let bottomCorner = psh.facing === 0 ? 1 : 0;
          topCorner = flipLR(topCorner);
          drawPieAtCellCorner(r, c, topCorner, col);
          drawPieAtCellCorner(r + 1, c, bottomCorner, col);
        }
      }

      function drawSquare(s) {
        const gx = bufCell;
        gx.clear();
        gx.noStroke();
        gx.fill(s.col);
        gx.rect(0, 0, CELL, CELL);
        p.image(gx, cellX(s.c), cellY(s.r));
      }

      function drawPie(s) {
        drawPieAtCellCorner(s.r, s.c, s.corner, s.col);
      }

      function drawCircle(s) {
        const gx = bufCell;
        gx.clear();
        gx.noStroke();
        gx.fill(s.col);
        gx.ellipseMode(p.CORNER);
        gx.ellipse(0, 0, CELL, CELL);
        p.image(gx, cellX(s.c), cellY(s.r));
      }

      function renderAll() {
        ensureBuffers();
        p.background(BG);
        // two-cell first
        for (const t of placedTwo) if (t.kind === K.PILL) drawPill(t);
        for (const t of placedTwo) if (t.kind === K.HALF) drawHalf(t);
        // singles (draw safety: skip duplicates)
        const drawn = Array.from({ length: ROWS }, () =>
          Array(COLS).fill(false)
        );
        for (const s of placedSingle) {
          if (!s) continue;
          if (s.r < 0 || s.r >= ROWS || s.c < 0 || s.c >= COLS) continue;
          if (drawn[s.r][s.c]) continue;
          if (s.kind === K.SQUARE) drawSquare(s);
          else if (s.kind === K.PIE) drawPie(s);
          else if (s.kind === K.CIRCLE) drawCircle(s);
          drawn[s.r][s.c] = true;
        }
        if (p._params.showGrid) drawGrid();
      }

      function regenerate({ keepPalette }) {
        if (isRendering) return false;
        isRendering = true;
        try {
          applySizeIfNeeded();
          for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
            build({ keepPalette });
            const boxes = computeBBoxes();
            if (!hasOverlap(boxes)) {
              renderAll();
              isRendering = false;
              return true;
            }
          }
          renderAll();
          isRendering = false;
          return true;
        } catch (e) {
          onErrorRef.current?.(e);
          try {
            p.clear();
          } catch (_) {}
          isRendering = false;
          return false;
        }
      }

      // ---------- BBOX for two-cell safety (singles are per-cell) ----------
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

      // ---------- SVG EXPORT (clip with circle at SAME corner) ----------
      let svgIdCounter = 0;
      function uid(prefix = "id_") {
        svgIdCounter += 1;
        return `${prefix}${svgIdCounter}`;
      }

      function emitQuarterWithClip(x, y, size, corner, fill, defsOut, bodyOut) {
        const r = size;
        const centers = [
          [x, y], // TL
          [x + r, y], // TR
          [x + r, y + r], // BR
          [x, y + r], // BL
        ];
        const [cx, cy] = centers[corner] || centers[0];
        const clipId = uid("qclip_");
        defsOut.push(
          `<clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`
        );
        bodyOut.push(
          `<rect x="${x}" y="${y}" width="${r}" height="${r}" fill="${fill}" clip-path="url(#${clipId})"/>`
        );
      }

      function toSVGString() {
        const { targetW, targetH } = computeTargetSize();
        const defs = [];
        const body = [];

        const parts = [];
        parts.push(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${targetW}" height="${targetH}" viewBox="0 0 ${targetW} ${targetH}">`
        );
        parts.push(`<rect width="100%" height="100%" fill="${BG}"/>`);

        // Pills
        for (const t of placedTwo) {
          if (t.kind !== K.PILL) continue;
          const x = cellX(t.c),
            y = cellY(t.r);
          const w2 = t.orientation === 0 ? 2 * CELL : CELL;
          const h2 = t.orientation === 0 ? CELL : 2 * CELL;
          const rx = CELL / 2;
          body.push(
            `<rect x="${x}" y="${y}" width="${w2}" height="${h2}" rx="${rx}" ry="${rx}" fill="${t.col}"/>`
          );
        }

        // Halves -> two clipped quarters
        for (const t of placedTwo) {
          if (t.kind !== K.HALF) continue;
          const r = t.r,
            c = t.c,
            col = t.col;
          if (t.orientation === 0) {
            let leftCorner = t.facing === 0 ? 2 : 1;
            let rightCorner = t.facing === 0 ? 0 : 3;
            leftCorner = [3, 2, 1, 0][leftCorner]; // flipUD
            emitQuarterWithClip(
              cellX(c),
              cellY(r),
              CELL,
              leftCorner,
              col,
              defs,
              body
            );
            emitQuarterWithClip(
              cellX(c + 1),
              cellY(r),
              CELL,
              rightCorner,
              col,
              defs,
              body
            );
          } else {
            let topCorner = t.facing === 0 ? 3 : 2;
            let bottomCorner = t.facing === 0 ? 1 : 0;
            topCorner = [1, 0, 3, 2][topCorner]; // flipLR
            emitQuarterWithClip(
              cellX(c),
              cellY(r),
              CELL,
              topCorner,
              col,
              defs,
              body
            );
            emitQuarterWithClip(
              cellX(c),
              cellY(r + 1),
              CELL,
              bottomCorner,
              col,
              defs,
              body
            );
          }
        }

        // Singles
        for (const s of placedSingle) {
          if (s.kind === K.BLANK) continue;
          const x = cellX(s.c),
            y = cellY(s.r);
          if (s.kind === K.SQUARE) {
            body.push(
              `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${s.col}"/>`
            );
          } else if (s.kind === K.CIRCLE) {
            const r = CELL / 2;
            body.push(
              `<circle cx="${x + r}" cy="${y + r}" r="${r}" fill="${s.col}"/>`
            );
          } else if (s.kind === K.PIE) {
            emitQuarterWithClip(x, y, CELL, s.corner, s.col, defs, body);
          }
        }

        if (p._params.showGrid) {
          for (let r = 0; r <= ROWS; r++)
            body.push(
              `<line x1="0" y1="${r * CELL}" x2="${targetW}" y2="${r * CELL}" stroke="rgba(255,255,255,0.24)" stroke-width="1"/>`
            );
          for (let c = 0; c <= COLS; c++)
            body.push(
              `<line x1="${c * CELL}" y1="0" x2="${c * CELL}" y2="${targetH}" stroke="rgba(255,255,255,0.24)" stroke-width="1"/>`
            );
        }

        if (defs.length) parts.push(`<defs>${defs.join("")}</defs>`);
        parts.push(body.join(""));
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
        // Cap DPI for stability across browsers/raspi
        const pd = Math.min(window.devicePixelRatio || 1, 2);
        p.pixelDensity(pd);
        const cnv = p.createCanvas(10, 10);
        cnv.parent(host.current);
        cnv.elt.style.display = "block";
        p.noLoop();
        regenerate({ keepPalette: false }); // initial render (may randomize)
      };

      p.updateParamsOnly = (newParams) => {
        p._params = { ...p._params, ...newParams };
      };
      p.generateNow = (opts = { keepPalette: false }) => regenerate(opts);
      p.exportSVGNow = () => downloadSVG();
    };

    const inst = new p5(sketch, host.current);
    instRef.current = inst;

    // Debounced window resize (keep current palette)
    let rafId = null;
    let debounceId = null;
    const onWindowResize = () => {
      const i = instRef.current;
      if (!i) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (debounceId) clearTimeout(debounceId);
        debounceId = setTimeout(() => {
          const j = instRef.current;
          if (!j) return;
          j.generateNow({ keepPalette: true });
        }, 150);
      });
    };
    window.addEventListener("resize", onWindowResize);

    return () => {
      window.removeEventListener("resize", onWindowResize);
      // dispose graphics buffers (they live inside the p5 sketch scope)
      try {
        instRef.current?.remove();
      } catch (_) {}
      instRef.current = null;
    };
  }, []);

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
