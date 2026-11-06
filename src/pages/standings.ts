import { initShell } from '../ui/shell';
/* Every page except the cockpit carries the open-page counter in its header. */
import '../viewer-counter';
import { JOLPI, SITE_SEASON } from '../config';
import { TEAM_HEX } from '../data/teams';

initShell();

type DriverRow = {
  position: string; points: string; wins: string;
  Driver: { givenName: string; familyName: string; code?: string; nationality?: string };
  Constructors?: Array<{ name: string }>;
};
type ConstructorRow = { position: string; points: string; wins: string; Constructor: { name: string } };

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const body = $('standingsBody');
const panel = $('standingsPanel');

/* Anything the API sends is data, not markup: escape before it reaches innerHTML. */
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

const teamColor = (name?: string) => (name && TEAM_HEX[name]) || 'var(--fg-4)';

function driversRow(row: DriverRow): string {
  const team = row.Constructors?.[0]?.name ?? '';
  const name = `${row.Driver.givenName} ${row.Driver.familyName}`.trim();
  const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `<tr>
    <td class="t-pos"><span class="pos-badge">${esc(row.position)}</span></td>
    <td>
      <a class="who" href="/drivers/${esc(slug)}/">
        <span class="who-bar" style="background:${teamColor(team)}"></span>
        <span>
          <b>${esc(name)}</b>
          ${row.Driver.code ? `<small>${esc(row.Driver.code)}</small>` : ''}
        </span>
      </a>
    </td>
    <td class="t-team">${esc(team)}</td>
    <td class="t-num num">${esc(row.wins)}</td>
    <td class="t-num num pts">${esc(row.points)}</td>
  </tr>`;
}

function constructorRow(row: ConstructorRow): string {
  const name = row.Constructor.name;
  return `<tr>
    <td class="t-pos"><span class="pos-badge">${esc(row.position)}</span></td>
    <td>
      <span class="who">
        <span class="who-bar" style="background:${teamColor(name)}"></span>
        <span><b>${esc(name)}</b></span>
      </span>
    </td>
    <td class="t-team">—</td>
    <td class="t-num num">${esc(row.wins)}</td>
    <td class="t-num num pts">${esc(row.points)}</td>
  </tr>`;
}

type Table = 'drivers' | 'constructors';
const cache = new Map<Table, string>();

async function load(type: Table): Promise<void> {
  if (!body || !panel) return;
  panel.setAttribute('aria-busy', 'true');
  const cached = cache.get(type);
  if (cached) {
    body.innerHTML = cached;
    panel.removeAttribute('aria-busy');
  }

  try {
    const url = `${JOLPI}/${SITE_SEASON}/${type === 'drivers' ? 'driverstandings' : 'constructorstandings'}/?limit=40`;
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const lists = data?.MRData?.StandingsTable?.StandingsLists?.[0];
    const rows: Array<DriverRow | ConstructorRow> = type === 'drivers' ? lists?.DriverStandings : lists?.ConstructorStandings;
    if (!Array.isArray(rows) || !rows.length) throw new Error('Empty standings');

    const html = type === 'drivers'
      ? (rows as DriverRow[]).map(driversRow).join('')
      : (rows as ConstructorRow[]).map(constructorRow).join('');

    cache.set(type, html);
    body.innerHTML = html;
  } catch {
    if (!cached) {
      body.innerHTML = '<tr><td colspan="5" class="t-empty">Standings are unavailable right now. The table returns as soon as the season API answers.</td></tr>';
    }
  } finally {
    panel.removeAttribute('aria-busy');
  }
}

document.querySelectorAll<HTMLButtonElement>('.seg-btn[data-type]').forEach((button) => {
  button.addEventListener('click', () => {
    const type = (button.dataset.type === 'constructors' ? 'constructors' : 'drivers') as Table;
    document.querySelectorAll<HTMLButtonElement>('.seg-btn[data-type]').forEach((other) => {
      const on = other === button;
      other.classList.toggle('active', on);
      other.setAttribute('aria-selected', String(on));
    });
    if (body) body.style.opacity = '0';
    void load(type).then(() => {
      if (body) body.style.opacity = '1';
    });
  });
});

/* The header states follow the table's left column, not a hard-coded label. */
const heads = document.querySelectorAll<HTMLElement>('#standingsTable thead th');
const setTeamHead = (label: string) => { if (heads[2]) heads[2].textContent = label; };
setTeamHead('Team');

document.querySelector<HTMLButtonElement>('.seg-btn[data-type="drivers"]')?.click();
export {};
