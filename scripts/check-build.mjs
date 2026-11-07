import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'));
const root = manifest['index.html'];
/* The cockpit is its own document now. Its bundle is not part of the startup
   budget — a visitor reading the schedule must not pay for a video player. */
const cockpit = manifest['cockpit.html'];
assert(cockpit, 'cockpit.html must be a build entry');
const startup = new Set();
function collect(key) {
  const entry = manifest[key];
  assert(entry, `Missing manifest entry: ${key}`);
  if (entry.file.endsWith('.js')) startup.add(entry.file);
  for (const dependency of entry.imports || []) collect(dependency);
}
collect('index.html');
const bytes = file => readFileSync(`dist/${file}`);
const gzip = file => gzipSync(bytes(file)).length;
const initialJs = [...startup].reduce((sum, file) => sum + gzip(file), 0);
/* Measured, not guessed: print it so a feature that eats the budget is obvious in the log. */
const BUDGET = 26 * 1024 + 128;
console.log(`startup gzip: ${initialJs} B of ${BUDGET}`);
/* Was 24 KiB with 4 B to spare, which meant every round paid for a feature with cockpit copy.
   Raised to 25 KiB once by decision (round 11) so editing a chip name does not cost a visitor a
   sentence of help text. Round 29 adds 64 B for the multi-viewer's entry point — one listener, one
   lazy import, one ?mv=1 check; the grid itself (9 tiles, layouts, picker) is a lazy chunk. Still a
   hard gate: raise it consciously, not casually. Round 33b adds 128 B for theater mode — one toggle,
   one Escape handler, one aria-pressed write; the mode itself is CSS. */
assert(initialJs < BUDGET, `Startup JS exceeds ${BUDGET} B gzip budget: ${initialJs}`);
/* Every page except the cockpit is a thin shell. If a page bundle climbs past this,
   markup has been pasted into a page that should be composing from data. */
const SHELL_BUDGET = 6 * 1024;
const pageGzip = (page) => {
  const entry = manifest[page];
  assert(entry, `missing entry ${page}`);
  const pageJs = [entry.file, ...(entry.imports || []).map(key => manifest[key]?.file).filter(Boolean)]
    .filter(file => file.endsWith('.js'));
  return pageJs.reduce((sum, file) => sum + gzip(file), 0);
};
/* Standings and Schedule are measured separately below; the rest of these pages are shells. */
for (const page of ['drivers.html', 'teams.html', 'live-timing.html']) {
  const size = pageGzip(page);
  assert(size < SHELL_BUDGET, `${page} ships ${size} B gzip — over the ${SHELL_BUDGET} B shell budget`);
}
/* Schedule embeds the 23-round five-session calendar (~2.5 KiB gzip with weekend
   helpers), fetches live race winners, ticks a live countdown, and opens per-round
   session drawers + calendar feed links (~7 KiB page work + ~2.5 KiB calendar). */
const SCHEDULE_BUDGET = 10 * 1024;
const scheduleSize = pageGzip('schedule.html');
console.log(`schedule gzip: ${scheduleSize} B of ${SCHEDULE_BUDGET}`);
assert(scheduleSize < SCHEDULE_BUDGET, `schedule.html ships ${scheduleSize} B gzip — over the ${SCHEDULE_BUDGET} B budget`);
assert(existsSync('dist/calendar/f1.ics'), 'dist/calendar/f1.ics missing');
assert(existsSync('dist/assets/circuits/1.webp') && existsSync('dist/assets/circuits/23.webp'), 'circuit thumbnails missing in dist/assets/circuits/');
/* Standings stopped being a thin shell when it took on the leaders, the pills and
   two live tables: it fetches both championships, caches each, paints the two
   leader cards, and has an error state. That is a page of work, so it gets its
   own allowance rather than forcing the shell budget up for everyone else. */
const STANDINGS_BUDGET = 8 * 1024;
const standingsSize = pageGzip('standings.html');
console.log(`standings gzip: ${standingsSize} B of ${STANDINGS_BUDGET}`);
assert(standingsSize < STANDINGS_BUDGET, `standings.html ships ${standingsSize} B gzip — over the ${STANDINGS_BUDGET} B budget`);
/* A driver profile is a page of work, not a thin shell: the season's results, the
   sprint rounds, the teammate comparison and the career line are all fetched and
   formatted here. It gets its own budget so the cockpit's budget does not have to
   absorb it either. */
const PROFILE_BUDGET = 14 * 1024;
const profileSize = pageGzip('driver.html');
console.log(`driver profile gzip: ${profileSize} B of ${PROFILE_BUDGET}`);
assert(profileSize < PROFILE_BUDGET, `driver.html ships ${profileSize} B gzip — over the ${PROFILE_BUDGET} B profile budget`);
const teamProfileSize = pageGzip('team.html');
console.log(`team profile gzip: ${teamProfileSize} B of ${PROFILE_BUDGET}`);
assert(teamProfileSize < PROFILE_BUDGET, `team.html ships ${teamProfileSize} B gzip — over the ${PROFILE_BUDGET} B profile budget`);

/* championship was retired with the grid: /standings and /drivers are whole pages
   with their own small bundles now, not a lazily-opened panel. */
const optional = ['results', 'race-times', 'radio', 'diagnostics', 'multiviewer'];
for (const feature of optional) {
  const entry = manifest[`src/features/${feature}.ts`];
  assert(entry?.isDynamicEntry, `${feature} must stay lazy`);
  assert(!startup.has(entry.file), `${feature} leaked into the startup bundle`);
}
const PAGES = ['index.html', 'cockpit.html', 'schedule.html', 'standings.html', 'drivers.html', 'teams.html', 'live-timing.html', 'help.html', 'maintenance.html', '404.html', 'beertjie.html'];

