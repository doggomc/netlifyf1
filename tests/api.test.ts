import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('window', globalThis);
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('API request cache', () => {
  it('deduplicates concurrent requests', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: 1 })));
    vi.stubGlobal('fetch', fetch);
    const { fetchJson } = await import('../src/services/api');
    expect(await Promise.all([fetchJson('/one'), fetchJson('/one')])).toEqual([{ value: 1 }, { value: 1 }]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('serves saved data during an outage', async () => {
    localStorage.setItem('freef1_api_cache_/offline', JSON.stringify({ savedAt: Date.now(), data: { cached: true } }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
    const { fetchJson } = await import('../src/services/api');
    expect(await fetchJson('/offline')).toEqual({ cached: true });
  });
  it('rejects expired, malformed and future-dated cache entries', async () => {
    const { readApiFallback } = await import('../src/services/api');
    for (const savedAt of [Date.now() - 8 * 86400000, 'invalid', Date.now() + 86400000]) {
      localStorage.setItem('freef1_api_cache_/old', JSON.stringify({ savedAt, data: { old: true } }));
      expect(readApiFallback('/old')).toBeNull();
    }
  });
  it('does not cache a rejected request forever', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(new Response('{"ok":true}'));
    vi.stubGlobal('fetch', fetch);
    const { fetchJson } = await import('../src/services/api');
    await expect(fetchJson('/retry')).rejects.toThrow('Offline');
    expect(await fetchJson('/retry')).toEqual({ ok: true });
  });
  it('refreshes in-memory results after one minute', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockImplementation(async () => new Response('{"ok":true}'));
    vi.stubGlobal('fetch', fetch);
    const { fetchJson } = await import('../src/services/api');
    await fetchJson('/refresh'); await fetchJson('/refresh');
    vi.advanceTimersByTime(61000); await fetchJson('/refresh');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('aborts requests at their timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('Aborted')));
    })));
    const { fetchWithTimeout } = await import('../src/services/api');
    const request = expect(fetchWithTimeout('/slow', {}, 100)).rejects.toThrow('Aborted');
    await vi.advanceTimersByTimeAsync(101); await request;
  });
  it('honours a caller abort signal', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('Cancelled')));
    })));
    const { fetchWithTimeout } = await import('../src/services/api');
    const controller = new AbortController();
    const request = expect(fetchWithTimeout('/cancel', { signal: controller.signal })).rejects.toThrow('Cancelled');
    controller.abort(); await request;
  });
  it('bounds the persistent response cache at forty entries', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
    const { fetchJson } = await import('../src/services/api');
    for (let index = 0; index < 50; index++) await fetchJson(`/bounded-${index}`);
    expect(JSON.parse(localStorage.getItem('freef1_api_cache_index')).length).toBe(40);
    expect(localStorage.getItem('freef1_api_cache_/bounded-0')).toBeNull();
  });
});
