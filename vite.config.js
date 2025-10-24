import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: [
        "defaults",
        "not IE 11",
        "iOS >= 14",
        "Safari >= 13",
        "Firefox >= 78",
      ],
      modernPolyfills: true,
    }),
  ],

  server: {
    host: true, // so it's reachable over LAN
    port: 8443, // 👈 change this number
  },
});
