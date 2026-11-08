import { BACKEND_API, SITE_CONFIG_CACHE_KEY } from '../config';
import type { ControllablePageId, SiteConfig } from '../types/site-config';

const DISCORD_INVITE = 'https://discord.gg/KYXHCAzhN4';
const LABELS: Record<ControllablePageId, string> = {
  cockpit: 'Cockpit',
  schedule: 'Schedule',
  standings: 'Standings',
  'live-timing': 'Live timing',
  drivers: 'Drivers',
  teams: 'Teams',
  help: 'Help',
};

export function resolvePageCategory(
  pageAttr: string | undefined = typeof document !== 'undefined' ? document.body?.dataset?.page : undefined,
  pathname: string = typeof location !== 'undefined' ? location.pathname : '/',
): ControllablePageId | null {
  const key = (pageAttr || pathname.replace(/^\/|\.html$|\/+$/g, '').split('/')[0] || '').trim().toLowerCase();
  if (!key || key === 'home' || key === 'index') return null;
  if (key === 'driver' || key === 'drivers') return 'drivers';
  if (key === 'team' || key === 'teams') return 'teams';
  return key in LABELS ? (key as ControllablePageId) : null;
}

export function outageMarkup(category: ControllablePageId): string {
  const label = LABELS[category] || 'Section';
  return `<div class="outage-card"><div class="outage-pill"><span class="outage-dot" aria-hidden="true"></span><span>${label} · Temporarily offline</span></div><h1 class="outage-title" id="partialOutageTitle">Partial Outage</h1><p class="outage-lead">This page isn't available right now.</p><p class="outage-copy">Race Control has temporarily paused ${label}. Everything else on FreeF1 remains available, or join our Discord for live updates.</p><div class="outage-actions"><a class="outage-btn outage-btn-primary" href="/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg><span>Home</span></a><a class="outage-btn" href="${DISCORD_INVITE}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 2.9c-.2.4-.4.9-.6 1.3a18.3 18.3 0 0 0-5.5 0c-.2-.4-.4-.9-.6-1.3A19.7 19.7 0 0 0 3.7 4.4C.5 9-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3c.5-.6.9-1.3 1.2-2-.7-.2-1.3-.5-1.9-.9l.4-.3c3.9 1.8 8.2 1.8 12.1 0l.4.3c-.6.4-1.2.7-1.9.9.4.7.8 1.4 1.2 2a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.3-13.7zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></svg><span>Discord</span></a></div><div class="outage-foot">Connected to Race Control — this page returns automatically once restored.</div></div>`;
}

let parkedStream = false;
let prevTitle: string | null = null;

function toGateSnapshot(raw: unknown): SiteConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const out: SiteConfig = {};
  const m = obj.maintenance as Record<string, unknown> | undefined;
  if (m && typeof m.active === 'boolean') out.maintenance = { active: m.active };
  const p = obj.pages as Record<string, unknown> | undefined;
  if (p && Array.isArray(p.disabled)) {
    out.pages = {
      disabled: p.disabled
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim().toLowerCase() as ControllablePageId)
        .filter((id) => id in LABELS),
    };
  }
  return out;
}

export function applyPageGate(config: SiteConfig | null, { fresh = false }: { fresh?: boolean } = {}): boolean {
  if (!config) return false;
  if (fresh && config.maintenance?.active === true) {
    location.replace('/maintenance.html');
    return true;
  }
  const category = resolvePageCategory();
  if (!category) return false;

  const main = document.querySelector<HTMLElement>('main');
  const existing = document.getElementById('partialOutageStage');
  if (config.pages?.disabled?.includes(category)) {
    if (prevTitle === null) prevTitle = document.title;
    document.title = `Partial Outage — ${LABELS[category]} · FreeF1`;
    document.querySelectorAll<HTMLVideoElement>('main video').forEach((v) => v.pause());
    document.querySelectorAll<HTMLIFrameElement>('#playerArea iframe, #multiGrid iframe').forEach((f) => {
      if (f.src && f.src !== 'about:blank') { f.src = 'about:blank'; parkedStream = true; }
    });
    if (main) main.hidden = true;
    if (!existing) {
      const stage = document.createElement('section');
      stage.id = 'partialOutageStage';
      stage.className = 'outage-stage';
      stage.setAttribute('role', 'region');
      stage.setAttribute('aria-labelledby', 'partialOutageTitle');
      stage.innerHTML = outageMarkup(category);
      main?.parentNode ? main.parentNode.insertBefore(stage, main) : document.body.appendChild(stage);
    }
    return true;
  }
  if (existing) {
    existing.remove();
    if (main) main.hidden = false;
    if (prevTitle !== null) { document.title = prevTitle; prevTitle = null; }
    if (parkedStream) { parkedStream = false; location.reload(); }
  }
  return false;
}

let started = false;
export function initPageGate(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  try {
    const cached = JSON.parse(localStorage.getItem(SITE_CONFIG_CACHE_KEY) || 'null');
    if (cached && Date.now() - Number(cached.savedAt) < 300_000) {
      applyPageGate(toGateSnapshot(cached.config));
    }
  } catch { /* ignore */ }

  let es: EventSource | null = null;
  let fallbackDone = false;
  const saveAndApply = (raw: unknown) => {
    const snap = toGateSnapshot(raw);
    if (!snap) return;
    try { localStorage.setItem(SITE_CONFIG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), config: raw })); } catch { /* ignore */ }
    applyPageGate(snap, { fresh: true });
  };
  const configApi = typeof location !== 'undefined' && location.protocol === 'https:' && !/\.e2b\.app$/i.test(location.hostname)
    ? location.origin
    : BACKEND_API;
  const fetchOnce = async () => {
    if (fallbackDone) return;
    fallbackDone = true;
    try {
      const r = await fetch(`${configApi}/api/site/config`, { credentials: 'omit' });
      if (r.ok) saveAndApply(await r.json());
    } catch { /* fail open */ }
  };
  const close = () => { es?.close(); es = null; };
  const connect = () => {
    if (es || document.visibilityState === 'hidden') return;
    if (typeof EventSource !== 'function') { void fetchOnce(); return; }
    try {
      es = new EventSource(`${BACKEND_API}/api/site/updates`);
      es.addEventListener('config', (e) => {
        try { saveAndApply(JSON.parse((e as MessageEvent).data)); } catch { /* ignore */ }
      });
      es.onerror = () => { close(); void fetchOnce(); };
    } catch { void fetchOnce(); }
  };
  connect();
  addEventListener('pagehide', close);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !es) connect();
  });
}
