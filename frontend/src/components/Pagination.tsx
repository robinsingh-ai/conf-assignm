import type { PaginationMeta, TransactionType } from "@/lib/api";
import { LinkButton } from "./ui";

export function Pagination({
  accountId,
  type,
  meta,
}: {
  accountId: string;
  type?: TransactionType;
  meta: PaginationMeta;
}) {
  if (meta.total_pages <= 1 && meta.page <= 1) return null;
  const href = (page: number) => {
    const p = new URLSearchParams();
    if (type) p.set("type", type);
    p.set("page", String(page));
    return `/accounts/${accountId}?${p.toString()}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <LinkButton href={href(meta.page - 1)} disabled={meta.page <= 1}>
        ← Newer
      </LinkButton>
      <span className="font-semibold text-ink-soft">
        Page {meta.page} of {meta.total_pages} · {meta.total_records} total
      </span>
      <LinkButton href={href(meta.page + 1)} disabled={meta.page >= meta.total_pages}>
        Older →
      </LinkButton>
    </nav>
  );
}
