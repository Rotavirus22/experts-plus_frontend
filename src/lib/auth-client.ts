import { createAuthClient } from "better-auth/react";

/** Same-origin: /api/auth is rewritten to the backend by next.config.ts. */
export const authClient = createAuthClient();
