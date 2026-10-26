import type { TransactionType } from "@/lib/api";

export function TypeBadge({ type }: { type: TransactionType }) {
  return type === "credit" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-leaf-soft px-2.5 py-1 text-xs font-extrabold text-leaf">
      ↑ credit
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-coral-soft px-2.5 py-1 text-xs font-extrabold text-coral">
      ↓ debit
    </span>
  );
}
