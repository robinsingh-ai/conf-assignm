import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`pop-in rounded-[var(--radius-blob)] border border-line bg-white/80 p-5 shadow-soft sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <h2 className="text-lg font-extrabold tracking-tight">{children}</h2>
      {hint ? <div className="text-xs font-semibold text-ink-soft">{hint}</div> : null}
    </div>
  );
}

type ButtonVariant = "primary" | "ghost" | "credit" | "debit";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-berry text-white hover:bg-berry-dark shadow-soft",
  ghost: "bg-white/70 text-ink border border-line hover:bg-lavender/60",
  credit: "bg-leaf text-white hover:brightness-95 shadow-soft",
  debit: "bg-coral text-white hover:brightness-95 shadow-soft",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
    />
  );
}

export function LinkButton({
  href,
  children,
  className = "",
  disabled = false,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const base = `inline-flex items-center gap-1 rounded-full border border-line bg-white/70 px-3 py-1.5 text-sm font-bold ${className}`;
  if (disabled) {
    return (
      <span aria-disabled className={`${base} cursor-not-allowed opacity-40`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={`${base} hover:bg-lavender/60`}>
      {children}
    </Link>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-bold uppercase tracking-wide text-ink-soft">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

const controlStyles =
  "w-full rounded-2xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-berry focus:ring-4 focus:ring-pink/60";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${controlStyles} ${className}`} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select {...props} className={`${controlStyles} ${className}`} />;
}

export function Chip({ children, tone = "lavender" }: { children: ReactNode; tone?: "lavender" | "mint" | "peach" | "butter" | "sky" | "pink" }) {
  const tones = {
    lavender: "bg-lavender",
    mint: "bg-mint",
    peach: "bg-peach",
    butter: "bg-butter",
    sky: "bg-sky",
    pink: "bg-pink",
  } as const;
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}
