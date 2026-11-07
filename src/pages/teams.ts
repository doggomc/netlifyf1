import { initShell } from '../ui/shell';
/* Every page except the cockpit carries the open-page counter in its header. */
import '../viewer-counter';
import { TEAM_ALIAS, TEAM_CAR, TEAM_HEX, TEAM_LOGO, teams } from '../data/teams';
import { headshot } from '../data/driver-portraits';
import { slugify } from '../data/slugs';
import { JOLPI, SITE_SEASON } from '../config';

initShell();

const list = document.getElementById('teamList');
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

/* The local roster is the source of truth for names, colours, cars and logos;
   the API supplies live championship positions, points and current drivers. */
type ApiConstructor = {
  position: string; points: string; wins: string;
  Constructor: { name: string; constructorId: string };
};

type ApiDriver = {
  Driver: { driverId: string; givenName: string; familyName: string };
  Constructors?: Array<{ name: string; constructorId: string }>;
};

type DriverChip = { driverId: string; name: string };
type TeamFacts = { position: string; points: string; drivers: DriverChip[] };

function rosterId(apiName: string, constructorId: string): string {
  const byName = TEAM_ALIAS[apiName.toLowerCase() as keyof typeof TEAM_ALIAS];
  if (byName) return byName;
  const spaced = constructorId.replace(/_/g, ' ');
  return TEAM_ALIAS[spaced as keyof typeof TEAM_ALIAS] || constructorId.replace(/_/g, '');
}

function paint(constructors: ApiConstructor[] | null, drivers: ApiDriver[] | null): void {
  if (!list) return;
  const byId = new Map<string, TeamFacts>();
  for (const row of constructors ?? []) {
    const id = rosterId(row.Constructor.name, row.Constructor.constructorId);
    byId.set(id, { position: row.position, points: row.points, drivers: [] });
  }
  for (const row of drivers ?? []) {
    const team = row.Constructors?.[0];
    if (!team) continue;
    const id = rosterId(team.name, team.constructorId);
    const facts = byId.get(id);
    const name = `${row.Driver.givenName} ${row.Driver.familyName}`.replace(/\s+/g, ' ').trim();
    if (facts && !facts.drivers.some((d) => d.driverId === row.Driver.driverId)) {
      facts.drivers.push({ driverId: row.Driver.driverId, name });
    }
  }

  /* Championship order first, then anyone the API has not placed yet. */
  const roster = teams.filter((team) => team.id !== 'default').sort((a, b) => {
    const pa = Number(byId.get(a.id)?.position ?? 999);
    const pb = Number(byId.get(b.id)?.position ?? 999);
    return pa - pb;
  });

  list.innerHTML = roster.map((team, index) => {
    const info = byId.get(team.id);
    const color = TEAM_HEX[team.name as keyof typeof TEAM_HEX] || team.color;
    const slug = slugify(team.name);
    const pos = info?.position ?? '';
    const meta = info ? `P${info.position} · ${info.points} pts` : `${SITE_SEASON} constructor`;
    const loading = index < 6 ? 'eager' : 'lazy';
    const delay = Math.min(index, 10);
    /* Top two scoring drivers represent the full-time race seats on the card. */
    const chips = (info?.drivers.slice(0, 2) ?? []).map((driver) =>
      `<span class="tm-chip"><img class="tm-chip-face" src="${esc(headshot(driver.driverId, 64))}" alt="" width="20" height="20" loading="lazy" decoding="async">${esc(driver.name)}</span>`
    ).join('');

    return `<a class="tm-card card card-hover rise" href="/teams/${esc(slug)}/" style="--team:${esc(color)};--rise-delay:${delay * 35}ms" aria-label="${esc(team.name)}, ${esc(meta)}">
      <div class="tm-head">
        <div class="tm-id">
          <span class="tm-logo-box">${team.logo ? `<img class="tm-logo" src="${esc(TEAM_LOGO(team.logo, 96))}" alt="" width="56" height="56" loading="${loading}" decoding="async">` : ''}</span>
          <div>
            <p class="tm-name">${esc(team.name)}</p>
            <p class="tm-meta num">${esc(meta)}</p>
          </div>
        </div>
        ${pos ? `<span class="tm-pos" aria-hidden="true">${esc(pos)}</span>` : ''}
      </div>
      ${team.logo ? `<img class="tm-car" src="${esc(TEAM_CAR(team.logo, 480))}" alt="${esc(team.name)} 2026 car" width="480" height="106" loading="${loading}" decoding="async">` : ''}
      <div class="tm-drivers">${chips}</div>
    </a>`;
  }).join('');
  list.removeAttribute('aria-busy');
}

(async () => {
  const get = async (path: string) => {
    const response = await fetch(`${JOLPI}/${SITE_SEASON}/${path}`, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };
  try {
    const [constructors, drivers] = await Promise.all([
      get('constructorstandings/?limit=20'),
      get('driverstandings/?limit=40'),
    ]);
    const constructorRows = constructors?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings;
    const driverRows = drivers?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings;
    paint(
      Array.isArray(constructorRows) ? constructorRows as ApiConstructor[] : null,
      Array.isArray(driverRows) ? driverRows as ApiDriver[] : null,
    );
  } catch {
    /* Offline fallback: render the local 11-constructor roster with logos and cars. */
    paint(null, null);
  }
})();
