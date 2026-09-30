const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PERCENT_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 });
const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function format_brl(value: number | null | undefined): string {
  return value == null ? "—" : BRL_FORMATTER.format(value);
}

/** Receives a ratio (0.12 = 12%). */
export function format_percent(ratio: number | null | undefined): string {
  return ratio == null ? "—" : PERCENT_FORMATTER.format(ratio);
}

export function format_number(value: number | null | undefined): string {
  return value == null ? "—" : NUMBER_FORMATTER.format(value);
}

/** Receives an ISO date (YYYY-MM-DD or full ISO string) and formats as dd/mm/yyyy. */
export function format_date(iso_date: string | null | undefined): string {
  return iso_date ? DATE_FORMATTER.format(new Date(iso_date)) : "—";
}

export function format_date_time(iso_date: string | null | undefined): string {
  return iso_date ? DATE_TIME_FORMATTER.format(new Date(iso_date)) : "—";
}

/** YYYY-MM-DD in the user's local timezone (toISOString would shift to UTC). */
export function to_local_iso_date(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
