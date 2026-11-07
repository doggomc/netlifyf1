import { initShell } from '../ui/shell';
/* Every page except the cockpit carries the open-page counter in its header. */
import '../viewer-counter';
import { JOLPI, SITE_SEASON } from '../config';
import { TEAM_CAR, TEAM_HEX, TEAM_LOGO } from '../data/teams';
import { headshot, portrait } from '../data/driver-portraits';
import { driverSlug, esc, gapToLeader, teamName, teamSlug } from './driver-core';

initShell();

type DriverRow = {
  position: string; positionText?: string; points: string; wins: string;
  Driver: { driverId: string; givenName: string; familyName: string; code?: string; nationality?: string };
  Constructors?: Array<{ name: string; constructorId: string }>;
};
type ConstructorRow = { position: string; points: string; wins: string; Constructor: { name: string; constructorId: string } };

type Table = 'drivers' | 'constructors';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const set = (id: string, text: string) => { const node = $(id); if (node) node.textContent = text; };
const body = $('standingsBody');
const panel = $('standingsPanel');
const updated = $('standingsUpdated');

/* Constructor slug for the CDN (car and logo art live under it). */
const TEAM_SLUG: Record<string, string> = {
  'McLaren': 'mclaren', 'Ferrari': 'ferrari', 'Red Bull': 'redbullracing', 'Mercedes': 'mercedes',
  'Williams': 'williams', 'Aston Martin': 'astonmartin', 'Alpine': 'alpine', 'Alpine F1 Team': 'alpine',
  'Haas': 'haasf1team', 'Haas F1 Team': 'haasf1team', 'Audi': 'audi', 'RB F1 Team': 'racingbulls',
  'Racing Bulls': 'racingbulls', 'Cadillac': 'cadillac', 'Cadillac F1 Team': 'cadillac',
};
const slugFor = (apiName: string) => TEAM_SLUG[apiName] ?? '';

/* One row, both tables: team bar, face or logo tile, name, wins, points with the
   gap beneath, and the team in a column that folds onto the name line on narrow
   screens. A constructor's name is its own team, so it prints once. */
function rowOf(cells: {
  position: string; name: string; team: string; color: string;
  avatar: string; href: string; wins: string; points: string; gap: string;
}): string {
  return `<tr>
    <td class="st-pos num">${esc(cells.position)}</td>
    <td>
      <a class="st-who" href="${esc(cells.href)}">
        <span class="team-bar" style="--team:${esc(cells.color)}"></span>
        ${cells.avatar}
        <span class="st-who-text">
          <span class="st-name">${esc(cells.name)}</span>
          <span class="st-sub">${esc(cells.team)}</span>
        </span>
      </a>
    </td>
    <td class="st-team-col">${esc(cells.team)}</td>
    <td class="st-num st-wins-col">${esc(cells.wins)}</td>
    <td class="st-num st-gap-col">${esc(cells.gap)}</td>
    <td class="st-num st-points">${esc(cells.points)}</td>
  </tr>`;
}

const tint = (apiName: string) => TEAM_HEX[apiName] ?? '#7e8188';

function driverRow(row: DriverRow, leaderPoints: number): string {
  const teamApi = row.Constructors?.[0]?.name ?? '';
  return rowOf({
    position: row.positionText ?? row.position,
    name: `${row.Driver.givenName} ${row.Driver.familyName}`.replace(/\s+/g, ' ').trim(),
    team: teamName(teamApi),
    color: tint(teamApi),
    avatar: `<img class="st-face" src="${esc(headshot(row.Driver.driverId, 64))}" alt="" width="64" height="64" loading="lazy" decoding="async">`,
    href: `/drivers/${driverSlug(row.Driver)}/`,
    wins: row.wins,
    points: row.points,
    gap: gapToLeader(row.points, String(leaderPoints)),
  });
}

function constructorRow(row: ConstructorRow, leaderPoints: number): string {
  const apiName = row.Constructor.name;
  const team = teamName(apiName);
  const slug = slugFor(apiName);
  return rowOf({
    position: row.position,
    name: team,
    team: '',
    color: tint(apiName),
    avatar: slug
      ? `<span class="st-logotile"><img class="st-logo" src="${esc(TEAM_LOGO(slug, 80))}" alt="" width="20" height="20" loading="lazy" decoding="async"></span>`
      : '',
    href: `/teams/${teamSlug(apiName)}/`,
    wins: row.wins,
    points: row.points,
    gap: gapToLeader(row.points, String(leaderPoints)),
  });
}

const cache = new Map<Table, { html: string; leader: unknown }>();

