# wclogs

WoW Mythic+ dungeon run tracker for the guild "Uncultured Social Cues" on Illidan US. Displays recent guild keys, timing results, player compositions, and links to Warcraft Logs comparison reports.

Live at: logs.fmj.gg

## Tech Stack

- **Astro 5** — SSR framework (`output: "server"`)
- **TypeScript** — strict mode via `astro/tsconfigs/strict`
- **Vercel** — hosting with edge middleware (`@astrojs/vercel`)
- **pnpm** — package manager
- **ArkType** — runtime type validation for API responses
- **p-map** — concurrent async operations (concurrency limits 3–5)
- **Redis** — Upstash managed Redis for caching

## Dev Commands

```bash
pnpm dev        # Start Astro dev server + Redis in parallel
pnpm build      # Production build
pnpm preview    # Preview production build
pnpm redis      # Start local Redis (no persistence)
pnpm test       # Run Playwright e2e tests (requires pnpm dev running)
```

Always run `pnpm test` after making changes. A PostToolUse hook in `.claude/settings.json` does this automatically — but if running in a cloud/remote dev environment where hooks don't execute, run `pnpm test` manually after each change.

## Environment Variables

Loaded via `.envrc` (direnv). Required vars:

| Variable | Purpose |
|---|---|
| `CLIENT_ID` | Warcraft Logs OAuth client ID |
| `CLIENT_SECRET` | Warcraft Logs OAuth client secret |
| `API_KEY_V1` | Warcraft Logs REST v1 API key |
| `BNET_CLIENT_ID` | Battle.net OAuth client ID |
| `BNET_CLIENT_SECRET` | Battle.net OAuth client secret |
| `REDIS_URL` | Upstash Redis connection string |

## External APIs

### Warcraft Logs
- **v2 GraphQL:** `https://www.warcraftlogs.com/api/v2/client` — guild reports, fight details, player compositions, keystone data
- **v1 REST:** `https://www.warcraftlogs.com/v1` — encounter rankings by class/spec (used for compare feature)
- Auth: OAuth 2.0 client credentials (`CLIENT_ID` / `CLIENT_SECRET`)
- Token endpoint: `https://www.warcraftlogs.com/oauth/token`

### Battle.net
- **Base:** `https://us.api.blizzard.com/data/wow`
- Used for: dungeon metadata, keystone timers, affix info, dungeon artwork
- Auth: OAuth 2.0 client credentials (`BNET_CLIENT_ID` / `BNET_CLIENT_SECRET`)
- Token endpoint: `https://oauth.battle.net/token`

### Raider.io
- No API calls — only used for player profile links
- Image domain `cdn.raiderio.net` is allowlisted in `astro.config.mjs`
- Player links: `https://raider.io/characters/us/{server}/{name}`

## Project Structure

```
src/
  lib/
    wcl.ts       # Warcraft Logs API client (v1 + v2)
    bnet.ts      # Battle.net API client
    keys.ts      # Report aggregation, dedup, timing logic
    world.ts     # Dungeon + affix metadata fetching
    compare.ts   # WCL comparison link generation
    redis.ts     # Redis client init
    consts.ts    # Guild config (ID: 365689, name, server)
    utils.ts     # Auth type validator
  pages/
    index.astro  # Homepage — fetches and renders recent keys
    compare.ts   # Redirect handler for WCL comparison links
    refresh.ts   # Flushes Redis cache, redirects home
    keys.json.ts # JSON API endpoint for raw key data
  components/
    Row.astro    # Single dungeon run (name, level, timing, affixes, players)
    Players.astro # Player cards with role icons and dual-mode links
  layouts/
    Layout.astro # Base HTML layout
```

## Key Patterns

**Caching:** OAuth tokens are cached in Redis at half their expiration time. Static metadata (affixes, dungeons) is cached indefinitely. Cache keys: `auth:wcl:v2`, `auth:bnet:v2`, `affixes`, `keys`, `wcl:mpluszone`.

**Cache refresh:** `GET /refresh` flushes the entire Redis DB and redirects home. Use this after a new season patch.

**Report fetching:** Pulls last 7 days of guild reports (falls back to 30 days if empty). Filters for difficulty=10 (Mythic). Deduplicates runs within a 60-second window. Caps display at 15 most recent unique runs.

**Timing logic:** Timed = under dungeon timer (green), Failed = over timer but completed (red), Incomplete = boss not killed (strikethrough). Challenger's Peril affix adds 90s to the timer.

**Compare feature:** Clicking a player name fetches top-ranked players for their class/spec/encounter from WCL v1, then redirects to WCL's compare view. Holding **R** while clicking opens the player's Raider.io profile instead.

**Type validation:** All external API responses are validated with ArkType schemas before use. The `Auth` type in `utils.ts` is shared across both API clients.
