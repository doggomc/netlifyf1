/* The nationality→flag map. Both the grid and a profile draw it, so it lives
   on its own and neither page pays for the other's tables. */

/** Flag code for a driver, keyed by the nationality string the API returns. */
export const NATIONALITY_FLAG: Record<string, string> = {
  Italian: 'it', British: 'gb', Monegasque: 'mc', Dutch: 'nl', Australian: 'au',
  French: 'fr', 'New Zealander': 'nz', Argentine: 'ar', German: 'de', Brazilian: 'br',
  Spanish: 'es', Thai: 'th', Japanese: 'jp', Canadian: 'ca', Finnish: 'fi',
  Mexican: 'mx',
};
