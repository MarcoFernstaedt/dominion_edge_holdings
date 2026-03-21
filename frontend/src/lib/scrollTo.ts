/**
 * smoothScrollTo — scroll to a DOM element by ID with easing.
 *
 * Usage:
 *   smoothScrollTo('section-tasks')          // scroll in current viewport
 *   smoothScrollTo('section-tasks', { offset: -80 })  // account for sticky header
 */
export function smoothScrollTo(id: string, options?: { offset?: number }) {
  const el = document.getElementById(id);
  if (!el) return false;

  const offset = options?.offset ?? -80; // default: clear the top bar
  const top = el.getBoundingClientRect().top + window.scrollY + offset;

  // Find the scrollable container (Next.js app uses main#main-content as scroller)
  const scroller = document.getElementById('main-content') ?? window;

  if (scroller instanceof Window) {
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  } else {
    // main-content is the overflow-y-auto container in the app layout
    const containerTop = scroller.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top;
    const scrollTarget = scroller.scrollTop + (elTop - containerTop) + offset;
    scroller.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
  }

  // Focus the element for accessibility
  el.setAttribute('tabindex', el.getAttribute('tabindex') ?? '-1');
  el.focus({ preventScroll: true });

  return true;
}

/**
 * navigateWithScroll — navigate to a route and, after mount, scroll to a section.
 * Stores the target id in sessionStorage so the destination page can pick it up.
 */
export function navigateWithScroll(id: string) {
  sessionStorage.setItem('deh_scroll_target', id);
}

/**
 * consumeScrollTarget — reads and clears the pending scroll target.
 * Call this inside a useEffect on the destination page.
 */
export function consumeScrollTarget(): string | null {
  const target = sessionStorage.getItem('deh_scroll_target');
  if (target) sessionStorage.removeItem('deh_scroll_target');
  return target;
}
