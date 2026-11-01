/* Provider catalogues: embdlol and cdnlivetv.
   Both are network calls that only matter once a link is actually needed, so they live in this
   lazy chunk instead of the startup bundle. Callers get plain lookups back. */

export interface CatalogueDeps {
  fetchWithTimeout: (url: string, init: RequestInit, ms: number) => Promise<Response>;
  /** f1admin's base address, where the weelo status relay lives. */
  backend: string;
}

export interface TaifoodChannel { id: string; name: string; lang: string; uri: string; status: string; }
export interface Catalogues {
  /* embdlol channel name → current channel id. Ids rotate, so this is never hard-coded. */
  embdlol: Record<string, string>;
  /* cdnlivetv channel name → the status the provider publishes for it. */
  cdnlive: Record<string, string>;
  /* strmfree stream key → the mirrors the provider publishes for it, 720p and above. */
  mirrors: Record<string, { url: string; quality: number }[]>;
  /* weelo stream id → the status the provider publishes for it ('online' | 'soon' | 'offline' | …). */
  weelo: Record<string, string>;
  /* taifood's per-race list: chip key ('apple', 'sky', …) → that broadcaster's addresses, live first. */
  taifood: Record<string, TaifoodChannel[]>;
  /* weelo stream id → its label, language, and whether weelo lists it as live. */
  weeloEvents: Record<string, { label: string; lang: string; live: boolean }>;
  /* PPV's current F1 address (the taifood path form), or '' when it lists none. */
  ppv: string;
}

export { staleSession } from './session-guard';

export const EMBDLOL_STRUCT = 'https://api.embdlol.st/struct';
export const EMBDLOL_EMBED = 'https://embdlol.st/embed/';
/* embdlol renames its F1 channels for every race — f1frisky, f1mexicosatsky, … — so a channel is
   matched by the feed it carries, not by its full name. */
/* Longest first: 'fullhd1' must win over 'de', 'italian' over 'ita'. 'uhd' is matched but never
   published — the 4K channel is resolved by the server and must not be named in the bundle. */
/* Sunday's set is f1mexicosunsky / sunworld / sunuhd / sunesp / sunita / sundeu (+ sun360p), so the
   short codes have to be here: without 'esp' the live Spanish feed matched no chip at all. 'sun' is
   the day prefix embdlol puts in front of the feed name, and it is not a feed of its own.
   '360p' is deliberately absent — it is below the 720p floor. */
const FEED_SUFFIXES = ['fullhd1', 'fullhd3', 'italian', 'spanish', 'german', 'skyit', 'skyde',
  'apple', 'world', 'dazn', 'sky', 'esp', 'ita', 'deu', 'uhd'];
export const PUBLIC_EMBDLOL = FEED_SUFFIXES.slice(0, -1);
const FEED_PATTERN = new RegExp(`^f1[a-z]*?(${FEED_SUFFIXES.join('|')})$`);
/* embdlol's short codes and the long key a chip uses: Mexico published f1mexicosatita and
   f1mexicosatdeu, which matched no chip and left the whole EMB block without a channel. */
const FEED_ALIASES: Record<string, string> = { esp: 'spanish', ita: 'italian', deu: 'german' };

/* 'f1mexicosatuhd' → 'uhd', 'f1mexicosatita' → 'italian'. Anything else has no key. */
export function feedKey(name: unknown): string {
  /* Some entries are bare ('german', 'fullhd3'), others carry the race prefix ('f1frigerman'). */
  const flat = String(name || '').trim().toLowerCase().replace(/[\s_]/g, '');
  if (FEED_SUFFIXES.includes(flat)) return flat;
  const match = flat.match(FEED_PATTERN);
  return match ? FEED_ALIASES[match[1]] || match[1] : '';
}
const CDNLIVE_CATALOGUE = 'https://api.cdnlivetv.tv/api/v1/channels/?user=cdnlivetv&plan=free';
/* The main channel is a strmfree stream; its mirrors live at /api/v1/sources/<key> on either domain. */
const MIRROR_KEYS = ['skyf1'];
const MIRROR_HOSTS = ['https://strmfree.st', 'https://streamfree.top'];
const TTL_MS = 5 * 60_000;
/* weelo publishes a fifteen-second status map for the onboards it relays, but weelo.live refuses
   the cross-origin request however open its headers look, so f1admin relays it at
   /api/stream/weelo. Asking weelo directly here left every onboard on "unknown". */
const WEELO_STATE = '/api/stream/weelo'; // joined to deps.backend
/* taifood publishes its per-race ids on a CDN without CORS headers, so f1admin relays the list. */
const TAIFOOD_LIST = '/api/stream/taifood';
/* weelo publishes every event with the exact stream ids behind it, and PPV publishes the current F1
   address. Both are CORS-open, so the browser reads them directly. */
const WEELO_EVENTS = 'https://weelo.live/feed/events.json';
const PPV_STREAMS = 'https://api.ppv.st/api/streams';

