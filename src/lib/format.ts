export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return "";
  if (amount >= 1_000_000) {
    const v = amount / 1_000_000;
    return `£${Number.isInteger(v) ? v : v.toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    const v = amount / 1_000;
    return `£${Number.isInteger(v) ? v : v.toFixed(0)}k`;
  }
  return `£${amount}`;
}

export function daysSince(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}