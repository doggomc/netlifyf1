/* ═══════════════ FreeF1 — 404 Page Runtime ═══════════════
   Lightweight standalone controller for 404.html: wires mobile nav toggle,
   populates the requested URL readout, and rotates pit-wall radio lines
   while respecting reduced-motion and tab visibility. */

import './interaction-guard';

const RADIO_LINES: readonly string[] = [
  '"Check the map — that sector isn\'t on the calendar."',
  '"You\'ve run wide at Turn 404. Rejoin safely via Home."',
  '"Track limits exceeded. Deleting that URL from the timing tower."',
  '"Copy that — box this lap and head back to the pit lane."',
  '"Telemetry lost on that route. Try the Cockpit or Schedule instead."',
];

function init404(): void {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const pathEl = document.getElementById('path');
  if (pathEl) {
    const raw = (window.location.pathname || '/') + (window.location.search || '');
    pathEl.textContent = raw.length > 56 ? `${raw.slice(0, 53)}…` : raw;
    pathEl.title = raw;
  }

  const nav = document.querySelector<HTMLElement>('.nav');
  if (nav) {
    const onScroll = (): void => {
      nav.classList.toggle('stuck', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    const closeMenu = (): void => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    };
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (event) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!links.contains(target) && !toggle.contains(target)) closeMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
  }

  const radioEl = document.getElementById('radio');
  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!radioEl || reducedMotion) return;

  let index = 0;
  window.setInterval(() => {
    if (document.hidden) return;
    index = (index + 1) % RADIO_LINES.length;
    radioEl.style.opacity = '0';
    window.setTimeout(() => {
      radioEl.textContent = RADIO_LINES[index];
      radioEl.style.opacity = '1';
    }, 220);
  }, 4600);
}

init404();
