/** Audit log filters (shared by the server page and the client view). */
export type AuditFilters = { from: string; to: string; actorId: string; action: string; entityType: string; q: string };

/** Last 30 days up to today (Dubai). */
export function defaultAuditFilters(today: string): AuditFilters {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
  return { from, to: today, actorId: "", action: "", entityType: "", q: "" };
}

export function auditQueryString(f: AuditFilters, cursor?: string): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  if (cursor) p.set("cursor", cursor);
  return p.toString();
}
