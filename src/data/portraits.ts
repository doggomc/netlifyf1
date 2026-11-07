/* The one rule that turns a driver's portrait file into a CDN URL.
   Deliberately separate from the portrait map itself: the standings page needs
   a head-and-shoulders crop and a leader card's cut-out, but not the 24-entry
   map it would otherwise carry to build two URLs. */

const PORTRAIT_BASE = 'https://media.formula1.com/image/upload';
const FALLBACK = 'd_common:f1:2026:fallback:driver:2026fallbackdriverright.webp';

/** Jolpica's driverIds that differ from the portrait's own file key. */
export const PORTRAIT_ALIAS: Record<string, string> = {
  max_verstappen: 'verstappen',
  arvid_lindblad: 'lindblad',
  ryo_hirakawa: 'hirakawa',
};

/** Where the file for a driverId lives, or null when the map has no entry. */
export type PortraitLookup = (driverId: string) => string | null;

/** A head-and-shoulders crop for a table row. The CDN crops to the face. */
export function headshotWith(lookup: PortraitLookup, driverId: string, size: 64 | 96 = 64): string {
  const file = lookup(driverId);
  const base = `${PORTRAIT_BASE}/c_fill,g_face,w_${size},h_${size}/q_auto`;
  return file ? `${base}/d_${FALLBACK}/v1740000001/common/f1/2026/${file}` : `${base}/${FALLBACK}`;
}

/** A cut-out portrait at a render width. */
export function portraitWith(lookup: PortraitLookup, driverId: string, width: 320 | 440 | 600): string {
  const file = lookup(driverId);
  return file
    ? `${PORTRAIT_BASE}/c_lfill,w_${width}/q_auto/d_${FALLBACK}/v1740000001/common/f1/2026/${file}`
    : `${PORTRAIT_BASE}/c_lfill,w_${width}/q_auto/v1740000001/${FALLBACK}`;
}
