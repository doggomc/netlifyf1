import { initShell } from '../ui/shell';
/* Every page except the cockpit carries the open-page counter in its header. */
import '../viewer-counter';
import { OPENF1_API } from '../config';
import {
  extrapolatedRemainingMs, F1SignalRClient, formatRemainingMs,
  snapshotFromF1State, snapshotFromOpenF1,
  type OpenF1Bundle, type OpenF1Session, type TimingRow, type TimingSnapshot,
} from './live-timing-feed';

initShell();

const ROW_H = 44;
const COL_RACE = '40px minmax(158px, 1fr) 86px 80px 84px 84px 62px 62px 62px 68px 44px';
const COL_PRAC = '40px minmax(158px, 1fr) 86px 82px 80px 84px 62px 62px 62px 68px 48px';
const MIN_W_RACE = 828;
const MIN_W_PRAC = 834;

const HEAD_RACE = ['Pos', 'Driver', 'Gap', 'Interval', 'Last lap', 'Best lap', 'S1', 'S2', 'S3', 'Tyre', 'Pit'];
const HEAD_PRAC = ['Pos', 'Driver', 'Best lap', 'Gap', 'Interval', 'Last lap', 'S1', 'S2', 'S3', 'Tyre', 'Laps'];

const SVG_THERM = '<svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M180,150.69V56A52,52,0,0,0,76,56v94.69a64,64,0,1,0,104,0ZM128,228a40,40,0,0,1-30.91-65.39,12,12,0,0,0,2.91-7.83V56a28,28,0,0,1,56,0v98.77a12,12,0,0,0,2.77,7.68A40,40,0,0,1,128,228Zm24-40a24,24,0,1,1-36-20.78V92a12,12,0,0,1,24,0v75.22A24,24,0,0,1,152,188Z"/></svg>';
const SVG_DROP = '<svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M134.88,6.17a12,12,0,0,0-13.76,0,259,259,0,0,0-42.18,39C50.85,77.43,36,111.62,36,144a92,92,0,0,0,184,0C220,66.64,138.36,8.6,134.88,6.17ZM128,212a68.07,68.07,0,0,1-68-68c0-33.31,20-63.37,36.7-82.71A249.35,249.35,0,0,1,128,31.11a249.35,249.35,0,0,1,31.3,30.18C176,80.63,196,110.69,196,144A68.07,68.07,0,0,1,128,212Zm49.62-52.4a52,52,0,0,1-34,34,12.2,12.2,0,0,1-3.6.55,12,12,0,0,1-3.6-23.45,28,28,0,0,0,18.32-18.32,12,12,0,0,1,22.9,7.2Z"/></svg>';
const SVG_WIND = '<svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M24,104a12,12,0,0,1,0-24h96a12,12,0,0,0,0-24,15.07,15.07,0,0,0-10.26,4.45,12,12,0,0,1-17-16.9A39.34,39.34,0,0,1,120,32a36,36,0,0,1,0,72ZM208,68a39.34,39.34,0,0,0-27.3,11.55,12,12,0,0,0,17,16.9A15.07,15.07,0,0,1,208,92a12,12,0,0,1,0,24H32a12,12,0,0,0,0,24H208a36,36,0,0,0,0-72Zm-56,84H40a12,12,0,0,0,0,24H152a12,12,0,0,1,0,24,15.11,15.11,0,0,1-10.27-4.45,12,12,0,1,0-17,16.9A39.34,39.34,0,0,0,152,224a36,36,0,0,0,0-72Z"/></svg>';
const SVG_RAIN = '<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M156,12A80.22,80.22,0,0,0,82.39,60.36,56.76,56.76,0,0,0,76,60a56,56,0,0,0,0,112h29.58L86,201.34a12,12,0,1,0,20,13.32L134.42,172H156a80,80,0,0,0,0-160Zm0,136H76a32,32,0,0,1,0-64h.28c-.11,1.1-.2,2.2-.26,3.3a12,12,0,1,0,24,1.39A56.06,56.06,0,1,1,156,148Zm.65,58.66-26.67,40a12,12,0,1,1-20-13.32l26.66-40a12,12,0,1,1,20,13.32Z"/></svg>';
const SVG_PLAY = '<svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"/></svg>';
const SVG_PAUSE = '<svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M216,48V208a16,16,0,0,1-16,16H160a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h40A16,16,0,0,1,216,48ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Z"/></svg>';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const set = (id: string, text: string) => { const el = $(id); if (el && el.textContent !== text) el.textContent = text; };

