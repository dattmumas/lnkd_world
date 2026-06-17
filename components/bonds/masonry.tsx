"use client";

import { motion } from "framer-motion";
import { type JSX, type ReactNode } from "react";

/** Staggered fade-up used across the bonds dashboard. */
export function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.5, ease: "easeOut" as const },
  };
}

interface MasonryProps {
  children: ReactNode;
  className?: string;
}

/**
 * CSS multi-column masonry. Cards flow top-to-bottom down each column and fill
 * gaps automatically regardless of card height — no row-height matching, so no
 * whitespace voids. Column count is responsive: 1 / 2 / 3 at mobile / md / xl.
 */
export function Masonry({ children, className = "" }: MasonryProps): JSX.Element {
  return (
    <div className={`columns-1 lg:columns-2 gap-3 ${className}`}>
      {children}
    </div>
  );
}

interface MasonryItemProps {
  children: ReactNode;
  delay?: number;
}

/** Wraps a panel so it never splits across a column and fades in on mount. */
export function MasonryItem({ children, delay = 0 }: MasonryItemProps): JSX.Element {
  return (
    <motion.div className="mb-3 break-inside-avoid" {...fadeUp(delay)}>
      {children}
    </motion.div>
  );
}
