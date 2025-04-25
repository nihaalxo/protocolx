import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import { createHtmlPlugin } from "vite-plugin-html";

export default defineConfig({
  plugins: [
    wasm(),
    createHtmlPlugin({
      minify: true,
      pages: [
        {
          filename: "index.html",
          template: "index.html",
        },
        {
          filename: "interactive.html",
          template: "interactive/index.html",
        }, // Add more pages as needed
      ],
    }),
  ],
});
