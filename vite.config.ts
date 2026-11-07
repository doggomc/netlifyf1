import { defineConfig, type Plugin } from 'vite';
import { driverPages } from './scripts/driver-pages';
import { teamPages } from './scripts/team-pages';
import { resolve, extname, join, relative, sep } from 'node:path';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, cpSync, writeFileSync, unlinkSync } from 'node:fs';

/* Static files live in the repo root, not in a public/ folder:
   - assets/      photos, fonts, icons — served at /assets/*
   - site-assets/ Netlify rules, fonts.css, robots.txt, sitemap.xml, .well-known
   Both are served in dev and copied into dist/ on build, so the public URLs
   (/assets/..., /fonts.css, /_headers, ...) never change.

   In dev the plugin also emulates the Netlify rules: _redirects (301/302/200)
   and _headers Cache-Control, so `npm run dev` matches a deploy preview. */

const ROOT = import.meta.dirname;
const ASSETS_DIR = resolve(ROOT, 'assets');
const SITE_ASSETS_DIR = resolve(ROOT, 'site-assets');
const DIST_DIR = resolve(ROOT, 'dist');

/* Docs such as assets/fonts/README.md ship with the repo but are not public. */
const PRIVATE_FILE = /\.(?:md|markdown)$/i;
const IMAGE_OR_FONT = /\.(?:jpe?g|png|webp|gif|svg|avif|woff2?|ttf|otf|eot)$/i;

const MIME: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ics': 'text/calendar; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

type RedirectRule = { from: string; to: string; status: number };
type HeaderRule = { pattern: string; headers: Record<string, string> };

function parseRedirects(): RedirectRule[] {
  const file = join(SITE_ASSETS_DIR, '_redirects');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .map(line => line.replace(/#.*$/, '').trim())
    .filter(Boolean)
    .map(line => line.split(/\s+/))
    .filter(parts => parts.length >= 2)
    .map(([from, to, status]) => ({ from, to, status: Number(status) || 301 }));
}

function parseHeaders(): HeaderRule[] {
  const file = join(SITE_ASSETS_DIR, '_headers');
  if (!existsSync(file)) return [];
  const rules: HeaderRule[] = [];
  let current: HeaderRule | null = null;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      current = { pattern: raw.trim(), headers: {} };
      rules.push(current);
      continue;
    }
    const match = /^\s+([\w-]+):\s*(.*)$/.exec(raw);
    if (match && current) current.headers[match[1]] = match[2].trim();
  }
  return rules;
}

/** Netlify placeholders (`/drivers/:slug`, `/drivers/:slug/`, and `:slug` in a
    target) are matched here too, so dev routes exactly like a deploy preview. */
function matches(pattern: string, pathname: string): boolean {
  const slots: string[] = [];
  if (pattern.includes(':')) {
    const source = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:\w+/g, (token) => {
      slots.push(token.slice(1));
      return '([^/]+)';
    });
    return new RegExp(`^${source}$`).test(pathname);
  }
  if (pattern.endsWith('/*')) {
    const base = pattern.slice(0, -2);
    return pathname === base || pathname.startsWith(base + '/');
  }
  return pattern === pathname;
}

/* Netlify applies every matching block in file order, so a later specific
   block (/assets/*, /fonts.css) overrides the catch-all /* one. */
function matchHeaderRule(rules: HeaderRule[], pathname: string): Record<string, string> {
  return rules
    .filter(rule => matches(rule.pattern, pathname))
    .reduce<Record<string, string>>((acc, rule) => Object.assign(acc, rule.headers), {});
}

function sendFile(res: import('node:http').ServerResponse, filePath: string, cacheControl?: string) {
  res.setHeader('Content-Type', MIME[extname(filePath).toLowerCase()] || 'application/octet-stream');
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);
  createReadStream(filePath).pipe(res);
}

