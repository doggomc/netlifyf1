/* Multi-viewer: weelo streams only.
   Modelled on the rerace.net grid the user pointed at: one button next to the player actions,
   ?mv=1 in the address, a 3x3 ceiling (9 tiles), a main/audio tile you can move, per-tile
   sound routing, a feed library drawer for adding and removing tiles, and focus/fullscreen.
   Everything is a real player window — each tile is a live stream frame, not a poster.

   Loaded lazily: a visitor who never presses the button downloads none of this. */

export interface WeeloStream { id: string; label: string; live: boolean; pasted?: string; }

/* Nine boxes: the grid is 3x3 at the ceiling, the layout picks the best rectangle below that. */
export const MAX_TILES = 9;
const GAP = 6;

export const PLAYER = 'https://weellz.live/beta?stream=';
const ALLOW = 'autoplay; fullscreen; encrypted-media; picture-in-picture';

/* Address for one tile. autoplay is always on; mute follows the audio routing, because a grid of
   nine unmuted feeds is noise, not coverage. */
export function tileUrl(id: string, muted: boolean, base = ''): string {
  /* A feed Race Control pasted a link for plays that link, not the id we shipped. */
  const url = base || `${PLAYER}${id}`;
  return `${url}${url.includes('?') ? '&' : '?'}autoplay=1&mute=${muted ? 1 : 0}`;
}

/* Column/row count for N tiles inside a WxH box, keeping each tile as close to 16:9 as it can.
   This is the same trade rerace makes: grow the column count while the tiles get bigger. */
export function layout(count: number, width: number, height: number) {
  if (count < 1) return [];
  const fit = (a: number, b: number) => (a / b > 16 / 9 ? { w: b * (16 / 9), h: b } : { w: a, h: a * (9 / 16) });
  let best: { cols: number; rows: number; t: { w: number; h: number } } | null = null;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const t = fit((width - GAP * (cols - 1)) / cols, (height - GAP * (rows - 1)) / rows);
    if (!best || t.w > best.t.w) best = { cols, rows, t };
  }
  const { cols, rows, t } = best!;
  const top = (height - (rows * t.h + (rows - 1) * GAP)) / 2;
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, count - row * cols);
    const left = (width - (inRow * t.w + (inRow - 1) * GAP)) / 2;
    boxes.push({ x: left + (i % cols) * (t.w + GAP), y: top + row * (t.h + GAP), w: t.w, h: t.h });
  }
  return boxes;
}

const icon = (name: string) => {
  const paths: Record<string, string> = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    volume: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/>',
    muted: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M17 9l4 6M21 9l-4 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
};