const towerWrap = $('ltTowerWrap');
const towerEl = $('ltTower');
towerWrap?.addEventListener('scroll', () => {
  towerWrap.classList.toggle('is-scrolled', towerWrap.scrollLeft > 0);
}, { passive: true });

/* ═══════════════ TOWER DOM RECONCILER ═══════════════ */

type RowDom = {
  el: HTMLDivElement;
  pos: HTMLSpanElement;
  drv: HTMLAnchorElement;
  cells: HTMLSpanElement[];
  tyre: HTMLSpanElement;
  tail: HTMLSpanElement;
  lastPos: number | null;
  drvKey: string;
  tyreKey: string;
};

let builtMode: 'race' | 'prac' | null = null;
let rowsHost: HTMLDivElement | null = null;
const rowDomMap = new Map<string, RowDom>();

function ensureTowerShell(isRace: boolean): void {
  const mode = isRace ? 'race' : 'prac';
  if (builtMode === mode && rowsHost) return;
  if (!towerEl) return;
  builtMode = mode;
  rowDomMap.clear();
  const cols = isRace ? COL_RACE : COL_PRAC;
  const heads = isRace ? HEAD_RACE : HEAD_PRAC;
  towerEl.style.minWidth = `${isRace ? MIN_W_RACE : MIN_W_PRAC}px`;
  towerEl.innerHTML = `<div class="lt-tower-head" style="grid-template-columns:${cols}">${
    heads.map((h, i) =>
      `<span class="${i === 0 ? 'lt-pin' : i === 1 ? 'lt-pin lt-pin-2' : 'lt-cell-head'}">${esc(h)}</span>`,
    ).join('')
  }</div><div class="lt-tower-rows" id="ltTowerRows"></div>`;
  towerEl.removeAttribute('aria-busy');
  rowsHost = $('ltTowerRows') as HTMLDivElement | null;
}

function getOrCreateRow(row: TimingRow, isRace: boolean): RowDom {
  let rec = rowDomMap.get(row.num);
  const cols = isRace ? COL_RACE : COL_PRAC;
  if (!rec) {
    const el = document.createElement('div');
    el.className = 'lt-tower-row';
    el.style.gridTemplateColumns = cols;

    const pos = document.createElement('span');
    pos.className = 'lt-pin lt-pos num';

    const drv = document.createElement('a');
    drv.className = 'lt-pin lt-pin-2 lt-drv';

    const cells = Array.from({ length: 7 }, () => {
      const s = document.createElement('span');
      s.className = 'lt-cell num';
      return s;
    });

    const tyre = document.createElement('span');
    tyre.className = 'lt-cell lt-tyre-cell';

    const tail = document.createElement('span');
    tail.className = 'lt-cell num lt-tail';

    el.append(pos, drv, ...cells, tyre, tail);
    rowsHost?.append(el);
    rec = { el, pos, drv, cells, tyre, tail, lastPos: null, drvKey: '', tyreKey: '' };
    rowDomMap.set(row.num, rec);
  }
  const drvKey = `${row.teamColor}|${row.tla}|${row.lastName}|${row.driverHref}`;
  if (rec.drvKey !== drvKey) {
    rec.drvKey = drvKey;
    rec.drv.href = row.driverHref;
    rec.drv.innerHTML = `<span class="lt-tbar" style="background:${esc(row.teamColor)}"></span><span class="lt-tla">${esc(row.tla)}</span><span class="lt-lname">${esc(row.lastName)}</span>`;
  }
  return rec;
}

let activeSnap: TimingSnapshot | null = null;
let activeSessionId = '';
let rcSig = '';
let radioSig = '';

