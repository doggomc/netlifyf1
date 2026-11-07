/* Constructor profiles are real pages under dist/teams/<slug>/index.html,
   mirroring scripts/driver-pages.ts so /teams/<slug>/ returns indexable HTML
   with its own <title>, description and canonical URL before JS runs. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { TEAM_PROFILES, type TeamProfileFacts } from '../src/data/team-facts';

const ROOT = import.meta.dirname ? resolve(import.meta.dirname, '..') : resolve('.');
const DIST = resolve(ROOT, 'dist');
const TEMPLATE = resolve(ROOT, 'dist/team.html');

const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] as string));

function teamPage(template: string, team: TeamProfileFacts): string {
  return template
    .replace('<title>Constructor — FreeF1</title>', `<title>${escapeHtml(team.name)} — 2026 drivers, car and results | FreeF1</title>`)
    .replace(
      'content="FreeF1 constructor profile: 2026 drivers, car, championship position, points, wins, podiums, poles and every round of the season."',
      `content="${escapeHtml(`${team.entryName} (${team.name}): 2026 Formula 1 drivers, car, championship standing and full season results.`)}"`,
    )
    .replace(
      '</head>',
      `  <link rel="canonical" href="https://freef1.netlify.app/teams/${team.slug}/">\n`
      + `  <meta property="og:title" content="${escapeHtml(`${team.name} — 2026 drivers, car and results | FreeF1`)}">\n`
      + `  <meta property="og:url" content="https://freef1.netlify.app/teams/${team.slug}/">\n</head>`,
    );
}

export function teamPages(): Plugin {
  return {
    name: 'freef1-team-pages',
    apply: 'build',
    closeBundle: {
      order: 'post',
      handler: () => {
        if (!existsSync(DIST)) return;
        if (!existsSync(TEMPLATE)) {
          throw new Error('constructor profile template was not built; expected dist/team.html (team.html entry)');
        }
        const template = readFileSync(TEMPLATE, 'utf8');
        for (const team of TEAM_PROFILES) {
          const dir = join(DIST, 'teams', team.slug);
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, 'index.html'), teamPage(template, team));
        }
        console.log(`team pages: ${TEAM_PROFILES.length} written`);
      },
    },
  };
}
