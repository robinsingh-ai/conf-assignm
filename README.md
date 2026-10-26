# Transaction Ledger

A small, correct ledger: create accounts, post credits and debits, read balances and
paginated history, and transfer money between accounts atomically. Built as a Full Stack
Developer assessment.

| Layer | Tech |
|---|---|
| API | Node 20, TypeScript, Express 5, Prisma 6, Zod, pino |
| Database | PostgreSQL 14+ |
| UI | Next.js (App Router), TypeScript, Tailwind CSS |
| Tests | Vitest + Supertest against a real PostgreSQL |

Documentation:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): the design and the reasoning behind every decision
- [docs/API.md](docs/API.md): endpoint reference with request/response examples
- [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md): where the brief was open to interpretation and what was chosen
- `http://localhost:4000/docs`: interactive Swagger UI once the API is running

---

## Quick start (Docker, one command)

Requires Docker with Compose.

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Web UI | http://localhost:3000 |
| API | http://localhost:4000 |
| Swagger UI | http://localhost:4000/docs |
| PostgreSQL | localhost:5432 (`postgres` / `postgres`, db `ledger`) |

Migrations run automatically when the API container starts. Stop with `Ctrl+C`; add `-v`
to `docker compose down` to also drop the database volume.

---

## Running locally without Docker

You need Node 20+, npm 10+ and a PostgreSQL 14+ you can connect to.

### 1. Database

Create two databases, one for the app and one for tests:

```bash
createdb ledger && createdb ledger_test
```

(or `psql -c "CREATE DATABASE ledger;" -c "CREATE DATABASE ledger_test;"`)

### 2. API

```bash
cd backend
cp .env.example .env            # edit DATABASE_URL if your Postgres differs
npm install
npm run db:migrate              # applies prisma/migrations
npm run dev                     # http://localhost:4000
```

Useful scripts:

| Script | What it does |
|---|---|
| `npm run dev` | start with hot reload (tsx watch) |
| `npm run build` / `npm start` | compile to `dist/` and run |
| `npm run db:migrate` | apply migrations (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | create a new migration from schema changes |
| `npm run db:studio` | open Prisma Studio |
| `npm test` | integration tests against `TEST_DATABASE_URL` |
| `npm run lint` / `npm run typecheck` | eslint / tsc --noEmit |

### 3. Web UI

```bash
cd frontend
cp .env.example .env.local      # NEXT_PUBLIC_API_URL defaults to http://localhost:4000
npm install
npm run dev                     # http://localhost:3000
```

---

## Environment variables

### backend/.env

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/ledger` | app database |
| `TEST_DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/ledger_test` | used only by `npm test` |
| `PORT` | `4000` | HTTP port |
| `CORS_ORIGIN` | `http://localhost:3000` | allowed browser origin |
| `LOG_LEVEL` | `info` | pino level |
| `NODE_ENV` | `development` | |

### frontend/.env.local

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | where the browser calls the API |
| `API_URL_INTERNAL` | falls back to `NEXT_PUBLIC_API_URL` | where server components call the API (inside Docker: `http://api:4000`) |

---

## A two-minute tour with curl

```bash
# create two accounts
A=$(curl -s -X POST localhost:4000/accounts -H 'content-type: application/json' -d '{"name":"Alice"}' | jq -r .id)
B=$(curl -s -X POST localhost:4000/accounts -H 'content-type: application/json' -d '{"name":"Bob"}'   | jq -r .id)

# credit Alice 100, then debit 30
curl -s -X POST localhost:4000/accounts/$A/transactions -H 'content-type: application/json' \
  -d '{"type":"credit","amount":"100.00","reference_id":"salary-1","description":"Salary"}'
curl -s -X POST localhost:4000/accounts/$A/transactions -H 'content-type: application/json' \
  -d '{"type":"debit","amount":"30.00","reference_id":"coffee-1","description":"Coffee"}'

# replaying the same reference_id -> 409 DUPLICATE_TRANSACTION, balance unchanged
curl -s -X POST localhost:4000/accounts/$A/transactions -H 'content-type: application/json' \
  -d '{"type":"debit","amount":"30.00","reference_id":"coffee-1"}'

# overdraft -> 422 INSUFFICIENT_BALANCE
curl -s -X POST localhost:4000/accounts/$A/transactions -H 'content-type: application/json' \
  -d '{"type":"debit","amount":"500.00","reference_id":"too-much"}'

# balance and history
curl -s localhost:4000/accounts/$A/balance
curl -s "localhost:4000/accounts/$A/transactions?type=debit&page=1&limit=10"

# transfer 50 from Alice to Bob, atomically
curl -s -X POST localhost:4000/transfers -H 'content-type: application/json' \
  -d "{\"from_account_id\":\"$A\",\"to_account_id\":\"$B\",\"amount\":\"50.00\",\"reference_id\":\"tx-1\"}"
```

---

## Tests

```bash
cd backend && npm test
```

The suite runs against a real PostgreSQL (`TEST_DATABASE_URL`), applies the migrations, and
covers: every validation rule, every error code, balance arithmetic, duplicate handling,
immutability (API and trigger), atomic rollback, transfer rollback, pagination/filter/sort,
and a concurrency test that fires parallel debits at one account and asserts the exact
outcome.

---

## Repository layout

```
backend/     Express API (see docs/ARCHITECTURE.md §3 for the module layout)
frontend/    Next.js UI
docs/        architecture, API reference, assumptions
docker-compose.yml
```
