import './interaction-guard';
import { initShell } from './ui/shell';
import './app';
import './viewer-counter';
import { onIdle } from './services/lazy';
import { store } from './services/storage';

/* The cockpit owns its own nav and routing; only the shared link state is taken
   from the shell, so the current page is marked the same way on every page. */
initShell({ nav: false, transitions: false });

// A fresh visitor needs no support-chat runtime on the main page.
const HELP_KEY = 'freef1.help.ticket.v1';
let help: Promise<unknown> | undefined;
function loadHelpNotifications(): void {
  try {
    const saved = JSON.parse(store.get(HELP_KEY) || 'null');
    if (saved?.token || saved?.unread) {
      onIdle(() => help ??= import('./help').catch(error => { help = undefined; throw error; }));
    }
  } catch { /* invalid local state must not affect playback */ }
}
loadHelpNotifications();
window.addEventListener('storage', event => { if (event.key === HELP_KEY) loadHelpNotifications(); });
