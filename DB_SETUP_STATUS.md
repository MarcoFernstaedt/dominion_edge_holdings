# Database setup status

Date checked: 2026-03-25 UTC

## Result

Database setup cannot be completed from the current access level **without installing additional PostgreSQL/runtime tooling or providing an external PostgreSQL instance**.

## What was verified

- Backend expects PostgreSQL via Prisma (`backend/prisma/schema.prisma` uses `provider = "postgresql"`).
- A Prisma migration already exists: `backend/prisma/migrations/20260323031140_initial/migration.sql`.
- Prisma CLI is installed and working in the repo (`npx prisma --version` succeeds).
- `backend/.env` is missing.
- `DATABASE_URL` is not present in the shell environment.
- Local PostgreSQL client/server binaries are **not installed or not on PATH**:
  - `psql` missing
  - `postgres` missing
  - `pg_isready` missing
  - `createdb` missing
- No PostgreSQL service/process was found.
- No Docker/Podman runtime is available to start PostgreSQL in a container.

## Exact blocker

The app requires a reachable PostgreSQL database plus a valid `DATABASE_URL`, but this machine currently has neither:

1. no local PostgreSQL runtime available
2. no container runtime available for an unprivileged Postgres container
3. no existing backend `.env` / `DATABASE_URL` pointing at a remote database

Because of that, Prisma cannot connect or run migrations. Current failure:

```text
Error: Environment variable not found: DATABASE_URL.
```

## What remains to finish later

**Follow-up task:** complete real PostgreSQL setup before treating backend persistence/auth flows as production-ready. This repo is not fully database-configured on the current machine yet.

Choose one path:

### Option A — local PostgreSQL
Install PostgreSQL on the host, start the service, create a database/user, then set:

```env
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/deh_aos?schema=public"
```

Then run:

```bash
cd backend
npm run db:generate
npx prisma migrate deploy
# optional seed if desired
node prisma/seed.js
```

### Option B — external/managed PostgreSQL
Provision a remote Postgres database (Railway, Neon, Supabase, etc.), add the connection string to `backend/.env`, then run the same Prisma commands above.

## Notes

- I did **not** make destructive changes.
- I did **not** create a fake `.env` with placeholder credentials, since that would not produce a working setup.
- If PostgreSQL access is provided later, the repo appears ready for the Prisma migration path.