function setStatusIndicator(text: string, mode: 'live' | 'idle' | 'connecting' | 'error'): void {
  set('ltStatus', text);
  const dot = $('ltDot');
  if (dot) dot.className = `lt-dot is-${mode}`;
}

function paintSnapshot(snap: TimingSnapshot): void {
  const sessionId = `${snap.source}:${snap.sessionKey ?? snap.sessionName}`;
  const sameSession = sessionId === activeSessionId;
  activeSessionId = sessionId;
  activeSnap = snap;
  setStatusIndicator(snap.statusText, snap.isLive ? 'live' : 'idle');
  set('ltTitle', `${snap.meetingName}: ${snap.sessionName}`);

  const trackEl = $('ltTrack');
  if (trackEl) trackEl.className = `lt-track ${snap.track.cls}`;
  set('ltTrackText', snap.track.label);
  set('ltClockLabel', snap.clock.label);
  set('ltClock', snap.clock.value);

  const weatherEl = $('ltWeather');
  if (weatherEl) {
    if (snap.weather) {
      const w = snap.weather;
      weatherEl.innerHTML = `<span class="lt-w-item">${SVG_THERM}Air <b>${esc(w.air)}°</b></span>`
        + `<span class="lt-w-item">Track <b>${esc(w.track)}°</b></span>`
        + `<span class="lt-w-item">${SVG_DROP}${esc(w.humidity)}%</span>`
        + `<span class="lt-w-item">${SVG_WIND}${esc(w.wind)} m/s</span>`
        + (w.rain ? `<span class="lt-rain-chip">${SVG_RAIN}Rain</span>` : '');
    } else {
      weatherEl.innerHTML = '<span class="lt-muted">Weather at the track will appear here during sessions.</span>';
    }
  }

  /* Tower rows */
  if (snap.rows.length === 0) {
    if (towerEl) {
      builtMode = null;
      rowDomMap.clear();
      towerEl.style.minWidth = '';
      towerEl.removeAttribute('aria-busy');
      towerEl.innerHTML = '<p class="lt-empty">Waiting for cars to set times in this session…</p>';
    }
  } else {
    ensureTowerShell(snap.isRace);
    if (rowsHost) rowsHost.style.height = `${snap.rows.length * ROW_H}px`;
    const seen = new Set<string>();

    snap.rows.forEach((row, idx) => {
      seen.add(row.num);
      const dom = getOrCreateRow(row, snap.isRace);
      dom.el.style.display = '';
      dom.el.style.transform = `translateY(${idx * ROW_H}px)`;
      const numericPos = Number(row.pos);
      if (sameSession && Number.isFinite(numericPos) && dom.lastPos !== null && dom.lastPos !== numericPos) {
        dom.el.classList.remove('flash-up', 'flash-down');
        dom.el.classList.add(numericPos < dom.lastPos ? 'flash-up' : 'flash-down');
        window.setTimeout(() => dom.el.classList.remove('flash-up', 'flash-down'), 1400);
      } else if (!sameSession) {
        dom.el.classList.remove('flash-up', 'flash-down');
      }
      dom.lastPos = Number.isFinite(numericPos) ? numericPos : null;
      dom.el.classList.toggle('is-out', row.isOut);
      if (dom.pos.textContent !== row.pos) dom.pos.textContent = row.pos;

      row.cells.forEach((cell, cIdx) => {
        const span = dom.cells[cIdx];
        if (span.textContent !== cell.text) span.textContent = cell.text;
        span.classList.toggle('t-fastest', cell.tone === 'fastest');
        span.classList.toggle('t-pb', cell.tone === 'pb');
      });

      const tyreKey = row.tyre ? `${row.tyre.code}:${row.tyre.age}` : '';
      if (dom.tyreKey !== tyreKey) {
        dom.tyreKey = tyreKey;
        dom.tyre.innerHTML = row.tyre
          ? `<span class="lt-tyre-wrap"><span class="lt-tyre lt-tyre-${esc(row.tyre.code)}">${esc(row.tyre.code)}</span><span class="lt-tyre-age">${esc(row.tyre.age)}</span></span>`
          : '';
      }
      if (dom.tail.textContent !== row.tail) dom.tail.textContent = row.tail;
    });

    for (const [num, dom] of rowDomMap) {
      if (!seen.has(num)) dom.el.style.display = 'none';
    }
  }

  /* Race control */
  set('ltRcCount', snap.raceControlTotal > 0 ? `${snap.raceControlTotal} messages` : '');
  const nextRcSig = `${snap.sessionKey ?? snap.sessionName}:${snap.raceControlTotal}:${snap.raceControl[0]?.message ?? ''}`;
  if (rcSig !== nextRcSig) {
    rcSig = nextRcSig;
    const rcList = $('ltRcList');
    if (rcList) {
      rcList.innerHTML = snap.raceControl.length > 0
        ? snap.raceControl.map((m) =>
            `<li class="lt-rc-item">
              <div class="lt-rc-meta">
                <span class="lt-rc-dot ${esc(m.dotCls)}" aria-hidden="true"></span>
                <span>${esc([m.time, m.lap].filter(Boolean).join(' · '))}</span>
              </div>
              <p class="lt-rc-msg">${esc(m.message)}</p>
            </li>`).join('')
        : '<li class="lt-muted">No race-control messages recorded for this session.</li>';
    }
  }

  /* Team radio */
  set('ltRadioCount', snap.radio.length > 0 ? `${snap.radio.length} clips` : '');
  const nextRadioSig = `${snap.sessionKey ?? snap.sessionName}:${snap.radio.length}:${snap.radio[0]?.url ?? ''}`;
  if (radioSig !== nextRadioSig) {
    radioSig = nextRadioSig;
    const radioList = $('ltRadioList');
    if (radioList) {
      radioList.innerHTML = snap.radio.length > 0
        ? snap.radio.map((c) => {
            const avatar = c.headshotUrl
              ? `<img class="lt-radio-face" src="${esc(c.headshotUrl)}" alt="" width="32" height="32" loading="lazy" decoding="async">`
              : `<span class="lt-radio-face lt-radio-face-text">${esc(c.tla)}</span>`;
            return `<li class="lt-radio-row" data-radio-row="${esc(c.url)}" style="--team:${esc(c.teamColor)}">
              <button class="lt-radio-btn" type="button" data-radio="${esc(c.url)}" aria-label="Play team radio from ${esc(c.fullName)}">
                <span class="lt-ico-play">${SVG_PLAY}</span>
                <span class="lt-ico-pause">${SVG_PAUSE}</span>
              </button>
              ${avatar}
              <span class="lt-radio-body">
                <span class="lt-radio-top">
                  <span class="lt-radio-who"><b>${esc(c.tla)}</b> <span>${esc(c.lastName)}</span></span>
                  <span class="lt-radio-when">${esc(c.time)}</span>
                </span>
                <span class="lt-radio-track" data-radio-seek="${esc(c.url)}" role="slider" aria-label="Seek radio clip" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="-1">
                  <span class="lt-radio-fill"></span>
                </span>
                <span class="lt-radio-time num" data-radio-time></span>
              </span>
            </li>`;
          }).join('')
        : '<li class="lt-muted">No team-radio clips published for this session.</li>';
      /* Gracefully replace broken headshots with TLA badge without inline event handlers. */
      radioList.querySelectorAll<HTMLImageElement>('img.lt-radio-face').forEach((img) => {
        img.addEventListener('error', () => {
          const fallback = document.createElement('span');
          fallback.className = 'lt-radio-face lt-radio-face-text';
          fallback.textContent = img.closest('.lt-radio-row')?.querySelector('.lt-radio-who b')?.textContent ?? '';
          img.replaceWith(fallback);
        }, { once: true });
      });
      syncRadioDom();
    }
  }
}

