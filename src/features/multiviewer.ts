/* Multiviewer — full-viewport multi-stream theater inspired by Rerace.
   Supports up to 9 simultaneous weellz.live F1 feeds (3x3 ceiling), Grid & Focus ("one big player,
   the rest small") layouts, GPU transform tile transitions, pointer drag-to-swap without reloading
   iframes, per-tile audio routing, fullscreen, keyboard shortcuts, and a searchable/filterable
   "Add streams" drawer with official 2026 driver portraits.

   Loaded lazily: visitors who never open Multiviewer download none of this chunk. */

import { BACKEND_API } from '../config';
import { DRIVER_PORTRAIT, headshot } from '../data/driver-portraits';

export type FeedCategory = 'broadcast' | 'onboard' | 'data';
export type BadgeKind = 'driver' | 'f1' | 'sky' | 'tracker' | 'data' | 'tv';

export interface FeedMeta {
  title: string;
  subtitle: string;
  category: FeedCategory;
  driverKey: string | null;
  badgeKind: BadgeKind;
}

export interface WeeloStream extends FeedMeta {
  id: string;
  streamId: string;
  label: string;
  live: boolean;
  stripped?: boolean;
  pasted?: string;
}

export interface TileBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MAX_TILES = 9;
const GAP = 6;
const STATE_KEY = 'freef1_mvx_state_v1';

export const PLAYER = 'https://weellz.live/beta?stream=';
const ALLOW = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
const STRIPPED_SANDBOX = 'allow-scripts allow-same-origin allow-presentation';
const STREAM_API = typeof location !== 'undefined' && location.protocol === 'https:' && !/\.e2b\.app$/i.test(location.hostname)
  ? location.origin
  : BACKEND_API;

export function strippedPlayerUrl(streamId: string, apiBase = STREAM_API): string {
  const base = String(apiBase || '').replace(/\/+$/, '');
  return `${base}/api/stream/weellz-embed?stream=${encodeURIComponent(streamId)}`;
}

export function tileUrl(id: string, muted: boolean, base = ''): string {
  const url = base || `${PLAYER}${id}`;
  try {
    const parsed = url.startsWith('/') && typeof window !== 'undefined'
      ? new URL(url, window.location.origin)
      : new URL(url);
    parsed.searchParams.set('autoplay', '1');
    parsed.searchParams.set('mute', muted ? '1' : '0');
    return parsed.href;
  } catch {
    return `${url}${url.includes('?') ? '&' : '?'}autoplay=1&mute=${muted ? 1 : 0}`;
  }
}

function fit16x9(width: number, height: number): { w: number; h: number } {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  if (!w || !h) return { w: 0, h: 0 };
  return w / h > 16 / 9 ? { w: h * (16 / 9), h } : { w, h: w * (9 / 16) };
}

/* Optimal equal-size 16:9 grid inside width x height. */
export function layout(count: number, width: number, height: number): TileBox[] {
  if (count < 1 || width <= 0 || height <= 0) return [];
  let best: { cols: number; rows: number; t: { w: number; h: number } } | null = null;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const t = fit16x9((width - GAP * (cols - 1)) / cols, (height - GAP * (rows - 1)) / rows);
    if (!best || t.w > best.t.w) best = { cols, rows, t };
  }
  const { cols, rows, t } = best!;
  const top = (height - (rows * t.h + (rows - 1) * GAP)) / 2;
  const boxes: TileBox[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, count - row * cols);
    const left = (width - (inRow * t.w + (inRow - 1) * GAP)) / 2;
    boxes.push({
      x: left + (i % cols) * (t.w + GAP),
      y: top + row * (t.h + GAP),
      w: t.w,
      h: t.h,
    });
  }
  return boxes;
}

/* Focus mode: one large primary 16:9 tile + remaining tiles in a compact side/bottom strip. */
export function focusLayout(count: number, width: number, height: number): TileBox[] {
  if (count < 1 || width <= 0 || height <= 0) return [];
  if (count === 1) return layout(1, width, height);

  const rest = count - 1;
  if (width / height >= 1.25) {
    const cols = rest > 4 ? 2 : 1;
    const rows = Math.ceil(rest / cols);
    const sideShare = cols === 1 ? 0.26 : 0.34;
    const side = fit16x9((width * sideShare - GAP * (cols - 1)) / cols, (height - GAP * (rows - 1)) / rows);
    const stripW = cols * side.w + (cols - 1) * GAP;
    const main = fit16x9(width - stripW - GAP, height);
    const startX = (width - (main.w + GAP + stripW)) / 2;
    const boxes: TileBox[] = [{ x: startX, y: (height - main.h) / 2, w: main.w, h: main.h }];
    const stripH = rows * side.h + (rows - 1) * GAP;
    for (let i = 0; i < rest; i++) {
      boxes.push({
        x: startX + main.w + GAP + (i % cols) * (side.w + GAP),
        y: (height - stripH) / 2 + Math.floor(i / cols) * (side.h + GAP),
        w: side.w,
        h: side.h,
      });
    }
    return boxes;
  }

  const main = fit16x9(width, height * 0.45);
  const cols = 2;
  const rows = Math.ceil(rest / cols);
  const side = fit16x9((width - GAP) / cols, (height - main.h - GAP - GAP * (rows - 1)) / rows);
  const boxes: TileBox[] = [{ x: (width - main.w) / 2, y: 0, w: main.w, h: main.h }];
  for (let i = 0; i < rest; i++) {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, rest - row * cols);
    const left = (width - (inRow * side.w + (inRow - 1) * GAP)) / 2;
    boxes.push({
      x: left + (i % cols) * (side.w + GAP),
      y: main.h + GAP + row * (side.h + GAP),
      w: side.w,
      h: side.h,
    });
  }
  return boxes;
}

