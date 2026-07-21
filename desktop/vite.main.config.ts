import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // @recallai/desktop-sdk ships a native binary next to its JS entry
      // point and resolves it relative to that file at runtime. Bundling it
      // into main.js breaks that path resolution ("Desktop SDK: Couldn't
      // launch!"). Keep it external so it's `require`d from node_modules as-is
      // - the documented fix for webpack (`externals`) applies the same way
      // here (see docs/recall-doc-gaps.md).
      external: ["@recallai/desktop-sdk"],
    },
  },
});
