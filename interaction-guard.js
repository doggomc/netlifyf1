/* Best-effort deterrent only: browser source and DevTools remain accessible. */
(() => {
  'use strict';

  document.addEventListener('contextmenu', event => {
    event.preventDefault();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'F12' && event.keyCode !== 123) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
})();
