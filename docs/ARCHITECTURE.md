# Architecture

This document is written before any code. It records what the system is, how it is shaped,
and, for every non-obvious decision, *why* that option was chosen over the alternatives.
Later documents (README, API reference, assumptions) build on it.

---

## 1. What we are building

A transaction ledger: accounts hold a balance; credits and debits move that balance;
every movement is recorded as an immutable transaction. A bonus endpoint transfers money
between two accounts atomically.

The hard requirements are not the endpoints, they are the *invariants*:

| Invariant | Meaning |
|---|---|
| **Balance consistency** | `account.balance == SUM(credits) - SUM(debits)` for that account, always. |
| **No overdraft** | A debit that would take the balance below zero is rejected and leaves no trace. |
| **Idempotent references** | `(account_id, reference_id)` is unique; a replay never creates a second row or moves the balance. |
| **Immutability** | A persisted transaction can never be edited or deleted through the API. |
| **Atomicity** | "Insert transaction" and "update balance" succeed together or not at all. Transfers: both legs or neither. |

Every architectural choice below is justified against these invariants first and developer
ergonomics second.

---

## 2. Stack and the reasons behind it

### 2.1 TypeScript on Node 20, end to end
**Decision:** Backend in TypeScript (Node 20 LTS), frontend in TypeScript (Next.js).

**Why:** One language across the stack means one set of types for the API contract, one
toolchain, and one mental model for a reviewer. Node's single-threaded event loop is a good
fit for an I/O-bound API where the database does the heavy lifting.

**Alternatives considered:** Go (excellent for this, but a second language next to the
required Next.js frontend adds friction for a 3-4 hour exercise); Python/FastAPI (fine, same
objection).

### 2.2 Express 5
**Decision:** Express 5 as the HTTP layer.

**Why:** Express 5 finally propagates rejected promises from async handlers to the error
middleware, which removes the `try/catch` boilerplate that made Express 4 noisy. It is small,
unopinionated, and universally understood, so the project structure is *ours*, not the
framework's. That matters here because the assessment asks for a clean, maintainable layout
and I want that layout to be legible on its own.

**Alternatives considered:** NestJS (brings DI, decorators and modules, but the ceremony
dwarfs a five-endpoint API and hides the design decisions I want to show); Fastify (great
performance and built-in JSON-schema validation, but I prefer Zod for validation because the
inferred TypeScript types flow into the service layer for free).

### 2.3 PostgreSQL
**Decision:** PostgreSQL 14+ as the only datastore.

**Why:** A ledger is the textbook relational workload. Every invariant above maps to a
PostgreSQL feature:

- Atomicity → ACID transactions.
- No overdraft under concurrency → row-level locks (`SELECT ... FOR UPDATE`) plus a
  `CHECK (balance >= 0)` constraint as a last line of defense.
- Idempotent references → `UNIQUE (account_id, reference_id)`.
- Immutability → a trigger that raises on `UPDATE`/`DELETE` of `transactions`, so even a
  bug or a stray SQL console session cannot mutate history.
- Exact money → `NUMERIC`, no floating point.

**Alternatives considered:** SQLite (zero setup, but weaker concurrency story and no
`FOR UPDATE`; the "under load" guarantees would be the app's problem instead of the
database's); MongoDB (multi-document transactions exist, but the constraint and trigger
vocabulary is far thinner, so integrity would live in application code, which is exactly
what the assessment tells us to avoid).

### 2.4 Prisma 6 (pinned to the 6.x line)
**Decision:** Prisma for schema, migrations and the typed query client; raw SQL where Prisma
has no abstraction (row locks, triggers, check constraints).

**Why:** Prisma gives a single source of truth for the schema, generates types that make
the repository layer safe, and its migration tool lets me check in plain SQL migrations
for the parts Prisma does not model (triggers, `CHECK`s). The `$transaction` callback API
is a clean unit-of-work for the atomic paths.

**Why 6.x and not 7:** Prisma 7 rewrote configuration and the driver model. It is stable,
but a reviewer cloning this in six months is more likely to have a smooth `npm install &&
prisma migrate` with the long-lived 6.x line. Boring is a feature in infrastructure.

**Alternatives considered:** Plain `pg` + hand-written SQL (maximum control, but we would
re-implement migrations and lose type inference); Drizzle (good, but less universally known).

