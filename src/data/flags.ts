/* Flags are self-hosted (assets/flags, 40px and 80px for hi-dpi) so a profile and
   the grid make no third-party image requests — the site's CSP has no external
   img-src entry for a flag CDN, and a reader's IP should not leak to one either.
   Only the codes that can appear on the 2026 grid and calendar are shipped. */

const FLAG = (code: string, size: 40 | 80) => `/assets/flags/${code}${size === 80 ? '-w80' : '-40'}.png`;

/** A flag <img> with a 2× source, sized like the reference's 20×15 plate. */
export function flagHtml(code: string, className = 'flag'): string {
  if (!code) return '';
  return `<img class="${className}" src="${FLAG(code, 40)}" srcset="${FLAG(code, 80)} 2x" alt="" width="20" height="15" loading="lazy" decoding="async">`;
}
