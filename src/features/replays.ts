import type { FeatureContext } from '../app';
import { $ } from '../services/dom';
import replayData from '../data/replays.json';

/* ═══════════════ RACE REPLAYS ═══════════════
   The index itself is generated at build time by scripts/fetch-replays.mjs (npm run replays),
   which reads fullraces.com's published sitemap and then each session page to find the players
   it embeds. It has to be build time: fullraces sits behind Cloudflare, which refuses Node's
   TLS fingerprint, and the browser cannot fetch it at all (CORS + our own CSP). So the view is
   a plain reader over a JSON file that ships with the build — no runtime scraping, no backend
   dependency, and it works offline once the page has loaded.

   We never copy a video: each feed is an <iframe> pointing at the source's own player, exactly
   as the page we read it from does. */

interface ReplayPlayer { provider: string; url: string }
interface ReplayItem {
  slug: string;
  url: string;
  season: number | null;
  session: string;
  sessionKey: string;
  event: string;
  date: string | null;
  players: ReplayPlayer[];
  fetchedAt?: string | null;
}

interface ReplayIndex {
  generatedAt: string;
  source: string;
  seasons: number[];
  count: number;
  withPlayers: number;
  items: ReplayItem[];
}

const index = replayData as unknown as ReplayIndex;
/* An embed gets this long to produce a document before we call it blocked. */
const FEED_TIMEOUT_MS = 8000;

/* Race weekend sessions only, in the order a weekend happens. The source also publishes
   press conferences, Paddock Uncut and The F1 Show; those are deliberately not listed. */
const SESSION_ORDER = [
  ['race', 'Race'],
  ['qualifying', 'Qualifying'],
  ['sprint', 'Sprint'],
  ['sprint-qualifying', 'Sprint Qualifying'],
  ['1st-practice', 'Practice 1'],
  ['2nd-practice', 'Practice 2'],
  ['3rd-practice', 'Practice 3']
];