const DRIVER_MATCHERS: [string, RegExp][] = [
  ['antonelli', /\b(antonelli|kimi)\b/i],
  ['russell', /\b(russell|george)\b/i],
  ['leclerc', /\b(leclerc|charles)\b/i],
  ['hamilton', /\b(hamilton|lewis)\b/i],
  ['norris', /\b(norris|lando)\b/i],
  ['piastri', /\b(piastri|oscar)\b/i],
  ['verstappen', /\b(verstappen|max)\b/i],
  ['hadjar', /\b(hadjar|isack)\b/i],
  ['lawson', /\b(lawson|liam)\b/i],
  ['lindblad', /\b(lindblad|arvid)\b/i],
  ['tsunoda', /\b(tsunoda|yuki)\b/i],
  ['gasly', /\b(gasly|pierre)\b/i],
  ['colapinto', /\b(colapinto|franco)\b/i],
  ['ocon', /\b(ocon|esteban)\b/i],
  ['bearman', /\b(bearman|ollie|oliver)\b/i],
  ['hirakawa', /\b(hirakawa|ryo)\b/i],
  ['hulkenberg', /\b(hulkenberg|hülkenberg|nico)\b/i],
  ['bortoleto', /\b(bortoleto|gabriel)\b/i],
  ['sainz', /\b(sainz|carlos)\b/i],
  ['albon', /\b(albon|alex|alexander)\b/i],
  ['alonso', /\b(alonso|fernando)\b/i],
  ['stroll', /\b(stroll|lance)\b/i],
  ['perez', /\b(perez|pérez|checo|sergio)\b/i],
  ['bottas', /\b(bottas|valtteri)\b/i],
];

export function describeFeed(source: { id?: string; label: string; special?: string; stripped?: boolean }): FeedMeta {
  const raw = String(source.label || '').trim();
  const low = raw.toLowerCase();
  const withStripped = (sub: string) => (source.stripped ? `${sub} · Stripped` : sub);

  if (/drivers?\s*track|driver\s*tracker|pit\s*lane|tracker/i.test(raw) || source.id === 'weelo-drivers' || source.id === 'weelo-stripped-drivers') {
    return {
      title: /drivers?\s*track$/i.test(raw) ? 'Driver Tracker' : raw,
      subtitle: withStripped('Live GPS map'),
      category: 'data',
      driverKey: null,
      badgeKind: 'tracker',
    };
  }

  if (/data\s*channel|telemetry|timing/i.test(raw) || source.id === 'weelo-data' || source.id === 'weelo-stripped-data' || source.special === 'data') {
    return {
      title: 'Data Channel',
      subtitle: withStripped('Live timing & sectors'),
      category: 'data',
      driverKey: null,
      badgeKind: 'data',
    };
  }

  for (const [key, rx] of DRIVER_MATCHERS) {
    if (rx.test(raw) && DRIVER_PORTRAIT[key]) {
      const cleanName = raw.replace(/\s*\((onboard|weelo)\)\s*/ig, '').trim();
      return {
        title: cleanName,
        subtitle: withStripped('Onboard'),
        category: 'onboard',
        driverKey: key,
        badgeKind: 'driver',
      };
    }
  }

  if (source.special === 'onboard') {
    return {
      title: raw.replace(/\s*\((onboard|weelo)\)\s*/ig, '').trim() || raw,
      subtitle: withStripped('Onboard'),
      category: 'onboard',
      driverKey: null,
      badgeKind: 'tv',
    };
  }

  if (low.includes('sky sports')) {
    return {
      title: 'Sky Sports F1',
      subtitle: withStripped('UK · English'),
      category: 'broadcast',
      driverKey: null,
      badgeKind: 'sky',
    };
  }

  if (low.includes('international feed')) {
    return {
      title: 'International Feed',
      subtitle: withStripped('Multi-audio'),
      category: 'broadcast',
      driverKey: null,
      badgeKind: 'f1',
    };
  }

  if (low.includes('f1 tv') && low.includes('world')) {
    return {
      title: 'F1 TV Live',
      subtitle: withStripped('F1 Live · English'),
      category: 'broadcast',
      driverKey: null,
      badgeKind: 'f1',
    };
  }

  if (low.includes('f1 tv') && low.includes('show')) {
    return {
      title: 'F1 TV Shows',
      subtitle: withStripped('Pre & post-session'),
      category: 'broadcast',
      driverKey: null,
      badgeKind: 'f1',
    };
  }

  return {
    title: raw.replace(/\s*\(weelo\)\s*/ig, '').trim() || raw,
    subtitle: withStripped('Live broadcast'),
    category: 'broadcast',
    driverKey: null,
    badgeKind: low.includes('f1') ? 'f1' : 'tv',
  };
}

