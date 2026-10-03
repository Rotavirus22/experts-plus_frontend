import type { WorkerListQuery } from "@xperts/shared";

/** Defaults are left out of the URL so links stay short. */
const DEFAULTS: Partial<Record<keyof WorkerListQuery, string>> = {
  status: "ACTIVE",
  leave: "ALL",
  housing: "ALL",
  sort: "employeeCode",
  dir: "asc",
  page: "1",
  pageSize: "50",
};

/** Worker list filters -> URL search params (used by the page, the table and the Excel export link). */
export function toSearchParams(query: Partial<WorkerListQuery>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (DEFAULTS[key as keyof WorkerListQuery] === String(value)) continue;
    params.set(key, String(value));
  }
  return params;
}
