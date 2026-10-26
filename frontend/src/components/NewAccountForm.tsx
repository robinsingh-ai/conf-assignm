"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ApiError, createAccount } from "@/lib/api";
import { ErrorNotice, SuccessNotice } from "./Notice";
import { Button, Input } from "./ui";

export function NewAccountForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreated(null);
    startTransition(async () => {
      try {
        const account = await createAccount(name);
        setCreated(account.name);
        setName("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="account-name"
          aria-label="Account holder name"
          placeholder="Who is this piggy bank for? e.g. Alice"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
        />
        <Button type="submit" disabled={pending || name.trim().length === 0} className="sm:w-44">
          {pending ? "Creating…" : "✨ Create account"}
        </Button>
      </div>
      <p className="text-xs text-ink-soft">New accounts always start at 0.00. The balance is not something a client can set.</p>
      {error ? <ErrorNotice error={error} /> : null}
      {created ? <SuccessNotice>🎉 Account for {created} created with a balance of 0.00.</SuccessNotice> : null}
    </form>
  );
}
