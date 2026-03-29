'use client';

/**
 * useScrollTarget — on mount, checks if a scroll target was stored by
 * navigateWithScroll() and smooth-scrolls to it.
 *
 * Drop this in any page that has scrollable sections:
 *   useScrollTarget();
 */

import { useEffect } from 'react';
import { consumeScrollTarget, smoothScrollTo } from '@/lib/scrollTo';

export function useScrollTarget(delay = 120) {
  useEffect(() => {
    const target = consumeScrollTarget();
    if (!target) return;

    // Small delay so the page has time to paint before we scroll
    const t = setTimeout(() => smoothScrollTo(target), delay);
    return () => clearTimeout(t);
  }, [delay]);
}
