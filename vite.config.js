import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: true, // so it's reachable over LAN
    port: 8443, // 👈 change this number
  },
});
