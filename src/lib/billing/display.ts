export function formatBillingDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString("de-DE") : "—"
}
