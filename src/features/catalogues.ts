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
  /* Session-indexed PPV main F1 addresses ('fp1' | 'fp2' | 'fp3' | 'qualifying' | 'sprint-qualifying' | 'sprint' | 'race' -> uri). */
  ppvSessions?: Record<string, string>;
  /* Live & upcoming F1 channel links resolved directly from weellz.live's feeds. */
  weellz?: WeellzCatalogue;
}

import { canonicalSessionSlug } from './session-guard';
export { staleSession, canonicalSessionSlug } from './session-guard';

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
const FEED_SUFFIXES = [
  'fullhd1', 'fullhd2', 'fullhd3',
  'italian', 'spanish', 'german',
  'skyita', 'skydeu', 'skyit', 'skyde', 'skyuk',
  'appletv', 'apple', 'f1tv', 'world', 'dazn',
  'atv', 'sky', 'esp', 'ita', 'deu', 'uhd', '4k',
];
export const PUBLIC_EMBDLOL = FEED_SUFFIXES.filter((s) => s !== 'uhd' && s !== '4k');
const FEED_PATTERN = new RegExp(`^f1[a-z0-9]*?(${FEED_SUFFIXES.join('|')})$`);
/* embdlol's short codes and aliases normalized to the canonical feed keys our chips read. */
const FEED_ALIASES: Record<string, string> = {
  fullhd2: 'fullhd3',
  skyuk: 'sky',
  atv: 'apple',
  appletv: 'apple',
  f1tv: 'apple',
  skyita: 'skyit',
  skydeu: 'skyde',
  esp: 'spanish',
  ita: 'italian',
  deu: 'german',
  '4k': 'uhd',
};

/* 'f1mexicosatuhd' → 'uhd', 'f1mexicosatita' → 'italian',
   'F1 - Sao Paulo - Saturday - ATV' → 'apple', 'F1 - Sao Paulo - Saturday - 540p' → ''. */
