import React, { useState, useCallback, useRef, useEffect } from "react";
import Sketch from "./Sketch.jsx";

const Field = ({ label, children }) => (
  <div className="space-y-1">
    <label className="block text-xs font-medium text-zinc-300">{label}</label>
    {children}
  </div>
);

const SmallNumber = ({ value, onChange, min = 1, max = 40 }) => (
  <input
    type="number"
    min={min}
    max={max}
    value={value}
    onChange={(e) => {
      const v = parseInt(e.target.value, 10);
      if (Number.isNaN(v)) return;
      onChange(Math.max(min, Math.min(max, v)));
    }}
    className="w-16 text-right rounded-md bg-zinc-900/60 border border-zinc-700/60 px-2 py-1 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
  />
);

const Num = (props) => (
  <input
    type="number"
    {...props}
    className="hs-input w-full rounded-md bg-zinc-900/60 border border-zinc-700/60 px-2 py-1 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
  />
);

const ToggleSwitch = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
      checked ? "bg-emerald-500" : "bg-zinc-700"
    }`}
    aria-pressed={checked}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
        checked ? "translate-x-5" : "translate-x-1"
      }`}
    />
  </button>
);

export default function App() {
  // Grid controls
  const [cols, setCols] = useState(14);
  const [rows, setRows] = useState(10);
  const [showGrid, setShowGrid] = useState(false);

  // Two-cell limits & weights
  const [maxPills, setMaxPills] = useState(5);
  const [maxHalves, setMaxHalves] = useState(3);
  const [wPill, setWPill] = useState(2);
  const [wHalf, setWHalf] = useState(2);
  const [wSquare, setWSquare] = useState(2);
  const [wPie, setWPie] = useState(2);
  const [wCircle, setWCircle] = useState(2);
  const [wBlank, setWBlank] = useState(5);

  // Palette control
  const [params, setParams] = useState({
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
  });

  // Remember the actual palette used on the last full Generate
  const [lastPalette, setLastPalette] = useState(null);
  const [fatalError, setFatalError] = useState(null);

  const sketchRef = useRef(null);

  const buildParams = (forcePal = null) => ({
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
    palettes: params.palettes,
    lockPalette: params.lockPalette,
    lockedIndex: params.lockedIndex,
    randomizePalette: params.randomizePalette,
    forcePalette: forcePal, // stick to last chosen palette during live updates
    fitToViewport: true,
    maxCanvasWidth: 1280,
  });

  // Full Generate — allow palette to change (random or locked)
  const handleGenerate = useCallback(() => {
    sketchRef.current?.generate(buildParams(null), { keepPalette: false });
  }, [
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
    params,
  ]);

  // Live updates when rows/cols/showGrid change — reuse the last chosen palette
  useEffect(() => {
    const pal = lastPalette || null;
    sketchRef.current?.generate(buildParams(pal), { keepPalette: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, rows, showGrid]);

  const resetGrid = useCallback(() => {
    setCols(14);
    setRows(10);
  }, []);

  const exportSVG = () => sketchRef.current?.exportSVG();

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[380px_1fr] bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold">Grid Shapes Generator</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Preline + Tailwind UI • p5.js canvas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              className="hs-btn px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500"
              title="Generate a new layout"
            >
              Generate
            </button>
          </div>
        </div>

        <div className="grid gap-2">
          {/* Grid */}
          <section id="grid-size">
            <h3 className="text-md font-semibold text-zinc-100">Grid</h3>
            <div className="pt-3 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-300">Columns</span>
                  <SmallNumber
                    value={cols}
                    onChange={setCols}
                    min={1}
                    max={40}
                  />
                </div>
                <input
                  type="range"
                  min={4}
                  max={40}
                  value={cols}
                  onChange={(e) => setCols(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-300">Rows</span>
                  <SmallNumber
                    value={rows}
                    onChange={setRows}
                    min={1}
                    max={40}
                  />
                </div>
                <input
                  type="range"
                  min={4}
                  max={40}
                  value={rows}
                  onChange={(e) => setRows(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-zinc-300">Show grid</label>
                <ToggleSwitch checked={showGrid} onChange={setShowGrid} />
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

          {/* Limits */}
          <section id="limits">
            <h3 className="text-md font-semibold text-zinc-100">
              Pill & Half-Circle Limits
            </h3>
            <div className="pt-3 grid grid-cols-2 gap-3">
              <Field label="Max pills">
                <Num
                  value={maxPills}
                  onChange={(e) =>
                    setMaxPills(Math.max(0, +e.target.value || 0))
                  }
                />
              </Field>
              <Field label="Max halves">
                <Num
                  value={maxHalves}
                  onChange={(e) =>
                    setMaxHalves(Math.max(0, +e.target.value || 0))
                  }
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
                  onChange={(e) => setWPill(Math.max(0, +e.target.value || 0))}
                />
              </Field>
              <Field label="Half-circle">
                <Num
                  value={wHalf}
                  onChange={(e) => setWHalf(Math.max(0, +e.target.value || 0))}
                />
              </Field>
              <Field label="Square">
                <Num
                  value={wSquare}
                  onChange={(e) =>
                    setWSquare(Math.max(0, +e.target.value || 0))
                  }
                />
              </Field>
              <Field label="Quarter circle">
                <Num
                  value={wPie}
                  onChange={(e) => setWPie(Math.max(0, +e.target.value || 0))}
                />
              </Field>
              <Field label="Circle">
                <Num
                  value={wCircle}
                  onChange={(e) =>
                    setWCircle(Math.max(0, +e.target.value || 0))
                  }
                />
              </Field>
              <Field label="Blank">
                <Num
                  value={wBlank}
                  onChange={(e) => setWBlank(Math.max(0, +e.target.value || 0))}
                />
              </Field>
            </div>
          </section>

          {/* Palette */}
          <section id="palette">
            <h3 className="text-md font-semibold text-zinc-100">Palette</h3>
            <div className="mt-3 space-y-2">
              {/* Random option styled like the others */}
              <button
                onClick={() =>
                  setParams((prev) => ({
                    ...prev,
                    randomizePalette: true,
                    lockPalette: false,
                  }))
                }
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition ${
                  params.randomizePalette && !params.lockPalette
                    ? "border-blue-400 bg-blue-900/20"
                    : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <span className="text-sm text-zinc-200">Random</span>
                <span className="text-xs text-zinc-400">
                  changes on Generate
                </span>
              </button>

              {[
                { name: "Blue", colors: ["#19224A", "#3F5DB3", "#6C94EC"] },
                { name: "Green", colors: ["#082429", "#0D4B3B", "#1EA672"] },
                { name: "Orange", colors: ["#3A1607", "#762B0B", "#D97917"] },
                { name: "Red", colors: ["#420000", "#940821", "#E46C63"] },
                { name: "Purple", colors: ["#27103C", "#673C87", "#AE74D8"] },
              ].map((p, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const pal = params.palettes[i];
                    setParams((prev) => ({
                      ...prev,
                      lockPalette: true,
                      lockedIndex: i,
                      randomizePalette: false,
                    }));
                    setLastPalette(pal);
                    sketchRef.current?.generate(buildParams(pal), {
                      keepPalette: true,
                    });
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition ${
                    params.lockPalette && params.lockedIndex === i
                      ? "border-blue-400 bg-blue-900/20"
                      : "border-zinc-700 hover:border-zinc-500"
                  }`}
                >
                  <span className="text-sm text-zinc-200">{p.name}</span>
                  <div className="flex space-x-1">
                    {p.colors.map((c, j) => (
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
      <main className="relative p-0 lg:p-0 flex items-center justify-center">
        <button
          onClick={exportSVG}
          className="absolute top-4 right-4 z-10 px-3 py-2 rounded-md bg-zinc-800/80 border border-zinc-700 hover:bg-zinc-700 text-xs"
          title="Export SVG"
        >
          Export SVG
        </button>

        {fatalError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/80">
            <div className="flex flex-col items-center gap-3">
              <div className="text-sm text-zinc-300">
                Something went wrong rendering the canvas.
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500"
              >
                Refresh app
              </button>
            </div>
          </div>
        )}

        {/* Centered canvas, no extra container */}
        <div className="w-full h-[calc(100vh-0px)] flex items-center justify-center">
          <Sketch
            ref={sketchRef}
            onError={(e) => {
              console.error(e);
              setFatalError(e);
            }}
            onPaletteChosen={(pal) => setLastPalette(pal)}
          />
        </div>
      </main>
    </div>
  );
}
