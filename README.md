# Xperts Camps — frontend

Web UI for Xperts Camps, the internal camp, room and bed management app for Xperts Recruitment (UAE).
Next.js 16 (App Router) · Tailwind v4 · shadcn/ui (Base UI) · TanStack Table · React Hook Form + Zod · motion.

The API lives in [experts-plus_backend](https://github.com/Rotavirus22/experts-plus_backend).

## Setup

```bash
cp .env.example .env.local   # BACKEND_URL=http://localhost:4000
npm install                  # also builds ./shared
npm run dev                  # http://localhost:3000
```

The browser only talks to this app: `/api/*` (including `/api/auth/*`) is rewritten to `BACKEND_URL`, so auth
cookies are first-party and there is no CORS. The backend must be running.

## Build and checks

```bash
npm run build && npm start
npm run typecheck && npm run lint
```

## Notes

- Route protection is `src/proxy.ts` (Next.js 16), not `middleware.ts`.
- Design tokens are in `src/app/globals.css`; the design handoff and screenshots are in `docs/design/`.
- `shared/` holds the domain rules and schemas shared with the backend. The backend repo keeps an identical copy —
  when you change `shared/`, copy the change to the other repo.
