# FreeF1 web — split into pages

The public site is no longer one document. Each top-level section is a real HTML
file with its own stylesheet and its own small entry script, which is what keeps a
visitor reading the schedule from downloading a video player.

## Pages

| URL | File | Stylesheet | Entry | What it is |
| --- | --- | --- | --- | --- |
| `/` | `index.html` | `layout.css` | `src/pages/home.ts` | Hero, current Grand Prix, countdown, weekend sessions |
| `/cockpit` | `cockpit.html` | `app.css` | `src/main.ts` | The player, source switching, grid and standings (moved, unchanged) |
| `/schedule` | `schedule.html` | `layout.css` | `src/pages/schedule.ts` | All 23 rounds, local times, next round marked |
| `/standings` | `standings.html` | `layout.css` | `src/pages/standings.ts` | Live Jolpica drivers/constructors tables |
| `/drivers` | `drivers.html` | `layout.css` | `src/pages/drivers.ts` | Page frame; cards are the next part |
| `/teams` | `teams.html` | `layout.css` | `src/pages/teams.ts` | Teams in championship order with line-ups |
| `/live-timing` | `live-timing.html` | `layout.css` | `src/pages/live-timing.ts` | Page frame; row feed is a later part |
| `/help` | `help.html` | `help.css` | `src/help.ts` | Support chat (unchanged) |

Short URLs (`/cockpit`, `/schedule`, …) 301 to the `.html` file in
`site-assets/_redirects`, so old links keep working and dev matches production.

## Shared shell

- `src/styles/layout.css` — tokens, nav, page frame, cards, tables, home hero, footer,
  and the page transitions. Nothing in it is cockpit-specific.
- `src/ui/shell.ts` — current-link marking, mobile menu, sticky-header state,
  footer year, and the cross-page fade. The cockpit imports it with
  `{ nav: false, transitions: false }` because it owns its own header and routing;
  it only borrows the link state so "Cockpit" is marked on that page.
- `src/services/weekend.ts` — pure schedule maths (next/live/last session, phases,
  countdown parts, time formatting). Testable, no DOM, shared by home and schedule.

## Page transitions

The same gesture as the source-chip switch: the outgoing page lifts 6px and fades
(180ms), the incoming page arrives 10px low and fades in (300ms).

- View Transitions (`@view-transition`) do it across documents where supported.
- Everywhere else, `shell.ts` intercepts same-origin link clicks, adds
  `is-leaving`, and navigates after 165ms; `pageshow`/`pagehide` clear the class so
  the back button and bfcache can never leave a page stuck mid-fade.
- Blocks inside a page stagger in with `.rise` / `.rise-1` / `.rise-2`.
- `prefers-reduced-motion` collapses all of it.

## Budgets

`scripts/check-build.mjs` now measures two things:

- **Startup JS ≤ 26 KiB gzip** for the home page (currently ~5.2 KiB).
- **Every non-cockpit page ≤ 6 KiB gzip** of its own JS, so a page that should
  compose from data cannot quietly grow pasted markup.

The cockpit is measured separately (`cockpitJsGzipBytes`, ~22 KiB) and is expected
to be the only heavy page.

## What is deliberately not here yet

- The Rerace-style driver cards (portrait well, team-colour glow, number watermark)
  and the per-driver profile pages. `src/pages/drivers.ts` already loads the live
  standings and builds the slug/number/team/photo records the cards will consume.
- Live-timing rows.
- The cockpit still contains its own single-page router (`VIEWS`) because its
  filtering/search flows are hash-routed inside itself. `cockpit` is registered as a
  real route with no in-page view, so `/cockpit.html` is no longer rewritten to `/`.
