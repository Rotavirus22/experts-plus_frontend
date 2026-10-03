import "server-only";
import type { AccessProfile, Permission } from "@xperts/shared";
import { hasPermission } from "@xperts/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** Calls the backend from server components, forwarding the user's cookies. */
export async function serverApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    ...init,
    headers: { ...init.headers, cookie: cookieHeader, "content-type": "application/json" },
    cache: "no-store",
  });
  if (res.status === 401) redirect("/login");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new ApiError(res.status, body.message ?? res.statusText, body.code);
  }
  return (await res.json()) as T;
}

export interface Me {
  userId: string;
  name: string;
  email: string;
  roleName: string | null;
  access: AccessProfile;
}

export const getMe = () => serverApi<Me>("/me");

/** Page-level guard. The backend still enforces the same permission on every API call. */
export async function requirePagePermission(permission: Permission): Promise<Me> {
  const me = await getMe();
  if (!hasPermission(me.access, permission)) redirect("/?denied=1");
  return me;
}
