import type { FeatureContext } from '../app';
import { $ } from '../services/dom';
export function init(ctx: FeatureContext) {
const { store, schedule, fadeSwapContent, escapeHtml, openModal, closeModal } = ctx;
/* ═══════════════ 18. RACE TIMES MODAL ═══════════════ */
const raceTimesOverlay = $("raceTimesOverlay");
const raceTimesList = $("raceTimesList");
const raceTimesGpSelect = $("raceTimesGp");
const raceTimesTimezone = $("raceTimesTimezone");
const RACE_TIMES_MODE_KEY = 'freef1_race_times_mode';
let raceTimesGpSlug = null;
let raceTimesMode = (() => {
  try {
    return store.get(RACE_TIMES_MODE_KEY) === 'track' ? 'track' : 'my';
  } catch (_) {
    return 'my';
  }
})();

const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local timezone';
const localTimeZoneLabel = (() => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date());
  return parts.find((part) => part.type === 'timeZoneName')?.value || localTimeZone;
})();

function raceStatus(event, now = Date.now()) {
  const race = event.sessions.find((session) => session.slug === 'race') || event.sessions.at(-1);
  const starts = event.sessions.map((session) => session.ts).filter(Number.isFinite);
  const first = Math.min(...starts);
  const last = Math.max(...starts);
  if (race && now > race.ts + 4 * 60 * 60 * 1000) return 'finished';
  if (now >= first - 60 * 60 * 1000 && now <= last + 4 * 60 * 60 * 1000) return 'current';
  return 'upcoming';
}

/* Only live-and-future weekends are selectable — finished rounds are gone. */
function raceTimesItems() {
  return schedule
    .map((event) => ({ event, status: raceStatus(event) }))
    .filter((item) => item.status !== 'finished');
}

function raceTimesDefaultSlug() {
  const items = raceTimesItems();
  const current = items.find((item) => item.status === 'current');
  return (current || items[0])?.event.slug || null;
}

function raceTimesFmt(timestamp, timeZone) {
  const date = new Date(Number(timestamp));
  const opts = timeZone ? { timeZone } : {};
  if (Number.isNaN(date.getTime())) return { day: '--', mon: '---', time: '--:--' };
  return {
    day: new Intl.DateTimeFormat('en-GB', { day: '2-digit', ...opts }).format(date),
    mon: new Intl.DateTimeFormat('en-GB', { month: 'short', ...opts }).format(date).toUpperCase(),
    time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, ...opts }).format(date)
  };
}

function renderRaceTimes() {
  if (!raceTimesList) return;

  document.querySelectorAll<HTMLElement>('#raceTimesMode [data-time-mode]').forEach((item) => {
    const active = item.dataset.timeMode === raceTimesMode;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });

  const items = raceTimesItems();
  if (!items.length) {
    if (raceTimesGpSelect) {
      raceTimesGpSelect.innerHTML = '<option>Season complete</option>';
      raceTimesGpSelect.disabled = true;
    }
    if (raceTimesTimezone) fadeSwapContent(raceTimesTimezone, () => {
      raceTimesTimezone.textContent = 'The 2026 season is complete.';
    });
    fadeSwapContent(raceTimesList, () => {
      raceTimesList.innerHTML = '<div class="state">No upcoming Grand Prix.</div>';
    });
    return;
  }

  if (!items.some((item) => item.event.slug === raceTimesGpSlug)) raceTimesGpSlug = raceTimesDefaultSlug();
  const selected = items.find((item) => item.event.slug === raceTimesGpSlug) || items[0];
  raceTimesGpSlug = selected.event.slug;

  if (raceTimesGpSelect) {
    raceTimesGpSelect.disabled = false;
    raceTimesGpSelect.innerHTML = items.map(({ event, status }) =>
      `<option value="${escapeHtml(event.slug)}" ${event.slug === raceTimesGpSlug ? 'selected' : ''}>R${escapeHtml(event.round)} · ${escapeHtml(event.name)}${status === 'current' ? ' · race weekend' : ''}</option>`
    ).join('');
  }

  const tz = raceTimesMode === 'track' ? selected.event.tz : undefined;
  const timezoneText = raceTimesMode === 'track'
    ? `Times shown at the circuit · ${selected.event.locality} (${selected.event.tz || 'local'})`
    : `Times shown in your local timezone · ${localTimeZone} (${localTimeZoneLabel})`;
  if (raceTimesTimezone) fadeSwapContent(raceTimesTimezone, () => {
    raceTimesTimezone.textContent = timezoneText;
  });

  const now = Date.now();
  const markup = selected.event.sessions.map((session) => {
    const { day, mon, time } = raceTimesFmt(session.ts, tz);
    const past = Number.isFinite(session.ts) && session.ts + 60 * 60 * 1000 < now;
    return `<div class="rt-row${past ? ' is-past' : ''}">
      <div class="rt-date"><span class="rt-day">${escapeHtml(day)}</span><span class="rt-mon">${escapeHtml(mon)}</span></div>
      <div class="rt-name">${escapeHtml(session.name)}</div>
      <time class="rt-time" datetime="${escapeHtml(new Date(session.ts).toISOString())}">${escapeHtml(time)}</time>
    </div>`;
  }).join('');
  fadeSwapContent(raceTimesList, () => {
    raceTimesList.innerHTML = markup;
  });
}

$("raceTimesBtn")?.addEventListener('click', () => {
  raceTimesGpSlug = raceTimesDefaultSlug();
  renderRaceTimes();
  openModal(raceTimesOverlay);
});
$("raceTimesClose")?.addEventListener('click', () => closeModal(raceTimesOverlay));
raceTimesGpSelect?.addEventListener('change', () => {
  raceTimesGpSlug = raceTimesGpSelect.value;
  renderRaceTimes();
});
document.querySelectorAll<HTMLElement>('#raceTimesMode [data-time-mode]').forEach((btn) => btn.addEventListener('click', () => {
  raceTimesMode = btn.dataset.timeMode === 'track' ? 'track' : 'my';
  try { store.set(RACE_TIMES_MODE_KEY, raceTimesMode); } catch (_) {}
  renderRaceTimes();
}));


return {};
}