async function fetchTable(type: Table): Promise<{ rows: Array<DriverRow | ConstructorRow>; round: string }> {
  const endpoint = type === 'drivers' ? 'driverstandings' : 'constructorstandings';
  const response = await fetch(`${JOLPI}/${SITE_SEASON}/${endpoint}/?limit=40`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const list = data?.MRData?.StandingsTable?.StandingsLists?.[0];
  const rows = type === 'drivers' ? list?.DriverStandings : list?.ConstructorStandings;
  if (!Array.isArray(rows) || !rows.length) throw new Error('Empty standings');
  return { rows, round: String(list?.round ?? '') };
}

/** The two leader cards at the top of the page. */
async function paintLeaders(drivers: DriverRow[], constructors: ConstructorRow[] | null): Promise<void> {
  const leader = drivers[0];
  if (leader) {
    const teamApi = leader.Constructors?.[0]?.name ?? '';
    const team = teamName(teamApi);
    const color = TEAM_HEX[teamApi] ?? '#7e8188';
    const name = `${leader.Driver.givenName} ${leader.Driver.familyName}`.replace(/\s+/g, ' ').trim();
    const card = $('leaderDriver');
    if (card) {
      card.style.setProperty('--team', color);
      card.setAttribute('href', `/drivers/${driverSlug(leader.Driver)}/`);
      card.setAttribute('aria-label', `${name}, ${team}, ${leader.points} points, championship leader`);
    }
    const photo = $('leaderDriverPhoto') as HTMLImageElement | null;
    if (photo) { photo.src = portrait(leader.Driver.driverId, 320); photo.alt = name; }
    set('leaderDriverName', name);
    set('leaderDriverTeam', team);
    set('leaderDriverPoints', leader.points);
  }

  if (constructors?.[0]) {
    const top = constructors[0];
    const apiName = top.Constructor.name;
    const team = teamName(apiName);
    const color = TEAM_HEX[apiName] ?? '#7e8188';
    const slug = slugFor(apiName);
    const card = $('leaderTeam');
    if (card) {
      card.style.setProperty('--team', color);
      card.setAttribute('href', `/teams/${teamSlug(apiName)}/`);
      card.setAttribute('aria-label', `${team}, ${top.points} points, constructors' leaders`);
    }
    const car = $('leaderTeamCar') as HTMLImageElement | null;
    if (car && slug) { car.src = TEAM_CAR(slug, 480); car.alt = `${team} 2026 car`; }
    set('leaderTeamName', team);
    set('leaderTeamPoints', top.points);
  }
}

async function load(type: Table, force = false): Promise<void> {
  if (!body || !panel) return;
  const cached = !force ? cache.get(type) : undefined;
  if (cached) {
    body.innerHTML = cached.html as string;
    panel.removeAttribute('aria-busy');
  } else {
    panel.setAttribute('aria-busy', 'true');
  }

  try {
    const { rows, round } = await fetchTable(type);
    const leaderPoints = Number(rows[0].points);
    const html = type === 'drivers'
      ? (rows as DriverRow[]).map((row) => driverRow(row, leaderPoints)).join('')
      : (rows as ConstructorRow[]).map((row) => constructorRow(row, leaderPoints)).join('');

    cache.set(type, { html, leader: rows[0] });
    if (body) body.innerHTML = html;

    /* "After round 19" and a real timestamp: the table changes when the feed does,
       so the page states when it last read it rather than implying live timing. */
    if (updated) {
      const when = new Date().toISOString().slice(11, 16);
      updated.textContent = `Updated ${when} UTC`;
    }
    const eyebrow = $('standingsEyebrow');
    if (eyebrow && round) eyebrow.innerHTML = `<span class="swatch" aria-hidden="true"></span>After round ${esc(round)} of 23`;

    if (type === 'drivers') {
      const constructors = await fetchTable('constructors').then((data) => data.rows as ConstructorRow[]).catch(() => null);
      await paintLeaders(rows as DriverRow[], constructors);
    }
  } catch {
    if (!cached && body) {
      body.innerHTML = '<tr><td colspan="6" class="t-empty">Standings are unavailable right now. The table returns as soon as the season API answers.</td></tr>';
    }
  } finally {
    panel.removeAttribute('aria-busy');
  }
}

/* Tabs */
document.querySelectorAll<HTMLButtonElement>('.tab[data-type]').forEach((button) => {
  button.addEventListener('click', () => {
    const type: Table = button.dataset.type === 'constructors' ? 'constructors' : 'drivers';
    document.querySelectorAll<HTMLButtonElement>('.tab[data-type]').forEach((other) => {
      const on = other === button;
      other.classList.toggle('active', on);
      other.setAttribute('aria-selected', String(on));
    });
    /* The second column means "Driver" or "Team" depending on the table. */
    const nameHead = $('stNameHead');
    const teamHead = $('stTeamHead');
    if (nameHead) nameHead.textContent = type === 'drivers' ? 'Driver' : 'Team';
    if (teamHead) teamHead.textContent = type === 'drivers' ? 'Team' : '';
    if (body) body.style.opacity = '0';
    void load(type).then(() => { if (body) body.style.opacity = '1'; });
  });
});

void load('drivers');
