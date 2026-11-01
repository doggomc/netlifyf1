import type { FeatureContext } from '../app';
import { $ } from '../services/dom';
export function init(ctx: FeatureContext) {
const { fetchJson, JOLPI, SITE_SEASON, hexFor, escapeHtml, readApiFallback, fadeSwapContent, inkOn, store, FOLLOW_KEY, TEAM_ALIAS, teams, mapPool, schedule, fmtPts, ageFrom, TEAM_LOGO, fmtDob, applyTeamTheme, closeModal, openModal } = ctx;
/* Headshots live in their own chunk so their image paths never sit in the startup bundle. The
   lookup starts with this import and is simply empty until it lands. */
let photoFor = (_id: string): string | null => null;
void import('../data/driver-photos').then(({ DRIVER_PHOTO, DRIVER_KEY }) => {
  photoFor = (id) => DRIVER_PHOTO[DRIVER_KEY[id] || id] || null;
});
/* ═══════════════ 14. STANDINGS (DRIVERS & CONSTRUCTORS) ═══════════════ */
const rowsEl = $("standingsList");
let driverStandingsPromise = null;

function getDriverStandings() {
  if (!driverStandingsPromise) {
    driverStandingsPromise = fetchJson(`${JOLPI}/${SITE_SEASON}/driverstandings/?limit=30`)
      .then((data) => data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [])
      .catch(error => { driverStandingsPromise = null; throw error; });
  }
  return driverStandingsPromise;
}

function renderStandings(type, list) {
  if (!rowsEl) return;
  rowsEl.innerHTML = '';
  const fragment = document.createDocumentFragment();
  list.forEach((it, i) => {
    const row = document.createElement('div');
    row.className = 'row' + (i === 0 ? ' p1' : '');
    row.style.animation = `rowIn .5s var(--ease) ${i * 24}ms both`;
    const name = type === 'drivers'
      ? `${it.Driver?.givenName || ''} ${it.Driver?.familyName || ''}`
      : (it.Constructor?.name || '');
    const sub = type === 'drivers'
      ? (it.Constructors?.[0]?.name || '')
      : `${it.wins || '0'} wins`;
    const tc = hexFor(type === 'drivers' ? it.Constructors?.[0]?.name : it.Constructor?.name);
    row.style.setProperty('--team', tc);
    row.innerHTML = `<div class="pos">${escapeHtml(it.position)}</div><div class="who"><b>${escapeHtml(name)}</b><small>${escapeHtml(sub)}</small></div><div class="pts">${escapeHtml(it.points)}<small>PTS</small></div>`;
    fragment.appendChild(row);
  });
  rowsEl.replaceChildren(fragment);
  rowsEl.removeAttribute('aria-busy');
  rowsEl.style.opacity = '1';
}

const standingsCache = new Map();

let activeStandingsType = 'drivers';
function loadStandings(type) {
  activeStandingsType = type;
  const url = `${JOLPI}/${SITE_SEASON}/${type === 'drivers' ? 'driverstandings' : 'constructorstandings'}/?limit=30`;
  const cached = standingsCache.get(type) || readApiFallback(url);

  // If already in memory or localStorage, render instantly (0ms latency, no flicker)
  if (cached) {
    const lists = cached?.MRData?.StandingsTable?.StandingsLists?.[0];
    const list = type === 'drivers' ? lists?.DriverStandings : lists?.ConstructorStandings;
    if (list && list.length) {
      renderStandings(type, list);
    }
  } else {
    if (rowsEl) rowsEl.style.opacity = '0.35';
  }

  fetchJson(url)
    .then((data) => {
      standingsCache.set(type, data);
      const lists = data?.MRData?.StandingsTable?.StandingsLists?.[0];
      const list = type === 'drivers' ? lists?.DriverStandings : lists?.ConstructorStandings;
      if (!list || !list.length) throw new Error('Empty');
      if (activeStandingsType === type) renderStandings(type, list);
    })
    .catch(() => {
      if (!cached && rowsEl) rowsEl.style.opacity = '1';
    });
}

document.querySelectorAll<HTMLElement>('#standings [role="tab"]').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll<HTMLElement>('#standings [role="tab"]').forEach((x) => {
      const active = x === t;
      x.classList.toggle('active', active);
      x.setAttribute('aria-selected', String(active));
    });
    loadStandings(t.dataset.type);
  });
});

/* ═══════════════ 15. DRIVER GRID (LIVE ORDER) ═══════════════ */
let driverEntries = [];