const icon = (name: string) => {
  const paths: Record<string, string> = {
    grid: '<path d="M100,36H56A20,20,0,0,0,36,56v44a20,20,0,0,0,20,20h44a20,20,0,0,0,20-20V56A20,20,0,0,0,100,36ZM96,96H60V60H96ZM200,36H156a20,20,0,0,0-20,20v44a20,20,0,0,0,20,20h44a20,20,0,0,0,20-20V56A20,20,0,0,0,200,36Zm-4,60H160V60h36Zm-96,40H56a20,20,0,0,0-20,20v44a20,20,0,0,0,20,20h44a20,20,0,0,0,20-20V156A20,20,0,0,0,100,136Zm-4,60H60V160H96Zm104-60H156a20,20,0,0,0-20,20v44a20,20,0,0,0,20,20h44a20,20,0,0,0,20-20V156A20,20,0,0,0,200,136Zm-4,60H160V160h36Z"/>',
    focus: '<path d="M220,48V96a12,12,0,0,1-24,0V77l-39.51,39.52a12,12,0,0,1-17-17L179,60H160a12,12,0,0,1,0-24h48A12,12,0,0,1,220,48ZM99.51,139.51,60,179V160a12,12,0,0,0-24,0v48a12,12,0,0,0,12,12H96a12,12,0,0,0,0-24H77l39.52-39.51a12,12,0,0,0-17-17Z"/>',
    plus: '<path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z"/>',
    maximize: '<path d="M220,48V88a12,12,0,0,1-24,0V60H168a12,12,0,0,1,0-24h40A12,12,0,0,1,220,48ZM88,196H60V168a12,12,0,0,0-24,0v40a12,12,0,0,0,12,12H88a12,12,0,0,0,0-24Zm120-40a12,12,0,0,0-12,12v28H168a12,12,0,0,0,0,24h40a12,12,0,0,0,12-12V168A12,12,0,0,0,208,156ZM88,36H48A12,12,0,0,0,36,48V88a12,12,0,0,0,24,0V60H88a12,12,0,0,0,0-24Z"/>',
    minimize: '<path d="M148,96V48a12,12,0,0,1,24,0V84h36a12,12,0,0,1,0,24H160A12,12,0,0,1,148,96ZM96,148H48a12,12,0,0,0,0,24H84v36a12,12,0,0,0,24,0V160A12,12,0,0,0,96,148Zm112,0H160a12,12,0,0,0-12,12v48a12,12,0,0,0,24,0V172h36a12,12,0,0,0,0-24ZM96,36A12,12,0,0,0,84,48V84H48a12,12,0,0,0,0,24H96a12,12,0,0,0,12-12V48A12,12,0,0,0,96,36Z"/>',
    close: '<path d="M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z"/>',
    volume: '<path d="M168,32V224a8,8,0,0,1-12.91,6.31L85.25,176H40a16,16,0,0,1-16-16V96A16,16,0,0,1,40,80H85.25l69.84-54.31A8,8,0,0,1,168,32Zm32,64a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V104A8,8,0,0,0,200,96Zm32-16a8,8,0,0,0-8,8v80a8,8,0,0,0,16,0V88A8,8,0,0,0,232,80Z"/>',
    muted: '<path d="M221.92,210.62a8,8,0,1,1-11.84,10.76L168,175.09v48.6a8.29,8.29,0,0,1-3.91,7.18,8,8,0,0,1-9-.56L85.25,176H40a16,16,0,0,1-16-16V96A16,16,0,0,1,40,80H81.55L50.08,45.38A8,8,0,0,1,61.92,34.62ZM200.53,160a8.17,8.17,0,0,0,7.47-8.25V104.27A8.17,8.17,0,0,0,200.53,96a8,8,0,0,0-8.53,8v48A8,8,0,0,0,200.53,160ZM161,119.87a4,4,0,0,0,7-2.7V32.24a8.25,8.25,0,0,0-2.88-6.39,8,8,0,0,0-10-.16L111.83,59.33a4,4,0,0,0-.5,5.85ZM231.47,80A8.17,8.17,0,0,0,224,88.27v79.46a8.17,8.17,0,0,0,7.47,8.25,8,8,0,0,0,8.53-8V88A8,8,0,0,0,231.47,80Z"/>',
    check: '<path d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z"/>',
    search: '<path d="M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z"/>',
    tracker: '<path d="M200,164a36.07,36.07,0,0,0-33.94,24H72a28,28,0,0,1,0-56h96a44,44,0,0,0,0-88H72a12,12,0,0,0,0,24h96a20,20,0,0,1,0,40H72a52,52,0,0,0,0,104h94.06A36,36,0,1,0,200,164Zm0,48a12,12,0,1,1,12-12A12,12,0,0,1,200,212Z"/>',
    data: '<path d="M236,208a12,12,0,0,1-12,12H32a12,12,0,0,1-12-12V48a12,12,0,0,1,24,0v99l43.51-43.52a12,12,0,0,1,17,0L128,127l43-43H160a12,12,0,0,1,0-24h40a12,12,0,0,1,12,12v40a12,12,0,0,1-24,0V101l-51.51,51.52a12,12,0,0,1-17,0L96,129,44,181v15H224A12,12,0,0,1,236,208Z"/>',
    tv: '<path d="M216,64H147.31l34.35-34.34a8,8,0,1,0-11.32-11.32L128,60.69,85.66,18.34A8,8,0,0,0,74.34,29.66L108.69,64H40A24,24,0,0,0,16,88V200a24,24,0,0,0,24,24H216a24,24,0,0,0,24-24V88A24,24,0,0,0,216,64Zm8,136a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V88a8,8,0,0,1,8-8H216a8,8,0,0,1,8,8Z"/>',
  };
  return `<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${paths[name] || ''}</svg>`;
};

function renderAvatar(stream: WeeloStream, large = false): string {
  const sz = large ? ' is-lg' : '';
  if (stream.badgeKind === 'driver' && stream.driverKey) {
    const url = headshot(stream.driverKey, 96);
    const initials = stream.title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('');
    return `<span class="mvx-avatar mvx-avatar-driver${sz}" aria-hidden="true"><b class="mvx-avatar-init">${escapeText(initials)}</b><img src="${url}" alt="" decoding="async"></span>`;
  }
  if (stream.badgeKind === 'f1') {
    return `<span class="mvx-avatar mvx-avatar-logo${sz}" aria-hidden="true"><svg viewBox="0 0 40 20" fill="none"><path d="M4 15.5 9.2 5h8.2l-1.9 3.6h-3.8l-.8 1.5h3.5l-1.7 3.2h-3.5l-1.1 2.2H4Zm14.2 0L23.4 5h8.5l-1.8 3.6h-4.9l-3.4 6.9h-3.6ZM31.4 15.5l5.2-10.5H40l-5.2 10.5h-3.4Z" fill="#E10600"/></svg></span>`;
  }
  if (stream.badgeKind === 'sky') {
    return `<span class="mvx-avatar mvx-avatar-logo is-sky${sz}" aria-hidden="true"><b>SKY</b><i>F1</i></span>`;
  }
  if (stream.badgeKind === 'tracker') {
    return `<span class="mvx-avatar mvx-avatar-icon is-tracker${sz}" aria-hidden="true">${icon('tracker')}</span>`;
  }
  if (stream.badgeKind === 'data') {
    return `<span class="mvx-avatar mvx-avatar-icon is-data${sz}" aria-hidden="true">${icon('data')}</span>`;
  }
  return `<span class="mvx-avatar mvx-avatar-icon${sz}" aria-hidden="true">${icon('tv')}</span>`;
}

