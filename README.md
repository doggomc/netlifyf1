# FreeF1 web — Vite + TypeScript

A static, performance-focused frontend for Netlify. **The existing Node.js/Express Race Control backend stays on Render.** No React runtime, SSR server, Netlify Functions, new database or frontend production dependencies are required.

## Deploy on the existing Netlify site

Commit the **contents of this directory** to `doggomc/netlifyf1`, replacing the old layout rather than only adding files. Netlify's Git deployment picks up `netlify.toml`:

| Setting | Value |
| --- | --- |
| Base directory | Repository root |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | 22 |

Do **not** publish the repository root anymore: TypeScript and source CSS must be built. `npm ci` uses the committed lockfile. Static files sit at the repository root: `assets/` (photos, fonts, icons) is served at `/assets/*`, and `site-assets/` holds the Netlify rules (`_headers`, `_redirects`) plus `fonts.css`, `robots.txt`, `sitemap.xml` and `.well-known/discord`. `vite.config.ts` serves those folders in dev and copies them into `dist` on build, so the published URLs are unchanged.

The production API remains `https://f1admin.onrender.com`. Keep the existing production Netlify hostname so the Render and Cloudflare origin allowlists continue to match. Netlify deploy previews are already recognized by the Render backend's existing rules. If using a new custom hostname, configure both services' allowlists separately.

For a manual deployment, build and upload the **contents of `dist`**, or the provided deployment ZIP. An existing site's dashboard/context overrides should also agree with the settings above.

## Development

Requires Node 22 (see `.nvmrc`). In two terminals:

```sh
# Existing sibling backend, only if testing control/support integration locally:
cd ../f1admin
npm ci
npm start
```

```sh
cd ../netlifyf1
npm ci
npm run dev
```

Open `http://localhost:4173`. Development API calls go through Vite's `/control-api` proxy to the local Node backend on port 3000; browser code does not call a second localhost service. With no backend running, the source selector/calendar and previously cached sports data remain usable.

```sh
npm run check     # 24 domain tests, TypeScript checks, production build, asset/bundle budgets
npm run build
npm run preview   # serve the production build on port 4173
```

`npm run preview` uses the real production service URLs, not the development proxy. These services can reject localhost or sandbox origins. An unavailable counter/control channel in that preview does not mean the production Netlify origin is broken. Live stream/media availability still depends on each third-party provider.

## Structure

```text
index.html, help.html, maintenance.html, 404.html, beertjie.html
src/
  main.ts              Thin public-page entry; optional Help notifications
  app.ts               Cockpit/player, navigation, theme and configuration orchestration
  config.ts            Public service URLs and season
  data/                Typed calendar, teams/photos, inherited fallback results
  features/            Lazy championship/profiles, results, race times, radio, diagnostics, canvas
  services/            Safe storage, bounded API cache, request timeout, lazy loaders, DOM IDs, pool
  ui/select.ts         Accessible custom select widget
  types/               Runtime-validated site config and browser/support contracts
  styles/              Existing design; radio CSS loads with that feature
assets/                Photos, fonts and icons, served at /assets/*
site-assets/           Netlify rules (_headers, _redirects), fonts.css, robots.txt, sitemap.xml, .well-known/
```

The migration preserves the current appearance and reuses the tricky player/fallback logic rather than redesigning or replacing it. Ancillary gallery/404 inline behaviours remain static. Core services, calendar/data and config validation have an additional **strict TypeScript** gate; compatibility UI modules use the broader non-strict gate while their provider adapters are incrementally typed. There are no `@ts-nocheck` exclusions.

## Performance changes

- Native HTML is visible without downloading a UI framework or waiting for hydration.
- Results (including the large inherited fallback snapshot), race times, radio and diagnostics download on first use.
- Driver grid/standings load near their sections, not on every initial visit; they now share one standings request.
- Decorative canvas initializes at idle and stays disabled for lite/reduced-motion clients.
- Fresh visitors do not load the Help chat runtime on the home page. Returning ticket holders still get notifications.
- Vite minifies and fingerprints JS/CSS. `/bundles/*` gets a one-year immutable cache; HTML revalidates so new deployments are discovered.
- API promises and persistent cache entries are bounded; successful in-memory responses expire after one minute instead of remaining fresh forever.
- Site config from SSE/local cache is validated at runtime. Network/data failures keep the existing local fallbacks.
- No service worker caches stale HTML or stale maintenance state.

`performance.json` is regenerated on every build. `benchmarks/baseline.json` records the original checkout and like-for-like per-file gzip sizes. The size budget is **24 KiB mandatory startup JS gzip**. Size reductions are not a claim that every device's LCP is faster by the same percentage. Optional chunks still cost bytes when used; first activation may wait for their network download.

## Browser regression coverage

`scripts/browser-check.pw.js` is a Chromium/Playwright CLI flow with fixture-only APIs and mocked SSE/WebSockets. It covers first-use lazy features, direct stream selection, iframe stability, provider deduplication, following/livery, radio, diagnostics privacy, clean routes, Help create/reply/delete/offline drafts, maintenance release, and mobile overflow. It does **not** mutate production tickets or admin state, or prove that a live third-party video will play.

The latest local run passed **41 checks with zero uncaught browser errors** (see `benchmarks/browser-check-results.json`). With the Playwright CLI and Chromium available and `npm run preview` running:

```sh
playwright-cli -s=arena open about:blank --browser=chromium
playwright-cli -s=arena run-code --filename scripts/browser-check.pw.js
playwright-cli -s=arena close
```

For a clean backend checkout, `integration/f1admin-verification.patch` contains the companion verification-only changes. Apply it from this directory with:

```sh
git -C ../f1admin apply --check ../netlifyf1/integration/f1admin-verification.patch
git -C ../f1admin apply ../netlifyf1/integration/f1admin-verification.patch
```

Skip that step in this workspace: it is already applied. The companion `f1admin` changes are **verification tooling only**: its aggregate check invokes the new frontend checks and its CSP/motion audits understand the new source/build paths. Express, admin runtime, Discord bot, persistence and endpoints are unchanged. Keep the repositories as siblings to run the aggregate check. Old frontend-specific JSDOM scripts in the backend are legacy and are no longer the aggregate test entry.

## Before production

Use a Netlify deploy preview, then test real iPhone/Safari playback, stream fallbacks, fullscreen/wake lock, and your live Discord support bridge. These depend on external services/device policies and cannot be certified by mocked Chromium tests. The existing backend dependency advisories are separate from this frontend migration; no backend dependency update was bundled into it.
