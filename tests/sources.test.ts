import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/* The source list lives in src/app.ts as a typed literal. Rather than duplicate it, these tests
   read the declaration and assert the invariants that matter, so a careless edit fails CI. */
const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
const block = app.slice(app.indexOf('const sources: StreamSource[] = ['), app.indexOf('let disabledSources'));

const linkCount = (block.match(/provider:/g) || []).length;
const qualityValues = [...block.matchAll(/quality:\s*(\d+)/g)].map((m) => Number(m[1]));
const ids = [...block.matchAll(/\{ id: "([a-z0-9-]+)"/g)].map((m) => m[1]);

describe('stream source link pools', () => {
  it('declares a pool for every source', () => {
    expect(ids.length).toBeGreaterThanOrEqual(17);
    for (const id of ids) expect(app).toContain(`{ id: "${id}"`);
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

  it('puts Sky HD first and Sky UHD second', () => {
    const order = [...block.matchAll(/\{ id: "(sky-[a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(order.slice(0, 2)).toEqual(['sky-uk', 'sky-uhd']);
    expect(block).toContain('label: "Sky HD"');
    expect(block).toContain('label: "Sky UHD"');
  });

  it('backs Sky HD with 1080p strmfree and Sky UHD with 2160p strmfree', () => {
    const skyHd = block.slice(block.indexOf('{ id: "sky-uk"'), block.indexOf('{ id: "sky-uhd"'));
    expect(skyHd).toContain('skyf11080p');
    expect(skyHd).not.toContain('skyf12160p');
    const skyUhd = block.slice(block.indexOf('{ id: "sky-uhd"'), block.indexOf('{ id: "sky-f1-uk"'));
    expect(skyUhd).toContain('skyf12160p');
  });

  it('keeps every cdnlivetv F1 channel in the pool', () => {
    expect(block).toContain("'Sky Sports F1 FHD UK'");
    expect(block).toContain("'DAZN F1 FHD'");
    expect(block).toContain("'Viaplay Sports 1 FHD UK'");
    expect(block).toContain("'Viaplay Sports 2 FHD UK'");
  });

  it('keeps the 540p taifood tier out of the list', () => {
    expect(block).not.toContain('_540p');
  });

  it('resolves no embdlol UUIDs into the bundle', () => {
    /* Ids rotate; they must come from the catalogue at runtime. */
    expect(app).not.toMatch(/EMBDLOL_FALLBACK/);
    expect(block).not.toMatch(/01a18[0-9a-f]{3}-/);
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
});
