import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import "preline"; // enable Preline JS behaviors

createRoot(document.getElementById("root")).render(<App />);
