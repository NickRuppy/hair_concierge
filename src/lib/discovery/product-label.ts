/**
 * Brand + name as one line, for every discovery surface that names a product (cockpit,
 * PDF, CLI receipts).
 *
 * The name often already starts with the brand — participants type it that way, retailer
 * search returns it that way, and some catalog rows carry it — so a plain join printed
 * „Afrolocke Afrolocke …". The brand is only prepended when the name does not already
 * begin with it (case-insensitive, whitespace- and apostrophe-normalised, at a word boundary).
 * The normalisation is for the comparison only; the printed text keeps its own spelling.
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

/** ' ’ ‘ ʼ ` — catalog, retailer and typed names mix all of them in „L'Oréal". */
const APOSTROPHES = /[\u0027\u2019\u2018\u02BC\u0060]/g

function comparable(value: string): string {
  return value.replace(APOSTROPHES, "'").toLocaleLowerCase("de")
}

function startsWithWord(text: string, prefix: string): boolean {
  const lowerText = comparable(text)
  const lowerPrefix = comparable(prefix)
  if (!lowerText.startsWith(lowerPrefix)) return false
  const next = lowerText.charAt(lowerPrefix.length)
  return next === "" || !/[\p{L}\p{N}]/u.test(next)
}
