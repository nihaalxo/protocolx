import { defineConfig } from 'vite';
import { resolve } from 'path';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  base: './',             // ensure all asset URLs are relative
  plugins: [wasm()],
  build: {
    rollupOptions: {
      input: {
        // name: absolute path to each html entry
        main: resolve(__dirname, 'index.html'),
        interactive: resolve(__dirname, 'interactive/index.html'),
      }
    }
  }
});
