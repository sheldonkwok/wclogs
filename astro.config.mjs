import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

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
  }
});
