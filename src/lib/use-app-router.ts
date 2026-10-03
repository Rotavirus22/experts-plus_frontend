"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useTransition } from "react";
import { beginWork } from "./api";

/**
 * `useRouter` whose push / replace / refresh run in a transition, so the top progress bar stays visible
 * until the new server data has rendered (not just until the request was sent). `pending` exposes the same.
 * `refresh()` returns a promise that settles once the refreshed data is on screen, so dialogs can stay busy
 * until then and close onto fresh data instead of flashing the old state.
 */
export function useAppRouter() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const waiters = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!pending) {
      for (const resolve of waiters.current.splice(0)) resolve();
      return;
    }
    return beginWork();
  }, [pending]);

  // Settle anything still waiting if the component goes away mid-transition.
  useEffect(() => () => waiters.current.splice(0).forEach((resolve) => resolve()), []);

  return useMemo(
    () => ({
      ...router,
      pending,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => startTransition(() => router.push(href, options)),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) => startTransition(() => router.replace(href, options)),
      refresh: () =>
        new Promise<void>((resolve) => {
          waiters.current.push(resolve);
          startTransition(() => router.refresh());
        }),
    }),
    [router, pending],
  );
}
