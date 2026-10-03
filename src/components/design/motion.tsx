"use client";

import type { OccupancyDto } from "@xperts/shared";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Fade-and-rise entrance with a capped stagger. Reduced motion: opacity only. */
export function FadeIn({ index = 0, className, children }: { index?: number; className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE, delay: Math.min(index, 8) * 0.04 }}
    >
      {children}
    </motion.div>
  );
}

/** Segmented bar: occupied / held / vacant with 2px gaps, growing from the left. */
export function OccupancyBar({ occupancy, className, height = 10 }: { occupancy: OccupancyDto; className?: string; height?: number }) {
  const reduce = useReducedMotion();
  const parts = [
    { key: "occupied", value: occupancy.occupied, className: "bg-status-occupied" },
    { key: "held", value: occupancy.held, className: "bg-status-held" },
    { key: "vacant", value: occupancy.vacant, className: "bg-status-vacant" },
  ].filter((p) => p.value > 0);
  return (
    <motion.div
      role="img"
      aria-label={`${occupancy.occupied} occupied, ${occupancy.held} held, ${occupancy.vacant} vacant of ${occupancy.beds} beds`}
      className={cn("flex w-full origin-left gap-[2px] overflow-hidden rounded-full bg-muted", className)}
      style={{ height }}
      initial={reduce ? { opacity: 0 } : { scaleX: 0 }}
      animate={reduce ? { opacity: 1 } : { scaleX: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      {parts.map((p) => (
        <div key={p.key} className={cn("h-full first:rounded-l-full last:rounded-r-full", p.className)} style={{ flexGrow: p.value, flexBasis: 0 }} />
      ))}
    </motion.div>
  );
}