/* Cards are committed in small batches, one batch per frame.
   Building all 22 at once costs the phone one long frame right where the grid scrolls into
   view - that was the biggest single hitch while scrolling. The placeholder cards already
   occupy the exact space of the real cards, so swapping them in batches cannot move anything. */
const GRID_BATCH = 4;
function commitGrid(el: HTMLElement, fragment: DocumentFragment) {
  const cards = Array.from(fragment.children) as HTMLElement[];
  const placeholders = Array.from(el.querySelectorAll('.dcard.skel'));
  if (!placeholders.length) {
    el.appendChild(fragment);
    return;
  }
  let i = 0;
  const step = () => {
    const slice = cards.slice(i, i + GRID_BATCH);
    slice.forEach((card, offset) => {
      const placeholder = placeholders[i + offset];
      if (placeholder && placeholder.parentNode === el) el.replaceChild(card, placeholder);
      else el.appendChild(card);
    });
    i += slice.length;
    if (i < cards.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderDriverGrid(list) {
  const el = $("driverGrid");
  if (!el) return;
  if (!list || !list.length) {
    fadeSwapContent(el, () => {
      el.innerHTML = '<div class="state">Grid unavailable right now.</div>';
    });
    return;
  }
  driverEntries = list.slice();
  const renderFollowing = getFollowing();
  const fragment = document.createDocumentFragment();
  let rendered = 0;

  list.forEach((it) => {
    const d = it.Driver || {};
    const team = it.Constructors?.[0]?.name || '';
    const src = photoFor(d.driverId);
    const a = document.createElement('article');
    a.className = 'dcard' + (it.position === '1' ? ' lead' : '') + (src ? '' : ' noimg');
    const accent = hexFor(team);
    a.style.setProperty('--c', accent);
    a.style.setProperty('--c-ink', inkOn(accent));
    const label = `View ${d.givenName || ''} ${d.familyName || ''} profile`.replace(/\s+/g, ' ').trim();
    a.setAttribute('role', 'button');
    a.tabIndex = 0;
    a.setAttribute('aria-label', label);
    a.title = label;
    a.dataset.driverId = d.driverId;
    a.innerHTML = `<div class="dshadow"></div><div class="dshade"></div><div class="dfall">${escapeHtml((d.givenName?.[0] || '') + (d.familyName?.[0] || ''))}</div>
      ${src ? `<img src="${src}" alt="${escapeHtml(`${d.givenName || ''} ${d.familyName || ''}`)}" width="440" height="587" loading="lazy" decoding="async" fetchpriority="low" referrerpolicy="no-referrer">` : ''}
      <div class="dpos">P${escapeHtml(it.position)}</div><div class="dnum">${escapeHtml(d.permanentNumber || '')}</div>
      <div class="dhint">View profile</div>
      <div class="fbadge"${renderFollowing.includes(d.driverId) ? '' : ' hidden'}>★ Following</div>
      <div class="dbody"><div class="dname"><small>${escapeHtml(d.givenName || '')}</small>${escapeHtml(d.familyName || '')}</div>
      <div class="dteam"><i></i>${escapeHtml(team)}</div><div class="dpts">${escapeHtml(it.points)} PTS · ${escapeHtml(it.wins)} WIN${it.wins === '1' ? '' : 'S'}</div></div>`;
    a.querySelector('img')?.addEventListener('error', () => a.classList.add('noimg'), { once: true });
    const open = () => openDriverProfile(d.driverId);
    a.addEventListener('click', open);
    a.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
    fragment.appendChild(a);
    rendered++;
  });
  if (rendered) {
    el.removeAttribute('aria-busy');
    commitGrid(el, fragment);
  } else {
    fadeSwapContent(el, () => {
      el.innerHTML = '<div class="state">Grid unavailable right now.</div>';
    });
  }
}

function loadDriverGrid() {
  getDriverStandings()
    .then(renderDriverGrid)
    .catch(() => {
      const el = $("driverGrid");
      if (el) fadeSwapContent(el, () => {
        el.innerHTML = '<div class="state">Grid unavailable right now.</div>';
      });
    });
}

/* ═══════════════ 16. DRIVER PROFILE MODAL ═══════════════ */
const dOverlay = $("driverOverlay");
const dSheet = $("driverSheet");
const dProfile = $("driverProfile");
let driverProfileToken = 0;
const driverCareerCache = new Map();
const CAREER_LS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 12h client cache — Jolpi is slow (multi-page + title checks)
const CAREER_LS_PREFIX = 'freef1_career_v2_';
const careerTitleCache = new Map(); // year -> champion driverId (or null)
function readCareerLs(driverId){
  try{
    const raw = store.get(CAREER_LS_PREFIX + driverId);
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(!obj || !obj.savedAt || !obj.career) return null;
    if(Date.now() - Number(obj.savedAt) > CAREER_LS_TTL_MS) return null;
    return obj.career;
  }catch(_){ return null; }
}
function writeCareerLs(driverId, career){
  try{
    store.set(CAREER_LS_PREFIX + driverId, JSON.stringify({ savedAt: Date.now(), career }));
    // LRU trim: keep at most 20 drivers
    const keys = [];
    try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.indexOf(CAREER_LS_PREFIX)===0) keys.push(k); } }catch(_){}
    if(keys.length>20){
      keys.sort((a,b)=>{ try{ return JSON.parse(store.get(a)||'{}').savedAt - JSON.parse(store.get(b)||'{}').savedAt; }catch(_){ return 0; } });
      for(let i=0;i<keys.length-20;i++) try{ localStorage.removeItem(keys[i]); }catch(_){}
    }
  }catch(_){}
}

