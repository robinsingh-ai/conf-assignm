import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Piggy Ledger",
  description: "A tiny, friendly ledger: accounts, credits, debits and transfers.",
};

const apiDocsUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/docs`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-10 border-b border-line/70 bg-cream/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
              <span className="grid size-9 place-items-center rounded-2xl bg-pink text-xl shadow-soft" aria-hidden>
                🐷
              </span>
              Piggy Ledger
            </Link>
            <nav className="flex items-center gap-1 text-sm font-semibold">
              <Link href="/" className="rounded-full px-3 py-1.5 hover:bg-lavender/70">
                Accounts
              </Link>
              <Link href="/transfer" className="rounded-full px-3 py-1.5 hover:bg-mint/70">
                Transfer
              </Link>
              <a
                href={apiDocsUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden rounded-full px-3 py-1.5 text-ink-soft hover:bg-butter/80 sm:inline"
              >
                API docs ↗
              </a>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>

        <footer className="px-4 py-6 text-center text-xs text-ink-soft">
          Every balance you see here is read straight from the API. The UI never does the math.
        </footer>
      </body>
    </html>
  );
}