const empty = (): Catalogues => ({ embdlol: {}, cdnlive: {}, mirrors: {}, weelo: {}, taifood: {}, weeloEvents: {}, ppv: '' });

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
    /* Keyed by feed, not by the published name: the name changes every race weekend and only the
       feed is stable. Allowlist, not a blocklist — the 4K channel is resolved server-side and must
       never be named or id'd in a public bundle. */
    const key = feedKey(channel?.channelname);
    if (key && key !== 'uhd' && channel?.id) next[key] = String(channel.id);
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
  const response = await deps.fetchWithTimeout(`${deps.backend}${WEELO_STATE}`, { cache: 'no-store', headers: { Accept: 'application/json' } }, 4000);
  if (!response.ok) throw new Error(`weelo state ${response.status}`);
  const json = await response.json();
  /* The relay answers { state: { id: status } }; a raw state.json would answer the map itself. */
  const map = json?.state || json;
  const next: Record<string, string> = {};
  for (const [id, status] of Object.entries(map || {})) {
    if (id.startsWith('_') || typeof status !== 'string') continue;
    next[id] = status.trim().toLowerCase();
  }
  return next;
}

/* 'Apple TV (F1TV) [English]' → key 'apple'. The first plain word of the broadcaster name is the
   key our chips use, which is how a chip finds its own entry without hard-coding an id. */
export function taifoodKey(name: unknown): string {
  const first = String(name || '').replace(/\(.*?\)/g, ' ').trim().toLowerCase().split(/\s+/)[0];
  return /^[a-z]+$/.test(first) ? first : '';
}

async function fetchTaifood(deps: CatalogueDeps): Promise<Record<string, TaifoodChannel[]>> {
  const response = await deps.fetchWithTimeout(`${deps.backend}${TAIFOOD_LIST}`, { cache: 'no-store', headers: { Accept: 'application/json' } }, 4000);
  if (!response.ok) throw new Error(`taifood list ${response.status}`);
  const json = await response.json();
  const out: Record<string, TaifoodChannel[]> = {};
  for (const entry of Array.isArray(json?.channels) ? json.channels : []) {
    const key = taifoodKey(entry?.name);
    const uri = String(entry?.uri || '');
    /* Same host and shape as our own candidates, and never the 540p variant (below the floor). */
    if (!key || !/^https:\/\/taifood-blog\.asia\/embed\//.test(uri) || /540p/.test(uri)) continue;
    (out[key] ||= []).push({ id: String(entry.id || ''), name: entry.name, lang: String(entry.lang || ''), uri, status: String(entry.status || '') });
  }
  /* Live addresses first, but an offline one is kept: a source is never dropped for being dead. */
  for (const list of Object.values(out)) list.sort((a, b) => Number(b.status === 'online') - Number(a.status === 'online'));
  return out;
}

/* The authoritative weelo id list: every event carries its own streams with label and language.
   Keyed by stream id, so a chip can be matched by id instead of a hand-written table. */
async function fetchWeeloEvents(deps: CatalogueDeps): Promise<Record<string, { label: string; lang: string; live: boolean }>> {
  const response = await deps.fetchWithTimeout(WEELO_EVENTS, { cache: 'no-store', headers: { Accept: 'application/json' } }, 5000);
  if (!response.ok) throw new Error(`weelo events ${response.status}`);
  const json = await response.json();
  const out: Record<string, { label: string; lang: string; live: boolean }> = {};
  for (const event of Array.isArray(json?.events) ? json.events : []) {
    if (!/^f1-/.test(String(event?.id || ''))) continue;
    for (const stream of Array.isArray(event.streams) ? event.streams : []) {
      const id = String(stream?.url || '').split('stream=')[1]?.split('&')[0];
      if (!id || out[id]) continue;
      out[id] = { label: String(stream.label || ''), lang: String(stream.language || ''), live: Boolean(event.live ?? true) };
    }
  }
  return out;
}

/* PPV's current F1 address, which is the path-form taifood link. One motorsport entry at a time. */
async function fetchPpv(deps: CatalogueDeps): Promise<string> {
  const response = await deps.fetchWithTimeout(PPV_STREAMS, { cache: 'no-store', headers: { Accept: 'application/json' } }, 5000);
  if (!response.ok) throw new Error(`ppv ${response.status}`);
  const json = await response.json();
  for (const group of Array.isArray(json?.streams) ? json.streams : []) {
    for (const stream of Array.isArray(group?.streams) ? group.streams : []) {
      const uri = String(stream?.iframe || '');
      if (/taifood-blog\.asia\/embed\//.test(uri)) return uri;
    }
  }
  return '';
}

/* Never rejects: a directory being down means "no ids from them", and the other links in the pool
   carry the session. */
export async function loadCatalogues(deps: CatalogueDeps, force = false): Promise<Catalogues> {
  if (!force && loadedAt && Date.now() - loadedAt < TTL_MS) return cached;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const [embdlol, cdnlive, mirrors, weelo, taifood, weeloEvents, ppv] = await Promise.all([
      fetchEmbdlol(deps).catch(() => cached.embdlol),
      fetchCdnLive(deps).catch(() => cached.cdnlive),
      fetchMirrors(deps).catch(() => cached.mirrors),
      fetchWeelo(deps).catch(() => cached.weelo),
      fetchTaifood(deps).catch(() => cached.taifood),
      fetchWeeloEvents(deps).catch(() => cached.weeloEvents),
      fetchPpv(deps).catch(() => cached.ppv),
    ]);
    cached = { embdlol, cdnlive, mirrors, weelo, taifood, weeloEvents, ppv };
    loadedAt = Date.now();
    return cached;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