### 2.5 Zod for validation
**Decision:** Every request body, path param and query string is parsed by a Zod schema
before it reaches a controller.

**Why:** Validation should happen once, at the boundary, and the rest of the code should
work with *already-trusted* typed data. Zod schemas double as the TypeScript types of our
DTOs, so there is no drift between "what we validate" and "what we think we have". Zod error
issues map cleanly into the consistent error envelope (section 5).

### 2.6 Vitest + Supertest, against a real database
**Decision:** Integration tests run the HTTP app against a real PostgreSQL test database.

**Why:** The properties under test (locks, unique constraints, triggers, rollback) *live in
the database*. A mocked repository would make those tests green while proving nothing. The
test suite therefore includes a concurrency test that fires parallel debits at one account
and asserts that exactly the affordable subset succeeded and the balance is exact.

### 2.7 Next.js (App Router) + Tailwind for the UI
**Decision:** A small Next.js app that is a thin client over the API.

**Why:** Required by the brief. App Router server components fetch from the API with no
client-side state library, which keeps the UI honest: the API is the single source of truth
and the UI never computes a balance itself.

---

## 3. Project layout

```
.
├── docs/                      # ARCHITECTURE, API, ASSUMPTIONS
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # data model
│   │   └── migrations/        # SQL migrations incl. triggers/CHECKs
│   ├── src/
│   │   ├── app.ts             # express app factory (no listen) -> testable
│   │   ├── server.ts          # entrypoint: config + listen
│   │   ├── config/env.ts      # typed env parsing (fail fast)
│   │   ├── lib/
│   │   │   ├── prisma.ts      # single PrismaClient
│   │   │   ├── errors.ts      # AppError hierarchy + error codes
│   │   │   ├── money.ts       # Decimal helpers, serialization
│   │   │   └── pagination.ts  # page/limit parsing + meta builder
│   │   ├── middleware/
│   │   │   ├── validate.ts    # zod -> req.validated
│   │   │   ├── error-handler.ts
│   │   │   └── not-found.ts
│   │   └── modules/
│   │       ├── accounts/      # router, controller, service, repository, schemas
│   │       ├── transactions/
│   │       └── transfers/
│   └── tests/                 # integration tests (vitest + supertest)
├── frontend/                  # Next.js app
└── docker-compose.yml         # postgres + api + web
```

### 3.1 Layering inside a module (and why four layers for a small app)

```
HTTP ──▶ router ──▶ controller ──▶ service ──▶ repository ──▶ PostgreSQL
          (routes)   (HTTP in/out)  (rules)     (SQL only)
```

- **Router** wires paths to controllers and attaches validation schemas. No logic.
- **Controller** translates HTTP to a service call and the result back to HTTP (status
  codes, response shape). It never touches Prisma.
- **Service** owns business rules and transaction boundaries: "a debit needs sufficient
  funds", "a transfer is two legs under one lock set". This is the layer the tests care about.
- **Repository** is the only place that knows SQL/Prisma. It accepts an optional
  transaction client so the service can compose several repository calls into one unit
  of work.

**Why bother for five endpoints:** the assessment is explicit about maintainability, and the
rules in the service layer are the thing most likely to grow (fees, limits, holds, multi-
currency). Keeping them free of HTTP and SQL details means each can be unit-tested and
changed in isolation. It is the cheapest form of future-proofing: four small files per
module rather than one tangled one.

### 3.2 Patterns used, and what each buys us

| Pattern | Where | Why |
|---|---|---|
| **Layered architecture** | every module | separation of HTTP, rules and persistence (above) |
| **Repository** | `*.repository.ts` | isolates Prisma; services are testable without SQL knowledge |
| **Unit of Work** | `prisma.$transaction(async tx => …)` passed into repositories | one commit/rollback boundary for "insert + update balance" |
| **App factory** | `createApp()` in `app.ts` | tests build an app without binding a port |
| **Constructor injection (manual)** | services receive repositories | explicit wiring, no DI container, trivial to swap in tests |
| **Domain errors → HTTP mapping** | `AppError` subclasses + one error middleware | services throw meaning (`InsufficientBalance`), not status codes; mapping happens once |
| **Schema-first DTOs** | Zod schemas | validation and types from one definition |

---

