/** No idle task is allowed to block the first paint or cockpit initialization. */
export function onIdle(task: () => unknown): void {
  const run = () => { Promise.resolve().then(task).catch(error => console.warn('Optional feature unavailable', error)); };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 2000 });
  else window.setTimeout(run, 250);
}

/** Share one initializer across sections; native HTML remains visible before JavaScript. */
export function onVisible(ids: string[], task: () => Promise<unknown>): void {
  let pending = false;
  let done = false;
  const run = async () => {
    if (pending || done) return;
    pending = true;
    try { await task(); done = true; observer?.disconnect(); }
    catch (error) { console.warn('Feature load failed', error); }
    finally { pending = false; }
  };
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void run(); }, { rootMargin: '300px' })
    : null;
  for (const id of ids) {
    const element = document.getElementById(id);
    if (element) observer?.observe(element);
    document.querySelectorAll<HTMLAnchorElement>(`a[href="#${id}"]`).forEach(link => link.addEventListener('click', () => { void run(); }));
  }
  if (!observer) onIdle(run);
}

/** Consume the first activation, load listeners, then replay it once. Keyboard clicks work too.
 *
 * The chunk is warmed on hover, focus, touch and idle, so the first click opens the panel
 * immediately instead of waiting for a network round trip. Warming only fetches and initialises
 * the module - it never fires the button's own action. */
export function lazyButton(id: string, load: () => Promise<unknown>): void {
  const button = document.getElementById(id);
  if (!button) return;
  let pending = false;
  let warm: Promise<unknown> | null = null;
  const warmUp = () => {
    if (!warm) warm = Promise.resolve(load()).catch((error) => {
      /* A failed warm-up is not fatal: the click below retries and reports properly. */
      warm = null;
      console.warn(`Feature ${id} warm-up failed`, error);
    });
    return warm as Promise<unknown>;
  };
  ['pointerenter', 'focus', 'touchstart'].forEach((type) => {
    button.addEventListener(type, () => void warmUp(), { passive: true, once: false });
  });
  onIdle(warmUp);
  const activate = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (pending) return;
    pending = true;
    button.setAttribute('aria-busy', 'true');
    try {
      await warmUp();
      button.removeEventListener('click', activate, true);
      button.removeAttribute('aria-busy');
      button.click();
    } catch (error) {
      console.warn(`Feature ${id} unavailable`, error);
      let notice = document.getElementById('featureLoadError');
      if (!notice) {
        notice = document.createElement('div');
        notice.id = 'featureLoadError';
        notice.setAttribute('role', 'alert');
        notice.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9999;padding:16px;background:#17191d;color:white;border:1px solid #e10600;border-radius:8px';
        document.body.append(notice);
      }
      notice.textContent = 'This feature could not load. Check your connection, then reload the page.';
      window.setTimeout(() => notice?.remove(), 5000);
    } finally { pending = false; button.removeAttribute('aria-busy'); }
  };
  button.addEventListener('click', activate, true);
}
