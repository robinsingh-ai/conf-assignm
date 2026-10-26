"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type Account, ApiError, createTransfer, type Transfer } from "@/lib/api";
import { formatMoney, newReference } from "@/lib/format";
import { ErrorNotice, SuccessNotice } from "./Notice";
import { Button, Field, Input, Select } from "./ui";

export function TransferForm({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState(accounts[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState(() => newReference("tx"));
  const [description, setDescription] = useState("");
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [result, setResult] = useState<Transfer | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = (id: string) => accounts.find((a) => a.id === id);
  const source = byId(from);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const transfer = await createTransfer({
          from_account_id: from,
          to_account_id: to,
          amount: amount.trim(),
          reference_id: reference.trim(),
          description: description.trim() || undefined,
        });
        setResult(transfer);
        setAmount("");
        setDescription("");
        setReference(newReference("tx"));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    });
  };

  const option = (a: Account) => (
    <option key={a.id} value={a.id}>
      {a.name} · {formatMoney(a.balance)}
    </option>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <Field label="From" htmlFor="from">
          <Select id="from" value={from} onChange={(e) => setFrom(e.target.value)} required>
            {accounts.map(option)}
          </Select>
        </Field>
        <button
          type="button"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          className="mx-auto grid size-10 place-items-center rounded-full border border-line bg-white/80 text-lg shadow-soft transition hover:rotate-180"
          aria-label="Swap accounts"
          title="Swap"
        >
          ⇄
        </button>
        <Field label="To" htmlFor="to">
          <Select id="to" value={to} onChange={(e) => setTo(e.target.value)} required>
            {accounts.map(option)}
          </Select>
        </Field>
      </div>
      {source ? (
        <p className="-mt-2 text-xs text-ink-soft">
          {source.name} has <span className="font-bold">{formatMoney(source.balance)}</span> available.
        </p>
      ) : null}

      <Field label="Amount" htmlFor="amount">
        <Input id="amount" inputMode="decimal" placeholder="e.g. 30.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </Field>

      <Field label="Reference id" htmlFor="reference" hint="Used on both the debit and the credit leg.">
        <div className="flex gap-2">
          <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} required />
          <Button type="button" variant="ghost" onClick={() => setReference(newReference("tx"))} aria-label="Generate a new reference id">
            🎲
          </Button>
        </div>
      </Field>

      <Field label="Description" htmlFor="description">
        <Input id="description" placeholder="Optional, e.g. Dinner split" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} />
      </Field>

      <Button type="submit" disabled={pending || from === to || accounts.length < 2}>
        {pending ? "Transferring…" : "💸 Transfer"}
      </Button>
      {from === to && accounts.length >= 2 ? <p className="text-xs font-semibold text-coral">Pick two different accounts.</p> : null}

      {error ? <ErrorNotice error={error} /> : null}
      {result ? (
        <SuccessNotice>
          <p>🎉 Moved {formatMoney(result.amount)} in one atomic step.</p>
          <ul className="mt-1 space-y-0.5 text-ink-soft">
            <li>
              <Link className="underline" href={`/accounts/${result.from_account_id}`}>
                {byId(result.from_account_id)?.name ?? "Source"}
              </Link>{" "}
              now has {formatMoney(result.from_balance_after)}
            </li>
            <li>
              <Link className="underline" href={`/accounts/${result.to_account_id}`}>
                {byId(result.to_account_id)?.name ?? "Destination"}
              </Link>{" "}
              now has {formatMoney(result.to_balance_after)}
            </li>
          </ul>
        </SuccessNotice>
      ) : null}
    </form>
  );
}
