/* ═══════════════ COCKPIT MESSAGES ═══════════════
   Every piece of "waiting" or "something went wrong" copy the site shows, in one file.

   The no-stream box rotates through NO_STREAM_MESSAGES while there is no feed: each entry is a
   short racing phrase (`t`) and a sentence in plain English (`x`). Add, remove or reorder freely
   — the rotation reads the array each time it starts, so a new entry is live as soon as it is
   added. Keep `t` to about 16 characters so it stays on one line in the box.

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
  { t: 'Lights out', x: 'We are away — the feed is being released now.' },
  { t: 'Off track', x: 'We ran wide for a moment. Rejoining the feed now.' },
  { t: 'Box box', x: 'Quick stop — we are changing tyres and coming straight back out.' },
  { t: 'Formation lap', x: 'Our crew is setting the feed up. A few more moments and you will be good to go.' },
  { t: 'In the garage', x: 'Getting everything ready for the best viewing experience possible.' },
  { t: 'Safety car', x: 'The feed is under a safety car. We will be back up to speed shortly.' },
  { t: 'Red flag', x: 'Session stopped briefly while we restart the stream. Hold your position.' },
  { t: 'Under investigation', x: 'We are checking the feed. Nothing wrong on your side — please stay with us.' },
  { t: 'Blue flags', x: 'A slower feed is in the way. We are working around it and getting you back on track.' },
  { t: 'Almost there', x: 'Just a little more patience and you will be watching the race in no time.' },
  { t: 'Stay tuned', x: 'The stream will be up shortly. We appreciate your patience!' },
  { t: 'Hang tight', x: "We're working on getting this stream up for you. Check back soon!" }
];

export const LOADER_LINES = [
  'Establishing feed…',
  'Getting the tyres up to temperature…',
  'Opening DRS…',
  'Lights out and away we go…'
];

export const BLOCKED_TITLE = 'Feed blocked on this device';

export const BLOCKED_COPY_IOS =
  'The stream host never loaded on this network. On iPhone this is usually caused by a content blocker, Private Relay, Lockdown Mode or DNS filtering. Disable them for this site and reload.';

export const BLOCKED_COPY =
  'The stream host never responded on this network - the feed was blocked before it could start. Check ad-blockers, VPN or DNS filtering, then retry.';

export const HIJACK_TITLE = 'The feed tried to send you to another site';

export const HIJACK_COPY =
  "That was the feed's ad layer tab-swapping the player on your click - not us. Resume reloads the stream; Stay keeps whatever page the frame landed on. We will never redirect you off this site: close any extra tab it opened.";

export const FEATURE_ERROR = 'This feature could not load. Check your connection, then reload the page.';