function getFollowing() {
  try {
    const list = JSON.parse(store.get(FOLLOW_KEY) || '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch (_) {
    return [];
  }
}

function syncFollowBadges() {
  const following = getFollowing();
  document.querySelectorAll<HTMLElement>('.dcard[data-driver-id]').forEach((card) => {
    const badge = card.querySelector<HTMLElement>('.fbadge');
    if (badge) badge.hidden = !following.includes(card.dataset.driverId);
  });
}

function teamEntryForConstructor(name) {
  const n = String(name || '').trim().toLowerCase();
  if (TEAM_ALIAS[n]) return teams.find((t) => t.id === TEAM_ALIAS[n]) || teams[0];
  return teams.find((t) => t.id !== 'default' && (n.includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(n))) || teams[0];
}

async function fetchCareerJson(url, attempts = 3) {
  let wait = 400;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchJson(url);
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((r) => window.setTimeout(r, wait));
      wait = Math.min(wait * 2, 2000);
    }
  }
}

async function fetchAllResults(driverId) {
  const first = await fetchCareerJson(`${JOLPI}/drivers/${driverId}/results/?limit=100&offset=0`).catch(() => null);
  const rows = first?.MRData?.RaceTable?.Races || [];
  const total = Number(first?.MRData?.total || rows.length);
  if (!rows.length) return null;
  if (total <= rows.length) return rows;
  const offsets = [];
  for (let off = rows.length; off < total; off += 100) offsets.push(off);
  const pages = await mapPool(offsets, (off) =>
    fetchCareerJson(`${JOLPI}/drivers/${driverId}/results/?limit=100&offset=${off}`).catch(() => null), 6);
  for (const page of pages) {
    const batch = page?.MRData?.RaceTable?.Races || [];
    if (!batch.length) return null;
    rows.push(...batch);
  }
  return rows;
}

