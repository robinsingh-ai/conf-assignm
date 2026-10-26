import type { ReactNode } from "react";
import type { ApiError } from "@/lib/api";

export function ErrorNotice({ error }: { error: ApiError | Error }) {
  const api = "code" in error ? (error as ApiError) : undefined;
  const isNetwork = !api && /fetch/i.test(error.message);
  return (
    <div role="alert" className="pop-in rounded-2xl border border-coral/30 bg-coral-soft px-4 py-3 text-sm">
      <p className="font-bold">
        {isNetwork ? "😵 Could not reach the API" : `😬 ${api?.code.replaceAll("_", " ").toLowerCase() ?? "Something went wrong"}`}
      </p>
      <p className="mt-0.5 text-ink-soft">{isNetwork ? "Is the backend running on port 4000?" : error.message}</p>
      {api && api.issues.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink-soft">
          {api.issues.map((i) => (
            <li key={i.path + i.message}>
              <span className="font-mono text-xs">{i.path.replace(/^body\./, "")}</span>: {i.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SuccessNotice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="pop-in rounded-2xl border border-leaf/30 bg-leaf-soft px-4 py-3 text-sm font-semibold">
      {children}
    </div>
  );
}

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-blob)] border border-dashed border-line bg-white/50 px-6 py-10 text-center">
      <div className="text-4xl" aria-hidden>
        {emoji}
      </div>
      <p className="mt-2 font-extrabold">{title}</p>
      {children ? <p className="mt-1 text-sm text-ink-soft">{children}</p> : null}
    </div>
  );
}