function escapeText(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function init(ctx: any) {
  const host = document.body;
  const toggled = document.getElementById('mvToggle');
  if (!host || (document.getElementById('multiViewer') && toggled?.dataset.wired)) return ctx.multiViewer;

  const panel = document.createElement('div');
  panel.id = 'multiViewer';
  panel.className = 'mvx';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Multiviewer');
  panel.hidden = true;
  panel.innerHTML = `
    <header class="mvx-top mvx-bar">
      <div class="mvx-brand">
        <span class="mvx-live-dot" aria-hidden="true"></span>
        <span class="mvx-brand-title">Multiviewer</span>
        <span class="mvx-count" data-mvx-count></span>
        <span class="mvx-online" data-mvx-online-wrap hidden><i aria-hidden="true"></i><b data-mvx-online>—</b> watching</span>
      </div>
      <div class="mvx-seg" role="group" aria-label="Layout">
        <button type="button" aria-pressed="true" data-mvx-mode="grid" title="All players the same size (G)">${icon('grid')}<span>Grid</span></button>
        <button type="button" aria-pressed="false" data-mvx-mode="focus" title="One big player, the rest small (G)">${icon('focus')}<span>Focus</span></button>
      </div>
      <div class="mvx-actions">
        <button type="button" class="mvx-btn mvx-add" data-mvx-open-lib>${icon('plus')}<span>Add feed</span></button>
        <button type="button" class="mvx-btn mvx-icon-btn" data-mvx-full aria-label="Full screen" title="Full screen (F)">${icon('maximize')}</button>
        <button type="button" class="mvx-btn mvx-icon-btn mvx-close" data-mvx-close aria-label="Close multiviewer" title="Close (Esc)">${icon('close')}</button>
      </div>
    </header>
    <div class="mvx-stage" data-mvx-stage>
      <div class="mvx-tiles" data-mvx-tiles></div>
    </div>
    <aside class="mvx-library mvx-lib" data-mvx-lib hidden aria-label="Add streams">
      <div class="mvx-lib-top">
        <div class="mvx-lib-head">
          <p class="mvx-lib-title">Add streams</p>
          <button type="button" class="mvx-btn mvx-icon-btn" data-mvx-lib-close aria-label="Close stream list" title="Close">${icon('close')}</button>
        </div>
        <label class="mvx-search">
          ${icon('search')}
          <input type="search" placeholder="Drivers, broadcasts, pit wall…" autocomplete="off" spellcheck="false" data-mvx-search>
          <button type="button" class="mvx-search-clear" aria-label="Clear search" data-mvx-clear hidden>${icon('close')}</button>
        </label>
        <div class="mvx-filters" role="tablist" aria-label="Filter streams" data-mvx-filters></div>
      </div>
      <div class="mvx-lib-body">
        <p class="mvx-lib-note" data-mvx-note hidden></p>
        <div data-mvx-list></div>
      </div>
    </aside>
  `;
  host.appendChild(panel);

  const stageEl = panel.querySelector<HTMLElement>('[data-mvx-stage]')!;
  const tilesEl = panel.querySelector<HTMLElement>('[data-mvx-tiles]')!;
  const libEl = panel.querySelector<HTMLElement>('[data-mvx-lib]')!;
  const countEl = panel.querySelector<HTMLElement>('[data-mvx-count]')!;
  const onlineWrapEl = panel.querySelector<HTMLElement>('[data-mvx-online-wrap]')!;
  const onlineEl = panel.querySelector<HTMLElement>('[data-mvx-online]')!;
  const noteEl = panel.querySelector<HTMLElement>('[data-mvx-note]')!;
  const listEl = panel.querySelector<HTMLElement>('[data-mvx-list]')!;
  const searchInput = panel.querySelector<HTMLInputElement>('[data-mvx-search]')!;
  const clearBtn = panel.querySelector<HTMLButtonElement>('[data-mvx-clear]')!;
  const filtersEl = panel.querySelector<HTMLElement>('[data-mvx-filters]')!;
  const addBtn = panel.querySelector<HTMLButtonElement>('[data-mvx-open-lib]')!;
  const fullBtn = panel.querySelector<HTMLButtonElement>('[data-mvx-full]')!;

  const tiles = new Map<string, HTMLElement>();
  const frames = new Map<string, HTMLIFrameElement>();
  const loadTimers = new Map<HTMLElement, number>();
  let ids: string[] = [];
  let audio: string | null = null;
  let mode: 'grid' | 'focus' = 'grid';
  let query = '';
  let filter: 'all' | FeedCategory = 'all';
  let open = false;

  function clearTileLoading(tile: HTMLElement | undefined) {
    if (!tile) return;
    const prev = loadTimers.get(tile);
    if (prev !== undefined) {
      window.clearTimeout(prev);
      loadTimers.delete(tile);
    }
    tile.classList.remove('is-loading');
  }

  function markTileLoading(tile: HTMLElement | undefined, timeoutMs = 4500) {
    if (!tile) return;
    const prev = loadTimers.get(tile);
    if (prev !== undefined) window.clearTimeout(prev);
    tile.classList.add('is-loading');
    const timer = window.setTimeout(() => clearTileLoading(tile), timeoutMs);
    loadTimers.set(tile, timer);
  }

  const streams = (): WeeloStream[] => (ctx.sources || [])
    .filter((s: any) => (s.weelo || s.weellzUrls?.length) && (!s.hidden || s.links?.[0]?.provider === 'custom'))
    .map((s: any): WeeloStream => {
      const custom = s.links?.[0]?.provider === 'custom' ? String(s.links[0].url || '') : '';
      const synced = Array.isArray(s.weellzUrls) && s.weellzUrls.length ? String(s.weellzUrls[0] || '') : '';
      let streamId = String(s.weelo || '');
      if (!streamId && synced) {
        try { streamId = new URL(synced, 'https://weellz.live').searchParams.get('stream') || ''; } catch { /* ignore */ }
      }
      if (!streamId) streamId = String(s.id);
      const id = String(s.id || streamId);
      const stripped = Boolean(s.stripped) && !custom;
      const meta = describeFeed(s);
      return {
        ...meta,
        id,
        streamId,
        label: String(s.label || meta.title),
        live: custom ? true : !ctx.isSpecialDown(s),
        stripped,
        pasted: custom || (stripped ? strippedPlayerUrl(streamId) : synced),
      };
    });

  const byId = (id: string) => streams().find((s) => s.id === id);

  function saveState() {
    try {
      ctx.store?.set?.(STATE_KEY, JSON.stringify({ ids, audio, mode }));
    } catch { /* ignore storage quota errors */ }
  }

  function readSavedState(): { ids?: string[]; audio?: string | null; mode?: 'grid' | 'focus' } {
    try {
      const raw = ctx.store?.get?.(STATE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function relayout() {
    const w = stageEl.clientWidth;
    const h = stageEl.clientHeight;
    stageEl.classList.toggle('is-empty', ids.length === 0);
    if (!w || !h || !ids.length) return;
    /* Reserve 2px around the stage perimeter so the 2px #e10600 outer ring on the audio tile never clips. */
    const pad = 2;
    const boxes = (mode === 'focus' ? focusLayout : layout)(ids.length, Math.max(0, w - pad * 2), Math.max(0, h - pad * 2));
    ids.forEach((id, i) => {
      const tile = tiles.get(id);
      const b = boxes[i];
      if (!tile || !b) return;
      const x = Math.round(b.x + pad);
      const y = Math.round(b.y + pad);
      const tw = Math.round(b.w);
      const th = Math.round(b.h);
      tile.style.transform = `translate(${x}px, ${y}px)`;
      tile.style.width = `${tw}px`;
      tile.style.height = `${th}px`;
      tile.dataset.x = String(x);
      tile.dataset.y = String(y);
      tile.classList.toggle('is-big', mode === 'focus' && i === 0);
      tile.classList.toggle('is-small', (mode === 'focus' && i > 0) || tw < 340);
      tile.classList.toggle('is-main', id === audio);
      tile.classList.toggle('has-audio', id === audio);
    });
  }

  function paintChrome() {
    const n = ids.length;
    countEl.textContent = n ? `${n} ${n === 1 ? 'feed' : 'feeds'}` : '';
    panel.querySelectorAll<HTMLElement>('[data-mvx-mode]').forEach((btn) => {
      const active = btn.dataset.mvxMode === mode;
      btn.classList.toggle('is-on', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    for (const [id, tile] of tiles) {
      const on = id === audio;
      tile.classList.toggle('is-main', on);
      tile.classList.toggle('has-audio', on);
    }
  }

  function paintAudio(remount = false) {
    for (const [id, f] of frames) {
      const on = id === audio;
      try {
        f.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: on ? 'unMute' : 'mute', args: [] }), '*');
        f.contentWindow?.postMessage(JSON.stringify({ method: on ? 'unMute' : 'mute', value: true }), '*');
        f.contentWindow?.postMessage(JSON.stringify({ type: 'freef1-audio', muted: !on }), '*');
      } catch { /* cross-origin frame ignores or handles message */ }
      const want = on ? 'on' : 'off';
      if (remount && f.dataset.state !== want) {
        const known = byId(id);
        const next = tileUrl(known?.streamId || id, !on, known?.pasted);
        if (next !== f.src) {
          markTileLoading(tiles.get(id));
          f.src = next;
        }
      }
      f.dataset.state = want;
      const btn = tiles.get(id)?.querySelector<HTMLElement>('[data-mvx-audio]');
      if (btn) {
        btn.innerHTML = icon(on ? 'volume' : 'muted');
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', String(on));
        btn.title = on ? 'Sound on' : 'Listen to this feed';
      }
    }
    paintChrome();
  }

  function setAudio(id: string) {
    if (audio === id || !ids.includes(id)) return;
    audio = id;
    paintAudio(true);
    saveState();
  }

  function setMode(nextMode: 'grid' | 'focus') {
    mode = nextMode;
    if (mode === 'focus' && audio && ids.includes(audio) && ids[0] !== audio) {
      ids = [audio, ...ids.filter((x) => x !== audio)];
    }
    paintChrome();
    relayout();
    saveState();
  }

  function makeBig(id: string) {
    if (!ids.includes(id)) return;
    /* Promote the tile into the Focus hero slot via pure GPU layout without reloading any iframe
       stream or interrupting active commentary audio (audio stays on the speaker toggle). */
    ids = [id, ...ids.filter((x) => x !== id)];
    mode = 'focus';
    paintChrome();
    relayout();
    saveState();
  }

  function createTile(id: string): HTMLElement {
    const stream = byId(id);
    const tile = document.createElement('div');
    tile.className = 'mvx-tile';
    markTileLoading(tile, 5500);
    tile.dataset.feed = id;
    if (!stream) return tile;
    if (!stream.live) tile.classList.add('is-off');

    const f = document.createElement('iframe');
    const nextUrl = tileUrl(stream.streamId, id !== audio, stream.pasted);
    f.src = nextUrl;
    f.dataset.state = id === audio ? 'on' : 'off';
    f.allow = ALLOW;
    f.setAttribute('allow', ALLOW);
    f.allowFullscreen = true;
    if (stream.stripped || nextUrl.includes('/api/stream/weellz-embed')) {
      f.setAttribute('sandbox', STRIPPED_SANDBOX);
      f.referrerPolicy = 'origin';
    } else {
      f.referrerPolicy = 'strict-origin-when-cross-origin';
    }
    f.title = stream.title;
    f.dataset.stream = stream.streamId;

    f.addEventListener('load', () => clearTileLoading(tile));

    const loadRing = document.createElement('span');
    loadRing.className = 'mvx-tile-load';
    loadRing.setAttribute('aria-hidden', 'true');
    loadRing.innerHTML = '<span class="mvx-spin"></span>';

    const bar = document.createElement('div');
    bar.className = 'mvx-tile-bar';

    const subParts = [stream.subtitle];
    if (!stream.live) subParts.push('<b class="mvx-off-msg">off air</b>');
    else subParts.push('<b class="mvx-off-msg" hidden></b>');

    bar.innerHTML = `
      <span class="mvx-handle mvx-tile-name" data-mvx-drag data-raw-label="${escapeText(stream.label)}" title="Drag to move">
        ${renderAvatar(stream)}
        <span class="mvx-name">
          <span class="mvx-name-t">${escapeText(stream.title)}</span>
          <span class="mvx-name-s">${escapeText(stream.subtitle)}${!stream.live ? ' · ' : ''}<b class="mvx-off-msg"${stream.live ? ' hidden' : ''}>${stream.live ? '' : 'off air'}</b></span>
        </span>
      </span>
      <span class="mvx-tools">
        <button type="button" class="mvx-tool" data-mvx-audio aria-label="Listen to ${escapeText(stream.title)}" aria-pressed="false" title="Listen to this feed">${icon('muted')}</button>
        <button type="button" class="mvx-tool" data-mvx-big aria-label="Make ${escapeText(stream.title)} the big player" title="Make big">${icon('maximize')}</button>
        <button type="button" class="mvx-tool" data-mvx-remove aria-label="Remove ${escapeText(stream.title)}" title="Remove">${icon('close')}</button>
      </span>
    `;

    tile.append(f, loadRing, bar);
    tiles.set(id, tile);
    frames.set(id, f);
    return tile;
  }

  function draw() {
    for (const [id, tile] of tiles) {
      if (!ids.includes(id)) {
        clearTileLoading(tile);
        const f = frames.get(id);
        if (f) f.src = 'about:blank';
        tile.remove();
        tiles.delete(id);
        frames.delete(id);
      }
    }
    for (const id of ids) {
      if (!tiles.has(id)) {
        tilesEl.appendChild(createTile(id));
      }
    }
    /* Never re-append existing tiles: moving an iframe's parent reloads the stream in browsers,
       and our GPU translate(x, y) layout places each tile by slot index regardless of DOM order. */
    paintChrome();
    paintAudio(false);
    relayout();
    if (!libEl.hidden) drawLibrary();
  }

  function add(id: string) {
    if (ids.includes(id) || ids.length >= MAX_TILES || !byId(id)) return;
    ids.push(id);
    if (!audio) audio = id;
    draw();
    saveState();
  }

  function remove(id: string) {
    const at = ids.indexOf(id);
    if (at < 0) return;
    ids.splice(at, 1);
    const hadAudio = audio === id;
    if (hadAudio) audio = ids[0] || null;
    draw();
    if (hadAudio && audio) paintAudio(true);
    saveState();
    if (!ids.length) library(true);
  }

  function library(on?: boolean) {
    const next = on ?? libEl.hidden;
    libEl.hidden = !next;
    panel.classList.toggle('lib-open', next);
    addBtn.classList.toggle('is-open', next);
    addBtn.setAttribute('aria-expanded', String(next));
    if (next) {
      drawLibrary();
      if (window.matchMedia?.('(pointer: fine)').matches && !query) {
        window.setTimeout(() => searchInput.focus({ preventScroll: true }), 40);
      }
    }
    requestAnimationFrame(() => relayout());
  }

  function drawFilters(list: WeeloStream[]) {
    const present = new Set(list.map((s) => s.category));
    const tabs: { id: 'all' | FeedCategory; label: string }[] = [{ id: 'all', label: 'All' }];
    if (present.has('broadcast')) tabs.push({ id: 'broadcast', label: 'Broadcast' });
    if (present.has('onboard')) tabs.push({ id: 'onboard', label: 'Onboards' });
    if (present.has('data')) tabs.push({ id: 'data', label: 'Data & timing' });
    if (!tabs.some((t) => t.id === filter)) filter = 'all';

    filtersEl.innerHTML = tabs
      .map((t) => `<button type="button" role="tab" aria-selected="${String(filter === t.id)}" data-mvx-filter="${t.id}">${escapeText(t.label)}</button>`)
      .join('');
  }

  function drawLibrary() {
    const all = streams();
    drawFilters(all);

    const full = ids.length >= MAX_TILES;
    if (full) {
      noteEl.hidden = false;
      noteEl.textContent = `Up to ${MAX_TILES} streams at once. Remove one to add another.`;
    } else {
      noteEl.hidden = true;
      noteEl.textContent = '';
    }

    const q = query.trim().toLowerCase();
    const filtered = all.filter((s) => {
      if (filter !== 'all' && s.category !== filter) return false;
      if (!q) return true;
      const hay = `${s.title} ${s.subtitle} ${s.label} ${s.category}`.toLowerCase();
      return hay.includes(q);
    });

    if (!filtered.length) {
      listEl.innerHTML = `<p class="mvx-lib-empty">${q ? `Nothing found for “${escapeText(query.trim())}”.` : 'No streams available in this category.'}</p>`;
      return;
    }

    const evName = ctx.currentEvent?.name
      ? `${ctx.currentEvent.name}${ctx.currentSession?.name ? ` · ${ctx.currentSession.name}` : ''}`
      : 'Formula 1 Championship';
    const anyLive = all.some((s) => s.live);

    const allGroups: { id: FeedCategory; label: string; items: WeeloStream[] }[] = [
      { id: 'broadcast', label: 'Broadcast', items: filtered.filter((s) => s.category === 'broadcast') },
      { id: 'onboard', label: 'Onboard cameras', items: filtered.filter((s) => s.category === 'onboard') },
      { id: 'data', label: 'Data & timing', items: filtered.filter((s) => s.category === 'data') },
    ];
    const groups = allGroups.filter((g) => g.items.length > 0);

    const renderFeedButton = (s: WeeloStream, faceCard: boolean) => {
      const inGrid = ids.includes(s.id);
      const disabled = !inGrid && full ? ' disabled' : '';
      const stateCls = `${inGrid ? ' is-on is-in' : ''}${!s.live ? ' is-off' : ''}${s.stripped ? ' is-stripped' : ''}`;
      const statusText = inGrid ? 'in grid' : s.live ? 'add' : 'off air';
      const strippedBadge = s.stripped ? '<span class="mvx-feed-strip">Stripped</span>' : '';
      if (faceCard) {
        const surname = s.title.split(/\s+/).slice(-1)[0] || s.title;
        return `<li>
          <button type="button" class="mvx-feed mvx-feed-face mvx-lib-row${stateCls}" data-mvx-toggle="${escapeText(s.id)}" aria-pressed="${String(inGrid)}" title="${escapeText(s.title)}${s.stripped ? ' · Stripped' : ''}${!s.live ? ' · Off air' : ''}"${disabled}>
            ${renderAvatar(s, true)}
            <span class="mvx-feed-t">${escapeText(surname)}</span>
            ${strippedBadge}
            ${!s.live ? '<span class="mvx-feed-off">off air</span>' : ''}
            <span class="mvx-sr">${escapeText(s.label)}${s.stripped ? ' · Stripped' : ''} · ${statusText}</span>
            <span class="mvx-feed-ic" aria-hidden="true">${icon(inGrid ? 'check' : 'plus')}</span>
          </button>
        </li>`;
      }
      const sub = !s.live ? `${escapeText(s.subtitle)} · <span class="mvx-feed-off">off air</span>` : escapeText(s.subtitle);
      return `<li>
        <button type="button" class="mvx-feed mvx-lib-row${stateCls}" data-mvx-toggle="${escapeText(s.id)}" aria-pressed="${String(inGrid)}"${disabled}>
          ${renderAvatar(s, false)}
          <span class="mvx-feed-copy">
            <span class="mvx-feed-t">${escapeText(s.title)} ${strippedBadge}</span>
            <span class="mvx-feed-s">${sub}</span>
          </span>
          <span class="mvx-sr">${escapeText(s.label)}${s.stripped ? ' · Stripped' : ''} · ${statusText}</span>
          <span class="mvx-feed-ic" aria-hidden="true">${icon(inGrid ? 'check' : 'plus')}</span>
        </button>
      </li>`;
    };

    listEl.innerHTML = `
      <section class="mvx-lib-ev">
        <p class="mvx-lib-evh">
          <span class="mvx-series-chip">F1</span>
          <span class="mvx-lib-evname">${escapeText(evName)}</span>
          ${anyLive ? '<span class="mvx-live-dot" aria-hidden="true"></span>' : ''}
        </p>
        ${groups
          .map(
            (g) => `
          <p class="mvx-lib-gh">${escapeText(g.label)}</p>
          <ul class="${g.id === 'onboard' ? 'mvx-lib-faces' : 'mvx-lib-list'}">
            ${g.items.map((item) => renderFeedButton(item, g.id === 'onboard')).join('')}
          </ul>
        `,
          )
          .join('')}
      </section>
    `;
  }

  function markButton(on: boolean) {
    const b = document.getElementById('mvToggle');
    b?.classList.toggle('primary', on);
    b?.setAttribute('aria-pressed', String(on));
  }

  let parkedSrc = '';
  let savedSource = -1;

  function park(on: boolean) {
    const p = document.getElementById('player');
    p?.classList.toggle('is-parked', on);
    const frame = p?.querySelector<HTMLIFrameElement>('.wplayer-stage > iframe');
    if (on) {
      parkedSrc = frame?.src || '';
      if (frame) frame.src = 'about:blank';
    } else if (parkedSrc && frame) {
      frame.src = parkedSrc;
      parkedSrc = '';
    }
  }

  const available = () => (ctx.sources || []).some((s: any) => (s.weelo || s.weellzUrls?.length) && !s.hidden);

  function mirrorCounter() {
    const src = document.getElementById('viewerCount');
    const txt = src?.textContent?.trim() || '';
    if (txt && txt !== '—') {
      onlineWrapEl.hidden = false;
      if (onlineEl.textContent !== txt) onlineEl.textContent = txt;
    } else {
      onlineWrapEl.hidden = true;
    }
  }

  function syncFullscreenButton() {
    const isFs = Boolean(document.fullscreenElement);
    fullBtn.innerHTML = icon(isFs ? 'minimize' : 'maximize');
    fullBtn.title = isFs ? 'Exit full screen (F)' : 'Full screen (F)';
    if (open) requestAnimationFrame(() => relayout());
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    } else {
      void panel.requestFullscreen?.().catch(() => {});
    }
  }

  function show(on: boolean) {
    if (on && !available()) return;
    open = on;
    panel.hidden = !on;
    document.documentElement.classList.toggle('has-mvx', on);
    if (on) {
      savedSource = ctx.currentSource;
      const list = streams();
      const saved = readSavedState();
      if (!ids.length) {
        const restored = Array.isArray(saved.ids) ? saved.ids.filter((id) => list.some((s) => s.id === id)) : [];
        ids = (restored.length ? restored : list.slice(0, 3).map((s) => s.id)).slice(0, MAX_TILES);
        mode = saved.mode === 'focus' ? 'focus' : 'grid';
        audio = saved.audio && ids.includes(saved.audio) ? saved.audio : ids[0] || null;
      } else {
        ids = ids.filter((id) => byId(id));
        if (!audio || !ids.includes(audio)) audio = ids[0] || null;
      }
      panel.hidden = false;
      park(true);
      mirrorCounter();
      markButton(true);
      btnUrl?.(true);
      requestAnimationFrame(() => {
        draw();
        if (!ids.length) library(true);
      });
    } else {
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => {});
      }
      for (const [, tile] of tiles) clearTileLoading(tile);
      for (const [, f] of frames) f.src = 'about:blank';
      frames.clear();
      tiles.clear();
      ids = [];
      audio = null;
      tilesEl.replaceChildren();
      library(false);
      markButton(false);
      park(false);
      btnUrl?.(false);
      ctx.reloadTop?.(savedSource);
    }
  }

  /* Pointer drag-to-swap on tile handles: swaps logical slot positions without touching DOM order. */
  function wireDrag() {
    let drag: { id: string; startX: number; startY: number; moved: boolean; over: string | null } | null = null;

    stageEl.addEventListener('pointerdown', (e) => {
      const handle = (e.target as HTMLElement | null)?.closest('[data-mvx-drag]');
      if (!handle || ids.length < 2 || e.button !== 0) return;
      const tile = handle.closest<HTMLElement>('.mvx-tile');
      const id = tile?.dataset.feed;
      if (!id) return;
      drag = { id, startX: e.clientX, startY: e.clientY, moved: false, over: null };
      try { stageEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });

    stageEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      const lifted = tiles.get(drag.id);
      if (!lifted) return;
      if (!drag.moved) {
        drag.moved = true;
        panel.classList.add('is-dragging');
        lifted.classList.add('is-lifted');
      }
      const baseX = Number(lifted.dataset.x || 0);
      const baseY = Number(lifted.dataset.y || 0);
      lifted.style.transform = `translate(${Math.round(baseX + dx)}px, ${Math.round(baseY + dy)}px)`;

      const hit = ids.find((otherId) => {
        if (otherId === drag!.id) return false;
        const rect = tiles.get(otherId)?.getBoundingClientRect();
        return Boolean(rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom);
      }) || null;

      if (hit !== drag.over) {
        if (drag.over) tiles.get(drag.over)?.classList.remove('is-target');
        if (hit) tiles.get(hit)?.classList.add('is-target');
        drag.over = hit;
      }
    });

    const finishDrag = () => {
      if (!drag) return;
      const lifted = tiles.get(drag.id);
      lifted?.classList.remove('is-lifted');
      panel.classList.remove('is-dragging');
      if (drag.over) {
        tiles.get(drag.over)?.classList.remove('is-target');
        const fromIdx = ids.indexOf(drag.id);
        const toIdx = ids.indexOf(drag.over);
        if (fromIdx >= 0 && toIdx >= 0) {
          [ids[fromIdx], ids[toIdx]] = [ids[toIdx], ids[fromIdx]];
          saveState();
        }
      }
      drag = null;
      relayout();
    };

    stageEl.addEventListener('pointerup', finishDrag);
    stageEl.addEventListener('pointercancel', finishDrag);
  }

  wireDrag();

  panel.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-mvx-close]')) { show(false); return; }
    if (target.closest('[data-mvx-open-lib]')) { library(); return; }
    if (target.closest('[data-mvx-lib-close]')) { library(false); return; }
    if (target.closest('[data-mvx-full]')) { toggleFullscreen(); return; }

    const modeBtn = target.closest<HTMLElement>('[data-mvx-mode]');
    if (modeBtn) {
      setMode(modeBtn.dataset.mvxMode === 'focus' ? 'focus' : 'grid');
      return;
    }

    const filterBtn = target.closest<HTMLElement>('[data-mvx-filter]');
    if (filterBtn) {
      filter = (filterBtn.dataset.mvxFilter as 'all' | FeedCategory) || 'all';
      drawLibrary();
      return;
    }

    const toggleFeedBtn = target.closest<HTMLElement>('[data-mvx-toggle]');
    if (toggleFeedBtn) {
      const feedId = toggleFeedBtn.dataset.mvxToggle || '';
      if (!feedId) return;
      if (ids.includes(feedId)) remove(feedId);
      else add(feedId);
      return;
    }

    const tile = target.closest<HTMLElement>('.mvx-tile');
    const tileId = tile?.dataset.feed;
    if (!tileId) return;
    if (target.closest('[data-mvx-audio]')) setAudio(tileId);
    else if (target.closest('[data-mvx-big]')) makeBig(tileId);
    else if (target.closest('[data-mvx-remove]')) remove(tileId);
  });

  searchInput.addEventListener('input', () => {
    query = searchInput.value;
    clearBtn.hidden = !query.trim();
    drawLibrary();
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    query = '';
    clearBtn.hidden = true;
    searchInput.focus();
    drawLibrary();
  });

  document.addEventListener('fullscreenchange', syncFullscreenButton);

  document.addEventListener('keydown', (e) => {
    if (!open) return;
    const tag = (e.target as HTMLElement | null)?.closest?.('input, textarea, select');
    if (tag) {
      if (e.key === 'Escape') (tag as HTMLElement).blur();
      return;
    }
    if (e.key === 'Escape') {
      if (!libEl.hidden) { library(false); return; }
      if (!document.fullscreenElement) show(false);
      return;
    }
    if (/^[1-9]$/.test(e.key)) {
      const targetId = ids[Number(e.key) - 1];
      if (targetId) setAudio(targetId);
      return;
    }
    if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
      return;
    }
    if (e.key === 'g' || e.key === 'G') {
      setMode(mode === 'grid' ? 'focus' : 'grid');
    }
  });

  const ro = new ResizeObserver(() => relayout());
  ro.observe(stageEl);

  let btnUrl: ((on: boolean) => void) | null = null;
  function wireToggle() {
    const b = document.getElementById('mvToggle');
    if (!b) return;
    b.dataset.wired = '1';
    const hasFeeds = available();
    b.hidden = !hasFeeds;
    if (!hasFeeds) return;
    btnUrl = (on) => {
      const url = new URL(location.href);
      if (on) url.searchParams.set('mv', '1');
      else url.searchParams.delete('mv');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    };
  }
  wireToggle();

  const sync = () => {
    if (!open) return;
    for (const id of [...ids]) {
      const hiddenByAdmin = ctx.sources.some((s: any) => s.hidden && (s.weelo === id || s.id === id));
      if (hiddenByAdmin || (!frames.has(id) && !byId(id))) remove(id);
    }
    for (const id of ids) {
      const tile = tiles.get(id);
      const known = byId(id);
      if (!tile || !known) continue;
      const live = known.live !== false;
      tile.classList.toggle('is-off', !live);
      const badge = tile.querySelector<HTMLElement>('.mvx-off-msg');
      if (badge) {
        badge.hidden = live;
        badge.textContent = live ? '' : 'off air';
      }
    }
    if (!libEl.hidden) drawLibrary();
    relayout();
    if (!ids.length) library(true);
  };

  window.setInterval(sync, 60000);
  window.setInterval(mirrorCounter, 5000);
  window.setTimeout(sync, 6000);

  const testMode = new URLSearchParams(location.search).get('mvtest');
  if (testMode) {
    const forced = () => testMode === 'live';
    ctx.isSpecialDown = () => !forced();
  }

  const api = {
    show,
    toggle: () => show(!open),
    isOpen: () => open,
    picked: () => [...ids],
    mode: () => mode,
    setMode,
    add,
    remove,
    wireToggle,
  };
  ctx.multiViewer = api;
  return api;
}
