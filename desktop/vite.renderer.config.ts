import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config
// Tailwind (v3, classic PostCSS setup - see postcss.config.js) is picked up
// automatically by Vite's built-in PostCSS support, no plugin needed here.
export default defineConfig({
  plugins: [react()],
});