function serveStaticFolders(): Plugin {
  let redirects: RedirectRule[] = [];
  let headerRules: HeaderRule[] = [];

  return {
    name: 'freef1-root-assets',
    configureServer(server) {
      redirects = parseRedirects();
      headerRules = parseHeaders();

      server.middlewares.use((req, res, next) => {
        let pathname: string;
        try {
          pathname = decodeURIComponent((req.url || '').split('?')[0].split('#')[0]);
        } catch {
          // A malformed escape used to throw out of the middleware and 500.
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Bad Request\n');
          return;
        }

        const cacheControl = matchHeaderRule(headerRules, pathname)['Cache-Control'];
        if (cacheControl && !res.getHeader('Cache-Control')) res.setHeader('Cache-Control', cacheControl);

        /* Netlify redirect/rewrite parity: 301/302 send a Location, 200 rewrites
           the URL and lets Vite render the target page. */
        const rule = redirects.find(candidate => matches(candidate.from, pathname));
        if (rule) {
          /* `/drivers/:slug/ → /drivers/:slug/index.html` carries the segment over. */
          let target = rule.to;
          if (rule.from.includes(':')) {
            const names = [...rule.from.matchAll(/:(\w+)/g)].map((match) => match[1]);
            const values = [...pathname.matchAll(/[^/]+/g)].map((match) => match[0]);
            names.forEach((name, index) => { target = target.replace(`:${name}`, values[index] ?? ''); });
          }
          if (rule.status === 200) {
            if (/^\/drivers\/[^/]+(?:\/|\/index\.html)?$/.test(target)) {
              req.url = '/driver.html' + (req.url || '').slice(pathname.length);
              return next();
            }
            if (/^\/teams\/[^/]+(?:\/|\/index\.html)?$/.test(target)) {
              req.url = '/team.html' + (req.url || '').slice(pathname.length);
              return next();
            }
            req.url = target + (req.url || '').slice(pathname.length);
            return next();
          }
          res.statusCode = rule.status;
          res.setHeader('Location', rule.to);
          res.end();
          return;
        }

        /* Driver profiles are real directories on Netlify (dist/drivers/<slug>/index.html,
           written by scripts/driver-pages.ts). In dev there is no build to write them,
           so route the pattern at the profile template instead — a slug that does not
           belong to the grid is rejected by the page itself. */
        if (/^\/drivers\/[^/]+\/?$/.test(pathname)) {
          req.url = '/driver.html' + (req.url || '').slice(pathname.length);
          return next();
        }
        if (/^\/teams\/[^/]+\/?$/.test(pathname)) {
          req.url = '/team.html' + (req.url || '').slice(pathname.length);
          return next();
        }

        /* Netlify never serves its own config files. */
        if (pathname === '/_headers' || pathname === '/_redirects') {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Not Found\n');
          return;
        }

        /* site-assets/* is published at the site root (fonts.css, robots.txt, …). */
        if (pathname !== '/' && !pathname.endsWith('/')) {
          const siteFile = resolve(SITE_ASSETS_DIR, pathname.slice(1));
          if (siteFile.startsWith(SITE_ASSETS_DIR + '/') && existsSync(siteFile) && statSync(siteFile).isFile()) {
            return sendFile(res, siteFile, cacheControl);
          }
        }

        if (pathname.startsWith('/assets/')) {
          if (PRIVATE_FILE.test(pathname)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('Not Found\n');
            return;
          }
          const filePath = resolve(ASSETS_DIR, pathname.slice('/assets/'.length));
          if (filePath.startsWith(ASSETS_DIR + '/') && existsSync(filePath) && statSync(filePath).isFile()) {
            return sendFile(res, filePath, cacheControl);
          }
        }

        next();
      });
    },
    closeBundle() {
      const copy = (from: string, to: string) =>
        cpSync(from, to, { recursive: true, filter: src => !PRIVATE_FILE.test(src) });
      copy(ASSETS_DIR, join(DIST_DIR, 'assets'));
      copy(SITE_ASSETS_DIR, DIST_DIR);
    },
  };
}

/* Files under assets/ are already published verbatim at /assets/*. Vite still
   resolves every /assets/... reference in HTML and CSS as a module asset, emits
   a second hashed copy into bundles/ and rewrites the URLs — which would double
   the payload and move images off the /assets/* cache rules in _headers. This
   pass maps each byte-identical emitted copy back to its /assets/ URL and drops
   the duplicate, so dist matches the pre-refactor output. */
