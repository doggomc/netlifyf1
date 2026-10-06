#!/usr/bin/env node
'use strict';

/* Regenerates fonts.css and assets/fonts/*.woff2 from Google Fonts.
   The site must not depend on fonts.googleapis.com / fonts.gstatic.com at
   runtime (third-party request before the site even loads, plus an extra CSP
   host), so the variable fonts are fetched once and committed.

   Only the latin and latin-ext subsets are kept: the site's copy is English
   plus driver/team names, which live inside those two ranges. One file per
   family per subset covers every weight the stylesheets ask for, because
   these are the variable builds.

   Usage: node scripts/fetch-fonts.js   (run from the netlifyf1 root) */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const FAMILIES = [
  { name: 'Inter', query: 'Inter:wght@100..900', css: "'Inter'" },
  { name: 'Archivo', query: 'Archivo:wght@100..900', css: "'Archivo'" },
  { name: 'JetBrainsMono', query: 'JetBrains+Mono:wght@100..800', css: "'JetBrains Mono'" }
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

async function fetchText(url, binary = false) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return binary ? Buffer.from(await res.arrayBuffer()) : res.text();
}

function subsetOf(unicodeRange) {
  if (unicodeRange.includes('U+0000-00FF')) return 'latin';
  if (unicodeRange.includes('U+0100-02BA') || unicodeRange.includes('U+0100-02AF')) return 'latin-ext';
  return null;
}

(async () => {
  const fontDir = path.join(root, 'assets', 'fonts');
  fs.mkdirSync(fontDir, { recursive: true });

  const out = [`/* ═══════════════ SELF-HOSTED TYPEFACES ═══════════════
   Inter, Archivo and JetBrains Mono, served from this origin instead of
   fonts.googleapis.com / fonts.gstatic.com. Two effects: viewers stop making
   a third-party request that leaks their IP and User-Agent before the site
   has even loaded, and the CSP no longer needs to allow an external font
   host. These are the latin + latin-ext subsets of the variable fonts, so
   every weight the stylesheets ask for comes from one file per family per
   subset (the browser only fetches the subset it needs). Regenerate with
   scripts/fetch-fonts.js. */

`];

  for (const family of FAMILIES) {
    const css = await fetchText(`https://fonts.googleapis.com/css2?family=${family.query}&display=swap`);
    const blocks = css.match(/@font-face\s*\{[^}]*\}/g) || [];
    let saved = 0;
    for (const block of blocks) {
      const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1]?.trim();
      const weight = /font-weight:\s*([^;]+);/.exec(block)?.[1]?.trim();
      const stretch = /font-stretch:\s*([^;]+);/.exec(block)?.[1]?.trim();
      const url = /url\((https:\/\/[^)]+\.woff2)\)/.exec(block)?.[1];
      if (!range || !weight || !url) continue;
      const subset = subsetOf(range);
      if (!subset) continue;

      const file = `${family.name}-${subset}.woff2`;
      fs.writeFileSync(path.join(fontDir, file), await fetchText(url, true));
      out.push(`@font-face {
  font-family: ${family.css};
  font-style: normal;
  font-weight: ${weight};${stretch ? `\n  font-stretch: ${stretch};` : ''}
  font-display: swap;
  src: url('/assets/fonts/${file}') format('woff2');
  unicode-range: ${range};
}
`);
      saved++;
    }
    console.log(`${family.name}: ${saved} subset file(s)`);
  }

  fs.writeFileSync(path.join(root, 'fonts.css'), out.join('\n'));
  console.log('fonts.css written');
})().catch(error => {
  console.error('fetch-fonts failed:', error.message);
  process.exit(1);
});
