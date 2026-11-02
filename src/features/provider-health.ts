/* Provider health and dynamic-link tokens.
   Lazy-loaded: neither is needed to paint the first screen, and both are network work that
   should never sit in the startup bundle. */

export interface ProviderHealthState {
  providers: Record<string, { status?: string; reason?: string }>;
  dynamic: Record<string, { url: string; at: number }>;
}

export interface HealthDeps {
  backend: string;
  state: ProviderHealthState;
  onChange: () => void;
  fetchWithTimeout: (url: string, init: RequestInit, ms: number) => Promise<Response>;
  shouldSync?: () => boolean;
}

/* ehgembxe's minted JWT dies in ~15-30 seconds, so an address is only reusable for a heartbeat.
   Caching it for a minute guaranteed a 403 'Link Expired' page on every click. */
const DYNAMIC_TTL_MS = 8_000;

export async function loadProviderHealth(deps: HealthDeps): Promise<void> {
  try {
    const response = await deps.fetchWithTimeout(`${deps.backend}/api/stream/health`, { cache: 'no-store', headers: { Accept: 'application/json' } }, 12000);
    if (!response.ok) return;
    const json = await response.json();
    if (json?.providers && typeof json.providers === 'object') {
      deps.state.providers = json.providers;
      deps.onChange();
    }
  } catch (_) {
    /* Health is advisory: no answer means no annotation, not a blocked player. */
  }
}

export async function resolveDynamicLink(deps: HealthDeps, path: string): Promise<string> {
  const cached = deps.state.dynamic[path];
  if (cached && Date.now() - cached.at < DYNAMIC_TTL_MS) return cached.url;
  try {
    const response = await deps.fetchWithTimeout(
      `${deps.backend}/api/stream/resolve?path=${encodeURIComponent(path)}`,
      { cache: 'no-store', headers: { Accept: 'application/json' } },
      9000
    );
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json?.url) return '';
    deps.state.dynamic[path] = { url: String(json.url), at: Date.now() };
    return deps.state.dynamic[path].url;
  } catch (_) {
    return '';
  }
}

export function cachedDynamic(deps: HealthDeps, path: string): string {
  const cached = deps.state.dynamic[path];
  return cached && Date.now() - cached.at < DYNAMIC_TTL_MS ? cached.url : '';
}