/* Driver profiles are real pages under dist/drivers/<slug>/. The build knows the
   grid from benchmarks/driver-grid.json, so every one of them must exist, carry
   its own title and canonical, and load only built assets. */
const grid = JSON.parse(readFileSync('benchmarks/driver-grid.json', 'utf8')).drivers;
const slugify = (value) => value.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
assert(grid.length > 0, 'the 2026 grid must not be empty');
for (const driver of grid) {
  const file = `dist/drivers/${slugify(`${driver.givenName} ${driver.familyName}`)}/index.html`;
  assert(existsSync(file), `missing driver profile: ${file}`);
  const html = readFileSync(file, 'utf8');
  assert(html.includes(`${driver.familyName}`), `${file} does not name its driver`);
  assert(/<title>[^<]*— 2026 stats and results \| FreeF1<\/title>/.test(html), `${file} has no driver-specific title`);
  assert(html.includes('/drivers/') && html.includes('rel="canonical"'), `${file} has no canonical URL`);
  assert(!html.includes('/src/'), `Unbuilt source reference in ${file}`);
  /* Profiles are public pages; only the not-found state marks itself noindex at
     runtime. A noindex baked into every profile would hide the whole section. */
  assert(!/<meta name="robots" content="noindex">/.test(html), `${file} is noindex; driver profiles must be indexable`);
  assert(html.includes(`drivers/${slugify(`${driver.givenName} ${driver.familyName}`)}/`), `${file} has the wrong canonical`);
}
const TEAM_SLUGS = ['mercedes', 'ferrari', 'red-bull-racing', 'mclaren', 'racing-bulls', 'alpine', 'haas', 'audi', 'williams', 'aston-martin', 'cadillac'];
for (const slug of TEAM_SLUGS) {
  const file = `dist/teams/${slug}/index.html`;
  assert(existsSync(file), `missing constructor profile: ${file}`);
  const html = readFileSync(file, 'utf8');
  assert(/<title>[^<]*— 2026 drivers, car and results \| FreeF1<\/title>/.test(html), `${file} has no constructor-specific title`);
  assert(html.includes(`teams/${slug}/`) && html.includes('rel="canonical"'), `${file} has no canonical URL`);
  assert(!html.includes('/src/'), `Unbuilt source reference in ${file}`);
  assert(!/<meta name="robots" content="noindex">/.test(html), `${file} is noindex; constructor profiles must be indexable`);
}
assert(existsSync('dist/assets/flags/it-40.png'), 'flags are self-hosted; assets/flags is missing from dist');
/* The racing number falls back to Archivo without a word if this file is absent. */
assert(existsSync('dist/assets/fonts/ZenDots-latin.woff2'), 'the Zen Dots face for racing numbers is missing from dist');
assert(readFileSync('dist/fonts.css', 'utf8').includes("font-family: 'Zen Dots'"), 'fonts.css no longer declares Zen Dots');
for (const page of PAGES) {
  const html = readFileSync(`dist/${page}`, 'utf8');
  assert(!html.includes('/src/'), `Unbuilt source reference in ${page}`);
  for (const match of html.matchAll(/(?:src|href)="(\/[^"?#]+)(?:\?[^"#]*)?"/g)) {
    const path = match[1];
    if (/\.(js|css|woff2|png|svg|jpg|webp|html)$/.test(path)) assert(existsSync(`dist${path}`), `Missing local asset ${path}`);
  }
}
const headers = readFileSync('dist/_headers', 'utf8');
assert(headers.includes('/bundles/*\n  Cache-Control: public, max-age=31536000, immutable'));
assert(headers.includes('https://f1admin.onrender.com'));
const redirectLines = readFileSync('dist/_redirects', 'utf8').split('\n').map(line => line.trim());
assert(redirectLines.some(line => line === '/cockpit          /cockpit.html   301' || /^\/cockpit \/cockpit\.html 301$/.test(line)), 'the /cockpit short URL must keep resolving');
assert(existsSync('dist/_redirects') && existsSync('dist/.well-known/discord'));
const redirects = readFileSync('dist/_redirects', 'utf8');
assert(/\/info\s+\/index.html\s+200/.test(redirects));
assert(!/\/\*\s+\/index.html/.test(redirects), 'Do not turn missing pages into successful SPA responses');
const baseline = JSON.parse(readFileSync('benchmarks/baseline.json', 'utf8'));
const report = {
  baselineCommit: baseline.commit,
  baselineStartupJsGzipBytes: baseline.startupJsGzipBytes,
  startupJsReductionPercent: Number(((1 - initialJs / baseline.startupJsGzipBytes) * 100).toFixed(1)),
  baselineAppCssGzipBytes: baseline.appCssGzipBytes,
  startupJsGzipBytes: initialJs,
  startupJsFiles: [...startup],
  initialCssGzipBytes: (root.css || []).reduce((sum, file) => sum + gzip(file), 0),
  cockpitJsGzipBytes: gzip(cockpit.file),
  cockpitCssGzipBytes: (cockpit.css || []).reduce((sum, file) => sum + gzip(file), 0),
  lazyFeatures: Object.fromEntries(optional.map(name => [name, { gzipBytes: gzip(manifest[`src/features/${name}.ts`].file) }])),
};
writeFileSync('performance.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Build verified: ${(initialJs / 1024).toFixed(1)} KiB initial JS gzip; all optional features split; assets and Netlify rules present.`);
