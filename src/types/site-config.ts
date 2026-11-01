export interface Maintenance { active: boolean; message?: string; eta?: string; startedAt?: number; updatedAt?: number; }
export interface StreamOverride { active: boolean; url?: string; type?: string; }
export interface StreamWindow { active: boolean; reason?: string; startedAt?: number; updatedAt?: number; }
export interface SiteConfig {
  maintenance?: Maintenance;
  streamOverride?: StreamOverride;
  sources?: { disabled: string[]; overrides?: Record<string, { label?: string; url?: string }> };
  streamWindow?: StreamWindow;
  news?: unknown[];
}
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown, limit: number): string | undefined => typeof value === 'string' ? value.slice(0, limit) : undefined;
const timestamp = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

/** SSE and cached JSON are untrusted. Ignore malformed fields rather than corrupting UI state. */
export function parseSiteConfig(value: unknown): SiteConfig | null {
  if (!record(value)) return null;
  const result: SiteConfig = {};
  if (record(value.maintenance) && typeof value.maintenance.active === 'boolean') {
    const m = value.maintenance;
    result.maintenance = { active: m.active as boolean, message: text(m.message, 500), eta: text(m.eta, 120), startedAt: timestamp(m.startedAt), updatedAt: timestamp(m.updatedAt) };
  }
  const override = value.streamOverride ?? value.override;
  if (record(override) && typeof override.active === 'boolean') {
    const url = text(override.url, 4000);
    let safeUrl: string | undefined;
    try { const parsed = new URL(url || ''); if (parsed.protocol === 'https:') safeUrl = parsed.href; } catch { /* invalid URL */ }
    result.streamOverride = { active: override.active && Boolean(safeUrl), url: safeUrl, type: text(override.type, 12) };
  }
  if (record(value.sources) && Array.isArray(value.sources.disabled)) {
    result.sources = { disabled: value.sources.disabled.filter((id): id is string => typeof id === 'string').slice(0, 50) };
    /* Race Control's per-chip name and link. HTTPS only, the rule the backend enforces. */
    const overrides: Record<string, { label?: string; url?: string }> = {};
    for (const [id, entry] of Object.entries(record(value.sources.overrides) ? value.sources.overrides : {}).slice(0, 60)) {
      if (!record(entry)) continue;
      const label = text(entry.label, 40)?.trim();
      const url = text(entry.url, 500) || '';
      if (label || /^https:\/\//i.test(url)) overrides[id] = { ...(label ? { label } : {}), ...(/^https:\/\//i.test(url) ? { url } : {}) };
    }
    result.sources.overrides = overrides;
  }
  if (record(value.streamWindow) && typeof value.streamWindow.active === 'boolean') {
    const w = value.streamWindow;
    result.streamWindow = { active: w.active as boolean, reason: text(w.reason, 120), startedAt: timestamp(w.startedAt), updatedAt: timestamp(w.updatedAt) };
  }
  if (Array.isArray(value.news)) result.news = value.news.slice(0, 100);
  return result;
}