## 4. Data model

```
accounts                               transactions
────────────────────────────────       ───────────────────────────────────────────
id           uuid PK                   id            uuid PK
name         text NOT NULL             account_id    uuid FK -> accounts(id)
balance      numeric(19,4) NOT NULL    type          enum('credit','debit')
             DEFAULT 0                 amount        numeric(19,4) CHECK (amount > 0)
             CHECK (balance >= 0)      description   text
created_at   timestamptz NOT NULL      reference_id  text NOT NULL
updated_at   timestamptz NOT NULL      transfer_id   uuid NULL FK -> transfers(id)
                                       created_at    timestamptz NOT NULL
                                       UNIQUE (account_id, reference_id)
                                       INDEX (account_id, created_at DESC, id DESC)

transfers
────────────────────────────────
id               uuid PK
from_account_id  uuid FK
to_account_id    uuid FK   CHECK (from_account_id <> to_account_id)
amount           numeric(19,4) CHECK (amount > 0)
reference_id     text NOT NULL
description      text
created_at       timestamptz NOT NULL
```

### 4.1 Why store `balance` at all (instead of summing transactions)?
The brief lists `balance` as a field of the account and asks for a balance endpoint. A
denormalised balance makes reads O(1) and makes the "insufficient funds" check a simple
comparison under a row lock. The risk of denormalisation is drift, which we eliminate by
updating the balance in the *same database transaction* as the insert and by never
allowing a transaction row to change (trigger). The test suite also asserts the
`balance == SUM(ledger)` identity directly.

### 4.2 Why `NUMERIC(19,4)` and string amounts in JSON
Floating point cannot represent `0.1 + 0.2` exactly; a ledger cannot tolerate that.
`NUMERIC` is exact. Four decimal places leaves headroom for future fees/FX while the API
accepts and validates at most two decimal places. Amounts are serialised as **strings**
(`"100.00"`) because JSON numbers are IEEE doubles and would reintroduce the problem on
the wire.

*Alternative considered:* integer minor units (cents). Equally exact and slightly faster,
but every client then has to divide by 100 and the API reads unnaturally (`amount: 10000`).
For a human-facing ledger API, decimal strings are the friendlier contract.

### 4.3 Why UUIDs
Generated by the database (`gen_random_uuid()`), unguessable, safe to generate in parallel,
and they let the API return `201` with an id without a round trip. Sequential integers leak
volume and invite enumeration.

### 4.4 Why `transfer_id` on transactions
A transfer is one business action producing two ledger rows. Linking both rows to one
`transfers` record keeps the ledger honest (every row is still a plain credit or debit) while
making the pairing queryable, which an auditor would ask for.

---

## 5. Request flow for a debit (the critical path)

```
POST /accounts/:id/transactions  { type:"debit", amount:"30.00", reference_id:"ref-1", … }
 │
 ├─ validate (zod): type ∈ {credit,debit}, amount > 0 with ≤2 dp, reference_id non-empty
 │
 └─ TransactionService.create()
      └─ prisma.$transaction(async tx => {
           1. SELECT * FROM accounts WHERE id = $1 FOR UPDATE   -- serialises this account
              └─ none → throw AccountNotFound (404)
           2. if debit and balance < amount → throw InsufficientBalance (422)
           3. INSERT INTO transactions (...)                   -- UNIQUE(account_id, reference_id)
              └─ unique violation → throw DuplicateTransaction (409)
           4. UPDATE accounts SET balance = balance ± amount   -- CHECK(balance >= 0) backstop
         })
      -- any throw ⇒ ROLLBACK ⇒ nothing persisted, balance untouched
```

### 5.1 Why a pessimistic row lock
Two concurrent debits of 70 against a balance of 100 must not both succeed. With
`FOR UPDATE` the second request blocks until the first commits, then re-reads the balance
(30) and is rejected with a *meaningful* error. The alternative, optimistic
`UPDATE … WHERE balance >= amount`, is also correct but reports failure as "0 rows
affected", which has to be reverse-engineered into an error. The lock costs nothing
measurable at this scale and yields clearer code.

### 5.2 Why rely on the UNIQUE constraint for duplicates instead of check-then-insert
A `SELECT` followed by an `INSERT` has a race window; the constraint does not. We insert
and translate PostgreSQL error `23505` into a 409. The database is the arbiter.

