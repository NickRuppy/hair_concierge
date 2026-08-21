function foldGermanText(value: string): string {
  return value
    .replace(/ß/g, "ss")
    .replace(/ẞ/g, "ss")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
}

function normalizeNoSymbol(value: string): string {
  return foldGermanText(value)
    .toLowerCase()
    .replace(/n[º°]\s*/g, "no ")
    .replace(/[\u2018\u2019\u02bc'`´](?=\p{Letter})/gu, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function normalizeIdentityText(input: string): string {
  return normalizeNoSymbol(input)
}

export function normalizeText(value: string | null | undefined): string {
  if (!value) return ""
  return normalizeIdentityText(value)
}

export function normalizeIdentifier(input: string | null | undefined): string {
  if (!input) return ""
  return normalizeIdentityText(input).replace(/\s+/g, "_")
}

export function normalizeIdentifierValue(input: string): string {
  return foldGermanText(input).toLowerCase().replace(/\s+/g, "").trim()
}

export function tokenizeProductName(input: string): string[] {
  return normalizeIdentityText(input)
    .split(" ")
    .filter((token) => token.length > 0)
}

/**
 * Canonical GTIN form for barcode-shaped identifiers: digits only, left-padded with
 * zeros to 14 (GTIN-14). UPC-A (12), EAN-13 (13), EAN-8 (8), and GTIN-14 spellings of
 * the same number all collapse to one value; real multipack GTIN-14s keep a non-zero
 * leading indicator digit, so padding never collides with them. Returns null for
 * anything that is not a GTIN-shaped value (callers fall back to the generic
 * normalization).
 */
export function canonicalizeGtin(input: string): string | null {
  const digits = input.replace(/[\s-]+/g, "")
  if (!/^\d+$/.test(digits)) return null
  if (![8, 12, 13, 14].includes(digits.length)) return null
  return digits.padStart(14, "0")
}
