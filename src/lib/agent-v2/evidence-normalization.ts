export function normalizeAgentV2EvidenceText(value: string): string {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKC")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/^[\s"'“”„‚‘’`´]+|[\s"'“”„‚‘’`´]+$/gu, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}
