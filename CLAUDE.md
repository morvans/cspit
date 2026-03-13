# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server with Turbopack
npm run build     # Generate Prisma client + production build
npm run lint      # Run ESLint
```

Since the dev environment runs in Docker:
```bash
docker-compose up                                       # Start full stack (app + MongoDB)
docker-compose run --rm app npm install <package>       # Install packages
docker-compose run --rm app npx prisma generate         # Regenerate Prisma client
docker-compose run --rm app npx prisma db push          # Push schema changes to DB
docker-compose exec app sh                              # Shell into running container
```

There are no automated tests.

## Architecture

**CSP Violation Reporter** — a Next.js 15 full-stack app that collects and displays Content Security Policy violation reports. Uses the App Router with TypeScript, MongoDB + Prisma ORM, NextAuth.js (Google OAuth), and shadcn/ui (Radix UI + Tailwind CSS 4).

### Key directories

- `src/app/` — Next.js App Router pages and API routes
- `src/app/api/` — All API handlers
- `src/components/ui/` — shadcn/ui component library (don't edit manually)
- `src/lib/auth.ts` — NextAuth configuration and session helpers
- `prisma/schema.prisma` — Database schema

### Data model

**Endpoint** — a named reporting endpoint with a unique CUID `token`. Each endpoint is separate so multiple websites can report to the same instance.

**Report** — unified model covering both legacy CSP reports and modern Reporting API reports. The `type` field distinguishes them (`"csp-violation"` vs `"deprecation"`, `"intervention"`, etc.). CSP reports use dedicated flat fields; Reporting API reports use the generic `url`/`body`/`age` fields.

### API routes

| Route | Purpose |
|-------|---------|
| `POST /api/report/[endpoint]` | Legacy CSP report receiver (per-endpoint) |
| `POST /api/v1/report/[endpoint]` | Unified receiver — handles both legacy CSP (`application/csp-report`) and modern Reporting API (`application/reports+json`) based on `Content-Type` |
| `GET /api/reports` | Fetch reports with filtering: `endpoint`, `type` (csp/generic/all), `page`, `limit`, `timeRange` |
| `GET/POST/DELETE /api/endpoints` | Manage reporting endpoints |

### Authentication

Dashboard (`/`) is protected — requires NextAuth session. Sign-in via Google OAuth. API report-receiving routes are unprotected (open to browsers). Management routes (`/api/endpoints`) are protected by session.

### Environment variables

```
DATABASE_URL        # MongoDB connection string (needs replicaSet for Prisma transactions)
NEXTAUTH_URL        # App base URL
NEXTAUTH_SECRET     # NextAuth secret
GOOGLE_CLIENT_ID    # Google OAuth
GOOGLE_CLIENT_SECRET
```
