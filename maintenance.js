'use strict';

/* Static maintenance page: no presence beacon, heartbeat, SSE connection,
   polling loop, or dependency on the Render control service. */
const SITE_CONFIG_CACHE_KEY = 'freef1_site_config_v2';
const messageEl = document.getElementById('maintenanceMessage');
const returnEtaEl = document.getElementById('returnEta');
const garageTimeEl = document.getElementById('garageTime');
const autoStatusEl = document.getElementById('autoStatus');
let startedAt = Date.now();

function formatDuration(milliseconds) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

try {
  const saved = JSON.parse(localStorage.getItem(SITE_CONFIG_CACHE_KEY) || 'null');
  const maintenance = saved?.config?.maintenance;
  if (maintenance?.message && messageEl) messageEl.textContent = maintenance.message;
  if (maintenance?.eta && returnEtaEl) returnEtaEl.textContent = maintenance.eta;
  if (Number(maintenance?.startedAt) > 0) startedAt = Number(maintenance.startedAt);
} catch (_) {}

function updateElapsedTime() {
  if (garageTimeEl) garageTimeEl.textContent = formatDuration(Date.now() - startedAt);
}

if (autoStatusEl) autoStatusEl.innerHTML = '<i></i> No background checks · reload or continue to the site';
updateElapsedTime();
setInterval(updateElapsedTime, 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateElapsedTime();
}, { passive: true });
