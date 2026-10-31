/* Provider catalogues: embdlol and cdnlivetv.
   Both are network calls that only matter once a link is actually needed, so they live in this
   lazy chunk instead of the startup bundle. Callers get plain lookups back. */

export interface CatalogueDeps {
  fetchWithTimeout: (url: string, init: RequestInit, ms: number) => Promise<Response>;
}

export interface Catalogues {
  /* embdlol channel name → current channel id. Ids rotate, so this is never hard-coded. */
  embdlol: Record<string, string>;
  /* cdnlivetv channel name → the status the provider publishes for it. */
  cdnlive: Record<string, string>;
}

export const EMBDLOL_STRUCT = 'https://api.embdlol.st/struct';
export const EMBDLOL_EMBED = 'https://embdlol.st/embed/';
export const PUBLIC_EMBDLOL = ['f1frisky', 'f1friapple', 'f1fridazn', 'f1friskyit', 'f1friskyde'];
const CDNLIVE_CATALOGUE = 'https://api.cdnlivetv.tv/api/v1/channels/?user=cdnlivetv&plan=free';
const TTL_MS = 5 * 60_000;

const empty = (): Catalogues => ({ embdlol: {}, cdnlive: {} });

let cached: Catalogues = empty();
let loadedAt = 0;
let inFlight: Promise<Catalogues> | null = null;

function channelsOf(json: unknown): Record<string, unknown>[] {
  const list = (json as { channels?: unknown })?.channels;
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

async function fetchEmbdlol(deps: CatalogueDeps): Promise<Record<string, string>> {
  const response = await deps.fetchWithTimeout(EMBDLOL_STRUCT, { cache: 'default', headers: { Accept: 'application/json' } }, 4000);
  if (!response.ok) throw new Error(`embdlol struct ${response.status}`);
  const json = await response.json();
  const next: Record<string, string> = {};
  for (const channel of channelsOf(json)) {
    const name = String(channel?.channelname || '').toLowerCase();
    /* Allowlist, not a blocklist: the 4K channel is resolved server-side and must never be named
       or id'd in a public bundle. */
    if (PUBLIC_EMBDLOL.includes(name) && channel?.id) next[name] = String(channel.id);
  }
  return next;
}

async function fetchCdnLive(deps: CatalogueDeps): Promise<Record<string, string>> {
  const response = await deps.fetchWithTimeout(CDNLIVE_CATALOGUE, { cache: 'default', headers: { Accept: 'application/json' } }, 5000);
  if (!response.ok) throw new Error(`cdnlivetv ${response.status}`);
  const json = await response.json();
  const next: Record<string, string> = {};
  for (const channel of channelsOf(json)) {
    const name = String(channel?.name || '');
    if (!/f1|formula/i.test(name)) continue;
    next[name] = String(channel?.status || 'unknown');
  }
  return next;
}

/* Never rejects: a directory being down means "no ids from them", and the other links in the pool
   carry the session. */
export async function loadCatalogues(deps: CatalogueDeps, force = false): Promise<Catalogues> {
  if (!force && loadedAt && Date.now() - loadedAt < TTL_MS) return cached;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const [embdlol, cdnlive] = await Promise.all([
      fetchEmbdlol(deps).catch(() => cached.embdlol),
      fetchCdnLive(deps).catch(() => cached.cdnlive),
    ]);
    cached = { embdlol, cdnlive };
    loadedAt = Date.now();
    return cached;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
