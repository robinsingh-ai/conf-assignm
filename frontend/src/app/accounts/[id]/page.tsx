import Link from "next/link";
import { notFound } from "next/navigation";
import { FilterTabs } from "@/components/FilterTabs";
import { EmptyState } from "@/components/Notice";
import { Pagination } from "@/components/Pagination";
import { TransactionForm } from "@/components/TransactionForm";
import { TypeBadge } from "@/components/TypeBadge";
import { Card, Chip, SectionTitle } from "@/components/ui";
import { ApiError, getAccount, listTransactions, type TransactionType } from "@/lib/api";
import { flavour, formatDate, formatMoney } from "@/lib/format";

const PAGE_SIZE = 10;

function parseType(value: string | string[] | undefined): TransactionType | undefined {
  return value === "credit" || value === "debit" ? value : undefined;
}

function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const type = parseType(sp.type);
  const page = parsePage(sp.page);

  let account;
  try {
    account = await getAccount(id);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }

  const history = await listTransactions(id, { type, page, limit: PAGE_SIZE });
  const { pastel, critter } = flavour(account.id);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="text-sm font-bold text-ink-soft hover:text-ink">
        ← All accounts
      </Link>

      <section className={`pop-in flex flex-col gap-4 rounded-[var(--radius-blob)] border border-white/60 ${pastel} p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-3xl bg-white/70 text-4xl" aria-hidden>
            {critter}
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{account.name}</h1>
            <p className="text-xs font-semibold text-ink-soft">
              Opened {formatDate(account.created_at)} · <span className="font-mono">{account.id.slice(0, 8)}…</span>
            </p>
          </div>
        </div>
        <div className="rounded-3xl bg-white/70 px-5 py-3 text-right">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Current balance</p>
          <p className="text-3xl font-extrabold tabular-nums tracking-tight">🪙 {formatMoney(account.balance)}</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="self-start">
          <SectionTitle>Add a transaction</SectionTitle>
          <TransactionForm accountId={account.id} />
        </Card>

        <Card>
          <SectionTitle hint={<Chip tone="butter">latest first</Chip>}>History</SectionTitle>
          <FilterTabs accountId={account.id} active={type} />

          {history.data.length === 0 ? (
            <div className="mt-4">
              <EmptyState emoji="🍃" title={type ? `No ${type}s yet` : "No transactions yet"}>
                {page > 1 ? "This page is empty. Try an earlier page." : "Post one on the left and it will appear here."}
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {history.data.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeBadge type={t.type} />
                      <span className="truncate text-sm font-bold">{t.description ?? <span className="text-ink-soft">No description</span>}</span>
                      {t.transfer_id ? <Chip tone="sky">transfer</Chip> : null}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      <span className="font-mono">{t.reference_id}</span> · {formatDate(t.created_at)}
                    </p>
                  </div>
                  <p className={`shrink-0 text-base font-extrabold tabular-nums ${t.type === "credit" ? "text-leaf" : "text-coral"}`}>
                    {t.type === "credit" ? "+" : "−"}
                    {formatMoney(t.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <Pagination accountId={account.id} type={type} meta={history.pagination} />
        </Card>
      </div>
    </div>
  );
}
