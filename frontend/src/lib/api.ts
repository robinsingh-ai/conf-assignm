/**
 * Typed client for the ledger API. Works in server components (reads
 * API_URL_INTERNAL, useful inside Docker) and in the browser (NEXT_PUBLIC_API_URL).
 * Every call is uncached: a ledger must never show a stale balance.
 */

export interface Account {
  id: string;
  name: string;
  balance: string;
  created_at: string;
}

export type TransactionType = "credit" | "debit";

export interface Transaction {
  id: string;
  account_id: string;
  type: TransactionType;
  amount: string;
  description: string | null;
  reference_id: string;
  transfer_id: string | null;
  created_at: string;
}

export interface CreatedTransaction extends Transaction {
  balance_after: string;
}

export interface Transfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: string;
  reference_id: string;
  description: string | null;
  created_at: string;
  debit_transaction: Transaction | null;
  credit_transaction: Transaction | null;
  from_balance_after: string;
  to_balance_after: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total_records: number;
  total_pages: number;
}

export interface Page<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

/** The API's error envelope, re-thrown as a typed error. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Validation issues, when the API sent them. */
  get issues(): ValidationIssue[] {
    return Array.isArray(this.details) ? (this.details as ValidationIssue[]) : [];
  }
}

function baseUrl(): string {
  const publicUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  if (typeof window === "undefined") return process.env.API_URL_INTERNAL ?? publicUrl;
  return publicUrl;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });

  if (!res.ok) {
    let body: { error?: { code?: string; message?: string; details?: unknown } } | undefined;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(
      res.status,
      body?.error?.code ?? "HTTP_ERROR",
      body?.error?.message ?? `Request failed with status ${res.status}`,
      body?.error?.details,
    );
  }
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") search.set(k, String(v));
  const s = search.toString();
  return s ? `?${s}` : "";
};

export const listAccounts = (page = 1, limit = 100) =>
  api<Page<Account>>(`/accounts${qs({ page, limit })}`);

export const getAccount = (id: string) => api<Account>(`/accounts/${id}`);

export const createAccount = (name: string) =>
  api<Account>("/accounts", { method: "POST", body: JSON.stringify({ name }) });

export const listTransactions = (
  accountId: string,
  opts: { type?: TransactionType; page?: number; limit?: number } = {},
) => api<Page<Transaction>>(`/accounts/${accountId}/transactions${qs(opts)}`);

export const createTransaction = (
  accountId: string,
  body: { type: TransactionType; amount: string; reference_id: string; description?: string },
) =>
  api<CreatedTransaction>(`/accounts/${accountId}/transactions`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const createTransfer = (body: {
  from_account_id: string;
  to_account_id: string;
  amount: string;
  reference_id: string;
  description?: string;
}) => api<Transfer>("/transfers", { method: "POST", body: JSON.stringify(body) });