function getDriverCareer(driverId) {
  if (driverCareerCache.has(driverId)) return driverCareerCache.get(driverId);
  const ls = readCareerLs(driverId);
  if (ls) {
    const hit = Promise.resolve(ls);
    driverCareerCache.set(driverId, hit);
    return hit;
  }
  const job = (async () => {
    try {
      // Query Jolpica directly from the browser. Results are cached locally so
      // a Render outage has no bearing on standings or career data.
      const [raceRows, poles, seasons] = await Promise.all([
        fetchAllResults(driverId),
        fetchCareerJson(`${JOLPI}/drivers/${driverId}/qualifying/1/?limit=1`).catch(() => null),
        fetchCareerJson(`${JOLPI}/drivers/${driverId}/seasons/?limit=100`).catch(() => null)
      ]);
      const races = raceRows || [];
      if (!races.length || !poles) return null;
      let wins = 0;
      let podiums = 0;
      let points = 0;
      let seasonPodiums = 0;
      const winSeasons = new Set();
      const allSeasons = new Set();

      races.forEach((r) => {
        allSeasons.add(r.season);
        const res = r.Results?.[0];
        if (!res) return;
        points += parseFloat(res.points) || 0;
        const pos = res.position;
        if (pos === '1') {
          wins++;
          podiums++;
          winSeasons.add(r.season);
        } else if (pos === '2' || pos === '3') {
          podiums++;
        }
        if (String(r.season) === String(SITE_SEASON) && (pos === '1' || pos === '2' || pos === '3')) {
          seasonPodiums++;
        }
      });

      const seasonRows = seasons?.MRData?.SeasonTable?.Seasons || [];
      const years = seasonRows.length ? seasonRows.map((s) => s.season) : [...allSeasons].sort();
      const span = years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : (years[0] || String(SITE_SEASON));

      const lastRaceStart = schedule[schedule.length - 1]?.sessions?.find((s) => s.slug === 'race')?.start;
      const seasonComplete = lastRaceStart ? Date.now() > new Date(lastRaceStart).getTime() + 2 * 36e5 : false;
      const titleSeasons = [...winSeasons].filter((y) => String(y) !== String(SITE_SEASON) || seasonComplete);
      let titles = 0;

      if (titleSeasons.length) {
        const checkTitle = async (y) => {
          if (careerTitleCache.has(y)) {
            const champ = careerTitleCache.get(y);
            return champ ? champ === driverId : false;
          }
          try {
            const d = await fetchCareerJson(`${JOLPI}/${y}/driverstandings/1/?limit=1`);
            const champ = d?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings?.[0]?.Driver?.driverId || null;
            careerTitleCache.set(y, champ);
            return champ ? champ === driverId : false;
          } catch (_) {
            return null;
          }
        };
        const checks = await mapPool(titleSeasons, checkTitle, 4);
        if (checks.includes(null)) return null;
        titles = checks.filter(Boolean).length;
      }

      const career = {
        races: races.length,
        wins,
        podiums,
        seasonPodiums,
        points: fmtPts(points),
        poles: Number(poles?.MRData?.total || 0),
        seasons: years.length || allSeasons.size,
        span,
        titles
      };
      writeCareerLs(driverId, career);
      return career;
    } catch (_) {
      return null;
    }
  })();

  driverCareerCache.set(driverId, job);
  job.then((career) => {
    if (!career) driverCareerCache.delete(driverId);
  });
  return job;
}

