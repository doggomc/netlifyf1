import { initShell } from '../ui/shell';
/* Every page except the cockpit carries the open-page counter in its header. */
import '../viewer-counter';
import { CIRCUIT_COUNTRY, displayName, shortRaceName, splitName } from '../data/driver-facts';
import { NATIONALITY_FLAG } from '../data/driver-flags';
import { flagHtml } from '../data/flags';
import { portrait } from '../data/driver-portraits';
import { TEAM_CAR, TEAM_HEX, TEAM_LOGO } from '../data/teams';
import { TEAM_PROFILES, findTeamByConstructorId, findTeamBySlug } from '../data/team-facts';
import { schedule } from '../data/schedule';
import { JOLPI, SITE_SEASON } from '../config';
import { driverSlug, esc, loadStandings, ordinal, teamName, teamSlug, type StandingRow } from './driver-core';
import { loadTeamSeason, teamRoundRows, teamSeasonStats, type TeamRoundRow } from './team-season';

initShell();

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const setText = (id: string, value: string) => { const node = $(id); if (node) node.textContent = value; };
const show = (id: string, value: string) => { const node = $(id); if (node) node.innerHTML = value; };

type ConstructorStandingRow = {
  position: string;
  points: string;
  wins: string;
  Constructor: { name: string; constructorId: string };
};

function slugFromLocation(): string {
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[0] === 'teams' && parts[1] ? decodeURIComponent(parts[1]) : '';
}

async function loadConstructorStandings(): Promise<ConstructorStandingRow[]> {
  const response = await fetch(`${JOLPI}/${SITE_SEASON}/constructorstandings/?limit=20`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json() as {
    MRData?: { StandingsTable?: { StandingsLists?: Array<{ ConstructorStandings?: ConstructorStandingRow[] }> } };
  };
  const rows = data?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Empty constructor standings');
  return rows;
}

function driverCardHtml(row: StandingRow, teamDisplay: string, color: string): string {
  const driver = row.Driver;
  const flag = NATIONALITY_FLAG[driver.nationality ?? ''] ?? '';
  const number = driver.permanentNumber ?? driver.code ?? '';
  const { first, last } = splitName(driver.givenName, driver.familyName);
  const full = displayName(driver.givenName, driver.familyName);
  const slug = driverSlug(driver);

  return `<a class="driver-card card card-hover" style="--team:${esc(color)}" href="/drivers/${esc(slug)}/" aria-label="${esc(full)}, ${esc(teamDisplay)}, P${esc(row.position)}, ${esc(row.points)} points">
    <div class="driver-portrait">
      <span class="driver-plate" aria-hidden="true">${esc(number)}</span>
      <img src="${esc(portrait(driver.driverId, 320))}" alt="${esc(full)}" width="320" height="920" loading="lazy" decoding="async">
      <span class="driver-fade" aria-hidden="true"></span>
    </div>
    <div class="driver-body">
      <div class="driver-meta">
        ${flag ? flagHtml(flag) : ''}
        <span class="driver-standing">P${esc(row.position)} · ${esc(row.points)} pts</span>
      </div>
      <p class="driver-name"><span class="driver-first">${esc(first)}</span><span class="driver-last">${esc(last)}</span></p>
      <p class="driver-team"><span class="driver-swatch" aria-hidden="true" style="background:${esc(color)}"></span>${esc(teamDisplay)}</p>
    </div>
  </a>`;
}

function resultsTableHtml(rows: TeamRoundRow[]): string {
  return rows.map((row) => {
    const code = CIRCUIT_COUNTRY[row.circuitId] ?? '';
    return `<tr>
      <td class="dp-rnd num">${esc(row.round)}</td>
      <td>
        <span class="dp-gp">
          ${code ? flagHtml(code) : ''}
          <span>${esc(shortRaceName(row.raceName, code))}</span>
        </span>
      </td>
      <td class="tp-finishes${row.won ? ' is-win' : ''}">${esc(row.finishes)}</td>
      <td class="t-num dp-points num">${esc(row.points)}</td>
    </tr>`;
  }).join('');
}

function miniStandingsHtml(rows: ConstructorStandingRow[], currentSlug: string): string {
  return rows.map((row) => {
    const profile = findTeamByConstructorId(row.Constructor.constructorId, row.Constructor.name);
    const display = profile?.name ?? teamName(row.Constructor.name);
    const slug = profile?.slug ?? teamSlug(row.Constructor.name);
    const color = profile?.color ?? TEAM_HEX[row.Constructor.name] ?? '#7e8188';
    const logo = profile?.logo ?? '';
    const active = slug === currentSlug;
    return `<tr${active ? ' class="is-current"' : ''}>
      <td class="st-pos num">${esc(row.position)}</td>
      <td>
        <a class="tp-mini-who" href="/teams/${esc(slug)}/"${active ? ' aria-current="page"' : ''}>
          <span class="team-bar" style="--team:${esc(color)}"></span>
          <span class="st-logotile">${logo ? `<img class="st-logo" src="${esc(TEAM_LOGO(logo, 64))}" alt="" width="20" height="20" loading="lazy" decoding="async">` : ''}</span>
          <span class="tp-mini-name">${esc(display)}</span>
        </a>
      </td>
      <td class="t-num dp-points num">${esc(row.points)}</td>
    </tr>`;
  }).join('');
}

function nextRoundCard(): string {
  const now = Date.now();
  const next = schedule.find((event) => {
    const last = event.sessions[event.sessions.length - 1];
    return last && last.ts > now;
  });
  if (!next) return '<p class="dp-muted">The season is complete.</p>';
  const first = next.sessions[0];
  const date = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: next.tz }).format(new Date(first.ts));
  const days = Math.max(0, Math.ceil((first.ts - now) / 86400000));
  return `<a class="dp-next-card" href="/schedule.html">
    <span class="dp-next-round">Round ${esc(next.round)}</span>
    <b>${esc(next.name)}</b>
    <span class="dp-next-meta">${esc(date)} · ${days <= 1 ? 'this week' : `in ${days} days`}</span>
  </a>`;
}

