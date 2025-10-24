import React, { useState, useCallback, useRef } from "react";
import Sketch from "./Sketch.jsx";

const Field = ({ label, children }) => (
  <div className="space-y-1">
    <label className="block text-xs font-medium text-zinc-300">{label}</label>
    {children}
  </div>
);

const Num = (props) => (
  <input
    type="number"
    {...props}
    className="hs-input w-full rounded-md bg-zinc-900/60 border border-zinc-700/60 px-2 py-1 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
  />
);

const Switch = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
      checked ? "bg-emerald-500" : "bg-zinc-700"
    }`}
    aria-pressed={checked}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
        checked ? "translate-x-4" : "translate-x-1"
      }`}
    />
  </button>
);

export default function App() {
  // Grid controls
  const [cols, setCols] = useState(14);
  const [rows, setRows] = useState(10);

  const [showGrid, setShowGrid] = useState(false);

  // Two-cell limits
  const [maxPills, setMaxPills] = useState(5);
  const [maxHalves, setMaxHalves] = useState(3);

  // Weights
  const [wPill, setWPill] = useState(2);
  const [wHalf, setWHalf] = useState(2);
  const [wSquare, setWSquare] = useState(2);
  const [wPie, setWPie] = useState(2);
  const [wCircle, setWCircle] = useState(2);
  const [wBlank, setWBlank] = useState(5);

  // Palette UI state
  const palettes = [
    ["#19224A", "#3F5DB3", "#6C94EC"], // Blue
    ["#082429", "#0D4B3B", "#1EA672"], // Green
    ["#3A1607", "#762B0B", "#D97917"], // Orange
    ["#420000", "#940821", "#E46C63"], // Red
    ["#27103C", "#673C87", "#AE74D8"], // Purple
  ];
  const [lockPalette, setLockPalette] = useState(false);
  const [lockedIndex, setLockedIndex] = useState(0);
  const [randomizePalette, setRandomizePalette] = useState(true); // replaced in UI with "Random" card
  const [forcedPalette, setForcedPalette] = useState(null); // set by Sketch on generate, reused on live resize/edits

  const [fatalError, setFatalError] = useState(null);

  const resetGrid = useCallback(() => {
    setCols(14);
    setRows(10);
  }, []);

  const sketchRef = useRef(null);

  // Build final param bag for Sketch
  const buildParams = useCallback(
    (overrides = {}) => ({
      cols,
      rows,
      showGrid,
      maxPills,
      maxHalves,
      weights: {
        pill: wPill,
        half: wHalf,
        square: wSquare,
        pie: wPie,
        circle: wCircle,
        blank: wBlank,
      },
      palettes,
      lockPalette,
      lockedIndex,
      randomizePalette,
      forcePalette: forcedPalette, // stick during live updates
      fitToViewport: true,
      maxCanvasWidth: 1280,
      ...overrides,
    }),
    [
      cols,
      rows,
      showGrid,
      maxPills,
      maxHalves,
      wPill,
      wHalf,
      wSquare,
      wPie,
      wCircle,
      wBlank,
      palettes,
      lockPalette,
      lockedIndex,
      randomizePalette,
      forcedPalette,
    ]
  );

  // Real-time updates for rows/cols keep palette
  const liveUpdate = useCallback(
    (next) => {
      const p = buildParams(next);
      sketchRef.current?.generate(p, { keepPalette: true });
    },
    [buildParams]
  );

  // Generate (re-randomizes unless locked)
  const handleGenerate = () => {
    setFatalError(null);

    // If Random is selected (not locked), clear the sticky palette first
    if (!lockPalette && randomizePalette) {
      setForcedPalette(null);
    }

    const p = buildParams({});
    sketchRef.current?.generate(p, { keepPalette: false });
  };

  const handleExport = () => {
    sketchRef.current?.exportSVG();
  };

  const onSketchError = useCallback((e) => {
    console.error(e);
    setFatalError(e?.message || "Render error");
  }, []);

  const onPaletteChosen = useCallback((pal) => {
    // Keep this palette while live editing / resizing
    setForcedPalette(pal);
  }, []);

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[380px_1fr] bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold">Grid Shapes Generator</h1>
            <p className="text-xs text-zinc-400 mt-1">Tailwind + p5.js</p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            className="hs-btn px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500"
            title="Generate a new layout"
          >
            Generate
          </button>
        </div>

        <div className="grid gap-3">
          {/* Grid size with sliders + number inputs */}
          <section id="grid-size">
            <h3 className="text-md font-semibold text-zinc-100">Grid</h3>
            <div className="pt-3 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-300">Columns</span>
                  <Num
                    value={cols}
                    onChange={(e) => {
                      const v = Math.max(1, +e.target.value || 1);
                      setCols(v);
                      liveUpdate({ cols: v });
                    }}
                    style={{ width: 80 }}
                  />
                </div>
                <input
                  type="range"
                  min={4}
                  max={40}
                  value={cols}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setCols(v);
                    liveUpdate({ cols: v });
                  }}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-300">Rows</span>
                  <Num
                    value={rows}
                    onChange={(e) => {
                      const v = Math.max(1, +e.target.value || 1);
                      setRows(v);
                      liveUpdate({ rows: v });
                    }}
                    style={{ width: 80 }}
                  />
                </div>
                <input
                  type="range"
                  min={4}
                  max={40}
                  value={rows}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setRows(v);
                    liveUpdate({ rows: v });
                  }}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-zinc-300">Show grid</label>
                <Switch
                  checked={showGrid}
                  onChange={(v) => {
                    setShowGrid(v);
                    liveUpdate({ showGrid: v });
                  }}
                />
                <button
                  className="ml-auto hs-btn text-xs px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 hover:bg-zinc-700"
                  onClick={resetGrid}
                  title="Reset rows/cols"
                >
                  Reset
                </button>
              </div>
            </div>
          </section>

          {/* Two-cell limits */}
          <section id="limits">
            <h3 className="text-md font-semibold text-zinc-100">
              Pill & Half-Circle Limits
            </h3>
            <div className="pt-3 grid grid-cols-2 gap-3">
              <Field label="Max pills">
                <Num
                  value={maxPills}
                  onChange={(e) => {
                    const v = Math.max(0, +e.target.value || 0);
                    setMaxPills(v);
                    liveUpdate({ maxPills: v });
                  }}
                />
              </Field>
              <Field label="Max halves">
                <Num
                  value={maxHalves}
                  onChange={(e) => {
                    const v = Math.max(0, +e.target.value || 0);
                    setMaxHalves(v);
                    liveUpdate({ maxHalves: v });
                  }}
                />
              </Field>
            </div>
          </section>

          {/* Weights */}
          <section id="weights">
            <h3 className="text-md font-semibold text-zinc-100">
              Shape Weights
            </h3>
            <div className="pt-3 grid grid-cols-2 gap-3">
              <Field label="Pill">
                <Num
                  value={wPill}
                  onChange={(e) => {
                    const v = Math.max(0, +e.target.value || 0);
                    setWPill(v);
                    liveUpdate({
                      weights: {
                        pill: v,
                        half: wHalf,
                        square: wSquare,
                        pie: wPie,
                        circle: wCircle,
                        blank: wBlank,
                      },
                    });
                  }}
                />
              </Field>
              <Field label="Half-circle">
                <Num
                  value={wHalf}
                  onChange={(e) => {
                    const v = Math.max(0, +e.target.value || 0);
                    setWHalf(v);
                    liveUpdate({
                      weights: {
                        pill: wPill,
                        half: v,
                        square: wSquare,
                        pie: wPie,
                        circle: wCircle,
                        blank: wBlank,
                      },
                    });
                  }}
                />
              </Field>
              <Field label="Square">
                <Num
                  value={wSquare}
                  onChange={(e) => {
                    const v = Math.max(0, +e.target.value || 0);
                    setWSquare(v);
                    liveUpdate({
                      weights: {
                        pill: wPill,
                        half: wHalf,
                        square: v,
                        pie: wPie,
                        circle: wCircle,
                        blank: wBlank,
                      },
                    });
                  }}
                />
              </Field>
              <Field label="Quarter circle">
                <Num
                  value={wPie}
                  onChange={(e) => {
                    const v = Math.max(0, +e.target.value || 0);
                    setWPie(v);
                    liveUpdate({
                      weights: {
                        pill: wPill,
                        half: wHalf,
                        square: wSquare,
                        pie: v,
                        circle: wCircle,
                        blank: wBlank,
                      },
                    });
                  }}
                />
              </Field>
              <Field label="Circle">
                <Num
                  value={wCircle}
                  onChange={(e) => {
                    const v = Math.max(0, +e.target.value || 0);
                    setWCircle(v);
                    liveUpdate({
                      weights: {
                        pill: wPill,
                        half: wHalf,
                        square: wSquare,
                        pie: wPie,
                        circle: v,
                        blank: wBlank,
                      },
                    });
                  }}
                />
              </Field>
              <Field label="Blank">
                <Num
                  value={wBlank}
                  onChange={(e) => {
                    const v = Math.max(0, +e.target.value || 0);
                    setWBlank(v);
                    liveUpdate({
                      weights: {
                        pill: wPill,
                        half: wHalf,
                        square: wSquare,
                        pie: wPie,
                        circle: wCircle,
                        blank: v,
                      },
                    });
                  }}
                />
              </Field>
            </div>
          </section>

          {/* Palette selector with a "Random" card */}
          <section id="palette">
            <h3 className="text-md font-semibold text-zinc-100">Palette</h3>
            <div className="mt-3 space-y-2">
              <button
                onClick={() => {
                  setLockPalette(false);
                  setRandomizePalette(true);
                  setForcedPalette(null);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition ${
                  !lockPalette && randomizePalette
                    ? "border-blue-400 bg-blue-900/20"
                    : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <span className="text-sm text-zinc-200">Random</span>
                <div className="flex space-x-1">
                  <div className="w-4 h-4 rounded bg-zinc-800" />
                  <div className="w-4 h-4 rounded bg-zinc-500" />
                  <div className="w-4 h-4 rounded bg-zinc-300" />
                </div>
              </button>

              {palettes.map((p, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setLockPalette(true);
                    setLockedIndex(i);
                    setRandomizePalette(false);
                    setForcedPalette(p);
                    liveUpdate({
                      lockPalette: true,
                      lockedIndex: i,
                      randomizePalette: false,
                      forcePalette: p,
                    });
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition ${
                    lockPalette && lockedIndex === i
                      ? "border-blue-400 bg-blue-900/20"
                      : "border-zinc-700 hover:border-zinc-500"
                  }`}
                >
                  <span className="text-sm text-zinc-200">
                    {["Blue", "Green", "Orange", "Red", "Purple"][i]}
                  </span>
                  <div className="flex space-x-1">
                    {p.map((c, j) => (
                      <div
                        key={j}
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </aside>

      {/* Canvas area */}
      <main className="relative p-4 lg:p-6">
        <div
          id="canvas-wrap"
          className="relative mx-auto max-w-[1280px] w-full rounded-2xl border border-zinc-800 bg-zinc-900/40 p-0 overflow-hidden min-h-[280px] flex items-center justify-center"
        >
          {/* Export button (top-right) */}
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm"
              title="Export SVG"
            >
              Export SVG
            </button>
          </div>

          {/* Error fallback */}
          {fatalError ? (
            <div className="p-6 text-center">
              <div className="text-red-400 font-medium mb-3">
                Something went wrong rendering the canvas
              </div>
              <button
                onClick={() => {
                  setFatalError(null);
                  handleGenerate();
                }}
                className="px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500"
              >
                Refresh App
              </button>
            </div>
          ) : (
            <Sketch
              ref={sketchRef}
              onError={onSketchError}
              onPaletteChosen={onPaletteChosen}
            />
          )}
        </div>
      </main>
    </div>
  );
}
