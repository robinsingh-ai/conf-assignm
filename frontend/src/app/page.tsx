import { AccountCard } from "@/components/AccountCard";
import { NewAccountForm } from "@/components/NewAccountForm";
import { EmptyState } from "@/components/Notice";
import { Card, Chip, SectionTitle } from "@/components/ui";
import { listAccounts } from "@/lib/api";
import { formatMoney } from "@/lib/format";

export default async function HomePage() {
  const { data: accounts, pagination } = await listAccounts(1, 100);
  const total = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <div className="flex flex-col gap-6">
      <section className="pop-in flex flex-col gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Your piggy banks <span aria-hidden>🐷</span>
        </h1>
        <p className="max-w-xl text-ink-soft">
          Create accounts, add or spend money, and move it around. Every number here comes straight from the ledger API.
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip tone="lavender">
            {pagination.total_records} account{pagination.total_records === 1 ? "" : "s"}
          </Chip>
          <Chip tone="mint">🪙 {formatMoney(total)} in total</Chip>
        </div>
      </section>

      <Card>
        <SectionTitle>New account</SectionTitle>
        <NewAccountForm />
      </Card>

      <section>
        <SectionTitle hint={accounts.length ? "Newest first" : undefined}>Accounts</SectionTitle>
        {accounts.length === 0 ? (
          <EmptyState emoji="🫙" title="No accounts yet">
            Create one above and it will show up here with a shiny 0.00 balance.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <AccountCard key={a.id} account={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
