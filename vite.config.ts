import { defineConfig, type HtmlTagDescriptor, type Plugin } from "vite";
import { resolve } from "node:path";

// Injects <link rel="prefetch"> for the b2c/b2b form bundles into the landing
// page only. The QR landing routes to one of the two forms via full-page nav,
// so warming their hashed JS/CSS (incl. turnstile/posthog) on idle makes the
// tap-through feel instant. Names are only known post-build, hence a plugin.
function prefetchFormBundles(): Plugin {
  return {
    name: "prefetch-form-bundles",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        // Only the landing page (entry name "landing") gets the prefetches.
        if (ctx.chunk?.name !== "landing" || !ctx.bundle) return;

        const seen = new Set<string>();
        const tags: HtmlTagDescriptor[] = [];
        const add = (fileName: string, as: "script" | "style") => {
          if (seen.has(fileName)) return;
          seen.add(fileName);
          tags.push({
            tag: "link",
            attrs: { rel: "prefetch", as, crossorigin: true, href: `/${fileName}` },
            injectTo: "head" as const,
          });
        };

        // Prefetch a chunk plus any CSS it pulls in (turnstile/posthog ship CSS).
        const addChunk = (fileName: string) => {
          add(fileName, "script");
          const chunk = ctx.bundle?.[fileName];
          if (chunk?.type !== "chunk") return;
          for (const css of chunk.viteMetadata?.importedCss ?? []) add(css, "style");
        };

        for (const file of Object.values(ctx.bundle)) {
          if (file.type !== "chunk" || !file.isEntry) continue;
          if (file.name !== "b2c" && file.name !== "b2b") continue;
          addChunk(file.fileName);
          for (const imp of file.imports) addChunk(imp);
        }

        return tags;
      },
    },
  };
}

// Multi-page app: a QR landing page that routes to the two lead-capture forms.
// Deployed to GitHub Pages on a custom domain (expo.greycoatresearch.com), so
// base stays at '/'. CNAME lives in public/ and is copied into dist/ as-is.
export default defineConfig({
  appType: "mpa",
  plugins: [prefetchFormBundles()],
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
