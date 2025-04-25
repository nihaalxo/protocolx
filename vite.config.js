import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [wasm()],
  build: {
    rollupOptions: {
      input: {
        interactive: "/interactive/index.html",
        // ...
        // List all files you want in your build
      },
    },
  },
});
