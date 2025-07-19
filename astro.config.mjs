import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: vercel({
    webAnalytics: { enabled: true, },
    speedInsights: { enabled: true },
    // isr: { expiration: 60 }, 
    edgeMiddleware: true
  }),
  image: {
    domains: ["cdn.raiderio.net"],
  }
});
