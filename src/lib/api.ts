/** Browser-side calls to the backend (same origin via the /api rewrite, cookies included). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

// In-flight work (API calls, router transitions) drives the top progress bar.
let inflight = 0;
const listeners = new Set<(count: number) => void>();

export function subscribeInflight(listener: (count: number) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function track(delta: number) {
  inflight += delta;
  for (const l of listeners) l(inflight);
}

/** Marks background work for the progress bar; call the returned function exactly once when done. */
export function beginWork(): () => void {
  track(1);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    track(-1);
  };
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  track(1);
  try {
    return await request<T>(path, init);
  } finally {
    track(-1);
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown }): Promise<T> {
  // FormData (file uploads) is sent as multipart; the browser sets the boundary header.
  const form = init.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: init.body === undefined || form ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : form ? (init.body as FormData) : JSON.stringify(init.body),
    credentials: "same-origin",
  });
  if (res.status === 401) {
    // Full reload so the server layout re-checks the session.
    window.location.assign(new URL(`/login?next=${encodeURIComponent(window.location.pathname)}`, window.location.origin));
    throw new ApiError(401, "Your session has expired");
  }
  const body = (await res.json().catch(() => ({}))) as { message?: string | string[]; code?: string };
  if (!res.ok) {
    const message = Array.isArray(body.message) ? body.message.join("; ") : body.message;
    throw new ApiError(res.status, message ?? res.statusText, body.code);
  }
  return body as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}
