# Camps Management — deploy & operations runbook

| Piece | Where | Notes |
|---|---|---|
| Frontend (Next.js) | Vercel project `experts-plus-frontend` → https://experts-plus-frontend.vercel.app | Deploys automatically on every push to `Rotavirus22/experts-plus_frontend` `main`. Env: `BACKEND_URL`. |
| Backend (NestJS) | Heroku app `xperts-camps-api` (EU, Basic dyno, always on) | Deployed by `git push` to Heroku (see below). |
| Database | MongoDB Atlas `Cluster0`, database `xperts` | Free tier: **no automatic backups** — the backend repo's GitHub Action takes one daily. |

The browser only talks to Vercel. Vercel rewrites `/api/*` to Heroku, so auth cookies are first-party.

## Configuration

Heroku config vars (`heroku config -a xperts-camps-api`):

| Var | Value |
|---|---|
| `DATABASE_URL` | Atlas connection string (`…/xperts?retryWrites=true&w=majority`) |
| `BETTER_AUTH_SECRET` | Long random string. Changing it signs everyone out. |
| `BETTER_AUTH_URL` | `https://camps.rohanpokhrel.com.np` (the public URL users open) |
| `FRONTEND_ORIGIN` | Comma-separated addresses allowed to sign in: `https://camps.rohanpokhrel.com.np,https://experts-plus-frontend.vercel.app` |
| `NODE_ENV` | `production` (turns on sign-in rate limiting) |

Vercel: `BACKEND_URL=https://xperts-camps-api-ed786a496638.herokuapp.com` (Production and Preview).

If the domain changes, set it in Vercel, then update `BETTER_AUTH_URL` and add it to `FRONTEND_ORIGIN` on Heroku (otherwise sign-in fails with "Invalid origin").

## Deploying

**Frontend:** push to the frontend repo `main`. Vercel builds and goes live (≈1–2 min).

**Backend:**

```bash
git push origin main                               # GitHub (source of truth)
git push https://git.heroku.com/xperts-camps-api.git main   # Heroku builds and releases
```

On Windows the Git credential manager can block Heroku; push with the CLI token instead:
`git -c credential.helper= push "https://heroku:$(heroku auth:token)@git.heroku.com/xperts-camps-api.git" main`.

After changing `prisma/schema.prisma` or `src/database/ensure-indexes.ts`, sync the database once
(with `DATABASE_URL` pointing at Atlas): `npm run db:sync`.

Rollback: `heroku releases -a xperts-camps-api` then `heroku rollback vNN -a xperts-camps-api`.
Vercel: Deployments → pick the previous one → *Promote to Production*.

## Health and monitoring

- `GET https://xperts-camps-api-ed786a496638.herokuapp.com/api/health` — app is up.
- `GET …/api/health?deep=1` — also pings the database (503 if it can't).
- Point a free uptime monitor (e.g. UptimeRobot, every 5 min) at the `?deep=1` URL to be emailed if it goes down.
- Logs: `heroku logs --tail -a xperts-camps-api`.

## Backups and restore

The backend repo runs **Database backup** daily at 03:00 Dubai (`.github/workflows/db-backup.yml`) and keeps a
gzip archive for 30 days (GitHub → Actions → the run → Artifacts). It needs the repository secret
`DATABASE_URL` (Settings → Secrets and variables → Actions). Run it any time with *Run workflow*.

Restore (replaces the collections in the target database — test on a scratch database first):

```bash
# MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools
mongorestore --uri="<connection string>" --gzip --archive=camps-YYYY-MM-DD.archive.gz --drop
```

## Security notes

- Sign-in is rate limited (10 attempts/min per IP) in production; helmet sets security headers on the API and
  Next.js sets frame/sniffing/referrer/permissions headers on every page.
- Sessions end after 1 day without activity; users can see and sign out their devices on **My account**.
- Rotate secrets if they are ever shared: change the Atlas database user password, then
  `heroku config:set DATABASE_URL=… -a xperts-camps-api` and update the GitHub `DATABASE_URL` secret.
- Atlas network access currently allows any IP (Heroku has no fixed IPs); access is protected by the database
  password, so keep it long and private.

## Starting a fresh database

```bash
ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" npm run db:init-clean -- --reset   # wipes ALL app data
```
