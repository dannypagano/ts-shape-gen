import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "preline/preline";
import "./index.css";

// Optional, safe polyfill for older Safari/Firefox engines
(async () => {
  if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
    const { default: RO } = await import("resize-observer-polyfill");
    // eslint-disable-next-line no-undef
    window.ResizeObserver = RO;
  }
})();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