export function init(_ctx: FeatureContext) {
  const listEl = $('replayList');
  const seasonsEl = $('replaySeasons');
  const sessionsEl = $('replaySessions');
  const panel = $('replayPlayer');
  const frameBox = $('replayFrameBox');
  const emptyEl = $('replayEmpty');
  const titleEl = $('replayTitle');
  const subEl = $('replaySub');
  const feedsEl = $('replayFeeds');
  const countEl = $('replayCount');
  const closeBtn = $('replayClose');
  if (!listEl || !seasonsEl || !sessionsEl) return {};

  const SESSION_KEYS = new Set(SESSION_ORDER.map(([key]) => key));
  const playable = index.items.filter((item) => item.players.length > 0 && SESSION_KEYS.has(item.sessionKey));
  const seasons = [...new Set(playable.map((item) => item.season).filter((year): year is number => Boolean(year)))].sort((a, b) => b - a);

  let activeSeason = seasons[0] || null;
  let activeSession = 'race';
  let activeItem: ReplayItem | null = null;

  const sessionLabel = (item: ReplayItem) => item.session || 'Session';
  const prettyDate = (value: string | null) => {
    if (!value) return '';
    const parsed = new Date(value + 'T12:00:00Z');
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  /* The site's own tab control (same markup as the standings and info tabs). */
  function chip(label: string, active: boolean, onClick: () => void) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab' + (active ? ' active' : '');
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(active));
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function renderSeasons() {
    seasonsEl.innerHTML = '';
    seasons.forEach((season) => {
      seasonsEl.appendChild(chip(String(season), season === activeSeason, () => {
        activeSeason = season;
        renderSeasons();
        renderSessions();
        renderList();
      }));
    });
  }

  function renderSessions() {
    sessionsEl.innerHTML = '';
    const sameSeason = playable.filter((item) => item.season === activeSeason);
    const counts = new Map<string, number>();
    sameSeason.forEach((item) => counts.set(item.sessionKey, (counts.get(item.sessionKey) || 0) + 1));
    const chips: Array<[string, string, number]> = SESSION_ORDER
      .filter(([key]) => counts.has(key))
      .map(([key, label]) => [key, label, counts.get(key) || 0]);
    // A season can lack the currently selected type (no sprints, for example): fall back.
    if (!chips.some(([key]) => key === activeSession) && chips.length) activeSession = chips[0][0];

    chips.forEach(([key, label, count]) => {
      sessionsEl.appendChild(chip(`${label} (${count})`, key === activeSession, () => {
        activeSession = key;
        renderSessions();
        renderList();
      }));
    });
  }

  function renderList() {
    const items = playable.filter((item) => item.season === activeSeason && item.sessionKey === activeSession);
    listEl.innerHTML = '';
    if (!items.length) {
      const state = document.createElement('div');
      state.className = 'state';
      state.textContent = 'No replays of that session yet.';
      listEl.appendChild(state);
      if (countEl) countEl.textContent = '0 sessions';
      return;
    }
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'row rp-row' + (activeItem && activeItem.slug === item.slug ? ' is-active' : '');
      const feeds = item.players.map((player) => player.provider).join(' · ');
      row.innerHTML =
        `<span class="rp-main"><span class="rp-event">${escapeText(item.event || 'Grand Prix')}</span>` +
        `<span class="rp-meta-line">${prettyDate(item.date)} · ${escapeText(feeds)}</span></span>` +
        `<span class="rp-session">${escapeText(sessionLabel(item))}</span>` +
        `<span class="rp-play">Play</span>`;
      row.addEventListener('click', () => openReplay(item));
      fragment.appendChild(row);
    });
    listEl.appendChild(fragment);
    if (countEl) countEl.textContent = `${items.length} session${items.length === 1 ? '' : 's'}`;
  }

  /* Most providers autoplay when asked; the flag is only a request, never a requirement. */
  function withAutoplay(url: string): string {
    try {
      const parsed = new URL(url);
      if (!parsed.searchParams.has('autoplay')) parsed.searchParams.set('autoplay', '1');
      return parsed.href;
    } catch (_) {
      return url;
    }
  }

  /* A cross-origin frame we cannot read is assumed to have loaded; one still on about:blank is not. */
  function committed(frame: HTMLIFrameElement): boolean {
    try {
      const href = frame.contentWindow ? frame.contentWindow.location.href : '';
      return href !== '' && href !== 'about:blank';
    } catch (_) {
      return true;
    }
  }

  function showEmpty(message: string, directUrl?: string) {
    frameBox.innerHTML = '';
    emptyEl.hidden = false;
    emptyEl.textContent = message;
    if (!directUrl) return;
    const link = document.createElement('a');
    link.className = 'rp-direct';
    link.href = directUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open it on the provider’s site';
    emptyEl.append(document.createElement('br'), link);
  }

  function hideEmpty() {
    emptyEl.hidden = true;
    emptyEl.textContent = 'This session has no embeddable player yet.';
  }

  function escapeText(value: string) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));
  }

  /* Each player is its own iframe pointing at the source's player host. The urls come from the
     build-time file, but they are still checked before being put in a src. */
  function loadFeed(item: ReplayItem, playerIndex: number) {
    const player = item.players[playerIndex];
    if (!player || !/^https:\/\//i.test(player.url)) {
      frameBox.innerHTML = '';
      showEmpty('This session has no embeddable player yet.');
      return;
    }
    const frame = document.createElement('iframe');
    /* Play on click, not on arrival: an embed that has to be woken up by a second click inside
       the frame reads as "the play button does nothing". */
    frame.src = withAutoplay(player.url);
    frame.title = `${sessionLabel(item)} replay`;
    frame.loading = 'eager';
    frame.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    frame.allowFullscreen = true;
    frame.setAttribute('allowfullscreen', '');
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('frameborder', '0');
    frame.setAttribute('scrolling', 'no');
    frameBox.replaceChildren(frame);
    hideEmpty();

    /* A provider that refuses to be embedded leaves an empty box and no error event, so the
       frame is given a few seconds to commit a document. If it never does, say so and offer the
       other feeds plus a direct link, rather than a dead rectangle. */
    const startedAt = Date.now();
    const watchdog = window.setInterval(() => {
      if (!frame.isConnected) return window.clearInterval(watchdog);
      if (committed(frame)) return window.clearInterval(watchdog);
      if (Date.now() - startedAt < FEED_TIMEOUT_MS) return;
      window.clearInterval(watchdog);
      frame.remove();
      showEmpty('This feed will not play in an embedded player here.', player.url);
    }, 500);

    feedsEl.querySelectorAll<HTMLElement>('button').forEach((button, i) => {
      button.classList.toggle('active', i === playerIndex);
      button.setAttribute('aria-pressed', String(i === playerIndex));
    });
  }

  function openReplay(item: ReplayItem) {
    activeItem = item;
    panel.hidden = false;
    titleEl.textContent = `${sessionLabel(item)} · ${item.event || 'Grand Prix'}`;
    subEl.textContent = `${prettyDate(item.date)} · ${item.players.length} feed${item.players.length === 1 ? '' : 's'} · ${item.season || ''}`.trim();

    feedsEl.innerHTML = '';
    item.players.forEach((player, i) => {
      feedsEl.appendChild(chip(player.provider, i === 0, () => loadFeed(item, i)));
    });
    loadFeed(item, 0);
    renderList();
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  closeBtn?.addEventListener('click', () => {
    panel.hidden = true;
    frameBox.innerHTML = '';
    activeItem = null;
    renderList();
  });

  renderSeasons();
  renderSessions();
  renderList();
  return {};
}
