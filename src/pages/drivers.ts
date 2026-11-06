import { initShell } from '../ui/shell';
import { JOLPI, SITE_SEASON } from '../config';
import { TEAM_HEX } from '../data/teams';
import { DRIVER_KEY, DRIVER_PHOTO } from '../data/driver-photos';

/* Part 1 leaves the card grid an empty stage on purpose: the card treatment
   (portrait well, team glow, number watermark) is the next part. What is built
   here is the page, the live ordering and the data every card will need. */
initShell();

const grid = document.getElementById('driverGrid');
const status = document.getElementById('driversStatus');
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

export const slugify = (value: string) => value.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Row = {
  position: string; points: string; wins: string;
  Driver: { driverId: string; givenName: string; familyName: string; permanentNumber?: string; code?: string };
  Constructors?: Array<{ name: string }>;
};

async function load(): Promise<{ rows: Row[]; round: string }> {
  const response = await fetch(`${JOLPI}/${SITE_SEASON}/driverstandings/?limit=40`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const list = data?.MRData?.StandingsTable?.StandingsLists?.[0];
  const rows = list?.DriverStandings;
  if (!Array.isArray(rows)) throw new Error('Empty standings');
  return { rows: rows as Row[], round: String(list.round ?? '') };
}

load().then(({ rows, round }) => {
  if (status) {
    status.textContent = `${rows.length} drivers · after round ${round} of 23 · ordered by championship position`;
  }
  if (grid) grid.removeAttribute('aria-busy');
  /* The ordering and photo map the cards will consume; kept here so the next part
     is markup and CSS only. */
  return rows.map((row) => {
    const key = DRIVER_KEY[row.Driver.driverId] || row.Driver.driverId;
    return {
      slug: slugify(`${row.Driver.givenName} ${row.Driver.familyName}`),
      name: `${row.Driver.givenName} ${row.Driver.familyName}`,
      number: row.Driver.permanentNumber ?? '',
      team: row.Constructors?.[0]?.name ?? '',
      teamColor: TEAM_HEX[row.Constructors?.[0]?.name ?? ''] ?? '#7e8188',
      position: row.position,
      points: row.points,
      photo: DRIVER_PHOTO[key] ?? null,
    };
  });
}).catch(() => {
  if (status) status.textContent = 'The 2026 grid could not be loaded. Refresh to try again.';
});
