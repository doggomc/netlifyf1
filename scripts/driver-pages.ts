/* Driver profiles are real pages, not a client-side route: /drivers/<slug>/ must
   return HTML with the right <title> without waiting for JavaScript.

   The slug is the rule, not a hand-written list — `andrea-kimi-antonelli` is just
   slugify("Andrea Kimi Antonelli"). This plugin proves that rule still covers the
   live grid, then copies the built template to dist/drivers/<slug>/index.html.
   If the grid changes and the check cannot run, the build fails loudly rather
   than shipping a driver with no page. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

const ROOT = import.meta.dirname ? resolve(import.meta.dirname, '..') : resolve('.');
const DIST = resolve(ROOT, 'dist');
/* Vite emits this entry as dist/driver.html (the key is only the entry name). */
const TEMPLATE = resolve(ROOT, 'dist/driver.html');
const FALLBACK = resolve(ROOT, 'dist/driver.html');

const slugify = (value: string) => value.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Driver = { driverId: string; givenName: string; familyName: string; permanentNumber?: string };

async function gridFromLive(): Promise<Driver[]> {
  const response = await fetch('https://api.jolpi.ca/ergast/f1/2026/driverstandings/?limit=40', {
    headers: { accept: 'application/json', 'user-agent': 'freef1-build' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json() as {
    MRData?: { StandingsTable?: { StandingsLists?: Array<{ DriverStandings?: Array<{ Driver: Driver }> }> } };
  };
  const list = data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings;
  if (!Array.isArray(list) || list.length === 0) throw new Error('empty grid');
  return list.map((row) => row.Driver);
}

/** The grid as the last successful build saw it, so an offline build still ships pages. */
function gridFromCache(): Driver[] | null {
  const file = resolve(ROOT, 'benchmarks/driver-grid.json');
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { drivers?: Driver[] };
    return Array.isArray(parsed.drivers) && parsed.drivers.length ? parsed.drivers : null;
  } catch { return null; }
}

function driverPage(template: string, driver: Driver): string {
  const full = `${driver.givenName} ${driver.familyName}`.replace(/\s+/g, ' ').trim();
  return template
    .replace('<title>Driver — FreeF1</title>', `<title>${escapeHtml(full)} — 2026 stats and results | FreeF1</title>`)
    .replace('content="FreeF1 driver profile: 2026 championship position, points, wins, podiums, qualifying record and every round of the season."',
      `content="${escapeHtml(`${full}, 2026 Formula 1 season: championship position, points, wins, podiums and every round.`)}"`)
    .replace('</head>', `  <link rel="canonical" href="https://freef1.netlify.app/drivers/${slugify(full)}/">\n</head>`);
}

const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] as string));

const htmlEscapeFile = (value: string) => escapeHtml(value);

export function driverPages(): Plugin {
  return {
    name: 'freef1-driver-pages',
    apply: 'build',
    /* Runs after Vite has written every entry, so the template's asset URLs are
       final and the copies need no further rewriting. */
    closeBundle: { order: 'post', handler: async () => {
      if (!existsSync(DIST)) return;
      const template = existsSync(TEMPLATE) ? readFileSync(TEMPLATE, 'utf8') : existsSync(FALLBACK) ? readFileSync(FALLBACK, 'utf8') : null;
      if (!template) throw new Error('driver profile template was not built; expected dist/driver.html (driver.html entry)');

      let grid: Driver[] | null = null;
      let source = 'live';
      try { grid = await gridFromLive(); }
      catch (error) {
        grid = gridFromCache();
        source = grid ? 'cached' : 'none';
        console.warn(`[drivers] live grid unavailable (${(error as Error).message}); using ${source} grid`);
      }
      if (!grid) throw new Error('could not resolve the 2026 grid: live lookup failed and no benchmarks/driver-grid.json exists');

      /* Prove the slug rule still produces the canonical URLs before writing any. */
      const slugs = grid.map((driver) => slugify(`${driver.givenName} ${driver.familyName}`));
      const unique = new Set(slugs);
      if (unique.size !== slugs.length) throw new Error(`slug collision on the grid: ${slugs.filter((slug, index) => slugs.indexOf(slug) !== index).join(', ')}`);
      const blank = slugs.filter((slug) => !slug);
      if (blank.length) throw new Error('a driver produced an empty slug');

      for (const slug of slugs) {
        const dir = join(DIST, 'drivers', slug);
        mkdirSync(dir, { recursive: true });
        const driver = grid[slugs.indexOf(slug)];
        writeFileSync(join(dir, 'index.html'), driverPage(template, driver));
      }

      writeFileSync(resolve(ROOT, 'benchmarks/driver-grid.json'), JSON.stringify({
        fetchedAt: new Date().toISOString(),
        source,
        drivers: grid,
      }, null, 2) + '\n');
      console.log(`driver pages: ${slugs.length} written from the ${source} grid`);
    } },
  };
}
