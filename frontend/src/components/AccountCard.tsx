import Link from "next/link";
import type { Account } from "@/lib/api";
import { flavour, formatDate, formatMoney } from "@/lib/format";

export function AccountCard({ account }: { account: Account }) {
  const { pastel, critter } = flavour(account.id);
  return (
    <Link
      href={`/accounts/${account.id}`}
      className={`pop-in group relative flex flex-col gap-3 overflow-hidden rounded-[var(--radius-blob)] border border-white/60 ${pastel} p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg`}
    >
      <div className="flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-2xl bg-white/70 text-2xl" aria-hidden>
          {critter}
        </span>
        <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-ink-soft">
          since {formatDate(account.created_at).slice(0, 11)}
        </span>
      </div>
      <div>
        <p className="truncate text-base font-extrabold">{account.name}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight">
          <span className="mr-1 text-base text-ink-soft">🪙</span>
          {formatMoney(account.balance)}
        </p>
      </div>
      <span className="text-xs font-bold text-ink-soft transition group-hover:translate-x-0.5">Open account →</span>
    </Link>
  );
}
