/* Multi-viewer: weelo streams only.
   A fourth tab after All shows every weelo stream as a greyed chip; clicking one turns it red and
   claims a grid box. The grid is always four boxes — 1 selection fills left+right as one wide tile,
   2 fill the top row, 3 leave the last box empty, 4 fill everything.
   Loaded lazily, so a visitor who never opens the tab pays nothing for it. */

export interface WeeloStream { id: string; label: string; live: boolean; }

/* Always four slots. Index 0..3, filled from the selection order. */
export type Slots = (string | null)[];

export const slotsFor = (picked: string[]): Slots => [0, 1, 2, 3].map((i) => picked[i] || null);

/* One selection is drawn wide across the top-left and top-right boxes. */
export const gridClass = (count: number) => (count <= 1 ? 'mv-grid mv-one' : count === 2 ? 'mv-grid mv-two' : 'mv-grid');

const PLAYER = 'https://weellz.live/beta?stream=';
const ALLOW = 'autoplay; fullscreen; encrypted-media; picture-in-picture';

function tile(stream: WeeloStream | undefined, picked: boolean): HTMLElement {
  const box = document.createElement('div');
  box.className = 'mv-tile' + (stream ? '' : ' mv-empty');
  if (!stream) {
    box.innerHTML = '<span class="mv-off">empty</span>';
    return box;
  }
  if (!stream.live) {
    box.innerHTML = `<span class="mv-off">${stream.label} · off air</span>`;
    return box;
  }
  const f = document.createElement('iframe');
  f.src = PLAYER + stream.id + '&autoplay=1&mute=1';
  f.allow = ALLOW;
  f.setAttribute('allow', ALLOW);
  f.allowFullscreen = true;
  f.referrerPolicy = 'no-referrer';
  f.title = stream.label;
  f.dataset.stream = stream.id;
  const bar = document.createElement('div');
  bar.className = 'mv-bar';
  bar.innerHTML = `<span>${stream.label}</span>`;
  /* Four feeds all unmuted is unusable, so a tile starts muted and unmutes only when asked. */
  const sound = document.createElement('button');
  sound.type = 'button';
  sound.className = 'mv-sound';
  sound.textContent = 'Unmute';
  sound.onclick = () => {
    f.src = PLAYER + stream.id + '&autoplay=1&mute=0';
    sound.textContent = sound.textContent === 'Unmute' ? 'Muted' : 'Unmute';
  };
  bar.appendChild(sound);
  box.append(f, bar);
  return box;
}

export function init(ctx: any) {
  const linksEl: HTMLElement | null = document.getElementById('links');
  const stage: HTMLElement | null = document.getElementById('player');
  if (!linksEl || !stage || document.getElementById('multiViewer')) return;

  const panel = document.createElement('div');
  panel.id = 'multiViewer';
  panel.className = 'mv';
  panel.hidden = true;
  const grid = document.createElement('div');
  grid.className = 'mv-grid';
  const bar = document.createElement('div');
  bar.className = 'mv-head';
  bar.innerHTML = '<span class="mv-title">Multi-viewer · weelo</span>';
  const exit = document.createElement('button');
  exit.type = 'button';
  exit.className = 'btn sm';
  exit.textContent = 'Leave grid';
  const full = document.createElement('button');
  full.type = 'button';
  full.className = 'btn sm';
  full.textContent = 'Fullscreen';
  full.onclick = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void panel.requestFullscreen?.();
  };
  bar.append(exit, full);
  panel.append(bar, grid);
  stage.after(panel);

  let picked: string[] = [];
  let open = false;

  /* weelo's own event feed decides whether a chip can play; a feed with no known state is offered. */
  const streams = (): WeeloStream[] => (ctx.sources || [])
    .filter((s: any) => s.weelo && !s.hidden)
    .map((s: any) => ({ id: s.weelo, label: s.label, live: !ctx.isSpecialDown(s) }));

  function draw() {
    const list = streams();
    grid.className = gridClass(picked.length);
    grid.replaceChildren(...slotsFor(picked).map((id) => tile(list.find((s) => s.id === id), Boolean(id))));
    picked = picked.filter((id) => list.some((s) => s.id === id));
  }

  function drawPicker() {
    linksEl!.replaceChildren();
    const head = document.createElement('span');
    head.className = 'special-head';
    head.textContent = 'Onboards & data';
    linksEl!.appendChild(head);
    for (const stream of streams()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip chip-mv' + (picked.includes(stream.id) ? ' picked' : '');
      if (!stream.live) b.classList.add('is-down'), b.title = 'weelo: off air';
      b.textContent = stream.label;
      b.onclick = () => {
        const at = picked.indexOf(stream.id);
        if (at >= 0) picked.splice(at, 1);
        /* Hard cap of four: the grid has four boxes and nothing is evicted silently. */
        else if (picked.length < 4) picked.push(stream.id);
        else return;
        drawPicker();
        draw();
      };
      linksEl!.appendChild(b);
    }
  }

  function show(on: boolean) {
    open = on;
    panel.hidden = !on;
    if (on) {
      drawPicker();
      draw();
    } else {
      ctx.renderButtons();
    }
  }

  exit.onclick = () => show(false);

  ctx.multiViewer = { show, isOpen: () => open, picked: () => [...picked] };
  return { show, isOpen: () => open };
}
