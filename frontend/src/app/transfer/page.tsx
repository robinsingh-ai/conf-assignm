import Link from "next/link";
import { EmptyState } from "@/components/Notice";
import { TransferForm } from "@/components/TransferForm";
import { Card, SectionTitle } from "@/components/ui";
import { listAccounts } from "@/lib/api";

export default async function TransferPage() {
  const { data: accounts } = await listAccounts(1, 100);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <section className="pop-in">
        <h1 className="text-3xl font-extrabold tracking-tight">Move money <span aria-hidden>💸</span></h1>
        <p className="mt-2 text-ink-soft">
          A transfer debits one account and credits another in a single database transaction. Either both happen or neither does.
        </p>
      </section>

      <Card>
        <SectionTitle>Transfer</SectionTitle>
        {accounts.length < 2 ? (
          <EmptyState emoji="👯" title="You need two accounts to transfer">
            <Link href="/" className="underline">
              Create another account
            </Link>{" "}
            and come back.
          </EmptyState>
        ) : (
          <TransferForm accounts={accounts} />
        )}
      </Card>
    </div>
  );
}
