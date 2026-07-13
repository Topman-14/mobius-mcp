import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config.js";

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        "content-script": "src/content-script.ts",
        injected: "injected.ts",
      },
      output: {
        // dynamically injected via chrome.scripting.executeScript({ files: [...] }),
        // so these need stable, predictable output paths (no content hash)
        entryFileNames: (chunk) =>
          chunk.name === "content-script" || chunk.name === "injected" ? "src/[name].js" : "assets/[name]-[hash].js",
      },
    },
  },
});