function openDriverProfile(driverId) {
  const entry = driverEntries.find((e) => e.Driver?.driverId === driverId);
  if (!entry || !dOverlay || !dProfile) return;
  const token = ++driverProfileToken;
  const d = entry.Driver || {};
  const team = entry.Constructors?.[0]?.name || '';
  const color = hexFor(team);
  const tEntry = teamEntryForConstructor(team);
  const photo = photoFor(d.driverId);
  const code = d.code || ((d.givenName?.[0] || '') + (d.familyName?.slice(0, 2) || '')).toUpperCase() || '-';
  const num = d.permanentNumber || '';
  const age = ageFrom(d.dateOfBirth);
  const mate = driverEntries.find((e) => e !== entry && (e.Constructors?.[0]?.name || '') === team)?.Driver;
  const mateName = mate ? `${mate.givenName || ''} ${mate.familyName || ''}`.trim() : '-';

  if (dSheet) {
    dSheet.style.setProperty('--dc', color);
    dSheet.style.setProperty('--dc-ink', inkOn(color));
  }

  const following = getFollowing().includes(d.driverId);
  dProfile.innerHTML = `
    <div class="dp-card">
      <div class="dp-shade"></div>
      <div class="dp-info">
        <div class="dp-eyebrow">Driver Profile · ${SITE_SEASON} Season</div>
        <div class="dp-name"><small>${escapeHtml(d.givenName || '')}</small>${escapeHtml(d.familyName || '')}</div>
        <div class="dp-team">${tEntry.logo ? `<img src="${TEAM_LOGO(tEntry.logo, 96)}" alt="" width="30" height="30" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<span>${escapeHtml(team || '-')}</span></div>
        <div class="dp-pills">
          <span class="dp-pos">P${escapeHtml(entry.position)}</span>
          ${num ? `<span class="dp-pill">#${escapeHtml(num)}</span>` : ''}
          <span class="dp-pill">${escapeHtml(code)}</span>
        </div>
      </div>
      <div class="dp-photo">
        ${photo ? `<img src="${photo}" alt="${escapeHtml(`${d.givenName || ''} ${d.familyName || ''}`)}" loading="eager" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.dp-photo').classList.add('noimg')">` : ''}
        <div class="dp-fall">${escapeHtml((d.givenName?.[0] || '') + (d.familyName?.[0] || ''))}</div>
      </div>
    </div>
    <div class="dp-sec">${SITE_SEASON} Season</div>
    <div class="dp-tiles">
      <div class="dp-tile"><b>P${escapeHtml(entry.position)}</b><span>Standing</span></div>
      <div class="dp-tile"><b>${escapeHtml(entry.points)}</b><span>Points</span></div>
      <div class="dp-tile"><b>${escapeHtml(entry.wins)}</b><span>Wins</span></div>
      <div class="dp-tile"><b id="dpSeasonPod">···</b><span>Podiums</span></div>
    </div>
    <div class="dp-sec">Career</div>
    <div id="dpCareer">
      <div class="dp-tiles skel"><div class="dp-tile"></div><div class="dp-tile"></div><div class="dp-tile"></div><div class="dp-tile"></div><div class="dp-tile"></div><div class="dp-tile"></div></div>
      <div class="dp-note">Loading career telemetry…</div>
    </div>
    <div class="dp-sec">Biography</div>
    <div class="dp-bio">
      <div class="dp-fact"><small>Nationality</small><b>${escapeHtml(d.nationality || '-')}</b></div>
      <div class="dp-fact"><small>Born</small><b>${escapeHtml(fmtDob(d.dateOfBirth))}${age !== null ? ` · Age ${age}` : ''}</b></div>
      <div class="dp-fact"><small>Driver Code</small><b>${escapeHtml(code)}</b></div>
      <div class="dp-fact"><small>Race Number</small><b>${escapeHtml(num || '-')}</b></div>
      <div class="dp-fact"><small>Team</small><b>${escapeHtml(team || '-')}</b></div>
      <div class="dp-fact"><small>Teammate</small><b>${escapeHtml(mateName)}</b></div>
    </div>
    <div class="dp-actions">
      <button class="btn sm${following ? ' on' : ''}" id="dpFollow" type="button" aria-pressed="${following}">${following ? '✓ Following' : '+ Follow'}</button>
      ${tEntry.id !== 'default' ? `<button class="btn sm primary" id="dpLivery" type="button">Apply ${escapeHtml(tEntry.name)} Livery</button>` : ''}
      ${d.url ? `<a class="btn sm" href="${escapeHtml(d.url)}" target="_blank" rel="noopener">Biography ↗</a>` : ''}
    </div>`;

  $("dpFollow")?.addEventListener('click', (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    const on = btn.getAttribute('aria-pressed') !== 'true';
    const list = getFollowing().filter((x) => x !== d.driverId);
    if (on) list.push(d.driverId);
    store.set(FOLLOW_KEY, JSON.stringify(list));
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? '✓ Following' : '+ Follow';
    syncFollowBadges();
  });

  $("dpLivery")?.addEventListener('click', () => {
    applyTeamTheme(tEntry.id);
    store.set('freef1_team', tEntry.id);
    closeModal(dOverlay);
  });

  openModal(dOverlay);

  getDriverCareer(d.driverId).then((career) => {
    if (token !== driverProfileToken) return;
    renderDriverCareer(career);
  });
}

function renderDriverCareer(career) {
  const box = $("dpCareer");
  if (!box) return;
  const pod = $("dpSeasonPod");
  if (pod) fadeSwapContent(pod, () => {
    pod.textContent = career ? career.seasonPodiums : '–';
  });

  if (!career) {
    fadeSwapContent(box, () => {
      box.innerHTML = '<div class="state">Career telemetry unavailable right now.</div>';
    });
    return;
  }

  const markup = `
    <div class="dp-tiles">
      <div class="dp-tile"><b>${career.races}</b><span>Races</span></div>
      <div class="dp-tile"><b>${career.wins}</b><span>Wins</span></div>
      <div class="dp-tile"><b>${career.podiums}</b><span>Podiums</span></div>
      <div class="dp-tile"><b>${career.poles}</b><span>Poles</span></div>
      <div class="dp-tile"><b>${escapeHtml(career.points)}</b><span>Points</span></div>
      <div class="dp-tile hl"><b>${career.titles}</b><span>Title${career.titles === 1 ? '' : 's'}</span></div>
    </div>
    <div class="dp-note">F1 ${escapeHtml(career.span)} · ${career.seasons} season${career.seasons === 1 ? '' : 's'} · Career data via Ergast</div>`;
  fadeSwapContent(box, () => {
    box.innerHTML = markup;
  });
}

$("driverClose")?.addEventListener('click', () => closeModal(dOverlay));


return { loadStandings, loadDriverGrid };
}
