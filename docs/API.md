# API Reference

Base URL (local): `http://localhost:4000`
Interactive docs: `GET /docs` (Swagger UI) and `GET /openapi.json`.

All request and response bodies are JSON. Money is always a **string** with up to two
decimal places (`"100.00"`), never a JSON number (see ARCHITECTURE §4.2). Timestamps are
ISO-8601 UTC. IDs are UUIDs.

## Conventions

### Success
- `201 Created` for creates, `200 OK` otherwise.
- Resources are returned flat (no `data` wrapper) except list endpoints, which return
  `{ data: [...], pagination: {...} }`.

### Errors
One envelope everywhere:

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Account balance 100.00 is less than debit amount 150.00",
    "details": { "balance": "100.00", "requested": "150.00" }
  }
}
```

`details` is optional and endpoint-specific. For `VALIDATION_ERROR` it is an array of
`{ path, message }`.

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | request body, path or query failed validation |
| 400 | `INVALID_PAGINATION` | `page`/`limit` not positive integers or `limit` > 100 |
| 400 | `INVALID_JSON` | body is not parseable JSON |
| 404 | `ACCOUNT_NOT_FOUND` | account id does not exist (also used for transfer source/destination) |
| 404 | `NOT_FOUND` | no such route (including any PUT/PATCH/DELETE on transactions) |
| 409 | `DUPLICATE_TRANSACTION` | `reference_id` already used for that account |
| 422 | `INSUFFICIENT_BALANCE` | debit or transfer exceeds available balance |
| 422 | `SAME_ACCOUNT_TRANSFER` | `from_account_id` equals `to_account_id` |
| 500 | `INTERNAL_ERROR` | unexpected failure; nothing was persisted |

---

## Health

### `GET /health`
Pings the database.

```json
200 { "status": "ok", "database": "up", "timestamp": "2026-10-26T12:00:00.000Z" }
503 { "status": "degraded", "database": "down", ... }
```

---

## Accounts

### `POST /accounts`
Create an account. Balance always starts at `0.00`; a `balance` field in the body is rejected.

Request:
```json
{ "name": "Alice" }
```

| Field | Rules |
|---|---|
| `name` | required, string, 1–100 chars after trimming |

Response `201`:
```json
{
  "id": "6f1d2a3e-...-...",
  "name": "Alice",
  "balance": "0.00",
  "created_at": "2026-10-26T12:00:00.000Z"
}
```

Errors: `400 VALIDATION_ERROR` (missing/empty name, unknown fields such as `balance`).

### `GET /accounts`
List accounts, newest first. Supports `page` and `limit` like the transactions list.

Response `200`:
```json
{
  "data": [ { "id": "...", "name": "Alice", "balance": "70.00", "created_at": "..." } ],
  "pagination": { "page": 1, "limit": 20, "total_records": 1, "total_pages": 1 }
}
```

### `GET /accounts/:id`
Fetch one account.

Response `200`: same shape as create. Errors: `400 VALIDATION_ERROR` (not a UUID),
`404 ACCOUNT_NOT_FOUND`.

### `GET /accounts/:id/balance`
Fetch the current balance.

Response `200`:
```json
{ "account_id": "6f1d2a3e-...", "balance": "70.00", "as_of": "2026-10-26T12:00:01.000Z" }
```

Errors: `404 ACCOUNT_NOT_FOUND`.

---

## Transactions

### `POST /accounts/:id/transactions`
Post a credit or debit. The insert and the balance update are one database transaction;
if anything fails nothing is persisted.

Request:
```json
{
  "type": "debit",
  "amount": "30.00",
  "reference_id": "coffee-1",
  "description": "Coffee"
}
```

| Field | Rules |
|---|---|
| `type` | required, `"credit"` or `"debit"` |
| `amount` | required, string or number, `> 0`, at most 2 decimal places, `< 10^15` |
| `reference_id` | required, string, 1–100 chars; unique per account |
| `description` | optional, string, ≤ 255 chars |

Response `201`:
```json
{
  "id": "9c0e...-...",
  "account_id": "6f1d2a3e-...",
  "type": "debit",
  "amount": "30.00",
  "description": "Coffee",
  "reference_id": "coffee-1",
  "transfer_id": null,
  "created_at": "2026-10-26T12:00:02.000Z",
  "balance_after": "70.00"
}
```

`balance_after` is the account balance immediately after this transaction committed. It is a
convenience for clients and is not stored on the transaction.

Errors:

| HTTP | code | trigger |
|---|---|---|
| 400 | `VALIDATION_ERROR` | bad type, amount ≤ 0, > 2dp, missing reference_id, non-UUID id |
| 404 | `ACCOUNT_NOT_FOUND` | unknown account |
| 409 | `DUPLICATE_TRANSACTION` | same `reference_id` already exists for this account; `details.existing_transaction_id` is returned |
| 422 | `INSUFFICIENT_BALANCE` | debit larger than balance |

### `GET /accounts/:id/transactions`
Paginated history, newest first (`created_at DESC, id DESC`).

Query parameters:

| Param | Default | Rules |
|---|---|---|
| `type` | both | `credit` or `debit` |
| `page` | `1` | integer ≥ 1 |
| `limit` | `20` | integer 1–100 |

Response `200`:
```json
{
  "data": [
    { "id": "...", "account_id": "...", "type": "debit", "amount": "30.00",
      "description": "Coffee", "reference_id": "coffee-1", "transfer_id": null,
      "created_at": "2026-10-26T12:00:02.000Z" }
  ],
  "pagination": { "page": 1, "limit": 20, "total_records": 2, "total_pages": 1 }
}
```

A `page` beyond the last returns an empty `data` array with the same `pagination` metadata.

Errors: `400 INVALID_PAGINATION`, `400 VALIDATION_ERROR` (bad `type`), `404 ACCOUNT_NOT_FOUND`.

### `GET /transactions/:id`
Fetch one transaction by id. Errors: `404 NOT_FOUND`.

### Immutability
There are no `PUT`, `PATCH` or `DELETE` routes for transactions; they return
`404 NOT_FOUND`. A database trigger additionally rejects any `UPDATE` or `DELETE` on the
`transactions` table.

---

## Transfers (bonus)

### `POST /transfers`
Move money from one account to another. Produces a debit on the source and a credit on the
destination, both tagged with the same `transfer_id` and `reference_id`, inside a single
database transaction. Either both legs commit or neither does.

Request:
```json
{
  "from_account_id": "6f1d2a3e-...",
  "to_account_id":   "a81b...-...",
  "amount": "30.00",
  "reference_id": "tx-1",
  "description": "Dinner split"
}
```

| Field | Rules |
|---|---|
| `from_account_id`, `to_account_id` | required UUIDs, must differ |
| `amount` | same rules as transactions |
| `reference_id` | required; must be unused on **both** accounts |
| `description` | optional |

Response `201`:
```json
{
  "id": "t-...",
  "from_account_id": "...",
  "to_account_id": "...",
  "amount": "30.00",
  "reference_id": "tx-1",
  "description": "Dinner split",
  "created_at": "...",
  "debit_transaction":  { "id": "...", "account_id": "...", "type": "debit",  "amount": "30.00", ... },
  "credit_transaction": { "id": "...", "account_id": "...", "type": "credit", "amount": "30.00", ... },
  "from_balance_after": "70.00",
  "to_balance_after": "80.00"
}
```

Errors: `400 VALIDATION_ERROR`, `404 ACCOUNT_NOT_FOUND` (`details.account_id` says which),
`409 DUPLICATE_TRANSACTION`, `422 SAME_ACCOUNT_TRANSFER`, `422 INSUFFICIENT_BALANCE`.

### `GET /transfers/:id`
Fetch a transfer with both legs. Errors: `404 NOT_FOUND`.
