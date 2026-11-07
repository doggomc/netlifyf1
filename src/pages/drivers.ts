import { initShell } from '../ui/shell';
/* Every page except the cockpit carries the open-page counter in its header. */
import '../viewer-counter';
import { portrait } from '../data/driver-portraits';
import { esc, loadStandings, driverSlug, type StandingRow } from './driver-core';
import { NATIONALITY_FLAG } from '../data/driver-flags';
import { flagHtml } from '../data/flags';

/* The eleven constructors on the 2026 grid, in the colours they race. Inlined
   because a card needs a colour and nothing else from the roster module. */
const TEAM_HEX: Record<string, string> = {
  McLaren: '#FF8000', Ferrari: '#DC0000', 'Red Bull': '#1E41FF', Mercedes: '#00D2BE',
  Williams: '#005AFF', 'Aston Martin': '#006F62', Alpine: '#FF0080', Haas: '#B6BABD',
  Audi: '#E62213', 'RB F1 Team': '#6692FF', 'Racing Bulls': '#6692FF', Cadillac: '#B4A07A',
};

initShell();

const grid = document.getElementById('driverGrid');
const status = document.getElementById('driversStatus');

/* Champion tint: Rerace washes the card in the team's colour from the floor up and
   leaves a faint plate number in the corner. Both are the team colour at low alpha,
   so a livery that flips mid-season flips the card with it. */
function card(row: StandingRow, index: number): string {
  const driver = row.Driver;
  const team = row.Constructors?.[0]?.name ?? '';
  const color = TEAM_HEX[team] ?? TEAM_HEX[team.replace(/ F1 Team$/, '')] ?? '#7e8188';
  const flag = NATIONALITY_FLAG[driver.nationality ?? ''] ?? '';
  const number = driver.permanentNumber ?? driver.code ?? '';
  const first = driver.givenName.trim();
  const last = driver.familyName.trim();
  const slug = driverSlug(driver);
  const delay = Math.min(index, 9);

  return `<a class="driver-card card card-hover rise" style="--team:${color};--rise-delay:${delay * 40}ms" href="/drivers/${esc(slug)}/" aria-label="${esc(`${first} ${last}`)}, ${esc(team)}, P${esc(row.position)}, ${esc(row.points)} points">
      <div class="driver-portrait">
        <span class="driver-plate" aria-hidden="true">${esc(number)}</span>
        <img src="${esc(portrait(driver.driverId, 320))}" alt="${esc(`${first} ${last}`)}" width="320" height="920" loading="${index < 5 ? 'eager' : 'lazy'}" decoding="async">
        <span class="driver-fade" aria-hidden="true"></span>
      </div>
      <div class="driver-body">
        <div class="driver-meta">
          ${flag ? flagHtml(flag) : ''}
          <span class="driver-standing">P${esc(row.position)} · ${esc(row.points)} pts</span>
        </div>
        <p class="driver-name"><span class="driver-first">${esc(first)}</span><span class="driver-last">${esc(last)}</span></p>
        <p class="driver-team"><span class="driver-swatch" aria-hidden="true" style="background:${esc(color)}"></span>${esc(team)}</p>
      </div>
    </a>`;
}

loadStandings().then(({ rows, round }) => {
  if (grid) {
    grid.innerHTML = rows.map(card).join('');
    grid.removeAttribute('aria-busy');
  }
  if (status) {
    status.textContent = `${rows.length} drivers · after round ${round} of 23 · ordered by championship position`;
  }
}).catch(() => {
  if (grid) grid.removeAttribute('aria-busy');
  if (status) status.textContent = 'The 2026 grid could not be loaded. Refresh to try again.';
});
