# Frontend migration — delivery notes

## Implemented

**Vite + modular TypeScript with native HTML rendering**, retaining the existing visual design. No React runtime or hydration step; no new frontend production dependencies. Render continues running the same Express/Node.js backend.

The large frontend script is split into shared services/data, a reusable select widget, a cockpit controller and lazy features. Sensitive playback state stays in the cockpit so unrelated UI changes do not recreate its iframe. Existing stream hosts, sports APIs, control/SSE contract, support bearer-key API and Cloudflare counter are retained.

## Measured build sizes

Per-file gzip, with the same Node zlib defaults on both versions; HTML/images/fonts excluded from both sides:

| Resource | Original | New mandatory startup | Reduction |
| --- | ---: | ---: | ---: |
| JavaScript | 56,093 bytes | 20,619 bytes | 63.2% |
| Application CSS | 18,115 bytes | 12,768 bytes | 29.5% |

Optional features still download when used. Desktop decoration may download after idle; championship data loads near its viewport sections. These are byte-size comparisons, **not** a claim of 63% lower page-load time or measured live Core Web Vitals.

## Verification

- Clean `npm ci`: successful; frontend npm audit reported zero vulnerabilities at verification time.
- `npm run check`: 24 frontend domain tests passed, both TypeScript gates passed, production build and static-asset/bundle budgets passed.
- Chromium: 41 fixture-backed browser checks passed; zero uncaught browser errors.
- Combined `f1admin` aggregate check passed: 149 backend/admin/security/motion/CSP/bot assertions, plus the frontend checks above.
- Desktop (1440px) and mobile (390px) screenshots inspected.
- Node backend implementation, admin UI runtime, bot, persistence and API routes were not modified. Only three backend verification files changed; their patch is included in `integration/`.

## Netlify settings

- **Build:** `npm run build`
- **Publish:** `dist`
- **Node:** 22
- **Base:** repository root

`netlify.toml` supplies these settings. Keep the current production hostname/origin. Headers, redirects, `.well-known/discord`, fonts and images are copied from `public/`. Only hashed `/bundles/*` assets receive immutable caching; HTML revalidates.

## Remaining release checks

Use a deploy preview before production. Real iPhone/Safari playback, fullscreen/wake lock and third-party source fallback need device/live-service testing. Browser regression tests mock external services and do not certify live video or your Discord bridge. The sandbox preview may show the existing Render/Cloudflare services as unavailable because they reject its origin; the static site still works with fallbacks.

No GitHub push, Netlify deployment, Render configuration change or production mutation was performed. Existing backend dependency advisories were not addressed as part of this frontend work.