/* ═══════════════ TEAM RADIO AUDIO PLAYER ═══════════════ */

const player: { audio: HTMLAudioElement | null; src: string; failedSrc: string } = {
  audio: null, src: '', failedSrc: '',
};

const fmtAudioSec = (sec: number) =>
  Number.isFinite(sec) && sec >= 0 ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}` : '';

function syncRadioDom(): void {
  const a = player.audio;
  document.querySelectorAll<HTMLElement>('[data-radio-row]').forEach((row) => {
    const url = row.dataset.radioRow ?? '';
    const isCurrent = Boolean(a && url === player.src);
    const isPlaying = Boolean(isCurrent && a && !a.paused && !a.ended);
    const prog = isCurrent && a && a.duration ? a.currentTime / a.duration : 0;
    row.classList.toggle('is-active', isCurrent);
    row.classList.toggle('is-playing', isPlaying);
    row.style.setProperty('--p', String(Math.max(0, Math.min(1, prog))));
    row.querySelector('[data-radio]')?.setAttribute('aria-label', isPlaying ? 'Pause team radio' : 'Play team radio');
    row.querySelector('[data-radio-seek]')?.setAttribute('aria-valuenow', String(Math.round(prog * 100)));
    const timeEl = row.querySelector<HTMLElement>('[data-radio-time]');
    if (timeEl) {
      if (url === player.failedSrc) {
        timeEl.textContent = 'Audio stream restricted by F1 CDN on this network';
      } else {
        timeEl.textContent = isCurrent && a && a.duration
          ? `${fmtAudioSec(a.currentTime)} / ${fmtAudioSec(a.duration)}`
          : '';
      }
    }
  });
}

function playRadio(url: string, seekRatio = 0): void {
  player.failedSrc = '';
  if (player.src !== url || !player.audio) {
    player.audio?.pause();
    const audio = new Audio(url);
    player.audio = audio;
    player.src = url;
    for (const ev of ['play', 'pause', 'timeupdate', 'loadedmetadata', 'ended', 'seeked']) {
      audio.addEventListener(ev, syncRadioDom);
    }
    audio.addEventListener('error', () => {
      player.failedSrc = url;
      syncRadioDom();
    });
    if (seekRatio > 0) {
      audio.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(audio.duration)) audio.currentTime = seekRatio * audio.duration;
      }, { once: true });
    }
  } else if (seekRatio > 0 && Number.isFinite(player.audio.duration)) {
    player.audio.currentTime = seekRatio * player.audio.duration;
  }
  player.audio.play().catch(() => {
    player.failedSrc = url;
    syncRadioDom();
  });
  syncRadioDom();
}

document.addEventListener('click', (ev) => {
  const target = ev.target as HTMLElement | null;
  if (!target) return;
  const seek = target.closest<HTMLElement>('[data-radio-seek]');
  if (seek && seek.dataset.radioSeek) {
    const rect = seek.getBoundingClientRect();
    const ratio = Math.min(0.99, Math.max(0, (ev.clientX - rect.left) / Math.max(1, rect.width)));
    playRadio(seek.dataset.radioSeek, ratio);
    return;
  }
  const btn = target.closest<HTMLElement>('[data-radio]');
  if (!btn || !btn.dataset.radio) return;
  const a = player.audio;
  if (a && player.src === btn.dataset.radio && !a.paused && !a.ended) {
    a.pause();
  } else {
    playRadio(btn.dataset.radio);
  }
});

/* ═══════════════ DUAL TIMING DATA ORCHESTRATION ═══════════════ */

const f1Client = new F1SignalRClient();
let pinnedSessionKey: number | 'live' | null = null;
let weekendSessions: OpenF1Session[] = [];
const bundleCache = new Map<number, OpenF1Bundle>();
let lastOf1At = 0;
let of1Queue: Promise<unknown> = Promise.resolve();

function fetchOpenF1<T = any[]>(path: string, params: Record<string, string | number>): Promise<T> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const url = `${OPENF1_API}/${path}?${qs}`;
  const run = async (): Promise<T> => {
    const wait = lastOf1At + 115 - Date.now();
    if (wait > 0) await new Promise((r) => window.setTimeout(r, wait));
    lastOf1At = Date.now();
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (res.status === 404) return [] as unknown as T;
      if (res.status === 429 && attempt === 0) {
        await new Promise((r) => window.setTimeout(r, 650));
        lastOf1At = Date.now();
        continue;
      }
      if (!res.ok) throw new Error(`OpenF1 ${path} HTTP ${res.status}`);
      const json = await res.json();
      if (json && typeof json === 'object' && !Array.isArray(json) && json.detail === 'No results found.') {
        return [] as unknown as T;
      }
      return json as T;
    }
    return [] as unknown as T;
  };
  const next = of1Queue.then(run, run);
  of1Queue = next.catch(() => {});
  return next;
}

async function loadOpenF1Bundle(session: OpenF1Session, bypassCache = false): Promise<OpenF1Bundle> {
  if (!bypassCache && bundleCache.has(session.session_key)) {
    return bundleCache.get(session.session_key)!;
  }
  const sk = session.session_key;
  const storageKey = `freef1_lt_v1_${sk}`;
  if (!bypassCache) {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as OpenF1Bundle;
        if (parsed && Array.isArray(parsed.drivers) && parsed.results?.length > 0) {
          bundleCache.set(sk, parsed);
          return parsed;
        }
      }
    } catch { /* ignore storage quota/privacy mode */ }
  }

  const drivers = await fetchOpenF1('drivers', { session_key: sk });
  const results = await fetchOpenF1('session_result', { session_key: sk });
  const laps = await fetchOpenF1('laps', { session_key: sk });
  const stints = await fetchOpenF1('stints', { session_key: sk });
  const weather = await fetchOpenF1('weather', { session_key: sk });
  const raceControl = await fetchOpenF1('race_control', { session_key: sk });
  const radio = await fetchOpenF1('team_radio', { session_key: sk });

  let positions: any[] = [];
  let intervals: any[] = [];
  if (results.length === 0) {
    positions = await fetchOpenF1('position', { session_key: sk });
    if (session.session_type === 'Race' || /^Sprint$/i.test(session.session_name)) {
      intervals = await fetchOpenF1('intervals', { session_key: sk });
    }
  }

  const bundle: OpenF1Bundle = {
    session, drivers, results, laps, stints, positions, intervals, weather, raceControl, radio,
  };
  if (results.length > 0) {
    bundleCache.set(sk, bundle);
    try { sessionStorage.setItem(storageKey, JSON.stringify(bundle)); } catch { /* ignore */ }
  }
  return bundle;
}

function renderSessionTabs(activeKey: number | 'live'): void {
  const bar = $('ltSessionsBar');
  const tabs = $('ltSessionTabs');
  if (!bar || !tabs) return;
  const hasLiveWs = Boolean(f1Client.state?.SessionInfo && snapshotFromF1State(f1Client.state)?.isLive);
  if (weekendSessions.length <= 1 && !hasLiveWs) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const liveBtn = hasLiveWs
    ? `<button class="tab ${activeKey === 'live' ? 'active' : ''}" type="button" role="tab" aria-selected="${activeKey === 'live'}" data-session-key="live">Live feed</button>`
    : '';
  tabs.innerHTML = liveBtn + weekendSessions.map((s) => {
    const isSel = activeKey === s.session_key;
    return `<button class="tab ${isSel ? 'active' : ''}" type="button" role="tab" aria-selected="${isSel}" data-session-key="${s.session_key}">${esc(s.session_name)}</button>`;
  }).join('');
}

$('ltSessionTabs')?.addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-session-key]');
  if (!btn) return;
  const raw = btn.dataset.sessionKey;
  if (raw === 'live') {
    pinnedSessionKey = 'live';
    const wsSnap = snapshotFromF1State(f1Client.state);
    if (wsSnap) {
      renderSessionTabs('live');
      paintSnapshot(wsSnap);
    }
    return;
  }
  const key = Number(raw);
  const target = weekendSessions.find((s) => s.session_key === key);
  if (!target) return;
  pinnedSessionKey = key;
  renderSessionTabs(key);
  setStatusIndicator(`Loading ${target.session_name}…`, 'connecting');
  loadOpenF1Bundle(target).then((bundle) => {
    if (pinnedSessionKey === key) paintSnapshot(snapshotFromOpenF1(bundle));
  }).catch(() => {
    setStatusIndicator(`Could not load ${target.session_name}`, 'error');
  });
});

/* Wire official F1 SignalR Core push stream */
let f1PaintScheduled = false;
f1Client.addEventListener('update', () => {
  if (f1PaintScheduled) return;
  f1PaintScheduled = true;
  window.setTimeout(() => {
    f1PaintScheduled = false;
    const snap = snapshotFromF1State(f1Client.state);
    if (!snap) return;
    if (snap.isLive && pinnedSessionKey !== 'live' && typeof pinnedSessionKey !== 'number') {
      pinnedSessionKey = 'live';
    }
    if (pinnedSessionKey === 'live' || !activeSnap) {
      renderSessionTabs('live');
      paintSnapshot(snap);
    }
  }, 220);
});

f1Client.addEventListener('status', (ev) => {
  const detail = (ev as CustomEvent<string>).detail;
  if (!activeSnap && detail === 'connecting') {
    setStatusIndicator('Connecting to live timing…', 'connecting');
  }
});

f1Client.start();

/* Bootstrap latest session + weekend session list from OpenF1 immediately so
   off-session visits and networks blocking livetiming.formula1.com get instant data. */
let livePollTimer: number | undefined;

async function bootstrapOpenF1(): Promise<void> {
  try {
    const latestArr = await fetchOpenF1<OpenF1Session[]>('sessions', { session_key: 'latest' });
    const latest = latestArr[latestArr.length - 1];
    if (!latest) throw new Error('No latest session');

    const meetingSessions = await fetchOpenF1<OpenF1Session[]>('sessions', { meeting_key: latest.meeting_key });
    const now = Date.now();
    weekendSessions = meetingSessions.filter((s) => Date.parse(s.date_start) <= now + 10 * 60_000);

    if (pinnedSessionKey === 'live') return;
    pinnedSessionKey = latest.session_key;
    renderSessionTabs(latest.session_key);

    const bundle = await loadOpenF1Bundle(latest);
    if (pinnedSessionKey === latest.session_key) {
      const snap = snapshotFromOpenF1(bundle);
      paintSnapshot(snap);

      /* If the session is currently live and SignalR is not delivering frames,
         poll OpenF1 every 12s while visible so the tower stays live everywhere. */
      clearInterval(livePollTimer);
      if (snap.isLive) {
        livePollTimer = window.setInterval(() => {
          if (document.hidden || pinnedSessionKey !== latest.session_key || f1Client.status === 'open') return;
          loadOpenF1Bundle(latest, true).then((fresh) => {
            if (pinnedSessionKey === latest.session_key) paintSnapshot(snapshotFromOpenF1(fresh));
          }).catch(() => {});
        }, 12_000);
      }
    }
  } catch {
    if (!activeSnap) {
      setStatusIndicator('Live timing unavailable. Retrying…', 'error');
      if (towerEl) {
        towerEl.removeAttribute('aria-busy');
        towerEl.innerHTML = '<p class="lt-empty">The timing feed could not be reached right now. Refresh in a moment to try again.</p>';
      }
    }
  }
}

bootstrapOpenF1();

/* Tick live session clock once per second when visible. */
window.setInterval(() => {
  if (document.hidden || !activeSnap || !activeSnap.isLive) return;
  if (activeSnap.source === 'f1live') {
    const lapCount = f1Client.state?.LapCount;
    if (lapCount?.TotalLaps) {
      set('ltClockLabel', 'Lap');
      set('ltClock', `${lapCount.CurrentLap ?? 0}/${lapCount.TotalLaps}`);
      return;
    }
    const rem = extrapolatedRemainingMs(f1Client.state);
    if (rem !== null) {
      set('ltClockLabel', 'Remaining');
      set('ltClock', formatRemainingMs(rem));
    }
  }
}, 1000);
