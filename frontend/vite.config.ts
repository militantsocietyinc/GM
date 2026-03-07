import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify("0.1.0"),
    __APP_NAME__: JSON.stringify("Bantay Pilipinas"),
    __APP_VARIANT__: JSON.stringify("philippine"),
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@config": resolve(__dirname, "src/config"),
      "@services": resolve(__dirname, "src/services"),
      "@components": resolve(__dirname, "src/components"),
      "@utils": resolve(__dirname, "src/utils"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          "map-deckgl": ["@deck.gl/core", "@deck.gl/layers", "@deck.gl/geo-layers"],
          "map-globe": ["globe.gl", "three"],
          d3: ["d3"],
        },
      },
    },
  },
});
