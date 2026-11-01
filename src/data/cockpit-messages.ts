/* ═══════════════ COCKPIT MESSAGES ═══════════════
   Every piece of "waiting" or "something went wrong" copy the site shows, in one file.

   The no-stream box rotates through NO_STREAM_MESSAGES while there is no feed: each entry is a
   short racing phrase (`t`) and a sentence in plain English (`x`). Add, remove or reorder freely
   — the rotation reads the array each time it starts, so a new entry is live as soon as it is
   added. Keep `t` to about 16 characters so it stays on one line in the box.

   Shown only when nothing is live — before, between or after sessions. Never read as breakage
   (BLOCKED_*, HIJACK_* carry that); every line looks forward.

   Where these appear:
     NO_STREAM_MESSAGES   the box over the player when no feed is available
     BLOCKED_COPY         the box when the feed host is blocked on this device/network
     HIJACK_TITLE/COPY    when a feed tries to send the visitor to another site
     LOADER_LINES         the small line under the spinner while a feed is connecting
     FEATURE_ERROR        fallback if a lazy feature chunk fails to load
*/

export interface CockpitMessage {
  /** Short racing phrase — the box heading. */
  t: string;
  /** One sentence of plain-English explanation. */
  x: string;
}

export const NO_STREAM_MESSAGES: CockpitMessage[] = [
  { t: 'Not on air yet', x: 'You are early. Video starts shortly before.' },
  { t: 'Lights out soon', x: 'Almost time. The stream goes live minutes ahead.' },
  { t: 'Waiting on the grid', x: 'The grid is forming. Times are above.' },
  { t: 'Between sessions', x: 'Nothing on track. The next session streams live.' },
  { t: 'Standby', x: 'All quiet. Pick a session above.' },
  { t: 'Parc fermé', x: 'Parked until the next session.' },
  { t: 'See you at lights out', x: 'Video starts at the scheduled time.' }
];

export const LOADER_LINES = [
  'Establishing feed…',
  'Getting the tyres up to temperature…',
  'Lights out and away we go…'
];

export const BLOCKED_TITLE = 'Feed blocked';

export const BLOCKED_COPY_IOS =
  'The stream host never loaded on this network. On iPhone this is usually caused by a content blocker, Private Relay, Lockdown Mode or DNS filtering. Disable them for this site and reload.';

export const BLOCKED_COPY =
  'The stream host never responded on this network - the feed was blocked before it could start. Check ad-blockers, VPN or DNS filtering, then retry.';

export const HIJACK_TITLE = 'The feed tried to send you to another site';

export const HIJACK_COPY =
  "That was the feed's ad layer, not us. Resume reloads the stream; Stay keeps the page the frame landed on. We never redirect you off this site: close any extra tab it opened.";

export const FEATURE_ERROR = 'This feature could not load. Check your connection, then reload the page.';
