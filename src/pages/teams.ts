import { initShell } from '../ui/shell';
import { TEAM_ALIAS, TEAM_HEX, TEAM_LOGO, teams } from '../data/teams';
import { JOLPI, SITE_SEASON } from '../config';

initShell();

const list = document.getElementById('teamList');
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

/* The local roster is the source of truth for names, colours and logos; the API
   only supplies the championship position and drivers, joined on the alias map. */
type ApiConstructor = {
  position: string; points: string; wins: string;
  Constructor: { name: string; constructorId: string };
};

type ApiDriver = {
  Driver: { givenName: string; familyName: string };
  Constructors?: Array<{ name: string; constructorId: string }>;
};

/* The constructors' table does not carry line-ups, so a driver's team is read off
   the drivers' table and attributed to that constructor. */
type TeamFacts = { position: string; points: string; drivers: string[] };

function rosterId(apiName: string, constructorId: string): string {
  const byName = TEAM_ALIAS[apiName.toLowerCase()];
  if (byName) return byName;
  /* constructorId uses underscores (red_bull, aston_martin, rb) where the roster
     uses squashed ids (redbull, astonmartin, racingbulls). */
  return TEAM_ALIAS[constructorId.replace(/_/g, ' ')] || constructorId.replace(/_/g, '');
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
    const name = `${row.Driver.givenName} ${row.Driver.familyName}`;
    if (facts && !facts.drivers.includes(name)) facts.drivers.push(name);
  }

  /* Championship order first, then anyone the API did not place. */
  const roster = teams.filter((team) => team.id !== 'default').sort((a, b) => {
    const pa = Number(byId.get(a.id)?.position ?? 999);
    const pb = Number(byId.get(b.id)?.position ?? 999);
    return pa - pb;
  });
  list.innerHTML = roster.map((team) => {
    const info = byId.get(team.id);
    const color = TEAM_HEX[team.name] || team.color;
    const drivers = info?.drivers.length ? info.drivers.join(' · ') : 'Line-up to be confirmed';
    const meta = info ? `P${esc(info.position)} · ${esc(info.points)} pts` : '—';
    return `<article class="team-card" style="--tc:${color}">
      ${team.logo ? `<img class="t-logo" src="${TEAM_LOGO(team.logo, 120)}" alt="" width="92" height="26" loading="lazy" decoding="async">` : '<span class="t-logo"></span>'}
      <div>
        <div class="t-name">${esc(team.name)}</div>
        <div class="t-sub">${esc(drivers)}</div>
      </div>
      <div class="t-meta"><span class="t-bar" aria-hidden="true"></span><span class="num">${meta}</span></div>
    </article>`;
  }).join('');
  list.removeAttribute('aria-busy');
}

paint(null, null);

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
    /* The roster still renders from local data: names, colours and logos only. */
  }
})();