function dedupeRootAssets(): Plugin {
  const digest = (input: Buffer | string) => createHash('sha256').update(input).digest('hex');
  let publicByHash = new Map<string, string>();
  let replacements: Array<[string, string]> = [];

  const walkFiles = (dir: string, visit: (file: string) => void) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walkFiles(full, visit);
      else visit(full);
    }
  };

  return {
    name: 'freef1-dedupe-root-assets',
    apply: 'build',
    buildStart() {
      publicByHash = new Map();
      replacements = [];
      walkFiles(ASSETS_DIR, full => {
        if (PRIVATE_FILE.test(full) || !IMAGE_OR_FONT.test(full)) return;
        publicByHash.set(digest(readFileSync(full)), '/' + relative(ROOT, full).split(sep).join('/'));
      });
    },
    /* Runs after Vite has written HTML/CSS/JS, so rewriting on disk cannot race
       with the HTML plugin. Every emitted image/font that is byte-identical to a
       file in assets/ is repointed at its /assets/ URL and then removed. */
    writeBundle() {
      if (!existsSync(DIST_DIR)) return;
      const textFiles: string[] = [];
      walkFiles(DIST_DIR, full => {
        if (PRIVATE_FILE.test(full)) return;
        if (!/\.(?:html|css|js|json|webmanifest)$/i.test(full)) return;
        textFiles.push(full);
      });

      /* Pass 1: find every emitted image/font that is byte-identical to a file
         in assets/, and remember its hashed URL. */
      for (const file of textFiles) {
        const text = readFileSync(file, 'utf8');
        for (const match of text.matchAll(/\/bundles\/[\w.@-]+\.[a-z0-9]+/gi)) {
          const url = match[0];
          if (!IMAGE_OR_FONT.test(url)) continue;
          if (replacements.some(([from]) => from === url)) continue;
          const emitted = join(DIST_DIR, url.slice(1));
          if (!existsSync(emitted)) continue;
          const publicPath = publicByHash.get(digest(readFileSync(emitted)));
          if (!publicPath) continue;
          replacements.push([url, publicPath]);
        }
      }

      /* Pass 2: point those references back at the published /assets/ files. */
      for (const file of textFiles) {
        const original = readFileSync(file, 'utf8');
        let next = original;
        for (const [from, to] of replacements) next = next.split(from).join(to);
        if (next !== original) writeFileSync(file, next);
      }

      /* Pass 3: drop the now-unreferenced duplicates. */
      const bundlesDir = join(DIST_DIR, 'bundles');
      if (!existsSync(bundlesDir)) return;
      walkFiles(bundlesDir, full => {
        if (!IMAGE_OR_FONT.test(full)) return;
        const url = '/' + relative(DIST_DIR, full).split(sep).join('/');
        if (replacements.some(([from]) => from === url)) unlinkSync(full);
      });
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [serveStaticFolders(), dedupeRootAssets(), driverPages(), teamPages()],
  server: {
    host: '0.0.0.0', port: 4173,
    allowedHosts: ['.e2b.app', 'localhost'],
    proxy: { '/control-api': { target: 'http://127.0.0.1:3000', changeOrigin: true, rewrite: path => path.replace(/^\/control-api/, '') } },
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: ['.e2b.app', 'localhost'] },
  build: {
    target: 'es2022',
    modulePreload: false,
    assetsDir: 'bundles',
    manifest: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        /* Separate pages, separate stylesheets: the public pages load layout.css
           and a few hundred bytes of shell, the cockpit loads the player runtime. */
        index: resolve(ROOT, 'index.html'),
        cockpit: resolve(ROOT, 'cockpit.html'),
        schedule: resolve(ROOT, 'schedule.html'),
        standings: resolve(ROOT, 'standings.html'),
        drivers: resolve(ROOT, 'drivers.html'),
        /* The profile template. scripts/driver-pages.ts copies the built page to
           dist/drivers/<slug>/ once every asset URL is final. */
        'drivers.driver': resolve(ROOT, 'driver.html'),
        teams: resolve(ROOT, 'teams.html'),
        'teams.team': resolve(ROOT, 'team.html'),
        liveTiming: resolve(ROOT, 'live-timing.html'),
        help: resolve(ROOT, 'help.html'),
        maintenance: resolve(ROOT, 'maintenance.html'),
        notFound: resolve(ROOT, '404.html'),
        gallery: resolve(ROOT, 'beertjie.html'),
      }
    }
  }
});
