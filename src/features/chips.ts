/* Race Control's per-chip name and link.
   Loaded the first time a site snapshot arrives, so the editing path costs the startup bundle
   nothing: most visitors never see a snapshot field they would use. */
import type { StreamSource } from './chip-types';

export interface ChipOverrides { [id: string]: { label?: string; url?: string } }
const store: { overrides: ChipOverrides } = { overrides: {} };

/* A custom address replaces the chip's pool outright; clearing the field brings the pool straight
   back. The shipped name and links are remembered the first time a chip is touched. */
export function setChip(source: StreamSource, custom: { label?: string; url?: string } = {}) {
  source.base ||= { label: source.label, links: source.links };
  source.label = custom.label || source.base.label;
  source.links = custom.url ? [{ provider: 'custom', quality: 0, url: custom.url }] : source.base.links;
}

/* Keep the last applied overrides here, so app.ts does not need a variable for them. */
export function applySourceConfig(payload: any, host: {
  sources: StreamSource[];
  current: () => number;
  usable: (source: StreamSource | undefined) => boolean;
  normalize: () => void;
  render: () => void;
  reload: () => void;
}) {
  const previous = host.sources[host.current()];
  const next = applyChips(host.sources, payload, store.overrides);
  if (next === store.overrides) return;
  store.overrides = next;
  const stillUsable = host.usable(previous);
  if (!stillUsable) host.normalize();
  host.render();
  if (!stillUsable) host.reload();
}

function applyChips(sources: StreamSource[], payload: any, previous: ChipOverrides): ChipOverrides {
  const known = new Set(sources.map((s) => s.id));
  const disabled = (Array.isArray(payload?.disabled) ? payload.disabled : []).map(String).filter((id: string) => known.has(id));
  const next = new Set(disabled);
  const overrides: ChipOverrides = payload?.overrides || {};
  if (JSON.stringify(overrides) === JSON.stringify(previous)
    && next.size === sources.filter((s) => s.hidden).length
    && disabled.every((id: string) => sources.some((s) => s.id === id && s.hidden))) return previous;
  sources.forEach((source) => {
    source.hidden = next.has(source.id);
    setChip(source, overrides[source.id]);
  });
  return overrides;
}
