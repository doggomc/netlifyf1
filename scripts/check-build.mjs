import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'));
const root = manifest['index.html'];
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
assert(initialJs < 24 * 1024, `Startup JS exceeds 24 KiB gzip budget: ${initialJs}`);
const optional = ['championship', 'results', 'race-times', 'radio', 'diagnostics'];
for (const feature of optional) {
  const entry = manifest[`src/features/${feature}.ts`];
  assert(entry?.isDynamicEntry, `${feature} must stay lazy`);
  assert(!startup.has(entry.file), `${feature} leaked into the startup bundle`);
}
for (const page of ['index.html', 'help.html', 'maintenance.html', '404.html', 'beertjie.html']) {
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
  lazyFeatures: Object.fromEntries(optional.map(name => [name, { gzipBytes: gzip(manifest[`src/features/${name}.ts`].file) }])),
};
writeFileSync('performance.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Build verified: ${(initialJs / 1024).toFixed(1)} KiB initial JS gzip; all optional features split; assets and Netlify rules present.`);