export function init(ctx: any) {
  const stage: HTMLElement | null = document.getElementById('player');
  const toggled = document.getElementById('mvToggle');
  if (!stage || (document.getElementById('multiViewer') && toggled?.dataset.wired)) return;

  const panel = document.createElement('div');
  panel.id = 'multiViewer';
  panel.className = 'mvx';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="mvx-bar">
      <span class="mvx-title">Multi-viewer <b class="mvx-count" data-mvx-count>0</b></span>
      <div class="mvx-seg" role="group" aria-label="Layout">
        <button type="button" aria-pressed="true" data-mvx-mode="grid" title="Grid">${icon('grid')}<span>Grid</span></button>
        <button type="button" aria-pressed="false" data-mvx-mode="focus" title="Focus the main tile">${icon('expand')}<span>Focus</span></button>
      </div>
      <div class="mvx-actions">
        <button type="button" class="mvx-btn mvx-add" data-mvx-open-lib>${icon('plus')}<span>Add</span></button>
        <button type="button" class="mvx-btn" data-mvx-full title="Full screen">${icon('expand')}</button>
        <button type="button" class="mvx-btn mvx-close" data-mvx-close title="Leave grid">${icon('close')}</button>
      </div>
    </div>
    <p class="mvx-beta" role="note"><span class="mvx-online"><i aria-hidden="true"></i><b data-mvx-online>—</b> online</span> <b>BETA</b> Multi-viewer is in beta — it needs a strong connection and may lag or drop a feed. Built for the pit wall, not for a phone on a train.</p>
    <div class="mvx-stage"><div class="mvx-tiles" data-mvx-tiles></div>
      <aside class="mvx-lib" data-mvx-lib hidden>
        <div class="mvx-lib-head">
          <b>Add a feed</b>
          <button type="button" class="mvx-btn" data-mvx-lib-close title="Close">${icon('close')}</button>
        </div>
        <p class="mvx-lib-note" data-mvx-note></p>
        <div data-mvx-list></div>
      </aside>
    </div>
`;
  /* Inside the player window, not under it: activating the multi-viewer IS the cockpit window
     changing what it shows, which is the point of it. The player's own frame stays mounted
     underneath, so leaving the grid puts the same stream back without a reload. */
  stage.appendChild(panel);

  const tilesEl = panel.querySelector<HTMLElement>('[data-mvx-tiles]')!;
  const stageWrap = panel.querySelector<HTMLElement>('.mvx-stage')!;
  const stageEl = panel.querySelector<HTMLElement>('.mvx-stage')!;
  const libEl = panel.querySelector<HTMLElement>('[data-mvx-lib]')!;
  const countEl = panel.querySelector<HTMLElement>('[data-mvx-count]')!;
  const noteEl = panel.querySelector<HTMLElement>('[data-mvx-note]')!;
  const listEl = panel.querySelector<HTMLElement>('[data-mvx-list]')!;

  const frames = new Map<string, HTMLIFrameElement>();
  let ids: string[] = [];
  let audio: string | null = null;
  let mode: 'grid' | 'focus' = 'grid';
  let open = false;

  /* Every weelo chip Race Control has not disabled is a candidate tile, and nothing else: weelo's
     stream list carries the other sports on the same host, and a grid that can open a basketball
     feed under an F1 label is exactly the wrong-sport failure we do not ship. A dark F1 feed stays
     listed (it says "off air") instead of mounting a player that could only show black. */
  /* Every weelo feed Race Control has left enabled is offered, whether it is up or not: an onboard
     that is dark this minute is the feed you want two minutes later, and hiding it just meant the
     grid could never hold more than the couple of feeds that happened to be live. Dark ones are
     labelled "off air" and still mount, so nothing has to be re-added by hand. */
  const streams = (): WeeloStream[] => (ctx.sources || [])
    /* A pasted link outlives Race Control's weelo switches: it is an address someone chose. */
    .filter((s: any) => s.weelo && (!s.hidden || s.links?.[0]?.provider === 'custom'))
    .map((s: any) => {
      const pasted = s.links?.[0]?.provider === 'custom' ? String(s.links[0].url || '') : '';
      return { id: s.weelo, label: s.label, live: pasted ? true : !ctx.isSpecialDown(s), pasted };
    });



  const byId = (id: string) => streams().find((s) => s.id === id);

  function relayout() {
    const w = stageEl.clientWidth;
    const h = stageEl.clientHeight;
    if (!w || !h) return;
    if (mode === 'focus' && audio) {
      tilesEl.style.gridTemplate = '';
      for (const [id, f] of frames) {
        const tile = f.parentElement!;
        const main = id === audio;
        tile.style.cssText = main ? 'position:absolute;inset:0' : 'display:none';
        tile.classList.toggle('is-main', main);
      }
      return;
    }
    /* The stage's inner height is the panel minus its toolbar; the toolbar floats over the tiles. */
    const boxes = layout(ids.length, w, h);
    ids.forEach((id, i) => {
      const tile = frames.get(id)?.parentElement;
      if (!tile) return;
      const b = boxes[i];
      tile.style.display = '';
      tile.style.position = 'absolute';
      tile.style.left = `${b.x}px`;
      tile.style.top = `${b.y + 0}px`;
      tile.style.width = `${b.w}px`;
      tile.style.height = `${b.h}px`;
      tile.classList.toggle('is-main', id === audio);
    });
  }

  /* Sound is a message to the player already running in the tile, never a new document. Swapping an
     iframe's src threw the player away and restarted the feed, which is why every mute re-buffered
     the whole grid. weelo's player accepts the standard mute commands, so the tile keeps playing
     and only its audio changes. */
  function paintAudio(remount = false) {
    for (const [id, f] of frames) {
      const on = id === audio;
      /* weelo's page listens for both shapes of command, so send both: the mute state is the one
         thing the tool promises, and a quiet click on it is the bug that was reported. */
      try {
        f.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: on ? 'unMute' : 'mute', args: [] }), '*');
        f.contentWindow?.postMessage(JSON.stringify({ method: on ? 'unMute' : 'mute', value: true }), '*');
        f.contentWindow?.postMessage(JSON.stringify({ type: 'freef1-audio', muted: !on }), '*');
      } catch { /* a cross-origin frame that refuses the message keeps its current audio */ }
      const want = id === audio ? 'on' : 'off';
      /* If a provider ignores the message, the address itself carries the mute flag. Only the two
         frames whose state changed are re-addressed, and only on an explicit audio change. */
      if (remount && f.dataset.state !== want) {
        const next = tileUrl(id, !on, byId(id)?.pasted);
        if (next !== f.src) f.src = next;
      }
      f.dataset.state = want;
      const btn = f.parentElement?.querySelector<HTMLElement>('[data-mvx-audio]');
      if (btn) {
        btn.innerHTML = icon(on ? 'volume' : 'muted');
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', String(on));
        btn.title = on ? 'Sound on' : 'Listen to this feed';
      }
    }
  }

  /* One feed holds the sound; taking it away from another tile must never touch its document. */
  function setAudio(id: string) {
    if (audio === id) return;
    audio = id;
    paintAudio(true);
    paintMain();
    if (mode === 'focus') relayout();
  }

  /* "Big" lifts one box to the focus layout without rebuilding any tile. */
  function makeBig(id: string) {
    ids = [id, ...ids.filter((x) => x !== id)];
    setAudio(id);
    mode = 'focus';
    panel.querySelectorAll<HTMLElement>('[data-mvx-mode]').forEach((o) => {
      const on = o.dataset.mvxMode === 'focus';
      o.classList.toggle('is-on', on);
      o.setAttribute('aria-pressed', String(on));
    });
    draw();
  }

  function createTile(id: string): HTMLElement {
    const stream = byId(id);
    const tile = document.createElement('div');
    tile.className = 'mvx-tile';
    tile.dataset.feed = id;
    if (!stream) return tile;
    /* Dark feeds are mounted, not skipped: weelo's own player is the thing that comes back when the
       feed comes up, and a tile that refused to exist read as "Add feed does not work". The badge
       says it is dark so a still frame is never mistaken for a broken one. */
    if (!stream.live) tile.classList.add('is-off');
    const f = document.createElement('iframe');
    f.src = tileUrl(id, id !== audio, stream.pasted);
    f.dataset.state = id === audio ? 'on' : 'off';
    f.allow = ALLOW;
    f.setAttribute('allow', ALLOW);
    f.allowFullscreen = true;
    f.referrerPolicy = 'no-referrer';
    f.title = stream.label;
    f.dataset.stream = id;
    f.loading = 'lazy';

    /* Their tile chrome, top right: a round glass tool for sound, one to take the box big and one
       to drop it. The label moved to the top left, where their handle sits. */
    const bar = document.createElement('div');
    bar.className = 'mvx-tile-bar';
    const name = document.createElement('span');
    name.className = 'mvx-tile-name';
    /* The badge is its own element so the label stays the label and "off air" is still a state. */
    name.textContent = stream.label;
    if (!stream.live) {
      const off = document.createElement('b');
      off.className = 'mvx-off-msg';
      off.textContent = 'off air';
      name.append(' · ', off);
    }
    const tools = document.createElement('span');
    tools.className = 'mvx-tools';
    const tool = (label: string, markup: string, act: () => void, attr?: string) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mvx-tool';
      b.title = label;
      b.setAttribute('aria-label', label);
      if (attr) b.dataset.mvxAudio = '';
      b.innerHTML = markup;
      b.onclick = act;
      return b;
    };
    const sound = tool('Listen to this feed', icon('muted'), () => setAudio(id), 'audio');
    sound.setAttribute('aria-pressed', 'false');
    const big = tool('Make this the main tile', icon('expand'), () => makeBig(id));
    const drop = tool('Remove from the grid', icon('close'), () => remove(id));
    tools.append(sound, big, drop);
    bar.append(name, tools);
    tile.append(f, bar);
    frames.set(id, f);
    return tile;
  }

  function paintMain() {
    for (const [id, f] of frames) f.parentElement?.classList.toggle('is-main', id === audio);
  }

  function draw() {
    for (const [id, f] of frames) {
      if (!ids.includes(id)) {
        f.parentElement?.remove();
        frames.delete(id);
      }
    }
    for (const id of ids) {
      const existing = tilesEl.querySelector(`[data-feed="${CSS.escape(id)}"]`);
      if (!existing) tilesEl.appendChild(createTile(id));
    }
    /* Keep DOM order equal to selection order so the layout and the bar agree — but only when the
       order actually changed. Re-appending an unchanged tile moves its node, and moving a node that
       holds an <iframe> reloads that document in every browser: that was the whole grid restarting
       every 15 seconds. */
    const current = [...tilesEl.children].map((c) => (c as HTMLElement).dataset.feed).join('|');
    if (current !== ids.join('|')) {
      ids.forEach((id) => {
        const tile = tilesEl.querySelector(`[data-feed="${CSS.escape(id)}"]`);
        if (tile) tilesEl.appendChild(tile);
      });
    }
    /* No tiles means no stage at all: a black 16:9 box with nothing in it reads as a dead player,
       which is the one thing this page must never show. The picker takes the space instead. */
    stageWrap.hidden = ids.length === 0;
    countEl.textContent = String(ids.length);
    /* The drawer shows what is in the grid and how many boxes are left, so it is redrawn with it. */
    if (!libEl.hidden) drawLibrary();
    relayout();
    paintAudio();
  }

  function add(id: string) {
    if (ids.includes(id) || ids.length >= MAX_TILES) return;
    ids.push(id);
    if (!audio) audio = id;
    /* Only the new tile is built: draw() appends it and leaves every existing frame alone. */
    draw();
    if (!ids.length) library(true);
  }

  function remove(id: string) {
    const at = ids.indexOf(id);
    if (at < 0) return;
    ids.splice(at, 1);
    if (audio === id) audio = ids[0] || null;
    draw();
    if (!ids.length) library(true);
  }

  function library(on?: boolean) {
    const next = on ?? libEl.hidden;
    libEl.hidden = !next;
    if (next) drawLibrary();
  }

  function drawLibrary() {
    const list = streams();
    const full = ids.length >= MAX_TILES;
    noteEl.textContent = full
      ? `${MAX_TILES} of ${MAX_TILES} tiles in use — remove one to add another.`
      : `${ids.length} of ${MAX_TILES} tiles in use. Every feed here comes from weelo.`;
    listEl.replaceChildren(...list.map((s) => {
      const inGrid = ids.includes(s.id);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'mvx-lib-row' + (inGrid ? ' is-in' : '');
      row.disabled = !inGrid && full;
      row.innerHTML = `<span class="mvx-lib-name">${s.label}</span><span class="mvx-lib-state">${inGrid ? 'in grid' : s.live ? 'add' : 'add · off air'}</span>`;
      row.onclick = () => (inGrid ? remove(s.id) : add(s.id));
      return row;
    }));
  }

  /* The button beside the player is the only control outside the grid, so it is kept in step here
     rather than reaching back into the app for a setter. */
  function markButton(on: boolean) {
    const b = document.getElementById('mvToggle');
    b?.classList.toggle('primary', on);
    b?.setAttribute('aria-pressed', String(on));
  }

  /* The player is parked, not destroyed: its frame keeps its address and comes back untouched when
     the grid closes. It is hidden because the grid covers it, not because it stopped playing. */
  /* Hiding the player is not enough — a hidden iframe keeps decoding and keeps its sound on, which
     is exactly what "the stream continues in the background" was. park() and unpark() cover it:
     the frame goes to about:blank (silence, no decoder) and the same address is put back when the
     grid closes, so nothing has to be re-picked. */
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

  const available = () => (ctx.sources || []).some((s: any) => s.weelo && !s.hidden);

  /* The nav's connection count, carried into the grid: in theater the nav is gone, so the thing
     people look at most would otherwise vanish with it. */
  function mirrorCounter() {
    const src = document.getElementById('viewerCount');
    const out = panel.querySelector<HTMLElement>('[data-mvx-online]');
    if (src && out && out.textContent !== src.textContent) out.textContent = src.textContent || '—';
  }

  function show(on: boolean) {
    /* Nothing to grid when Race Control has turned every weelo feed off: stay closed rather than
       open an empty monitor. */
    if (on && !available()) return;
    open = on;
    panel.hidden = !on;
    document.documentElement.classList.toggle('has-mvx', on);
    if (on) {
      savedSource = ctx.currentSource;
      const list = streams();
      if (!ids.length) {
        /* Open with the three headline feeds that weelo actually has on air. Nothing on air means
           no tiles at all and the picker open: an empty grid is honest, a grid of black frames is
           the 'connected but black' failure we do not ship. */
        ids = list.slice(0, 3).map((s) => s.id);
        audio = ids[0] || null;
      }
      ids = ids.filter((id) => byId(id));
      panel.hidden = false;
      requestAnimationFrame(() => { draw(); if (!ids.length) library(true); });
      park(true);
      mirrorCounter();
      markButton(true);
      btnUrl?.(true);
    } else {
      for (const [, f] of frames) f.src = 'about:blank';
      frames.clear();
      ids = [];
      audio = null;
      tilesEl.replaceChildren();
      library(false);
      markButton(false);
      park(false);
      btnUrl?.(false);
      /* Leaving the grid puts the top stream back on the player, even if the source row was changed
         while the grid was up. */
      ctx.reloadTop?.(savedSource);
    }
  }

  /* The grid is mounted next to the player, so any resize of the column is a relayout. */
  const ro = new ResizeObserver(() => relayout());
  ro.observe(stageEl);

  panel.querySelector('[data-mvx-close]')!.addEventListener('click', () => show(false));
  /* Closing the panel any other way (Escape, the app's own close) must also unpress the button, so
     the button's state is derived from the panel rather than tracked twice. */
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) show(false); });
  /* The button toggles the panel; the panel never reads its own hidden flag back as state. */
  toggled?.addEventListener('click', () => show(!open));
  panel.querySelector('[data-mvx-open-lib]')!.addEventListener('click', () => library(true));
  panel.querySelector('[data-mvx-lib-close]')!.addEventListener('click', () => library(false));
  panel.querySelector('[data-mvx-full]')!.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void panel.requestFullscreen?.();
  });
  panel.querySelectorAll<HTMLElement>('[data-mvx-mode]').forEach((b) => {
    b.addEventListener('click', () => {
      mode = b.dataset.mvxMode === 'focus' ? 'focus' : 'grid';
      panel.querySelectorAll('[data-mvx-mode]').forEach((o) => {
        o.classList.toggle('is-on', o === b);
        o.setAttribute('aria-pressed', String(o === b));
      });
      relayout();
    });
  });

  /* The button beside the player is drawn and wired here, so the startup chunk carries nothing for
     a feature most visits never open. It only exists when weelo has a source Race Control has not
     disabled, and ?mv=1 in the address opens the grid on load. */
  function wireToggle() {
    const b = document.getElementById('mvToggle');
    if (!b) return;
    b.dataset.wired = '1';
    const available = (ctx.sources || []).some((s: any) => s.weelo && !s.hidden);
    b.hidden = !available;
    if (!available) return;
    /* The address carries the state so a grid can be linked to and the back button behaves. */
    btnUrl = (on) => {
      const url = new URL(location.href);
      if (on) url.searchParams.set('mv', '1'); else url.searchParams.delete('mv');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    };
  }
  let btnUrl: ((on: boolean) => void) | null = null;
  wireToggle();

  /* weelo's state arrives after the grid can be asked to open (a ?mv=1 link fires before the first
     catalogue), so the tiles are re-checked against it: a tile that turns out to be off air is
     dropped instead of being kept as a black frame. */
  const sync = () => {
    if (!open) return;
    /* Preserve already-mounted playing tiles across 3-minute weellz.live link refreshes unless hidden by Race Control. */
    for (const id of [...ids]) {
      const hiddenByAdmin = ctx.sources.some((s: any) => s.hidden && s.weelo === id);
      if (hiddenByAdmin || (!frames.has(id) && !byId(id))) remove(id);
    }
    /* weelo's state map arrives after the tiles do, so the badge is refreshed rather than decided
       once: a feed that comes up loses it, a feed that goes dark gains it, and neither is unmounted. */
    for (const id of ids) {
      const tile = tilesEl.querySelector(`[data-feed="${CSS.escape(id)}"]`);
      const known = byId(id);
      if (!known) continue;
      const live = known.live !== false;
      tile?.classList.toggle('is-off', !live);
      const badge = tile?.querySelector('.mvx-off-msg');
      if (badge) badge.textContent = live ? '' : 'off air';
    }
    /* The badge and the ordering are pure DOM state: no frame is rebuilt here, and nothing is
       re-appended unless a feed really went away. */
    relayout();
    if (!ids.length) library(true);
  };
  /* Slow, and only ever a class swap: weelo changes state on the scale of minutes, not seconds. */
  setInterval(sync, 60000);
  setInterval(mirrorCounter, 5000);
  setTimeout(sync, 6000);

  /* Testing hook. weelo decides when its feeds exist, not us, so the grid can be driven with a
     forced state map (?mvtest=live) to prove layouts, audio routing and removal on demand. It is
     read-only: nothing here can change what the page does for a real visitor. */
  const testMode = new URLSearchParams(location.search).get('mvtest');
  if (testMode) {
    const forced = () => testMode === 'live';
    ctx.isSpecialDown = () => !forced();
  }
  const api = { show, toggle: () => show(!open), isOpen: () => open, picked: () => [...ids], add, remove, wireToggle };
  ctx.multiViewer = api;
  return api;
}
