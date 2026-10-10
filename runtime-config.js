'use strict';

// Kept separate from the application bundle so capacity tuning never requires
// editing or rebuilding the 270 KB client.
window.__FREEF1_CONFIG__ = Object.freeze({
  heartbeatMs: 120000,
  fallbackPollMs: 120000
});
