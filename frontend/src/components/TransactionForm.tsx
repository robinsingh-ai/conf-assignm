"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ApiError, createTransaction, type TransactionType } from "@/lib/api";
import { formatMoney, newReference } from "@/lib/format";
import { ErrorNotice, SuccessNotice } from "./Notice";
import { Button, Field, Input } from "./ui";

export function TransactionForm({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [type, setType] = useState<TransactionType>("credit");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState(() => newReference("ref"));
  const [description, setDescription] = useState("");
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const created = await createTransaction(accountId, {
          type,
          amount: amount.trim(),
          reference_id: reference.trim(),
          description: description.trim() || undefined,
        });
        setSuccess(
          `${type === "credit" ? "Credited" : "Debited"} ${formatMoney(created.amount)} · new balance ${formatMoney(created.balance_after)}`,
        );
        setAmount("");
        setDescription("");
        setReference(newReference("ref"));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Transaction type" className="grid grid-cols-2 gap-2 rounded-2xl bg-cream p-1">
        {(["credit", "debit"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => setType(t)}
            className={`rounded-xl px-3 py-2 text-sm font-extrabold transition ${
              type === t
                ? t === "credit"
                  ? "bg-leaf text-white shadow-soft"
                  : "bg-coral text-white shadow-soft"
                : "text-ink-soft hover:bg-white"
            }`}
          >
            {t === "credit" ? "↑ Credit (add)" : "↓ Debit (spend)"}
          </button>
        ))}
      </div>

      <Field label="Amount" htmlFor="amount" hint="Up to two decimal places, must be greater than 0.">
        <Input
          id="amount"
          inputMode="decimal"
          placeholder="e.g. 25.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </Field>

      <Field label="Reference id" htmlFor="reference" hint="Unique per account. Replaying the same reference is rejected and the balance stays put.">
        <div className="flex gap-2">
          <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} required />
          <Button type="button" variant="ghost" onClick={() => setReference(newReference("ref"))} aria-label="Generate a new reference id">
            🎲
          </Button>
        </div>
      </Field>

      <Field label="Description" htmlFor="description">
        <Input
          id="description"
          placeholder="Optional, e.g. Coffee with Sam"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={255}
        />
      </Field>

      <Button type="submit" variant={type} disabled={pending}>
        {pending ? "Posting…" : type === "credit" ? "Add money" : "Spend money"}
      </Button>

      {error ? <ErrorNotice error={error} /> : null}
      {success ? <SuccessNotice>✅ {success}</SuccessNotice> : null}
    </form>
  );
}
