const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Display-only formatting of the API's decimal strings ("1234.5" -> "1,234.50"). */
export function formatMoney(value: string | number): string {
  return moneyFormatter.format(Number(value));
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDate(iso: string): string {
  return `${dateFormatter.format(new Date(iso))} UTC`;
}

const PASTELS = ["bg-peach", "bg-pink", "bg-mint", "bg-lavender", "bg-butter", "bg-sky"] as const;
const CRITTERS = ["🐷", "🐰", "🐻", "🦊", "🐸", "🐥", "🐨", "🐼"] as const;

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Stable pastel + critter per account id so cards keep their look across reloads. */
export function flavour(id: string) {
  const h = hash(id);
  return { pastel: PASTELS[h % PASTELS.length], critter: CRITTERS[(h >>> 3) % CRITTERS.length] };
}

export function newReference(prefix: string): string {
  const rand = typeof crypto !== "undefined" ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36);
  return `${prefix}-${rand}`;
}
