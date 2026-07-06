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
