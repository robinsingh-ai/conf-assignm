# Ledger UI

A small Next.js (App Router, TypeScript, Tailwind) client for the ledger API.

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL defaults to http://localhost:4000
npm install
npm run dev                  # http://localhost:3000
```

Pages:

- `/` accounts overview and "new account"
- `/accounts/:id` balance, post a credit/debit, filtered + paginated history
- `/transfer` move money between two accounts

Server components read from the API on every request (no caching); client forms post
to the API and refresh the page data. The UI never computes balances itself.
