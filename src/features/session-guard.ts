/* Is a provider address for the session being watched?
   taifood keeps the previous session's entries in its list marked 'online', and an expired address
   renders a black frame instead of failing visibly, so the player must never be handed one.
   Kept in its own module: app.ts needs it in the startup chunk, and importing the catalogue module
   for it dragged the whole provider layer into the initial bundle. */
export function canonicalSessionSlug(raw: unknown): string {
  const slug = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) return '';
  if (slug === 'fp1' || slug === 'practice-1' || slug === 'free-practice-1' || slug === 'p1') return 'fp1';
  if (slug === 'fp2' || slug === 'practice-2' || slug === 'free-practice-2' || slug === 'p2') return 'fp2';
  if (slug === 'fp3' || slug === 'practice-3' || slug === 'free-practice-3' || slug === 'p3') return 'fp3';
  if (slug === 'sq' || slug === 'sprint-qualifying' || slug === 'sprint-shootout') return 'sprint-qualifying';
  if (slug === 'quali' || slug === 'qualifying') return 'qualifying';
  return slug;
}

export function staleSession(uri: unknown, sessionSlug: string): boolean {
  /* '<event>---<session>-<id>', where the session itself may end in a number ('practice-3'), so the
     session is what sits between '---' and the trailing '-<id>'. The path form
     ('f1/2026/mexico/race') names no session and is always kept. */
  const path = String(uri || '').split('/embed/')[1] || '';
  const match = path.replace(/_\d+p$/i, '').match(/^(.+?)---(.+)-(\d+)$/);
  const wanted = canonicalSessionSlug(sessionSlug);
  if (!match || !wanted) return false;
  return canonicalSessionSlug(match[2]) !== wanted;
}
