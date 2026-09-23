/**
 * Brand + name as one line, for every discovery surface that names a product (cockpit,
 * PDF, CLI receipts).
 *
 * The name often already starts with the brand — participants type it that way, retailer
 * search returns it that way, and some catalog rows carry it — so a plain join printed
 * „Afrolocke Afrolocke …". The brand is only prepended when the name does not already
 * begin with it (case-insensitive, whitespace-normalised, at a word boundary).
 */
export function discoveryProductLabel(
  brand: string | null | undefined,
  name: string | null | undefined,
): string {
  const cleanBrand = collapseWhitespace(brand)
  const cleanName = collapseWhitespace(name)
  if (!cleanBrand) return cleanName
  if (!cleanName) return cleanBrand
  return startsWithWord(cleanName, cleanBrand) ? cleanName : `${cleanBrand} ${cleanName}`
}

function collapseWhitespace(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function startsWithWord(text: string, prefix: string): boolean {
  const lowerText = text.toLocaleLowerCase("de")
  const lowerPrefix = prefix.toLocaleLowerCase("de")
  if (!lowerText.startsWith(lowerPrefix)) return false
  const next = lowerText.charAt(lowerPrefix.length)
  return next === "" || !/[\p{L}\p{N}]/u.test(next)
}
