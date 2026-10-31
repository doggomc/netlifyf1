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
  /* strmfree stream key → the mirrors the provider publishes for it, 720p and above. */
  mirrors: Record<string, { url: string; quality: number }[]>;
  /* weelo stream id → the status the provider publishes for it ('online' | 'soon' | 'offline' | …). */
  weelo: Record<string, string>;
}

export const EMBDLOL_STRUCT = 'https://api.embdlol.st/struct';
export const EMBDLOL_EMBED = 'https://embdlol.st/embed/';
/* embdlol renames its F1 channels for every race — f1frisky, f1mexicosatsky, … — so a channel is
   matched by the feed it carries, not by its full name. */
/* Longest first: 'fullhd1' must win over 'de', 'italian' over 'ita'. 'uhd' is matched but never
   published — the 4K channel is resolved by the server and must not be named in the bundle. */
const FEED_SUFFIXES = ['fullhd1', 'fullhd3', 'italian', 'spanish', 'german', 'skyit', 'skyde',
  'apple', 'world', 'dazn', 'sky', 'ita', 'deu', 'uhd'];
export const PUBLIC_EMBDLOL = FEED_SUFFIXES.slice(0, -1);
const FEED_PATTERN = new RegExp(`^f1[a-z]*?(${FEED_SUFFIXES.join('|')})$`);

/* 'f1mexicosatuhd' → 'uhd'. Anything that is not an F1 channel has no key. */
export function feedKey(name: unknown): string {
  /* Some entries are bare ('german', 'fullhd3'), others carry the race prefix ('f1frigerman'). */
  const flat = String(name || '').trim().toLowerCase().replace(/[\s_]/g, '');
  if (FEED_SUFFIXES.includes(flat)) return flat;
  const match = flat.match(FEED_PATTERN);
  return match ? match[1] : '';
}
const CDNLIVE_CATALOGUE = 'https://api.cdnlivetv.tv/api/v1/channels/?user=cdnlivetv&plan=free';
/* The main channel is a strmfree stream; its mirrors live at /api/v1/sources/<key> on either domain. */
const MIRROR_KEYS = ['skyf1'];
const MIRROR_HOSTS = ['https://strmfree.st', 'https://streamfree.top'];
const TTL_MS = 5 * 60_000;
/* weelo publishes a fifteen-second status map for the onboards it relays. It is CORS-open, so the
   browser reads it directly — no backend, no key. */
const WEELO_STATE = 'https://weelo.live/players/state.json';

const empty = (): Catalogues => ({ embdlol: {}, cdnlive: {}, mirrors: {}, weelo: {} });

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

function qualityOf(value: unknown): number {
  const match = String(value || '').match(/(\d{3,4})p/i);
  return match ? Number(match[1]) : 0;
}

/* The provider states which addresses are live for a stream key. Mirrors it does not list are still
   useful later in the pool, so this only ever adds. */
async function fetchMirrors(deps: CatalogueDeps): Promise<Record<string, { url: string; quality: number }[]>> {
  const out: Record<string, { url: string; quality: number }[]> = {};
  await Promise.all(MIRROR_KEYS.map(async (key) => {
    const found: { url: string; quality: number }[] = [];
    for (const host of MIRROR_HOSTS) {
      try {
        const response = await deps.fetchWithTimeout(`${host}/api/v1/sources/${encodeURIComponent(key)}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        }, 4000);
        if (!response.ok) continue;
        const json = await response.json();
        for (const entry of Array.isArray(json?.live_sources) ? json.live_sources : []) {
          const url = String(entry?.url || entry || '');
          const quality = qualityOf(entry?.quality);
          if (!url.startsWith('https://') || quality < 720) continue;
          if (!found.some((mirror) => mirror.url === url)) found.push({ url, quality });
        }
      } catch (_) {
        /* Domain down or not answering JSON: the static links in the pool still cover it. */
      }
    }
    if (found.length) out[key] = found;
  }));
  return out;
}

/* Every state.json value is a plain string; '_fallback'/'_p2p' are objects and are skipped. */
async function fetchWeelo(deps: CatalogueDeps): Promise<Record<string, string>> {
  const response = await deps.fetchWithTimeout(WEELO_STATE, { cache: 'no-store', headers: { Accept: 'application/json' } }, 4000);
  if (!response.ok) throw new Error(`weelo state ${response.status}`);
  const json = await response.json();
  const next: Record<string, string> = {};
  for (const [id, status] of Object.entries(json || {})) {
    if (id.startsWith('_') || typeof status !== 'string') continue;
    next[id] = status.trim().toLowerCase();
  }
  return next;
}

/* Never rejects: a directory being down means "no ids from them", and the other links in the pool
   carry the session. */
export async function loadCatalogues(deps: CatalogueDeps, force = false): Promise<Catalogues> {
  if (!force && loadedAt && Date.now() - loadedAt < TTL_MS) return cached;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const [embdlol, cdnlive, mirrors, weelo] = await Promise.all([
      fetchEmbdlol(deps).catch(() => cached.embdlol),
      fetchCdnLive(deps).catch(() => cached.cdnlive),
      fetchMirrors(deps).catch(() => cached.mirrors),
      fetchWeelo(deps).catch(() => cached.weelo),
    ]);
    cached = { embdlol, cdnlive, mirrors, weelo };
    loadedAt = Date.now();
    return cached;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
