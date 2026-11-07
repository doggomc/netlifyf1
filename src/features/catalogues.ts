/* Provider catalogues: embdlol and cdnlivetv.
   Both are network calls that only matter once a link is actually needed, so they live in this
   lazy chunk instead of the startup bundle. Callers get plain lookups back. */

export interface CatalogueDeps {
  fetchWithTimeout: (url: string, init: RequestInit, ms: number) => Promise<Response>;
  /** f1admin's base address, where the weelo status relay lives. */
  backend: string;
}

export type WeellzSlotKey = 'skyweelo' | 'intl' | 'f1tvworld' | 'shows' | 'drivers' | 'data';

export interface WeellzChannelLink {
  label: string;
  stream: string;
  urls: string[];
  lang: string;
  live: boolean;
  pending?: boolean;
}

export interface WeellzCatalogue {
  fetchedAt: number;
  anyLive: boolean;
  slots: Partial<Record<WeellzSlotKey, WeellzChannelLink>>;
  onboards: WeellzChannelLink[];
  byStream: Record<string, { label: string; lang: string; live: boolean; url: string }>;
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
  /* Live & upcoming F1 channel links resolved directly from weellz.live's feeds. */
  weellz?: WeellzCatalogue;
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
export const WEELO_REFRESH_MS = 3 * 60_000;
/* weelo publishes a fifteen-second status map for the onboards it relays, but weelo.live refuses
   the cross-origin request however open its headers look, so f1admin relays it at
   /api/stream/weelo. Asking weelo directly here left every onboard on "unknown". */
const WEELO_STATE = '/api/stream/weelo'; // joined to deps.backend
/* taifood publishes its per-race ids on a CDN without CORS headers, so f1admin relays the list. */
const TAIFOOD_LIST = '/api/stream/taifood';
/* weellz.live builds its live channel links from weelo.live/players/events.json (+ fallback
   v.weellz.live/players/events.json), racinglap.net/api/status.json, and weelo.live/feed/events.json. */
export const WEELLZ_PLAYER_BASE = 'https://weellz.live/beta?stream=';
const WEELLZ_PLAYERS_FEED = 'https://weelo.live/players/events.json';
const WEELLZ_PLAYERS_ALT = 'https://v.weellz.live/players/events.json';
const WEELLZ_STATUS_FEED = 'https://racinglap.net/api/status.json';
const WEELO_EVENTS = 'https://weelo.live/feed/events.json';
const PPV_STREAMS = 'https://api.ppv.st/api/streams';

const emptyWeellz = (): WeellzCatalogue => ({ fetchedAt: 0, anyLive: false, slots: {}, onboards: [], byStream: {} });
const empty = (): Catalogues => ({ embdlol: {}, cdnlive: {}, mirrors: {}, weelo: {}, taifood: {}, weeloEvents: {}, ppv: '', weellz: emptyWeellz() });

let cached: Catalogues = empty();
let loadedAt = 0;
let inFlight: Promise<Catalogues> | null = null;
let weeloInFlight: Promise<Catalogues> | null = null;

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

function normalizeWeellzUrl(rawUrl: unknown, fallbackStream = ''): { stream: string; url: string } {
  const raw = String(rawUrl || '').trim();
  if (raw.startsWith('https://weellz.live/')) {
    const stream = raw.includes('stream=') ? (raw.split('stream=')[1]?.split('&')[0]?.trim() || '') : '';
    if (stream) return { stream, url: `${WEELLZ_PLAYER_BASE}${stream}` };
    return { stream: '', url: raw };
  }
  const cleanStream = String(fallbackStream || '').trim();
  return cleanStream ? { stream: cleanStream, url: `${WEELLZ_PLAYER_BASE}${cleanStream}` } : { stream: '', url: '' };
}

function classifyWeellzChannel(labelRaw: unknown, isShow = false): WeellzSlotKey | 'onboard' | null {
  const label = String(labelRaw || '').trim();
  if (!label) return null;
  if (/\bsky\s*sports\b/i.test(label)) return 'skyweelo';
  if (/\binternational\s*feed\b/i.test(label)) return 'intl';
  if (/\bf1\s*tv\b/i.test(label)) {
    if (/\bshow/i.test(label) || isShow) return 'shows';
    return 'f1tvworld';
  }
  if (/\bdriver(?:s)?\s*track(?:er)?\b/i.test(label)) return 'drivers';
  if (/\bdata\s*channel\b/i.test(label)) return 'data';
  return isShow ? null : 'onboard';
}

function cleanOnboardLabel(labelRaw: unknown): string {
  return String(labelRaw || '').replace(/\s*-\s*onboard\b/i, '').trim();
}

export function parseWeellzFeeds(
  playersJson: any,
  statusJson: any,
  feedJson: any,
  nowMs = Date.now(),
): WeellzCatalogue {
  const out: WeellzCatalogue = {
    fetchedAt: nowMs,
    anyLive: false,
    slots: {},
    onboards: [],
    byStream: {},
  };
  const PAD_MS = 45 * 60 * 1000;
  const liveById: Record<string, boolean> = {};
  const doneById: Record<string, boolean> = {};

  for (const ev of Array.isArray(statusJson?.events) ? statusJson.events : []) {
    const id = String(ev?.id || '');
    if (!id) continue;
    if (typeof ev?.live === 'boolean') liveById[id] = ev.live;
    if (typeof ev?.done === 'boolean') doneById[id] = ev.done;
  }

  const isPlayerEventLive = (ev: any): boolean => {
    const id = String(ev?.id || '');
    if (id && Object.prototype.hasOwnProperty.call(liveById, id)) return liveById[id];
    if (ev?.live === true) return true;
    if (id && doneById[id] === true) return false;
    const startMs = Number(ev?.start || 0) * 1000;
    const endMs = Number(ev?.end || 0) * 1000 || (startMs ? startMs + 2 * 60 * 60 * 1000 : 0);
    return startMs > 0 && nowMs >= startMs - PAD_MS && nowMs <= endMs + PAD_MS;
  };

  const recordStream = (stream: string, label: string, lang: string, live: boolean, url: string) => {
    if (!stream) return;
    const prev = out.byStream[stream];
    out.byStream[stream] = {
      label: prev?.label || label,
      lang: prev?.lang || lang,
      live: Boolean(prev?.live || live),
      url: prev?.url || url || `${WEELLZ_PLAYER_BASE}${stream}`,
    };
  };

  const upsertSlot = (slot: WeellzSlotKey, entry: WeellzChannelLink, prepend = false) => {
    const existing = out.slots[slot];
    if (!existing) {
      out.slots[slot] = {
        ...entry,
        urls: [...new Set(entry.urls.filter(Boolean))],
      };
      return;
    }
    const mergedUrls = prepend
      ? [...new Set([...entry.urls, ...existing.urls].filter(Boolean))]
      : [...new Set([...existing.urls, ...entry.urls].filter(Boolean))];
    out.slots[slot] = {
      label: prepend ? (entry.label || existing.label) : (existing.label || entry.label),
      stream: prepend ? (entry.stream || existing.stream) : (existing.stream || entry.stream),
      urls: mergedUrls,
      lang: existing.lang || entry.lang,
      live: existing.live || entry.live,
      pending: mergedUrls.length > 0 ? false : Boolean(existing.pending && entry.pending),
    };
  };

  const upsertOnboard = (entry: WeellzChannelLink) => {
    const key = entry.label.toLowerCase();
    const existing = out.onboards.find((o) => o.label.toLowerCase() === key || (entry.stream && o.stream === entry.stream));
    if (!existing) {
      out.onboards.push({ ...entry, urls: [...new Set(entry.urls.filter(Boolean))] });
      return;
    }
    existing.stream = existing.stream || entry.stream;
    existing.urls = [...new Set([...existing.urls, ...entry.urls].filter(Boolean))];
    existing.live = existing.live || entry.live;
    if (existing.urls.length > 0) existing.pending = false;
  };

  const rawPlayerEvents = Array.isArray(playersJson?.events) ? playersJson.events : [];
  const f1Events = rawPlayerEvents
    .filter((ev: any) => String(ev?.series_key || '').toLowerCase() === 'f1')
    .sort((a: any, b: any) => Number(a?.start || 0) - Number(b?.start || 0));
  const showEvents = rawPlayerEvents
    .filter((ev: any) => {
      if (String(ev?.series_key || '').toLowerCase() !== 'show') return false;
      const hay = `${ev?.weekend || ''} ${ev?.name || ''} ${ev?.series || ''}`;
      return /grand\s*prix|\bf1\b|formula\s*1|warm-up|notebook|pre-race|post-race|pre-qualifying|post-qualifying|pre-sprint|post-sprint/i.test(hay);
    })
    .sort((a: any, b: any) => Number(a?.start || 0) - Number(b?.start || 0));

  for (const ev of [...f1Events, ...showEvents]) {
    const live = isPlayerEventLive(ev);
    if (live) out.anyLive = true;
    for (const ch of Array.isArray(ev?.channels) ? ev.channels : []) {
      if (ch?.pending) continue;
      const { stream, url } = normalizeWeellzUrl(ch?.url, String(ch?.stream || ''));
      if (stream) recordStream(stream, String(ch?.name || ''), String(ch?.lang || ''), live, url);
    }
  }

  const pickActiveOrNext = (list: any[], horizonHours: number) => {
    const liveEv = list.find((ev) => isPlayerEventLive(ev));
    if (liveEv) return liveEv;
    const upcoming = list.find((ev) => {
      const id = String(ev?.id || '');
      if (id && doneById[id] === true) return false;
      const startMs = Number(ev?.start || 0) * 1000;
      return startMs > 0 && startMs + horizonHours * 3600_000 >= nowMs;
    });
    return upcoming || list[list.length - 1] || null;
  };

  const activeF1 = pickActiveOrNext(f1Events, 3);
  const activeShow = pickActiveOrNext(showEvents, 2);

  if (activeF1) {
    const live = isPlayerEventLive(activeF1);
    for (const ch of Array.isArray(activeF1.channels) ? activeF1.channels : []) {
      const slot = classifyWeellzChannel(ch?.name, false);
      if (!slot) continue;
      const pending = Boolean(ch?.pending);
      const { stream, url } = pending ? { stream: '', url: '' } : normalizeWeellzUrl(ch?.url, String(ch?.stream || ''));
      const entry: WeellzChannelLink = {
        label: slot === 'onboard' ? cleanOnboardLabel(ch?.name) : String(ch?.name || '').trim(),
        stream,
        urls: url ? [url] : [],
        lang: String(ch?.lang || 'English'),
        live,
        pending: pending && !url,
      };
      if (slot === 'onboard') upsertOnboard(entry);
      else upsertSlot(slot, entry);
    }
  }

  if (activeShow) {
    const showLive = isPlayerEventLive(activeShow);
    const f1Live = activeF1 ? isPlayerEventLive(activeF1) : false;
    for (const ch of Array.isArray(activeShow.channels) ? activeShow.channels : []) {
      const slot = classifyWeellzChannel(ch?.name, true);
      if (!slot || slot === 'onboard') continue;
      const pending = Boolean(ch?.pending);
      const { stream, url } = pending ? { stream: '', url: '' } : normalizeWeellzUrl(ch?.url, String(ch?.stream || ''));
      const entry: WeellzChannelLink = {
        label: String(ch?.name || '').trim(),
        stream,
        urls: url ? [url] : [],
        lang: String(ch?.lang || 'English'),
        live: showLive,
        pending: pending && !url,
      };
      if (slot === 'shows') {
        upsertSlot('shows', entry);
      } else if (slot === 'skyweelo' && url) {
        /* When an F1 show (Warm-Up / Pre-Qualifying / Notebook) is live while no track session is
           live, promote the show's Sky Sports link to the front of Sky Sports (weelo). */
        upsertSlot('skyweelo', entry, showLive && !f1Live);
      }
    }
  }

  /* Secondary & backup links from weelo.live/feed/events.json (includes weellz.live/at?id=... backups
     and acts as a complete fallback if players/events.json is ever unreachable). */
  const feedEvents = (Array.isArray(feedJson?.events) ? feedJson.events : []).filter((ev: any) =>
    /^f1-/i.test(String(ev?.id || '')) || String(ev?.series || '').toLowerCase() === 'f1',
  );
  const isFeedEventLive = (ev: any): boolean => {
    if (typeof ev?.live === 'boolean') return ev.live;
    const sessions = Array.isArray(ev?.sessions) ? ev.sessions : [];
    return sessions.some((session: any) => {
      const start = Date.parse(String(session?.startsAt || ''));
      const end = Date.parse(String(session?.endsAt || '')) || start + 2 * 60 * 60 * 1000;
      return Number.isFinite(start) && nowMs >= start - PAD_MS && nowMs <= end + PAD_MS;
    });
  };
  const feedCandidates = feedEvents
    .map((ev: any) => {
      const sessions = Array.isArray(ev?.sessions) ? ev.sessions : [];
      const nextTs = sessions
        .map((s: any) => Date.parse(String(s?.endsAt || s?.startsAt || '')))
        .filter((t: number) => Number.isFinite(t) && t + PAD_MS >= nowMs)
        .sort((a: number, b: number) => a - b)[0] ?? Infinity;
      return { ev, live: isFeedEventLive(ev), nextTs };
    })
    .sort((a: any, b: any) => Number(b.live) - Number(a.live) || a.nextTs - b.nextTs);

  for (const { ev, live } of feedCandidates) {
    if (live) out.anyLive = true;
    const isPrimaryRound = ev === feedCandidates[0]?.ev;
    for (const st of Array.isArray(ev?.streams) ? ev.streams : []) {
      const { stream, url } = normalizeWeellzUrl(st?.url);
      if (!url) continue;
      const label = String(st?.label || '').trim();
      const lang = String(st?.language || 'English');
      if (stream) recordStream(stream, label, lang, live, url);
      if (!isPrimaryRound) continue;
      const isBackup = /\bbackup\b/i.test(label);
      const slot = classifyWeellzChannel(label.replace(/\s*-\s*backup\b/i, ''), /\bshow/i.test(label));
      const entry: WeellzChannelLink = {
        label: slot === 'onboard' ? cleanOnboardLabel(label) : label,
        stream,
        urls: [url],
        lang,
        live,
        pending: false,
      };
      if (slot === 'onboard') {
        upsertOnboard(entry);
      } else if (slot) {
        upsertSlot(slot, entry, false);
        if (isBackup && out.slots[slot]) {
          out.slots[slot]!.urls = [...new Set([...out.slots[slot]!.urls, url])];
        }
      }
    }
  }

  return out;
}

async function fetchJsonNoStore(deps: CatalogueDeps, url: string, timeoutMs = 5000): Promise<any> {
  const response = await deps.fetchWithTimeout(url, { cache: 'no-store', headers: { Accept: 'application/json' } }, timeoutMs);
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

async function fetchWeellz(deps: CatalogueDeps): Promise<{
  weellz: WeellzCatalogue;
  weeloEvents: Record<string, { label: string; lang: string; live: boolean }>;
}> {
  const [playersJson, statusJson, feedJson] = await Promise.all([
    fetchJsonNoStore(deps, WEELLZ_PLAYERS_FEED, 5000)
      .catch(() => fetchJsonNoStore(deps, WEELLZ_PLAYERS_ALT, 4000))
      .catch(() => null),
    fetchJsonNoStore(deps, WEELLZ_STATUS_FEED, 4000).catch(() => null),
    fetchJsonNoStore(deps, WEELO_EVENTS, 5000).catch(() => null),
  ]);
  if (!playersJson && !feedJson) throw new Error('weellz feeds unreachable');
  const weellz = parseWeellzFeeds(playersJson, statusJson, feedJson, Date.now());
  const weeloEvents: Record<string, { label: string; lang: string; live: boolean }> = {};
  for (const [id, info] of Object.entries(weellz.byStream)) {
    weeloEvents[id] = { label: info.label, lang: info.lang, live: info.live };
  }
  return { weellz, weeloEvents };
}

/* PPV's current F1 address, which is the path-form taifood link. One motorsport entry at a time. */
/* PPV publishes every sport it carries — 36 American football channels, 151 football, NBA, cricket,
   golf, rugby, wrestling — and they all point at taifood, so "the first taifood embed" was
   nfl-network. The F1 address is the one whose venue/session is in the path, or whose title mentions
   F1/Formula 1; nothing else is acceptable for this chip. */
const PPV_F1_PATTERNS = [
  /formula[\s-]?1|\bf1\b|grand\s?prix/i,        // title or tag says F1
  /\/embed\/f1\//i,                             // the path form: /embed/f1/2026/<event>/<session>
  /---(?:race|qualifying|sprint|practice)[-\w]*/i // the session form: <event>---<session>-<id>
];

async function fetchPpv(deps: CatalogueDeps): Promise<string> {
  const response = await deps.fetchWithTimeout(PPV_STREAMS, { cache: 'no-store', headers: { Accept: 'application/json' } }, 5000);
  if (!response.ok) throw new Error(`ppv ${response.status}`);
  const json = await response.json();
  const candidates: { uri: string; haystack: string }[] = [];
  for (const group of Array.isArray(json?.streams) ? json.streams : []) {
    for (const stream of Array.isArray(group?.streams) ? group.streams : []) {
      const uri = String(stream?.iframe || '');
      if (!/taifood-blog\.asia\/embed\//.test(uri)) continue;
      /* Everything a stream says about itself, so a mislabelled category cannot hide an F1 row. */
      const haystack = [stream?.name, stream?.tag, stream?.source_tag, stream?.category_name, stream?.uri_name, uri].join(' ');
      candidates.push({ uri, haystack });
    }
  }
  const hit = candidates.find((entry) => PPV_F1_PATTERNS.some((pattern) => pattern.test(entry.haystack)));
  return hit ? hit.uri : '';
}

/* Refresh ONLY weellz.live channel links & weelo status map (called every 3 minutes from Cockpit).
   Bypasses the 5-minute full-catalogue TTL so links are always fresh, and never throws. */
export async function refreshWeeloCatalogues(deps: CatalogueDeps): Promise<Catalogues> {
  if (weeloInFlight) return weeloInFlight;
  weeloInFlight = (async () => {
    const [weelo, weellzPack] = await Promise.all([
      fetchWeelo(deps).catch(() => cached.weelo),
      fetchWeellz(deps).catch(() => ({ weellz: cached.weellz || emptyWeellz(), weeloEvents: cached.weeloEvents })),
    ]);
    cached = {
      ...cached,
      weelo,
      weeloEvents: weellzPack.weeloEvents,
      weellz: weellzPack.weellz,
    };
    return cached;
  })();
  try {
    return await weeloInFlight;
  } finally {
    weeloInFlight = null;
  }
}

/* Never rejects: a directory being down means "no ids from them", and the other links in the pool
   carry the session. */
export async function loadCatalogues(deps: CatalogueDeps, force = false): Promise<Catalogues> {
  if (!force && loadedAt && Date.now() - loadedAt < TTL_MS) return cached;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const [embdlol, cdnlive, mirrors, weelo, taifood, weellzPack, ppv] = await Promise.all([
      fetchEmbdlol(deps).catch(() => cached.embdlol),
      fetchCdnLive(deps).catch(() => cached.cdnlive),
      fetchMirrors(deps).catch(() => cached.mirrors),
      fetchWeelo(deps).catch(() => cached.weelo),
      fetchTaifood(deps).catch(() => cached.taifood),
      fetchWeellz(deps).catch(() => ({ weellz: cached.weellz || emptyWeellz(), weeloEvents: cached.weeloEvents })),
      fetchPpv(deps).catch(() => cached.ppv),
    ]);
    cached = {
      embdlol,
      cdnlive,
      mirrors,
      weelo,
      taifood,
      weeloEvents: weellzPack.weeloEvents,
      ppv,
      weellz: weellzPack.weellz,
    };
    loadedAt = Date.now();
    return cached;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
