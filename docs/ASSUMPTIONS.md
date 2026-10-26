# Assumptions

Places where the brief left room for interpretation, what was chosen, and why. Each is a
one-line change if the reviewer prefers otherwise.

## Money and amounts
1. **Single currency, no currency field.** The brief never mentions currency. Amounts are
   plain decimals.
2. **Two decimal places on the API, four in storage.** The API rejects more than 2 dp
   (`"10.005"` → 400). Storage is `NUMERIC(19,4)` to leave headroom for fees or FX later.
3. **Amounts are strings in JSON.** `"100.00"` not `100`. Numeric input is accepted on
   write for convenience but is converted exactly and echoed back as a string.
4. **Upper bound** of `< 10^15` on a single amount so values always fit `NUMERIC(19,4)`.

## Accounts
5. **Account names are not unique.** Two "Alice" accounts are allowed; the UUID is the
   identity. Names are trimmed and limited to 100 characters.
6. **Unknown body fields are rejected** (e.g. a client sending `balance` on create gets a
   400). The brief says the client must not set the balance; failing loudly is safer than
   silently ignoring.
7. **No account update or delete endpoints.** Not in the brief, and deleting an account with
   ledger history would break the ledger. `GET /accounts` (list) was added because the UI
   needs it.

## Transactions
8. **Rejected transactions are not persisted.** An overdraft or a duplicate leaves no row.
   The alternative (a `status=failed` row) was considered and rejected; see ARCHITECTURE §5.3.
9. **Duplicate `reference_id` returns 409 Conflict** with the existing transaction id in
   `details`. It is not treated as an idempotent replay returning 200, because the brief
   explicitly lists "Duplicate transaction" among the error cases to handle. The balance is
   untouched either way.
10. **`reference_id` comparison is exact and case-sensitive.** `"REF-1"` and `"ref-1"` are
    different references.
11. **`description` is optional.** The brief lists it as a field but gives no rule; it is
    nullable, max 255 characters.
12. **`balance_after`** is included in the create response as a convenience. It is computed
    inside the same database transaction, so it is exact, but it is not a stored column.
13. **Insufficient balance is 422, duplicate is 409.** Both requests are well-formed; one
    fails a business rule given current state (422), the other conflicts with existing state
    (409). 400 is reserved for malformed input.

## History, pagination, sorting
14. **Offset pagination** with `page` (default 1) and `limit` (default 20, max 100). The
    brief asks for total pages, which needs a count anyway, so cursors would add nothing.
15. **Invalid pagination is 400 `INVALID_PAGINATION`**, not silently clamped. `page=0`,
    `limit=1000`, `page=abc` all fail. Silent clamping hides client bugs.
16. **Sort is `created_at DESC, id DESC`.** The id tiebreaker guarantees a stable order when
    timestamps collide, so paging never duplicates or skips a row.
17. **Filter `type`** accepts exactly `credit` or `debit`; anything else is a 400.

## Transfers (bonus)
18. **A transfer is two ledger rows plus one `transfers` row.** Both rows share one
    `reference_id` (uniqueness is per account, so this is legal) and one `transfer_id`.
19. **Transfer to the same account is rejected** (422 `SAME_ACCOUNT_TRANSFER`). It would be a
    no-op that burns a reference id.
20. **Lock order is by account id, not direction**, to make deadlocks impossible when
    A→B and B→A run concurrently.

## Operational
21. **No authentication.** The API is assumed to run behind a trusted boundary. A middleware
    at the router layer would add it without touching services or repositories.
22. **PostgreSQL 14+ is required** (uses `gen_random_uuid()` from core, available since 13).
23. **Timestamps are server-generated UTC** (`timestamptz`), never accepted from the client.
24. **Soft limits for the exercise:** no rate limiting, no request size tuning beyond the
    100 kB JSON body limit.
