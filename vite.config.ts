// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Nitro preset selection.
//   - Inside the Lovable sandbox: forced to `cloudflare-module` automatically.
//   - Production target: Cloudflare Workers (`cloudflare-module`). This is the
//     officially supported preset for TanStack Start + Nitro on Cloudflare and
//     emits `.output/server/index.mjs` (Worker) + `.output/public/` (assets),
//     consumed by `wrangler.toml`.
//   - Override with NITRO_PRESET for other hosts: `node-server`, `vercel`,
//     `netlify`, `bun`, `deno-server`.
const nitroPreset = process.env.NITRO_PRESET || "cloudflare-module";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    preset: nitroPreset,
  },
});
