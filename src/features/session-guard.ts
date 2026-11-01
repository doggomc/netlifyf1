/* Is a provider address for the session being watched?
   taifood keeps the previous session's entries in its list marked 'online', and an expired address
   renders a black frame instead of failing visibly, so the player must never be handed one.
   Kept in its own module: app.ts needs it in the startup chunk, and importing the catalogue module
   for it dragged the whole provider layer into the initial bundle. */
export function staleSession(uri: unknown, sessionSlug: string): boolean {
  /* '<event>---<session>-<id>', where the session itself may end in a number ('practice-3'), so the
     session is what sits between '---' and the trailing '-<id>'. The path form
     ('f1/2026/mexico/race') names no session and is always kept. */
  const path = String(uri || '').split('/embed/')[1] || '';
  const match = path.replace(/_\d+p$/i, '').match(/^(.+?)---(.+)-(\d+)$/);
  if (!match || !sessionSlug) return false;
  return match[2].toLowerCase() !== sessionSlug.toLowerCase();
}
