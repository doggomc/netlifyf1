import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePpvStreams, isPpv540p, normalizePpvLang, feedKey } from '../src/features/catalogues';

/* The source list lives in src/app.ts as a typed literal. Rather than duplicate it, these tests
   read the declaration and assert the invariants that matter, so a careless edit fails CI. */
const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
const block = app.slice(app.indexOf('const sources: StreamSource[] = ['), app.indexOf('let disabledSources'));

const linkCount = (block.match(/provider:/g) || []).length;
const qualityValues = [...block.matchAll(/quality:\s*(\d+)/g)].map((m) => Number(m[1]));
/* EMB chips are generated from a feed list, so they are counted from that list rather than literals. */
const embFeeds = (app.match(/const EMB_FEEDS = '([^']+)'/) || [, ''])[1].split(',').filter(Boolean);
const ids = [
  ...[...block.matchAll(/\{ id: "([a-z0-9-]+)"/g)].map((m) => m[1]),
  ...embFeeds.map((f) => `emb-${f}`),
  ...embFeeds.map((f) => `emb-stripped-${f}`),
];

describe('stream source link pools', () => {
  it('declares a pool for every source', () => {
    expect(ids.length).toBeGreaterThanOrEqual(17);
    /* Every id is either a literal in the list or a generated EMB chip. */
    for (const id of ids.filter((id) => !id.startsWith('emb-') || id.endsWith('-uhd'))) {
      expect(app).toContain(`{ id: "${id}"`);
    }
    expect(embFeeds).toContain('fullhd1');
  });

  it('carries several links per source, not one', () => {
    expect(linkCount).toBeGreaterThan(20);
  });

  it('never offers a link below 720p', () => {
    for (const quality of qualityValues) {
      expect(quality === 0 || quality >= 720, `quality ${quality} is below the 720p floor`).toBe(true);
    }
  });

  it('states a quality, a provider and an addressing mode for every link', () => {
    const links = [...block.matchAll(/\{[^{}]*provider:[^{}]*\}/g)].map((m) => m[0]);
    expect(links.length).toBeGreaterThan(20);
    for (const link of links) {
      expect(link).toMatch(/provider:\s*'/);
      /* quality may be omitted when it is unknown/adaptive; when stated it must clear 720p. */
      const quality = link.match(/quality:\s*(\d+)/);
      if (quality) expect(Number(quality[1]) === 0 || Number(quality[1]) >= 720).toBe(true);
      /* addressing is optional: a missing one means 'fixed'. Only 'dynamic' has to be stated. */
      if (/addressing:/.test(link)) expect(link).toMatch(/addressing:\s*'/);
      /* label is optional: the provider name is used when it would only repeat itself. */
      if (/label:/.test(link)) expect(link).toMatch(/label:\s*'/);
    }
  });

  it('puts stripped Sky HD first and removes strmfree Sky UHD', () => {
    const order = [...block.matchAll(/\{ id: "(sky-[a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(order[0]).toBe('sky-uk');
    expect(order).not.toContain('sky-uhd');
    expect(block).toContain('label: "Sky HD"');
    expect(block).not.toContain('label: "Sky UHD"');
  });

  it('backs Sky HD with stripped 1080p strmfree and never 2160p strmfree', () => {
    const skyHd = block.slice(block.indexOf('{ id: "sky-uk"'), block.indexOf('{ id: "emb-uhd"'));
    expect(skyHd).toContain('skyf11080p');
    expect(skyHd).toContain('stripped: true');
    expect(skyHd).not.toContain('skyf12160p');
    expect(app).toContain('/api/stream/strmfree-embed?variant=');
    expect(app).toContain("url.includes('/api/stream/strmfree-embed')");
  });

  it('keeps every cdnlivetv F1 channel in the pool', () => {
    expect(block).toContain("'Sky Sports F1 FHD UK'");
    expect(block).toContain("'DAZN F1 FHD'");
    expect(block).toContain("'Viaplay Sports 1 FHD UK'");
    expect(block).toContain("'Viaplay Sports 2 FHD UK'");
  });

  it('keeps the 540p PPV tier out of the list and labels PPV sources as (PPV)', () => {
    expect(block).not.toContain('_540p');
    expect(block).not.toMatch(/provider:\s*'taifood'/);
    for (const expectedLabel of [
      'Sky Sports (PPV)',
      'AppleTV (PPV)',
      'DAZN (PPV)',
      'Viaplay (PPV)',
      'Sky Sport Italia (PPV)',
      'Sky Sport F1 DE (PPV)',
      'V Sport Motor SE (PPV)',
      'Eleven Sports PL (PPV)',
      'Nova Sport CZ (PPV)',
    ]) {
      expect(block).toContain(`label: "${expectedLabel}"`);
    }
  });

  it('builds PPV streams from api.ppv.st/api/streams with zero 540p variants', () => {
    const sample = {
      success: true,
      streams: [
        {
          id: 1,
          category: 'American Football',
          streams: [
            { id: 10, name: 'NFL Network', tag: 'NFL', source_tag: 'HD | NFL', iframe: 'https://taifood-blog.asia/embed/nfl-network' },
          ],
        },
        {
          id: 35,
          category: 'Motorsports',
          streams: [
            {
              id: 20,
              name: 'Valencia Grand Prix - Race',
              tag: 'MotoGP',
              source_tag: 'HD | TNT Sports',
              iframe: 'https://taifood-blog.asia/embed/valencia-motogp---race-99999',
            },
            {
              id: 31852,
              name: 'São Paulo Grand Prix - Qualifying',
              tag: 'Formula 1',
              source_tag: 'HD | Sky Sports F1',
              uri_name: 'f1/2026/brazil/qualifying',
              starts_at: 1794074400,
              ends_at: 1794081600,
              locale: 'en-gb',
              iframe: 'https://taifood-blog.asia/embed/f1/2026/brazil/qualifying',
              substreams: [
                { id: 1031852, source_tag: 'SD | Sky Sports F1', locale: 'en-gb', iframe: 'https://taifood-blog.asia/embed/f1/2026/brazil/qualifying_540p' },
                { id: 31854, source_tag: 'HD | Apple TV (F1TV)', locale: 'en-us', iframe: 'https://taifood-blog.asia/embed/so-paulo-grand-prix---qualifying-31854' },
                { id: 1031854, source_tag: 'SD | Apple TV (F1TV)', locale: 'en-us', iframe: 'https://taifood-blog.asia/embed/so-paulo-grand-prix---qualifying-31854_540p' },
                { id: 31856, source_tag: 'HD | DAZN F1', locale: 'es', iframe: 'https://taifood-blog.asia/embed/so-paulo-grand-prix---qualifying-31856' },
                { id: 1031856, source_tag: 'SD | DAZN F1', locale: 'es', iframe: 'https://taifood-blog.asia/embed/so-paulo-grand-prix---qualifying-31856_540p' },
                { id: 31857, source_tag: 'HD | Sky Sport F1', locale: 'de', iframe: 'https://taifood-blog.asia/embed/so-paulo-grand-prix---qualifying-31857' },
                { id: 31858, source_tag: 'HD | Sky Sport F1', locale: 'it', iframe: 'https://taifood-blog.asia/embed/so-paulo-grand-prix---qualifying-31858' },
                { id: 31859, source_tag: 'HD | V Sport Motor', locale: 'sv', iframe: 'https://taifood-blog.asia/embed/so-paulo-grand-prix---qualifying-31859' },
                { id: 31860, source_tag: 'HD | Viaplay', locale: 'nl', iframe: 'https://taifood-blog.asia/embed/so-paulo-grand-prix---qualifying-31860' },
                { id: 31861, source_tag: 'HD | Nova Sport 5', locale: 'cs', iframe: 'https://taifood-blog.asia/embed/so-paulo-grand-prix---qualifying-31861' },
                { id: 31862, source_tag: 'HD | Eleven Sports 1', locale: 'pl', iframe: 'https://taifood-blog.asia/embed/so-paulo-grand-prix---qualifying-31862' },
              ],
            },
          ],
        },
      ],
    };

    const parsed = parsePpvStreams(sample, 1794075000 * 1000);
    expect(parsed.ppv).toBe('https://taifood-blog.asia/embed/f1/2026/brazil/qualifying');
    expect(parsed.ppvSessions.qualifying).toBe('https://taifood-blog.asia/embed/f1/2026/brazil/qualifying');

    const allUris = Object.values(parsed.taifood).flat().map((entry) => entry.uri);
    expect(allUris.some((u) => /540p/i.test(u))).toBe(false);
    expect(allUris.some((u) => /nfl|motogp/i.test(u))).toBe(false);
    expect(parsed.taifood.apple?.[0]).toMatchObject({
      lang: 'english',
      uri: 'https://taifood-blog.asia/embed/so-paulo-grand-prix---qualifying-31854',
    });
    expect(parsed.taifood.dazn?.[0]).toMatchObject({
      lang: 'spanish',
      uri: 'https://taifood-blog.asia/embed/so-paulo-grand-prix---qualifying-31856',
    });
    expect(parsed.taifood.viaplay?.[0]?.lang).toBe('dutch');
    expect(parsed.taifood.sky?.map((s) => s.lang).sort()).toEqual(['german', 'italian']);
    expect(parsed.taifood.v?.[0]?.lang).toBe('swedish');
    expect(parsed.taifood.nova?.[0]?.lang).toBe('czech');
    expect(parsed.taifood.eleven?.[0]?.lang).toBe('polish');

    expect(isPpv540p({ source_tag: 'SD | Apple TV (F1TV)', iframe: 'https://taifood-blog.asia/embed/foo' })).toBe(true);
    expect(isPpv540p({ source_tag: 'HD | Apple TV (F1TV)', iframe: 'https://taifood-blog.asia/embed/foo_540p' })).toBe(true);
    expect(isPpv540p({ source_tag: 'HD | Apple TV (F1TV)', iframe: 'https://taifood-blog.asia/embed/foo-31854' })).toBe(false);
    expect(normalizePpvLang('en-gb')).toBe('english');
    expect(normalizePpvLang('cs')).toBe('czech');
  });

  it('resolves no embdlol UUIDs into the bundle and parses hyphenated F1 feed names without 540p', () => {
    /* Ids rotate; they must come from the catalogue at runtime. */
    expect(app).not.toMatch(/EMBDLOL_FALLBACK/);
    expect(block).not.toMatch(/01a18[0-9a-f]{3}-/);
    expect(feedKey('F1 - Sao Paulo - Saturday - Sky')).toBe('sky');
    expect(feedKey('F1 - Sao Paulo - Saturday - ATV')).toBe('apple');
    expect(feedKey('F1 - Sao Paulo - Saturday - UHD')).toBe('uhd');
    expect(feedKey('F1 - Sao Paulo - Saturday - DAZN')).toBe('dazn');
    expect(feedKey('F1 - Sao Paulo - Saturday - SkyIT')).toBe('skyit');
    expect(feedKey('F1 - Sao Paulo - Saturday - SkyDE')).toBe('skyde');
    expect(feedKey('F1 - Sao Paulo - Saturday - 540p')).toBe('');
    expect(feedKey('Moto3/2/GP - Qatar - Saturday - DAZN')).toBe('');
    expect(feedKey('Sky Sports Tennis')).toBe('');
    expect(feedKey('f1mexicosatita')).toBe('italian');
  });

  it('fails over at link level before source level', () => {
    expect(app).toContain('function attemptSource(token, order, idx, startedAt, linkIdx = 0)');
    expect(app).toContain('attemptSource(token, order, idx, startedAt, linkIdx + 1)');
  });

  it('stamps the session key onto links that cannot carry one', () => {
    expect(app).toContain('function stampSession(');
    expect(app).toContain("s=${encodeURIComponent(key)}");
  });

  it('routes dynamic providers through the server, never a literal URL', () => {
    /* The hop lives in the lazy health module so it stays out of startup JS. */
    const health = readFileSync(new URL('../src/features/provider-health.ts', import.meta.url), 'utf8');
    expect(health).toContain('/api/stream/resolve?path=');
    expect(app).toContain("import('./features/provider-health')");
    /* The browser must never hold the token URL itself. */
    expect(block).not.toMatch(/play\/eyJ/);
    expect(app).not.toMatch(/play\/eyJ/);
  });

  it('adds stripped Weelo counterparts after the original specials with sandboxed embed URLs', () => {
    expect(block).toContain('...SPECIAL_SOURCES,');
    expect(block).toContain('...STRIPPED_SPECIAL_SOURCES,');
    expect(block.indexOf('...SPECIAL_SOURCES,')).toBeLessThan(block.indexOf('...STRIPPED_SPECIAL_SOURCES,'));
    expect(app).toContain("id: id.replace(/^weelo-/, 'weelo-stripped-')");
    expect(app).toContain('/api/stream/weellz-embed?stream=');
    expect(app).toContain("f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation')");
    expect(app).toContain("strippedTag.textContent = 'Stripped'");
  });

  it('adds stripped EMB counterparts alongside existing EMB feeds and 4K UHD', () => {
    expect(block).toContain('id: `emb-stripped-${embdlol}`');
    expect(block).toContain('{ id: "emb-stripped-uhd", label: "F1 UHD 4K", gated: true, stripped: true, links: [] }');
    expect(block.indexOf('{ id: "emb-uhd"')).toBeLessThan(block.indexOf('{ id: "emb-stripped-uhd"'));
    expect(app).toContain('/api/stream/embdlol-embed?id=');
    expect(app).toContain("url.includes('/api/stream/embdlol-embed')");
  });

  it('adds 9 stripped PPV counterparts alongside existing PPV feeds and proxies streams through STREAM_API', () => {
    const ppvPairs = [
      ['ppv', 'ppv-stripped', 'Sky Sports (PPV)'],
      ['appletv', 'appletv-stripped', 'AppleTV (PPV)'],
      ['dazn', 'dazn-stripped', 'DAZN (PPV)'],
      ['viaplay', 'viaplay-stripped', 'Viaplay (PPV)'],
      ['sky-italia', 'sky-italia-stripped', 'Sky Sport Italia (PPV)'],
      ['sky-de', 'sky-de-stripped', 'Sky Sport F1 DE (PPV)'],
      ['v-sport', 'v-sport-stripped', 'V Sport Motor SE (PPV)'],
      ['eleven', 'eleven-stripped', 'Eleven Sports PL (PPV)'],
      ['nova', 'nova-stripped', 'Nova Sport CZ (PPV)'],
    ] as const;

    for (const [origId, strippedId, expectedLabel] of ppvPairs) {
      expect(block).toContain(`{ id: "${origId}"`);
      expect(block).toContain(`{ id: "${strippedId}"`);
      expect(block.indexOf(`{ id: "${origId}"`)).toBeLessThan(block.indexOf(`{ id: "${strippedId}"`));
      const start = block.indexOf(`{ id: "${strippedId}"`);
      const slice = block.slice(start, start + 260);
      expect(slice).toContain(`label: "${expectedLabel}"`);
      expect(slice).toContain('stripped: true');
      expect(slice).toContain("provider: 'ppv-stripped'");
      expect(slice).not.toContain('540p');
    }

    expect(app).toContain('/api/stream/ppv-embed?slug=');
    expect(app).toContain("url.includes('/api/stream/ppv-embed')");
    expect(app).toContain('const STREAM_API =');

    const redirects = readFileSync(new URL('../site-assets/_redirects', import.meta.url), 'utf8');
    expect(redirects).toContain('/api/stream/*     https://f1admin.onrender.com/api/stream/:splat   200');
    expect(redirects).toContain('/api/site/config  https://f1admin.onrender.com/api/site/config     200');

    const headers = readFileSync(new URL('../site-assets/_headers', import.meta.url), 'utf8');
    expect(headers).toContain('/api/stream/*');
    expect(headers).toContain('Referrer-Policy: no-referrer');
  });

  it('keeps offline Weelo chips on standby before a session unless Force Live is active, without reloading active streams', () => {
    expect(app).toContain('const isWeeloSourceLive =');
    expect(app).toContain('const directWeeloSelected = isWeeloSourceLive(selectedSource);');
    expect(app).toContain('!streamWindowState.active && (specialDown(selectedSource) || (!isStreamAvailable(currentSession) && !directWeeloSelected))');
    expect(app).toContain("const hasActiveMedia = Boolean(playerEl?.querySelector('iframe, video')) && !noStreamEl?.classList.contains('visible');");
  });
});
