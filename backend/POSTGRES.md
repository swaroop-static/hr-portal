# PostgreSQL Production Guide

## When to use PostgreSQL

Use PostgreSQL for production deployments, multi-instance setups, or anywhere you need concurrent writes, row-level locking, or connection pooling. Local development and all automated tests continue to use SQLite — no code changes are required when switching environments.

## Required environment variable

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

For managed services the connection string is provided by the platform dashboard (Render, Railway, Supabase, etc.).

## Schema file

The PostgreSQL schema lives at `prisma/schema.postgres.prisma`. It is identical to `prisma/schema.prisma` except for the datasource provider. JSON fields remain `String` columns — the application layer serialises/deserialises them; no route changes are needed.

## First-time setup (development / staging)

```bash
# Create the initial migration from the schema
npm run migrate:dev
```

Prisma will prompt for a migration name (e.g. `init`), create a `prisma/migrations/` folder, and apply it to the target database.

## Deploying to production

```bash
# Apply all pending migrations — safe for CI/CD pipelines, no interactive prompts
npm run migrate:prod
```

Run this as part of your release process before starting the server.

## Regenerate the Prisma client after schema changes

```bash
npm run generate:postgres
```

This regenerates `@prisma/client` from the PostgreSQL schema so the client types match.

## Push schema without migrations (quick sync)

```bash
npm run db:push:postgres
```

Useful for prototyping on a throwaway database. Do not use in production — prefer `migrate:prod` there.

## Docker Compose

Add a `docker-compose.yml` at the repo root:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: hrportal
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: hr_portal
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

Then set `DATABASE_URL=postgresql://hrportal:secret@localhost:5432/hr_portal` in `backend/.env` and run `npm run migrate:dev`.

## Render / Railway deployment

1. Create a PostgreSQL database in the platform dashboard.
2. Copy the connection string it provides into the `DATABASE_URL` environment variable for your web service.
3. Add a pre-deploy or release command: `npm run migrate:prod`.
4. Deploy — the server will start against PostgreSQL automatically.

## What stays the same

- `prisma/schema.prisma` (SQLite) — unchanged; used by `npm run db:push` and all tests.
- All route files, middleware, and application logic — no changes needed.
- `src/__tests__/createTestDb.mjs` — still provisions a fresh SQLite `test.db` before each test run.
