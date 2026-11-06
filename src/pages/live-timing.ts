import { initShell } from '../ui/shell';
import { findLiveSession, findNextSession, formatDay, formatTime, sessionShortName } from '../services/weekend';

/* The frame and the clock are real; the row feed lands with the drivers part. */
initShell();

const $ = (id: string) => document.getElementById(id);

const live = findLiveSession();
const next = findNextSession();
const body = $('timingBody');

if (body) {
  body.innerHTML = `<tr><td colspan="6" class="t-empty">${
    live
      ? `A session is on air: ${live.session.name}. The timing rows arrive in the next part.`
      : next
        ? `No session running. Next: ${next.session.name}, ${formatDay(next.session.ts)} at ${formatTime(next.session.ts)}.`
        : 'The 2026 season is complete.'
  }</td></tr>`;
}

const badge = document.getElementById('liveBadge');
if (badge && next && !live) {
  const label = document.getElementById('liveText');
  if (label) label.textContent = sessionShortName(next.session.name);
}
