'use strict';

/* The maintenance page listens only for public Race Control config changes.
   It sends no visitor/presence data and runs no network polling or heartbeat. */
const BACKEND_API = 'https://f1admin.onrender.com';
const SITE_CONFIG_CACHE_KEY = 'freef1_site_config_v2';
const messageEl = document.getElementById('maintenanceMessage');
const returnEtaEl = document.getElementById('returnEta');
const garageTimeEl = document.getElementById('garageTime');
const autoStatusEl = document.getElementById('autoStatus');
let startedAt = Date.now();
let updateStream = null;
let releaseStarted = false;

function formatDuration(milliseconds) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function showCachedDetails() {
  try {
    const saved = JSON.parse(localStorage.getItem(SITE_CONFIG_CACHE_KEY) || 'null');
    const maintenance = saved?.config?.maintenance;
    if (maintenance?.message && messageEl) messageEl.textContent = maintenance.message;
    if (maintenance?.eta && returnEtaEl) returnEtaEl.textContent = maintenance.eta;
    if (Number(maintenance?.startedAt) > 0) startedAt = Number(maintenance.startedAt);
  } catch (_) {}
}

function saveConfig(config) {
  try {
    localStorage.setItem(SITE_CONFIG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), config }));
  } catch (_) {}
}

function releaseSite() {
  if (releaseStarted) return;
  releaseStarted = true;
  if (autoStatusEl) autoStatusEl.textContent = 'Race Control clear · returning to FreeF1';
  document.documentElement.classList.add('site-released');
  window.setTimeout(() => window.location.replace('/'), 360);
}

function applyConfig(config) {
  if (!config || typeof config !== 'object') return;
  saveConfig(config);
  const maintenance = config.maintenance || {};
  if (maintenance.active !== true) {
    releaseSite();
    return;
  }

  if (maintenance.message && messageEl) messageEl.textContent = maintenance.message;
  if (maintenance.eta && returnEtaEl) returnEtaEl.textContent = maintenance.eta;
  if (Number(maintenance.startedAt) > 0) startedAt = Number(maintenance.startedAt);
  if (autoStatusEl) autoStatusEl.innerHTML = '<i></i> Race Control connected · live updates enabled';
  updateElapsedTime();
}

function updateElapsedTime() {
  if (garageTimeEl) garageTimeEl.textContent = formatDuration(Date.now() - startedAt);
}

function connectUpdates() {
  if (document.hidden || updateStream || releaseStarted) return;
  if (typeof window.EventSource !== 'function') {
    void refreshConfigOnce();
    return;
  }

  try {
    updateStream = new window.EventSource(`${BACKEND_API}/api/site/updates`);
    updateStream.addEventListener('config', (event) => {
      try { applyConfig(JSON.parse(event.data)); } catch (_) {}
    });
    updateStream.addEventListener('error', () => {
      if (autoStatusEl && !releaseStarted) autoStatusEl.innerHTML = '<i></i> Race Control reconnecting · status may be delayed';
    });
  } catch (_) {
    updateStream = null;
    void refreshConfigOnce();
  }
}

async function refreshConfigOnce() {
  try {
    const response = await fetch(`${BACKEND_API}/api/site/config`, {
      cache: 'no-cache',
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`Race Control returned ${response.status}`);
    applyConfig(await response.json());
  } catch (_) {
    if (autoStatusEl) autoStatusEl.innerHTML = '<i></i> Race Control unavailable · reconnect when this page returns';
  }
}

showCachedDetails();
if (autoStatusEl) autoStatusEl.innerHTML = '<i></i> Connecting to Race Control…';
updateElapsedTime();
window.setInterval(updateElapsedTime, 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateElapsedTime();
  if (typeof window.EventSource === 'function') connectUpdates();
  else if (!document.hidden) void refreshConfigOnce();
}, { passive: true });
window.addEventListener('focus', () => {
  if (document.hidden) return;
  if (typeof window.EventSource === 'function') connectUpdates();
  else void refreshConfigOnce();
}, { passive: true });
window.addEventListener('online', () => {
  if (document.hidden) return;
  if (typeof window.EventSource === 'function') connectUpdates();
  else void refreshConfigOnce();
}, { passive: true });
connectUpdates();