### 5.3 Why rejected transactions are not persisted
The brief says a failed transaction "must not affect the account balance". The simplest
proof of that is that it never reaches the database: the whole unit of work rolls back.
Persisting rejected attempts with a `status = failed` column was considered and declined
because it would (a) consume the `reference_id` for a retry and (b) force every balance
query to filter by status. If an audit log of attempts is wanted later, it belongs in a
separate append-only table, not in the ledger.

### 5.4 Transfers: lock ordering
A transfer locks *both* accounts. Two opposite transfers (A→B and B→A) could deadlock if
each locked its source first. We lock in ascending `id` order regardless of direction, which
makes deadlock impossible. Both legs share one `reference_id` (allowed, since uniqueness is
per account) and one `transfer_id`.

---

## 6. Error model

All errors share one envelope so clients write one handler:

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Account balance 100.00 is less than debit amount 150.00",
    "details": { "balance": "100.00", "requested": "150.00" }
  }
}
```

| HTTP | code | when |
|---|---|---|
| 400 | `VALIDATION_ERROR` | body/params/query fail schema (details lists each issue) |
| 400 | `INVALID_PAGINATION` | page/limit out of range or not integers |
| 404 | `ACCOUNT_NOT_FOUND` | unknown account id |
| 404 | `NOT_FOUND` | unknown route |
| 409 | `DUPLICATE_TRANSACTION` | reference_id already used for this account |
| 422 | `INSUFFICIENT_BALANCE` | debit exceeds balance |
| 422 | `SAME_ACCOUNT_TRANSFER` | transfer source == destination |
| 500 | `INTERNAL_ERROR` | anything unexpected (message is generic, details logged) |

**Why 422 for insufficient balance rather than 400:** the request is syntactically valid; it
fails a business rule given the current state. 422 "Unprocessable Content" is the status
for exactly that. 409 for duplicates because the request conflicts with existing state.

---

## 7. Pagination and ordering

`GET /accounts/:id/transactions?type=debit&page=2&limit=20`

- Offset pagination (`page`, `limit`) because the brief asks for `total_pages`, which needs a
  `COUNT(*)` anyway; cursor pagination would be premature here.
- `limit` defaults to 20 and is capped at 100 to protect the database.
- Ordering is `created_at DESC, id DESC`. The `id` tiebreaker makes the order stable when two
  rows share a timestamp, so a client paging through never sees a row twice or skips one.
- A composite index `(account_id, created_at DESC, id DESC)` serves both the filter and the
  sort.

Response:

```json
{
  "data": [ …transactions… ],
  "pagination": { "page": 2, "limit": 20, "total_records": 57, "total_pages": 3 }
}
```

---

## 8. Immutability, enforced twice

1. **API surface:** there is no `PUT`, `PATCH` or `DELETE` route for transactions. The
   router simply does not define them, so they 404.
2. **Database:** a `BEFORE UPDATE OR DELETE` trigger on `transactions` raises an exception.
   This protects against future code, migrations, or a human with a SQL console.

Belt and braces: the first protects the contract, the second protects the data.

---

## 9. Operational concerns

- **Configuration** via environment variables parsed by Zod at startup. Missing or malformed
  config fails fast with a clear message rather than at the first request.
- **Logging** with `pino` (structured JSON), request logging via `pino-http`; errors are
  logged with the request id so a 500 in the envelope can be matched to a log line.
- **Health** endpoint `GET /health` pings the database, for compose/orchestrator checks.
- **Security headers** via `helmet`; CORS limited to the frontend origin.
- **Graceful shutdown** disconnects Prisma on `SIGTERM`.
- **Local run**: `docker compose up` starts postgres, API and web; or run against any
  Postgres with `DATABASE_URL`.

---

## 10. What was deliberately left out

- Authentication/authorisation: not in the brief; the API is assumed to sit behind a trusted
  gateway. Adding an auth middleware would not change any layer below the router.
- Multi-currency: `NUMERIC(19,4)` leaves room, but a `currency` column and per-currency
  rules are out of scope.
- Soft deletes/archiving of accounts: not requested; deleting an account with history would
  violate ledger integrity anyway.
- Event publishing/outbox: a real ledger would emit events; a 3-4 hour brief should not.
