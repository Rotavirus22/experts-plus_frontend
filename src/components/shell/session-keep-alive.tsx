"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

/** How often an open tab confirms the session (the backend extends it at most every 10 minutes anyway). */
const CHECK_EVERY_MS = 10 * 60 * 1000;

/**
 * Keeps an active user signed in: the session expires after 1 day without activity and slides forward on use.
 * Pages rendered on the server can't refresh the browser cookie, so while the app is open and visible this
 * checks the session on load, when the tab regains focus, and every 10 minutes. If the session has ended
 * (1 day idle, deactivated, password reset) it goes to the login page instead of failing on the next click.
 */
export function SessionKeepAlive() {
  useEffect(() => {
    let last = 0;
    let stopped = false;

    async function check() {
      if (stopped || document.visibilityState !== "visible" || Date.now() - last < 30_000) return;
      last = Date.now();
      const { data, error } = await authClient.getSession();
      if (stopped || error) return; // network blips: try again later
      if (!data) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/login?next=${next}`);
      }
    }

    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  return null;
}
