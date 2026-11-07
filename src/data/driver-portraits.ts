/* The grid as the Drivers page and the driver profiles need it.
   Everything here is either a fact the calendar already knows (the circuit a round
   is run at, the country whose flag flies over it) or a fixed sports fact (the
   country a team is licensed in, the colours it races in). No biography is invented:
   profiles are assembled from the championship and result tables the backend serves. */

export const DRIVER_PORTRAIT: Record<string, string> = {
  antonelli: 'mercedes/andant01/2026mercedesandant01right.webp',
  russell: 'mercedes/georus01/2026mercedesgeorus01right.webp',
  leclerc: 'ferrari/chalec01/2026ferrarichalec01right.webp',
  hamilton: 'ferrari/lewham01/2026ferrarilewham01right.webp',
  norris: 'mclaren/lannor01/2026mclarenlannor01right.webp',
  piastri: 'mclaren/oscpia01/2026mclarenoscpia01right.webp',
  verstappen: 'redbullracing/maxver01/2026redbullracingmaxver01right.webp',
  hadjar: 'redbullracing/isahad01/2026redbullracingisahad01right.webp',
  lawson: 'racingbulls/lialaw01/2026racingbullslialaw01right.webp',
  lindblad: 'racingbulls/arvlin01/2026racingbullsarvlin01right.webp',
  tsunoda: 'racingbulls/yuktsu01/2026racingbullsyuktsu01right.webp',
  gasly: 'alpine/piegas01/2026alpinepiegas01right.webp',
  colapinto: 'alpine/fracol01/2026alpinefracol01right.webp',
  ocon: 'haasf1team/estoco01/2026haasf1teamestoco01right.webp',
  bearman: 'haasf1team/olibea01/2026haasf1teamolibea01right.webp',
  hirakawa: 'haasf1team/ryohir01/2026haasf1teamryohir01right.webp',
  hulkenberg: 'audi/nichul01/2026audinichul01right.webp',
  bortoleto: 'audi/gabbor01/2026audigabbor01right.webp',
  sainz: 'williams/carsai01/2026williamscarsai01right.webp',
  albon: 'williams/alealb01/2026williamsalealb01right.webp',
  alonso: 'astonmartin/feralo01/2026astonmartinferalo01right.webp',
  stroll: 'astonmartin/lanstr01/2026astonmartinlanstr01right.webp',
  perez: 'cadillac/serper01/2026cadillacserper01right.webp',
  bottas: 'cadillac/valbot01/2026cadillacvalbot01right.webp',
};

import { PORTRAIT_ALIAS, headshotWith, portraitWith, type PortraitLookup } from './portraits';

/* The map is only for the pages that need many portraits (the grid, a profile).
   A page that needs one or two binds the rule to this map instead of shipping it. */
const lookup: PortraitLookup = (driverId) => {
  const key = PORTRAIT_ALIAS[driverId] ?? driverId;
  return DRIVER_PORTRAIT[key] ?? null;
};

export const portrait = (driverId: string | null, width: 320 | 440 | 600) =>
  portraitWith(driverId ? lookup : () => null, driverId ?? '', width);

export const headshot = (driverId: string | null, size: 64 | 96 = 64) =>
  headshotWith(driverId ? lookup : () => null, driverId ?? '', size);
