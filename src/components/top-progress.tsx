"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore } from "react";
import { beginWork, subscribeInflight } from "@/lib/api";

/**
 * Thin bar at the top of the window while anything is loading: API calls made through `api()`,
 * router transitions (`useAppRouter`) and link navigations. Appears after 120ms so instant work doesn't flicker.
 */

// ───── store (module-level: one bar per window) ─────

let progress: number | null = null;
const listeners = new Set<() => void>();
let showTimer: number | undefined;
let trickleTimer: number | undefined;
let hideTimer: number | undefined;
let active = false;

function set(value: number | null) {
  progress = value;
  for (const l of listeners) l();
}

function onInflight(count: number) {
  if (count > 0 && !active) {
    active = true;
    window.clearTimeout(hideTimer);
    showTimer = window.setTimeout(() => {
      set(progress ?? 15);
      trickleTimer = window.setInterval(() => set(progress === null ? 15 : progress + (90 - progress) * 0.1), 200);
    }, 120);
  } else if (count === 0 && active) {
    active = false;
    window.clearTimeout(showTimer);
    window.clearInterval(trickleTimer);
    if (progress !== null) {
      set(100);
      hideTimer = window.setTimeout(() => set(null), 300);
    }
  }
}

let wired = false;
function subscribe(listener: () => void) {
  if (!wired) {
    wired = true;
    subscribeInflight(onInflight);
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ───── component ─────

export function TopProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}

let endNavigation: (() => void) | null = null;

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const value = useSyncExternalStore(subscribe, () => progress, () => null);

  // A link navigation has finished once the URL changes.
  useEffect(() => {
    endNavigation?.();
    endNavigation = null;
  }, [pathname, search]);

  // Start on internal link clicks that will change the URL.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      endNavigation?.();
      endNavigation = beginWork();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (value === null) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5" role="progressbar" aria-label="Loading">
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--primary)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${value}%`, opacity: value >= 100 ? 0 : 1 }}
      />
    </div>
  );
}
