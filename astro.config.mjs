import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

// The adapter's serverless entrypoint imports header constants from the adapter's main module,
// which also pulls in build-only deps (rolldown, @vercel/routing-utils). Without this they get
// bundled into the function, and rolldown's native binding fails to load at startup.
const adapterIndex = /@astrojs[\\/]vercel[\\/]dist[\\/]index\.js$/;
const dropAdapterBuildDeps = {
  name: "drop-adapter-build-deps",
  enforce: "pre",
  async resolveId(source, importer, options) {
    if (!importer || !adapterIndex.test(importer)) return;
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    if (resolved) return { ...resolved, moduleSideEffects: false };
  },
};

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: vercel({
    webAnalytics: { enabled: true, },
    // isr: { expiration: 60 },
    middlewareMode: 'edge'
  }),
  image: {
    domains: ["cdn.raiderio.net", "render.worldofwarcraft.com"],
  },
  vite: {
    plugins: [dropAdapterBuildDeps],
  },
});
