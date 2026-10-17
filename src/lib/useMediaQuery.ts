'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query.
 *
 * `useSyncExternalStore` is the SSR-safe way to read a browser API: the server
 * snapshot is returned while prerendering and the real value follows on the
 * client, so hydration never mismatches.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}

/** Desktop layout starts at the `lg` breakpoint (1024px), matching the CSS. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)', true);
}

/**
 * True on touch screens. Used to decide whether hover-revealed controls must be
 * permanently visible and whether HTML5 drag-and-drop is available at all.
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)', false);
}
