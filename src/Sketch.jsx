// src/Sketch.jsx
import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";

function isRaspi() {
  const ua = (navigator.userAgent || "").toLowerCase();
  return ua.includes("raspi") || ua.includes("armv8") || ua.includes("aarch64");
}

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

  // Keep latest callbacks without remounting p5
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
          ["#19224A", "#3F5DB3", "#6C94EC"], // Blue
          ["#082429", "#0D4B3B", "#1EA672"], // Green
          ["#3A1607", "#762B0B", "#D97917"], // Orange
          ["#420000", "#940821", "#E46C63"], // Red
          ["#27103C", "#673C87", "#AE74D8"], // Purple
        ],
        lockPalette: false,
        lockedIndex: 0,
        randomizePalette: true,
        // When set (by App), stick to this exact palette during live updates
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

      // caches/guards
      let lastTargetW = 0;
      let lastTargetH = 0;
      let isRendering = false;

      // --- Reusable p5.Graphics cache (max 3 buffers) ---
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

      // ---------- SIZING ----------
      function measureWrapper() {
        const wrap = host.current?.parentElement;
        const wrapW = Math.floor(
          Math.min(p._params.maxCanvasWidth || 1280, wrap?.clientWidth || 0)
        );
        const wrapH = Math.max(200, Math.floor(wrap?.clientHeight || 0));
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

      // ---------- PALETTE ----------
      function applyPalette(pal) {
        if (!pal) return;
        BG = pal[0];
        SHAPE_COLS = [pal[1], pal[2]];
      }

      function choosePalette() {
        // Forced palette: used during live layout changes
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

      // ---------- BUILD ----------
      function build({ keepPalette }) {
        applySizeIfNeeded();

        if (keepPalette) {
          if (
            Array.isArray(p._params.forcePalette) &&
            p._params.forcePalette.length === 3
          ) {
            applyPalette(p._params.forcePalette);
          }
        } else {
          const pal = choosePalette();
          onPaletteChosenRef.current?.(pal);
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
        // Enforce uniqueness per cell, even if something upstream misflags occ[].
        const singlesByKey = new Map(); // "r,c" -> shape
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (!occ[r][c]) {
              const kind = pickWeightedSingle();
              const s = { kind, r, c, col: SHAPE_COLS[rnd(SHAPE_COLS.length)] };
              if (kind === K.PIE) s.corner = rnd(4);
              const k = `${r},${c}`;
              if (!singlesByKey.has(k)) {
                singlesByKey.set(k, s);
                occ[r][c] = true; // mark occupied once
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

      // ---------- BBOX ----------
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

      // ---------- DRAW ----------
      function drawGrid() {
        p.push();
        p.stroke(255, 60);
        p.noFill();
        for (let r = 0; r <= ROWS; r++) p.line(0, r * CELL, p.width, r * CELL);
        for (let c = 0; c <= COLS; c++) p.line(c * CELL, 0, c * CELL, p.height);
        p.pop();
      }

      // CELL-sized cache; call ensureBuffers() before rendering
      function drawPieAtCellCorner(r, c, corner, col) {
        const gx = bufCell; // CELL × CELL off-screen
        gx.clear();
        gx.noStroke();
        gx.fill(col);

        // Radius = CELL, diameter = 2*CELL; center sits on the cell corner.
        const diam = 2 * CELL;

        switch (corner) {
          case 0: // TL (center at 0,0) -> fill BR quadrant of the circle
            gx.arc(0, 0, diam, diam, 0, p.HALF_PI, p.PIE);
            break;
          case 1: // TR (center at CELL,0) -> fill BL quadrant
            gx.arc(CELL, 0, diam, diam, p.HALF_PI, p.PI, p.PIE);
            break;
          case 2: // BR (center at CELL,CELL) -> fill UL quadrant
            gx.arc(CELL, CELL, diam, diam, p.PI, p.PI + p.HALF_PI, p.PIE);
            break;
          case 3: // BL (center at 0,CELL) -> fill UR quadrant
            gx.arc(0, CELL, diam, diam, p.PI + p.HALF_PI, p.TWO_PI, p.PIE);
            break;
        }

        // Blit at the cell origin — **no +/- CELL offsets here**
        p.image(gx, c * CELL, r * CELL);
      }

      function drawPill(psh) {
        const x = cellX(psh.c),
          y = cellY(psh.r);
        const w = psh.orientation === 0 ? 2 * CELL : CELL;
        const h = psh.orientation === 0 ? CELL : 2 * CELL;

        p.noStroke();
        p.fill(psh.col);
        // Rounded-rect pill: radius = CELL/2 matches the p5.Graphics version
        p.rect(x, y, w, h, CELL / 2);
      }

      const flipLR = (c) => [1, 0, 3, 2][c] ?? c;
      const flipUD = (c) => [3, 2, 1, 0][c] ?? c;

      function drawHalf(psh) {
        const r = psh.r,
          c = psh.c,
          col = psh.col;

        if (psh.orientation === 0) {
          // horizontal: (r,c) + (r,c+1)
          let leftCorner = psh.facing === 0 ? 2 : 1; // BR or TR
          let rightCorner = psh.facing === 0 ? 0 : 3; // TL or BL
          leftCorner = flipUD(leftCorner); // same as SVG export logic
          drawPieAtCellCorner(r, c, leftCorner, col);
          drawPieAtCellCorner(r, c + 1, rightCorner, col);
        } else {
          // vertical: (r,c) + (r+1,c)
          let topCorner = psh.facing === 0 ? 3 : 2; // BL or BR
          let bottomCorner = psh.facing === 0 ? 1 : 0; // TR or TL
          topCorner = flipLR(topCorner); // same as SVG export logic
          drawPieAtCellCorner(r, c, topCorner, col);
          drawPieAtCellCorner(r + 1, c, bottomCorner, col);
        }
      }

      function drawSquare(s) {
        const x = cellX(s.c),
          y = cellY(s.r);
        p.noStroke();
        p.fill(s.col);
        p.rect(x, y, CELL, CELL);
      }

      function drawPie(s) {
        drawPieAtCellCorner(s.r, s.c, s.corner, s.col);
      }

      function drawCircle(s) {
        const x = cellX(s.c),
          y = cellY(s.r);
        p.noStroke();
        p.fill(s.col);
        p.ellipseMode(p.CORNER);
        p.ellipse(x, y, CELL, CELL);
      }

      function renderAll() {
        ensureBuffers(); // keeps bufCell/bufH2/bufV2 in sync with CELL
        p.background(BG);

        for (const t of placedTwo) if (t.kind === K.PILL) drawPill(t);
        for (const t of placedTwo) if (t.kind === K.HALF) drawHalf(t);
        // singles (extra safety: skip if a duplicate sneaks in)
        const drawn = Array.from({ length: ROWS }, () =>
          Array(COLS).fill(false)
        );
        for (const s of placedSingle) {
          if (s.r < 0 || s.r >= ROWS || s.c < 0 || s.c >= COLS) continue;
          if (drawn[s.r][s.c]) continue;
          if (s.kind === K.SQUARE) drawSquare(s);
          else if (s.kind === K.PIE) drawPie(s);
          else if (s.kind === K.CIRCLE) drawCircle(s);
          drawn[s.r][s.c] = true;
        }
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

      // ---------- SVG EXPORT (quarter tiles via clip paths) ----------
      let svgIdCounter = 0;
      function uid(prefix = "id_") {
        svgIdCounter += 1;
        return `${prefix}${svgIdCounter}`;
      }

      // Emits a <clipPath> with a circle centered at the *opposite* corner of the cell,
      // then draws a cell rect clipped to that circle (exact quarter-disk).
      // corner: 0=TL,1=TR,2=BR,3=BL (same as drawPieAtCellCorner)
      function emitQuarterWithClip(x, y, size, corner, fill, defsOut, bodyOut) {
        const r = size;

        // Opposite-corner centers (matches p5 arc centers with diam=2*CELL)
        // Center on the SAME corner (matches p5 drawPieAtCellCorner)
        const centers = [
          [x, y], // 0: TL
          [x + r, y], // 1: TR
          [x + r, y + r], // 2: BR
          [x, y + r], // 3: BL
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

        // Halves (as two clipped quarters)
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

        // Optional grid
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
        const cnv = p.createCanvas(10, 10);
        // Ensure canvas sits in our host (not <body>)
        cnv.parent(host.current);
        cnv.elt.style.display = "block";
        p.noLoop();
        regenerate({ keepPalette: false }); // initial render (may randomize)

        const pd = isRaspi() ? 1 : Math.min(window.devicePixelRatio || 1, 2);
        p.pixelDensity(pd);
      };

      // External (React) bridge
      p.updateParamsOnly = (newParams) => {
        p._params = { ...p._params, ...newParams };
      };
      p.generateNow = (opts = { keepPalette: false }) => regenerate(opts);
      p.exportSVGNow = () => downloadSVG();
    };

    const inst = new p5(sketch, host.current);
    instRef.current = inst;

    // Debounced window resize (keeps current palette)
    let rafId = null;
    let debounceId = null;
    const onWindowResize = () => {
      if (!instRef.current) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (debounceId) clearTimeout(debounceId);
        debounceId = setTimeout(() => {
          const i = instRef.current;
          if (!i) return;
          i.generateNow({ keepPalette: true });
        }, 150);
      });
    };

    window.addEventListener("resize", onWindowResize);

    return () => {
      window.removeEventListener("resize", onWindowResize);
      // dispose off-screen buffers safely
      try {
        bufCell?.remove?.();
      } catch (_) {}
      try {
        bufH2?.remove?.();
      } catch (_) {}
      try {
        bufV2?.remove?.();
      } catch (_) {}
      bufCell = bufH2 = bufV2 = null;

      instRef.current?.remove();
      instRef.current = null;
      if (rafId) cancelAnimationFrame(rafId);
      if (debounceId) clearTimeout(debounceId);
    };
  }, []); // mount p5 once

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
