import { store } from './storage';

const STALE_MS = 7 * 86400_000;
const MAX_CACHE_ENTRIES = 40;
const INDEX_KEY = 'freef1_api_cache_index';
const requests = new Map<string, { expires: number; promise: Promise<unknown> }>();
const keyFor = (url: string) => `freef1_api_cache_${url}`;

/** Abort a timed-out or caller-cancelled fetch. Streaming body lifetimes remain caller-owned. */
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}

// Provider payloads intentionally remain flexible at this compatibility boundary.
// Domain-specific feature adapters narrow them before rendering.
export function readApiFallback<T = any>(url: string): T | null {
  const key = keyFor(url);
  try {
    const cached = JSON.parse(store.get(key) || 'null');
    const savedAt = Number(cached?.savedAt);
    if (!cached || !Number.isFinite(savedAt) || Date.now() - savedAt > STALE_MS || savedAt > Date.now() + 60000) {
      store.remove(key); return null;
    }
    return cached.data ?? null;
  } catch { return null; }
}

function saveResponse(url: string, data: unknown): void {
  const key = keyFor(url);
  store.set(key, JSON.stringify({ savedAt: Date.now(), data }));
  let index: string[] = [];
  try {
    const parsed: unknown = JSON.parse(store.get(INDEX_KEY) || '[]');
    if (Array.isArray(parsed)) index = parsed.filter((item): item is string => typeof item === 'string' && item.startsWith('freef1_api_cache_') && item !== INDEX_KEY);
  } catch { /* rebuild index on next save */ }
  index = index.filter(item => item !== key);
  index.push(key);
  while (index.length > MAX_CACHE_ENTRIES) store.remove(index.shift()!);
  store.set(INDEX_KEY, JSON.stringify(index));
}

/** Dedupe in-flight requests, bound memory, and refresh live data after one minute. */
export function fetchJson<T = any>(url: string): Promise<T> {
  const hit = requests.get(url);
  if (hit && hit.expires > Date.now()) return hit.promise as Promise<T>;
  if (requests.size >= MAX_CACHE_ENTRIES) requests.delete(requests.keys().next().value!);
  const promise = fetchWithTimeout(url, { headers: { Accept: 'application/json' } })
    .then(async response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: T = await response.json();
      saveResponse(url, data);
      return data;
    })
    .catch(error => {
      requests.delete(url);
      const cached = readApiFallback<T>(url);
      if (cached !== null) return cached;
      throw error;
    });
  requests.set(url, { expires: Date.now() + 60000, promise });
  return promise;
}
