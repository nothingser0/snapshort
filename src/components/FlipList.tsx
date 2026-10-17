'use client';

import React, { useLayoutEffect, useRef } from 'react';

/**
 * Animates list items to their new positions when the order changes (FLIP).
 *
 * Each direct child must carry `data-flip-key` with a stable id. Positions are
 * measured before and after the render, then each moved item is offset back to
 * where it was and released, so it slides into place. Uses inline styles so no
 * keyframes have to be declared globally.
 */
export function FlipList({
  children,
  className,
  orderKey,
}: {
  children: React.ReactNode;
  className?: string;
  orderKey: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previous = useRef<Map<string, { x: number; y: number }>>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = Array.from(container.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement
    );

    const next = new Map<string, { x: number; y: number }>();
    for (const item of items) {
      const key = item.dataset.flipKey;
      if (!key) continue;
      const rect = item.getBoundingClientRect();
      next.set(key, { x: rect.left, y: rect.top });
    }

    for (const item of items) {
      const key = item.dataset.flipKey;
      if (!key) continue;
      const before = previous.current.get(key);
      const after = next.get(key);
      if (!before || !after) continue;

      const dx = before.x - after.x;
      const dy = before.y - after.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

      item.style.transition = 'none';
      item.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        item.style.transition = 'transform 220ms cubic-bezier(0.2, 0, 0, 1)';
        item.style.transform = '';
      });
    }

    previous.current = next;
  }, [orderKey]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
