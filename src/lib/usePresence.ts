'use client';

import { useEffect, useState } from 'react';

/**
 * Keeps an element mounted long enough to play its exit transition.
 *
 * - `mounted`: render the element at all.
 * - `active`: drives the enter/exit utility classes (opacity/scale/translate).
 *
 * Only Tailwind utilities are used, so no global keyframes are required.
 */
export function usePresence(
  visible: boolean,
  duration = 160
): { mounted: boolean; active: boolean } {
  const [mounted, setMounted] = useState(visible);
  const [active, setActive] = useState(false);
  const [prevVisible, setPrevVisible] = useState(visible);

  // Adjusting state during render is React's documented pattern for reacting to
  // a prop change without an extra commit. `mounted` releases on a timer instead,
  // so the exit transition has time to play.
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setMounted(true);
    else setActive(false);
  }

  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => setMounted(false), duration);
      return () => clearTimeout(timer);
    }

    // Two frames: the element must be painted once in its "hidden" state,
    // otherwise it is created already active and the transition never runs.
    // The forced reflow makes sure that base state is computed before switching.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      void document.body.offsetHeight;
      inner = requestAnimationFrame(() => setActive(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [visible, duration]);

  return { mounted, active };
}
