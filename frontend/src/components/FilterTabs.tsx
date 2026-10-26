import Link from "next/link";
import type { TransactionType } from "@/lib/api";

const TABS: Array<{ label: string; value: TransactionType | undefined }> = [
  { label: "All", value: undefined },
  { label: "Credits", value: "credit" },
  { label: "Debits", value: "debit" },
];

export function FilterTabs({ accountId, active }: { accountId: string; active?: TransactionType }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-white/70 p-1 text-sm font-bold">
      {TABS.map((tab) => {
        const selected = tab.value === active;
        const href = tab.value ? `/accounts/${accountId}?type=${tab.value}` : `/accounts/${accountId}`;
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={selected ? "page" : undefined}
            className={`rounded-full px-3 py-1 transition ${selected ? "bg-ink text-white shadow-soft" : "text-ink-soft hover:bg-lavender/60"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