async function paint(): Promise<void> {
  const slug = slugFromLocation();
  if (!slug) { location.replace('/teams.html'); return; }

  const profile = findTeamBySlug(slug);
  show('tpNext', nextRoundCard());

  if (!profile) {
    setText('tpCrumb', 'Constructor not found');
    setText('tpEntry', `${SITE_SEASON} Formula 1 season`);
    setText('tpName', 'Constructor not found');
    setText('tpAboutName', 'this constructor');
    setText('tpResultsNote', `No ${SITE_SEASON} constructor matches “${slug}”.`);
    const car = $('tpCar') as HTMLImageElement | null;
    if (car) car.hidden = true;
    const logoBox = $('tpLogoBox');
    if (logoBox) logoBox.hidden = true;
    const driversSection = $('tpDriversSection');
    if (driversSection) driversSection.hidden = true;
    const body = $('tpResultsBody');
    if (body) {
      body.removeAttribute('aria-busy');
      body.innerHTML = `<tr><td colspan="4" class="dp-empty">Pick a constructor from the <a href="/teams.html">2026 teams</a>.</td></tr>`;
    }
    document.title = 'Constructor not found — FreeF1';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.append(robots);
    return;
  }

  /* Paint static constructor identity immediately before network calls settle. */
  document.title = `${profile.name} — ${SITE_SEASON} drivers, car and results | FreeF1`;
  const hero = $('tpHero');
  if (hero) hero.style.setProperty('--team', profile.color);
  setText('tpCrumb', profile.name);
  setText('tpEntry', profile.entryName);
  setText('tpName', profile.name);
  setText('tpAboutName', profile.name);
  setText('tpFactBase', profile.base);
  setText('tpFactPu', profile.powerUnit);
  setText('tpFactFirst', profile.firstSeason);
  setText('tpFactTitles', String(profile.titles));

  const logo = $('tpLogo') as HTMLImageElement | null;
  if (logo) {
    logo.src = TEAM_LOGO(profile.logo, 160);
    logo.alt = `${profile.name} logo`;
  }
  const car = $('tpCar') as HTMLImageElement | null;
  if (car) {
    car.src = TEAM_CAR(profile.logo, 960);
    car.srcset = `${TEAM_CAR(profile.logo, 480)} 480w, ${TEAM_CAR(profile.logo, 960)} 960w`;
    car.sizes = '(min-width: 1024px) 896px, 100vw';
    car.alt = `${profile.name} ${SITE_SEASON} Formula 1 car`;
  }

  const [constructorsRes, driversRes, seasonRes] = await Promise.allSettled([
    loadConstructorStandings(),
    loadStandings(),
    loadTeamSeason(profile.constructorId),
  ]);

  const constructors = constructorsRes.status === 'fulfilled' ? constructorsRes.value : null;
  const driverStandings = driversRes.status === 'fulfilled' ? driversRes.value.rows : null;
  const season = seasonRes.status === 'fulfilled' ? seasonRes.value : null;

  const standingRow = constructors?.find((row) => row.Constructor.constructorId === profile.constructorId) ?? null;
  if (standingRow) {
    setText('tpStatPos', ordinal(Number(standingRow.position)));
    setText('tpStatPts', standingRow.points);
    setText('tpStatWins', standingRow.wins);
  }

  if (constructors) {
    show('tpStandingsMini', miniStandingsHtml(constructors, profile.slug));
  } else {
    show('tpStandingsMini', TEAM_PROFILES.map((t, i) => `<tr${t.slug === profile.slug ? ' class="is-current"' : ''}>
      <td class="st-pos num">${i + 1}</td>
      <td><a class="tp-mini-who" href="/teams/${esc(t.slug)}/"><span class="team-bar" style="--team:${esc(t.color)}"></span><span class="st-logotile"><img class="st-logo" src="${esc(TEAM_LOGO(t.logo, 64))}" alt="" width="20" height="20"></span><span class="tp-mini-name">${esc(t.name)}</span></a></td>
      <td class="t-num dp-points num">—</td>
    </tr>`).join(''));
  }

  const teamDrivers = (driverStandings ?? []).filter((row) => {
    const c = row.Constructors?.[0];
    return c && (c.constructorId === profile.constructorId || teamSlug(c.name) === profile.slug);
  }).slice(0, 2);

  const driversGrid = $('tpDriversGrid');
  if (driversGrid) {
    driversGrid.removeAttribute('aria-busy');
    driversGrid.innerHTML = teamDrivers.length
      ? teamDrivers.map((row) => driverCardHtml(row, profile.name, profile.color)).join('')
      : '<p class="dp-muted">Driver standings are unavailable right now.</p>';
  }

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  if (season) {
    const stats = teamSeasonStats(season);
    setText('tpStatWins', String(stats.wins));
    setText('tpStatPodiums', String(stats.podiums));
    setText('tpStatPoles', String(stats.poles));
    setText('tpStatOneTwos', String(stats.oneTwos));

    const roundRows = teamRoundRows(season);
    const body = $('tpResultsBody');
    if (body) {
      body.removeAttribute('aria-busy');
      body.innerHTML = roundRows.length
        ? resultsTableHtml(roundRows)
        : '<tr><td colspan="4" class="dp-empty">No rounds completed yet this season.</td></tr>';
    }
    setText('tpResultsNote', roundRows.length
      ? [plural(roundRows.length, 'round', 'rounds'), plural(stats.wins, 'win', 'wins'), plural(stats.podiums, 'podium', 'podiums')].join(' · ')
      : 'No rounds completed yet this season.');

    const driverNames = teamDrivers.map((r) => displayName(r.Driver.givenName, r.Driver.familyName));
    const lineupLine = driverNames.length === 2
      ? `${driverNames[0]} and ${driverNames[1]} race for the team in ${SITE_SEASON}.`
      : driverNames.length === 1 ? `${driverNames[0]} races for the team in ${SITE_SEASON}.` : '';
    const pts = Number(standingRow?.points ?? 0);
    const posOrd = standingRow ? ordinal(Number(standingRow.position)) : '';
    const prose = [
      `${profile.entryName} competes from ${profile.base} with ${profile.powerUnit} power units, having entered its first Formula 1 championship season in ${profile.firstSeason}${profile.titles > 0 ? ` and won ${plural(profile.titles, 'constructors’ title', 'constructors’ titles')}` : ''}.`,
      standingRow
        ? `Across ${plural(stats.rounds, 'round', 'rounds')} in ${SITE_SEASON}, ${profile.name} stands ${posOrd} in the Constructors’ Championship on ${plural(pts, 'point', 'points')}, recording ${plural(stats.wins, 'win', 'wins')}, ${plural(stats.podiums, 'podium', 'podiums')}, ${plural(stats.poles, 'pole', 'poles')} and ${plural(stats.oneTwos, '1-2 finish', '1-2 finishes')}.`
        : '',
      lineupLine,
    ].filter(Boolean);
    show('tpProse', prose.map((line) => `<p>${esc(line)}</p>`).join(''));
  } else {
    const body = $('tpResultsBody');
    if (body) {
      body.removeAttribute('aria-busy');
      body.innerHTML = '<tr><td colspan="4" class="dp-empty">Season results are unavailable right now. Refresh to try again.</td></tr>';
    }
    setText('tpResultsNote', 'Season data could not be loaded.');
    show('tpProse', `<p>${esc(`${profile.entryName} competes from ${profile.base} with ${profile.powerUnit} power units.`)}</p>`);
  }
}

void paint();
