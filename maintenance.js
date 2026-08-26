'use strict';

const productionApi = 'https://f1free.onrender.com';
const backendHost = location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  location.hostname === 'f1free.onrender.com' ||
  location.hostname.endsWith('.e2b.app');
const API = backendHost ? location.origin : productionApi;

const messageEl = document.getElementById('maintenanceMessage');
const garageTimeEl = document.getElementById('garageTime');
const autoStatusEl = document.getElementById('autoStatus');
let maintenanceStartedAt = Date.now();
let released = false;
let eventSource = null;
let sseConnected = false;

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function safeStoreGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function safeStoreSet(key, value) {
  try { localStorage.setItem(key, value); } catch (_) {}
}

function formatDuration(milliseconds) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

function releaseWebsite() {
  if (released) return;
  released = true;
  document.documentElement.classList.add('site-released');
  if (autoStatusEl) autoStatusEl.innerHTML = '<i></i> Track clear — releasing website';
  eventSource?.close();
  setTimeout(() => location.replace('/'), 850);
}

function applyMaintenanceState(state) {
  if (!state || typeof state.active !== 'boolean') return;
  if (!state.active) return releaseWebsite();
  if (state.message && messageEl) messageEl.textContent = state.message;
  if (state.startedAt) maintenanceStartedAt = Number(state.startedAt) || maintenanceStartedAt;
  if (autoStatusEl) autoStatusEl.innerHTML = '<i></i> Connected to race control';
}

async function fetchMaintenanceStatus() {
  if (released || document.hidden) return;
  try {
    const response = await fetchWithTimeout(`${API}/api/site/status`, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return;
    const data = await response.json();
    applyMaintenanceState(data.maintenance);
  } catch (_) {
    if (autoStatusEl) autoStatusEl.innerHTML = '<i></i> Reconnecting to race control';
  }
}

function connectEvents() {
  if (released || document.hidden || eventSource) return;
  try {
    const source = new EventSource(`${API}/api/events`);
    eventSource = source;
    source.addEventListener('open', () => {
      sseConnected = true;
      if (autoStatusEl) autoStatusEl.innerHTML = '<i></i> Connected to race control';
    });
    source.addEventListener('maintenance_update', event => {
      try { applyMaintenanceState(JSON.parse(event.data)); } catch (_) {}
    });
    source.addEventListener('error', () => {
      sseConnected = false;
      if (autoStatusEl) autoStatusEl.innerHTML = '<i></i> Reconnecting to race control';
    });
  } catch (_) {
    eventSource = null;
  }
}

function initVisitorHeartbeat() {
  let visitorId = safeStoreGet('freef1_user_id');
  if (!visitorId) {
    visitorId = `user_${crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)}`;
    safeStoreSet('freef1_user_id', visitorId);
  }

  let timer = 0;
  let inFlight = false;
  let visitorToken = '';
  let visitorTokenExpiresAt = 0;
  const refreshVisitorToken = async () => {
    const response = await fetchWithTimeout(`${API}/api/visitors/token`, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { 'X-User-Id': visitorId }
    });
    if (!response.ok) throw new Error(`Token request failed: ${response.status}`);
    const data = await response.json();
    visitorToken = data.token || '';
    visitorTokenExpiresAt = Number(data.expiresAt) || 0;
  };
  const heartbeat = async () => {
    clearTimeout(timer);
    if (released || document.hidden || inFlight) {
      timer = setTimeout(heartbeat, 24000);
      return;
    }
    inFlight = true;
    try {
      if (!visitorToken || visitorTokenExpiresAt - Date.now() < 60000) await refreshVisitorToken();
      const response = await fetchWithTimeout(`${API}/api/visitors/heartbeat`, {
        cache: 'no-store',
        credentials: 'omit',
        keepalive: true,
        headers: {
          'X-Visitor-Token': visitorToken,
          'X-User-Id': visitorId
        }
      });
      if (response.status === 403) {
        visitorToken = '';
        visitorTokenExpiresAt = 0;
      }
    } catch (_) {
      // The maintenance experience stays usable while the backend reconnects.
    } finally {
      inFlight = false;
      timer = setTimeout(heartbeat, 24000);
    }
  };
  heartbeat();
}

function updateTelemetry() {
  if (document.hidden) return;
  if (garageTimeEl) garageTimeEl.textContent = formatDuration(Date.now() - maintenanceStartedAt);
}

fetchMaintenanceStatus();
connectEvents();
initVisitorHeartbeat();
updateTelemetry();
setInterval(updateTelemetry, 1000);
setInterval(() => { if (!sseConnected) fetchMaintenanceStatus(); }, 30000);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    eventSource?.close();
    eventSource = null;
    sseConnected = false;
  } else {
    updateTelemetry();
    fetchMaintenanceStatus();
    connectEvents();
  }
}, { passive: true });

addEventListener('pagehide', () => eventSource?.close(), { once: true });