export function feedKey(name: unknown): string {
  const raw = String(name || '').trim().toLowerCase();
  if (!raw || /(?:360|480|540)p\b/.test(raw)) return '';
  if (/^(?:f[234]\b|formula\s*[234e]\b)/.test(raw)) return '';
  /* Support both compact ('f1frigerman') and hyphen/space-separated ('F1 - Sao Paulo - Saturday - Sky') names. */
  const flat = raw.replace(/^formula[\s_-]*1\b/, 'f1').replace(/[\s_-]+/g, '');
  if (!/^[a-z0-9]+$/.test(flat)) return '';
  if (FEED_SUFFIXES.includes(flat)) return FEED_ALIASES[flat] || flat;
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
const EMBDLOL_RELAY = '/api/stream/embdlol';
/* weellz.live builds its live channel links from weelo.live/players/events.json (+ fallback
   v.weellz.live/players/events.json), racinglap.net/api/status.json, and weelo.live/feed/events.json. */
export const WEELLZ_PLAYER_BASE = 'https://weellz.live/beta?stream=';
const WEELLZ_PLAYERS_FEED = 'https://weelo.live/players/events.json';
const WEELLZ_PLAYERS_ALT = 'https://v.weellz.live/players/events.json';
const WEELLZ_STATUS_FEED = 'https://racinglap.net/api/status.json';
const WEELO_EVENTS = 'https://weelo.live/feed/events.json';
const PPV_STREAMS = 'https://api.ppv.st/api/streams';

const emptyWeellz = (): WeellzCatalogue => ({ fetchedAt: 0, anyLive: false, slots: {}, onboards: [], byStream: {} });
const empty = (): Catalogues => ({ embdlol: {}, cdnlive: {}, mirrors: {}, weelo: {}, taifood: {}, weeloEvents: {}, ppv: '', ppvSessions: {}, weellz: emptyWeellz() });

let cached: Catalogues = empty();
let loadedAt = 0;
let inFlight: Promise<Catalogues> | null = null;
let weeloInFlight: Promise<Catalogues> | null = null;

function channelsOf(json: unknown): Record<string, unknown>[] {
  const list = (json as { channels?: unknown })?.channels;
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

async function fetchEmbdlol(deps: CatalogueDeps): Promise<Record<string, string>> {
  const next: Record<string, string> = {};
  try {
    const response = await deps.fetchWithTimeout(EMBDLOL_STRUCT, { cache: 'no-store', headers: { Accept: 'application/json' } }, 5000);
    if (response.ok) {
      const json = await response.json();
      for (const channel of channelsOf(json)) {
        /* Keyed by feed, not by the published name: the name changes every race weekend and only the
           feed is stable. Allowlist, not a blocklist — the 4K channel is resolved server-side and must
           never be named or id'd in a public bundle. */
        const key = feedKey(channel?.channelname);
        if (key && key !== 'uhd' && channel?.id) next[key] = String(channel.id);
      }
      if (next.sky && !next.fullhd1) next.fullhd1 = next.sky;
      if (next.apple && !next.fullhd3) next.fullhd3 = next.apple;
    }
  } catch (_) {
    /* Fall through to f1admin relay if api.embdlol.st is blocked or slow on the visitor's network. */
  }
  if (Object.keys(next).length) return next;

  const relay = await deps.fetchWithTimeout(`${deps.backend}${EMBDLOL_RELAY}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  }, 5000);
  if (!relay.ok) throw new Error(`embdlol relay ${relay.status}`);
  const relayJson = await relay.json();
  const relayChannels = relayJson?.channels && typeof relayJson.channels === 'object' ? relayJson.channels : {};
  for (const [key, id] of Object.entries(relayChannels)) {
    if (key && key !== 'uhd' && typeof id === 'string' && id) next[key] = id;
  }
  if (next.sky && !next.fullhd1) next.fullhd1 = next.sky;
  if (next.apple && !next.fullhd3) next.fullhd3 = next.apple;
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

const PPV_LOCALE_MAP: Record<string, string> = {
  en: 'english',
  'en-gb': 'english',
  'en-us': 'english',
  'en-au': 'english',
  'en-ca': 'english',
  english: 'english',
  es: 'spanish',
  'es-es': 'spanish',
  'es-mx': 'spanish',
  spanish: 'spanish',
  nl: 'dutch',
  'nl-nl': 'dutch',
  dutch: 'dutch',
  de: 'german',
  'de-de': 'german',
  'de-at': 'german',
  german: 'german',
  it: 'italian',
  'it-it': 'italian',
  italian: 'italian',
  sv: 'swedish',
  'sv-se': 'swedish',
  swedish: 'swedish',
  cs: 'czech',
  'cs-cz': 'czech',
  cz: 'czech',
  czech: 'czech',
  pl: 'polish',
  'pl-pl': 'polish',
  polish: 'polish',
};

export function normalizePpvLang(raw: unknown): string {
  const clean = String(raw || '').trim().toLowerCase();
  if (!clean) return '';
  if (PPV_LOCALE_MAP[clean]) return PPV_LOCALE_MAP[clean];
  const base = clean.split(/[-_]/)[0] || '';
  return PPV_LOCALE_MAP[base] || clean;
}

export function cleanPpvBroadcasterName(raw: unknown): string {
  return String(raw || '')
    .replace(/^\s*(?:HD|FHD|UHD|4K|SD|1080p|720p|540p)\s*\|\s*/i, '')
    .replace(/^\s*\[embed\]\s*/i, '')
    .replace(/\s*\[[^\]]*\]\s*$/g, '')
    .trim();
}

export function isPpv540p(item: Record<string, unknown> | null | undefined): boolean {
  if (!item) return true;
  const uri = String(item.iframe ?? item.uri ?? '');
  const uriName = String(item.uri_name ?? '');
  const sourceTag = String(item.source_tag ?? item.title ?? '');
  const name = String(item.name ?? '');
  const quality = Number(item.quality);
  if (Number.isFinite(quality) && quality > 0 && quality < 720) return true;
  if (/540p/i.test(uri) || /540p/i.test(uriName)) return true;
  if (/\b540p\b|^\s*SD\s*\|/i.test(sourceTag) || /\b540p\b|^\s*SD\s*\|/i.test(name)) return true;
  return false;
}

/* 'HD | Apple TV (F1TV) [English]' → key 'apple'. The first plain word of the broadcaster name is the
   key our chips use, which is how a chip finds its own entry without hard-coding an id. */
export function taifoodKey(name: unknown): string {
  const first = cleanPpvBroadcasterName(name).replace(/\(.*?\)/g, ' ').trim().toLowerCase().split(/\s+/)[0] || '';
  return /^[a-z]+$/.test(first) ? first : '';
}

async function fetchTaifood(deps: CatalogueDeps): Promise<{ channels: Record<string, TaifoodChannel[]>; ppv: string }> {
  const response = await deps.fetchWithTimeout(`${deps.backend}${TAIFOOD_LIST}`, { cache: 'no-store', headers: { Accept: 'application/json' } }, 4000);
  if (!response.ok) throw new Error(`taifood list ${response.status}`);
  const json = await response.json();
  const out: Record<string, TaifoodChannel[]> = {};
  for (const entry of Array.isArray(json?.channels) ? json.channels : []) {
    if (!entry || typeof entry !== 'object' || isPpv540p(entry as Record<string, unknown>)) continue;
    const cleanName = cleanPpvBroadcasterName(entry?.name || entry?.source_tag);
    const key = taifoodKey(cleanName);
    const uri = String(entry?.uri || entry?.iframe || '');
    /* Same host and shape as our own candidates, and never the 540p variant (below the floor). */
    if (!key || !/^https:\/\/taifood-blog\.asia\/embed\//.test(uri)) continue;
    const lang = normalizePpvLang(entry?.lang ?? entry?.locale);
    (out[key] ||= []).push({ id: String(entry.id || ''), name: cleanName, lang, uri, status: String(entry.status || 'online') });
  }
  /* Live addresses first, but an offline one is kept: a source is never dropped for being dead. */
  for (const list of Object.values(out)) list.sort((a, b) => Number(b.status === 'online') - Number(a.status === 'online'));
  const relayPpv = typeof json?.ppv === 'string' && /^https:\/\/taifood-blog\.asia\/embed\//.test(json.ppv) && !/540p/i.test(json.ppv)
    ? json.ppv
    : '';
  return { channels: out, ppv: relayPpv };
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

/* PPV's F1 feed builder from https://api.ppv.st/api/streams.
   PPV publishes every sport it carries — American football, football, NBA, cricket, golf, rugby,
   wrestling — and every Formula 1 session carries both a main HD stream (Sky Sports F1) and a
   substreams[] array across broadcasters (Apple TV, DAZN, Sky DE, Sky Italia, V Sport, Viaplay,
   Nova Sport, Eleven Sports) in both HD and SD (_540p). We match Formula 1 events strictly and
   drop every 540p / SD variant so only >=720p PPV streams ever reach a chip. */
const PPV_F1_PATTERNS = [
  /formula[\s-]?1|\bf1\b|grand\s?prix/i,        // title or tag says F1
  /\/embed\/f1\//i,                             // the path form: /embed/f1/2026/<event>/<session>
  /---(?:race|qualifying|sprint|practice)[-\w]*/i // the session form: <event>---<session>-<id>
];
const PPV_NON_F1_SERIES = /\b(?:moto\s*gp|moto\s*[23]|formula\s*[23e]\b|f[23]\s+championship|indycar|nascar|supercars|wrc|wec)\b/i;

function extractPpvSessionSlug(stream: Record<string, unknown>): string {
  const uriName = String(stream.uri_name || stream.iframe || '');
  const pathMatch = uriName.replace(/_\d+p$/i, '').match(/(?:^|\/embed\/)f1\/\d+\/[^/]+\/([^/?#]+)/i);
  if (pathMatch) return canonicalSessionSlug(pathMatch[1]);
  const dashMatch = uriName.replace(/_\d+p$/i, '').match(/---(.+)-(\d+)$/);
  if (dashMatch) return canonicalSessionSlug(dashMatch[1]);
  const name = String(stream.name || '');
  const parts = name.split(/\s+-\s+/);
  if (parts.length > 1) return canonicalSessionSlug(parts[parts.length - 1]);
  return '';
}

function scorePpvEventWindow(stream: Record<string, unknown>, nowSec: number): [number, number] {
  const startsAt = Number(stream.starts_at) || 0;
  const endsAt = Number(stream.ends_at) || 0;
  if (!startsAt && !endsAt) return [1, 0];
  /* Live / imminent window (30 min before start through 30 min after scheduled end) ranks first. */
  if (startsAt - 1800 <= nowSec && (endsAt ? nowSec <= endsAt + 1800 : nowSec <= startsAt + 10800)) {
    return [0, startsAt];
  }
  if (startsAt > nowSec) return [1, startsAt];
  return [2, -(endsAt || startsAt)];
}

export interface ParsedPpvPack {
  taifood: Record<string, TaifoodChannel[]>;
  ppv: string;
  ppvSessions: Record<string, string>;
}

export function parsePpvStreams(json: unknown, nowMs = Date.now()): ParsedPpvPack {
  const taifood: Record<string, TaifoodChannel[]> = {};
  const ppvSessions: Record<string, string> = {};
  let ppv = '';
  const seenByBucket: Record<string, Set<string>> = {};
  const rawGroups = Array.isArray((json as { streams?: unknown })?.streams)
    ? ((json as { streams: Record<string, unknown>[] }).streams)
    : [];
  const f1Events: Record<string, unknown>[] = [];

  for (const group of rawGroups) {
    const entries = Array.isArray(group?.streams)
      ? (group.streams as Record<string, unknown>[])
      : (group && typeof group === 'object' ? [group] : []);
    for (const stream of entries) {
      if (!stream || typeof stream !== 'object') continue;
      const uri = String(stream.iframe || stream.uri || '');
      const tagAndTitle = `${stream.tag || ''} ${stream.name || ''}`;
      if (!/formula[\s-]?1|\bf1\b/i.test(String(stream.tag || '')) && PPV_NON_F1_SERIES.test(tagAndTitle)) continue;
      const haystack = [stream.name, stream.tag, stream.source_tag, stream.category_name, stream.uri_name, uri].join(' ');
      if (!PPV_F1_PATTERNS.some((pattern) => pattern.test(haystack))) continue;
      f1Events.push(stream);
    }
  }

  const nowSec = Math.floor(nowMs / 1000);
  f1Events.sort((a, b) => {
    const [rankA, tieA] = scorePpvEventWindow(a, nowSec);
    const [rankB, tieB] = scorePpvEventWindow(b, nowSec);
    return rankA !== rankB ? rankA - rankB : tieA - tieB;
  });

  const pushChannel = (item: Record<string, unknown>) => {
    if (isPpv540p(item)) return;
    const uri = String(item.iframe ?? item.uri ?? '').trim();
    if (!/^https:\/\/taifood-blog\.asia\/embed\//i.test(uri)) return;
    /* Path-form embeds (/embed/f1/...) belong to the main Sky Sports (PPV) chip, never substream buckets. */
    if (/\/embed\/f1\//i.test(uri)) return;
    const labelSource = item.source_tag || item.title || item.name;
    const cleanName = cleanPpvBroadcasterName(labelSource);
    const key = taifoodKey(cleanName);
    if (!key) return;
    const seen = (seenByBucket[key] ||= new Set<string>());
    if (seen.has(uri)) return;
    seen.add(uri);
    const lang = normalizePpvLang(item.locale ?? item.lang);
    (taifood[key] ||= []).push({
      id: String(item.id || ''),
      name: cleanName,
      lang,
      uri,
      status: 'online',
    });
  };

  for (const event of f1Events) {
    const mainUri = String(event.iframe ?? event.uri ?? '').trim();
    const sessionSlug = extractPpvSessionSlug(event);
    if (!isPpv540p(event) && /^https:\/\/taifood-blog\.asia\/embed\//i.test(mainUri)) {
      if (!ppv) ppv = mainUri;
      if (sessionSlug && !ppvSessions[sessionSlug]) ppvSessions[sessionSlug] = mainUri;
      pushChannel(event);
    }
    const substreams = Array.isArray(event.substreams) ? (event.substreams as Record<string, unknown>[]) : [];
    for (const sub of substreams) {
      if (!sub || typeof sub !== 'object') continue;
      pushChannel(sub);
    }
  }

  return { taifood, ppv, ppvSessions };
}

function mergeTaifoodCatalogues(
  primary: Record<string, TaifoodChannel[]>,
  fallback: Record<string, TaifoodChannel[]>,
): Record<string, TaifoodChannel[]> {
  const out: Record<string, TaifoodChannel[]> = {};
  const keys = new Set([...Object.keys(primary || {}), ...Object.keys(fallback || {})]);
  for (const key of keys) {
    const merged: TaifoodChannel[] = [];
    const seen = new Set<string>();
    for (const item of [...(primary[key] || []), ...(fallback[key] || [])]) {
      if (!item?.uri || /540p/i.test(item.uri) || seen.has(item.uri)) continue;
      seen.add(item.uri);
      merged.push(item);
    }
    if (merged.length) out[key] = merged;
  }
  return out;
}

async function fetchPpv(deps: CatalogueDeps): Promise<ParsedPpvPack> {
  const response = await deps.fetchWithTimeout(PPV_STREAMS, { cache: 'no-store', headers: { Accept: 'application/json' } }, 7000);
  if (!response.ok) throw new Error(`ppv ${response.status}`);
  const json = await response.json();
  return parsePpvStreams(json);
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
    const [embdlol, cdnlive, mirrors, weelo, relayTaifood, weellzPack, ppvPack] = await Promise.all([
      fetchEmbdlol(deps).catch(() => cached.embdlol),
      fetchCdnLive(deps).catch(() => cached.cdnlive),
      fetchMirrors(deps).catch(() => cached.mirrors),
      fetchWeelo(deps).catch(() => cached.weelo),
      fetchTaifood(deps).catch(() => ({ channels: {} as Record<string, TaifoodChannel[]>, ppv: '' })),
      fetchWeellz(deps).catch(() => ({ weellz: cached.weellz || emptyWeellz(), weeloEvents: cached.weeloEvents })),
      fetchPpv(deps).catch(() => ({ taifood: {}, ppv: cached.ppv, ppvSessions: cached.ppvSessions || {} })),
    ]);
    const mergedTaifood = mergeTaifoodCatalogues(ppvPack.taifood, relayTaifood.channels);
    const taifood = Object.keys(mergedTaifood).length ? mergedTaifood : cached.taifood;
    cached = {
      embdlol,
      cdnlive,
      mirrors,
      weelo,
      taifood,
      weeloEvents: weellzPack.weeloEvents,
      ppv: ppvPack.ppv || relayTaifood.ppv || cached.ppv,
      ppvSessions: Object.keys(ppvPack.ppvSessions).length ? ppvPack.ppvSessions : (cached.ppvSessions || {}),
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
