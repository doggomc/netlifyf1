/* ═══════════════ SHARED PAGE SHELL ═══════════════
   Every page except the cockpit imports this and nothing else, so the chrome
   costs a fraction of the cockpit bundle. The cockpit keeps its own runtime and
   calls initShell({ nav: false, transitions: false }) purely for link state.

   The transition is deliberately the same gesture as the source-chip switch:
   the outgoing page lifts 6px and fades, the incoming one arrives 10px low.
   View Transitions do it across documents where supported; the .is-leaving
   body class covers the rest, and reduced-motion skips both. */

type ShellOptions = {
  /** Bind the mobile menu button and the scrolled-header state. */
  nav?: boolean;
  /** Fade between pages instead of hard-cutting. */
  transitions?: boolean;
};

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Normalised pathname: '/cockpit.html' and '/cockpit/' are the same page. */
function pathKey(pathname: string): string {
  const withoutIndex = pathname.replace(/\/index\.html$/, '/');
  const trimmed = withoutIndex.replace(/\.html$/, '').replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

function markCurrentLink(root: ParentNode): void {
  const here = pathKey(location.pathname);
  root.querySelectorAll<HTMLAnchorElement>('.nav-links a, .footer-nav a').forEach((link) => {
    let target: string;
    try {
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      target = pathKey(url.pathname);
    } catch {
      return;
    }
    link.removeAttribute('aria-current');
    if (target === here || (target !== '/' && here.startsWith(`${target}/`))) {
      link.setAttribute('aria-current', 'page');
    }
  });
}

function bindNav(): void {
  const nav = document.querySelector<HTMLElement>('.nav');
  const toggle = document.getElementById('navToggle') as HTMLButtonElement | null;
  const menu = document.getElementById('navLinks');

  const close = () => {
    menu?.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.setAttribute('aria-label', 'Open navigation');
  };

  toggle?.addEventListener('click', () => {
    const open = !menu?.classList.contains('open');
    menu?.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });

  menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));

  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu?.classList.contains('open')) {
      close();
      toggle?.focus();
    }
  });

  /* The header earns its border only once the page has moved. */
  if (nav) {
    let stuck = false;
    const sync = () => {
      const next = scrollY > 8;
      if (next === stuck) return;
      stuck = next;
      nav.classList.toggle('stuck', stuck);
    };
    addEventListener('scroll', sync, { passive: true });
    sync();
  }
}

function bindTransitions(): void {
  const canTransition = () => !reduceMotion() && !document.body.classList.contains('is-leaving');

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = (event.target as Element | null)?.closest?.('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    if (anchor.target && anchor.target !== '_self') return;
    if (anchor.hasAttribute('download')) return;

    let url: URL;
    try {
      url = new URL(anchor.href, location.href);
    } catch {
      return;
    }
    if (url.origin !== location.origin) return;

    /* Same document: let the browser scroll to the anchor. */
    if (pathKey(url.pathname) === pathKey(location.pathname) && url.search === location.search) return;
    if (!canTransition()) return;

    event.preventDefault();
    document.body.classList.add('is-leaving');
    /* 170ms matches pageOut; navigating sooner would cut the animation short. */
    setTimeout(() => { location.href = url.href; }, 165);
  });

  /* Coming back via the back button restores from bfcache with the class still on. */
  addEventListener('pageshow', () => document.body.classList.remove('is-leaving'));

  /* A link that starts a download or is opened in a new tab must never leave the
     page stuck in the leaving state. */
  addEventListener('pagehide', () => document.body.classList.remove('is-leaving'));
}

export function initShell(options: ShellOptions = {}): void {
  const { nav = true, transitions = true } = options;
  markCurrentLink(document);
  if (nav) bindNav();
  if (transitions) bindTransitions();

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
}
