/*
 * Animation + interaction benchmark for the FreeF1 frontend.
 *
 * Serves a built dist/ with Netlify-like routing, then in Chromium at phone size with 4x CPU
 * throttling measures: scroll frame pacing, driver-profile open pacing, long tasks, cumulative
 * layout shift, and console/page errors on every route.
 *
 *   node scripts/perf-audit.mjs <dist-dir> [label]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve(process.argv[2] || 'dist');
const label = process.argv[3] || 'run';
const { chromium, devices } = await import('/tmp/shots/node_modules/playwright/index.mjs');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

const aliases = { '/info': 'index.html', '/info/': 'index.html', '/discord': 'index.html', '/discord/': 'index.html', '/help': 'help.html' };

const server = createServer((request, response) => {
  let pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  if (aliases[pathname]) pathname = aliases[pathname];
  if (pathname === '/') pathname = 'index.html';
  const file = join(root, pathname.replace(/^\//, ''));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(readFileSync(file));
});

await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;

const summarise = (frames) => {
  const sorted = [...frames].sort((a, b) => a - b);
  const pick = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0;
  const budget = 1000 / 60;
  const over = frames.filter((d) => d > budget * 1.5).length;
  return {
    frames: frames.length,
    median: +pick(0.5).toFixed(1),
    p95: +pick(0.95).toFixed(1),
    worst: +(sorted[sorted.length - 1] || 0).toFixed(1),
    overBudgetPct: +((100 * over) / Math.max(1, frames.length)).toFixed(1),
  };
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.6,
  isMobile: true,
  hasTouch: true,
  userAgent: devices['Pixel 7'].userAgent,
});
const page = await context.newPage();
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text().slice(0, 200));
});
page.on('pageerror', (error) => errors.push('pageerror: ' + error.message.slice(0, 200)));

await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(6000);

const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.evaluate(() => {
  window.__cls = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
  }).observe({ type: 'layout-shift', buffered: true });
  window.__long = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__long.push(entry.duration);
  }).observe({ type: 'longtask', buffered: true });
});

async function sample(run, ms = 4000) {
  await page.evaluate(() => {
    window.__f = [];
    let last = performance.now();
    window.__go = true;
    const tick = (now) => {
      window.__f.push(now - last);
      last = now;
      if (window.__go) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await run();
  await page.waitForTimeout(Math.max(0, ms - 1200));
  return page.evaluate(() => {
    window.__go = false;
    return window.__f;
  });
}

const scrollFrames = await sample(async () => {
  for (let i = 0; i < 24; i++) {
    await page.mouse.wheel(0, 210);
    await page.waitForTimeout(110);
  }
});

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);
const modalFrames = await sample(async () => {
  await page.evaluate(() => document.querySelector('.dcard')?.click());
  await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('#driverClose')?.click());
});

const metrics = await page.evaluate(() => ({
  cls: +(window.__cls || 0).toFixed(4),
  longTasks: window.__long.length,
  worstLongTask: +(Math.max(0, ...window.__long).toFixed(1)),
  longTaskTotal: +(window.__long.reduce((a, b) => a + b, 0).toFixed(1)),
}));

// Route sweep: every page must load with no console or page errors.
const routes = ['/', '/help.html', '/info', '/discord', '/maintenance.html', '/404.html', '/beertjie.html'];
const routeErrors = {};
for (const route of routes) {
  const errorsBefore = errors.length;
  await page.goto('http://127.0.0.1:' + port + route, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(1200);
  routeErrors[route] = errors.slice(errorsBefore);
}

const report = {
  label,
  scroll: summarise(scrollFrames),
  driverProfile: summarise(modalFrames),
  ...metrics,
  consoleErrors: errors.length,
  routeErrors,
};
mkdirSync('verification', { recursive: true });
writeFileSync('verification/perf-' + label + '.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
server.close();
