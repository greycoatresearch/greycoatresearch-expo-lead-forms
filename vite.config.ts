import { defineConfig } from "vite";
import { resolve } from "node:path";

// Multi-page app: a QR landing page that routes to the two lead-capture forms.
// Deployed to GitHub Pages on a custom domain (expo.greycoatresearch.com), so
// base stays at '/'. CNAME lives in public/ and is copied into dist/ as-is.
export default defineConfig({
  appType: "mpa",
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, "index.html"),
        b2c: resolve(__dirname, "b2c.html"),
        b2b: resolve(__dirname, "b2b.html"),
      },
    },
  },
  server: {
    port: 6490,
  },
});
