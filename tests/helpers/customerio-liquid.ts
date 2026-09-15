/**
 * Narrow test double for the trigger substitutions used by trial emails.
 * Customer.io's `escape` percent-encodes; it is NOT Shopify HTML escaping.
 * Source: https://docs.customer.io/messaging/liquid/tag-list/#htmlencode
 * A real Customer.io test delivery on 2026-09-15 also confirmed htmlencode
 * escapes tags/quotes/ampersands and preserves literal Liquid in trigger data.
 * The original delivered confirmation (2026-09-15) independently confirmed
 * this behavior: URL-decoding its HTML text exactly matched its plain text.
 * This is not a replacement for checking a real Customer.io delivery.
 */
export function renderCustomerIoTriggerTemplate(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(
    /\{\{\s*trigger\.([a-z_]+)(?:\s*\|\s*([a-z_]+))?\s*\}\}/g,
    (_match, key: string, filter?: string) => {
      if (typeof data[key] !== "string") throw new Error(`Missing trigger string: ${key}`)
      const value = data[key]
      if (!filter) return value
      if (filter === "escape") return encodeURIComponent(value)
      if (filter !== "htmlencode") throw new Error(`Unsupported Customer.io filter: ${filter}`)
      return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;")
    },
  )
}
