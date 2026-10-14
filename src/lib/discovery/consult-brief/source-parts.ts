/**
 * The stale hint's vocabulary (consult-brief-d item 3), client-safe: the input parts a
 * consultant recognises, and which of them differ between the stored brief and the page's
 * read. The fingerprints themselves are computed server-side (`consultSourceParts` in hash.ts).
 */
export const CONSULT_SOURCE_PART_LABELS = {
  produkte: "Produkte & Entscheidungen",
  checkliste: "Checkliste & Recherche",
  profil: "Profil & Hauptproblem",
  hitze: "Hitze & Styling",
  waschen: "Waschrhythmus",
  wissen: "Wissensbasis",
  score: "Ausgangswert",
  version: "Brief-Vorlage",
} as const

export type ConsultSourcePart = keyof typeof CONSULT_SOURCE_PART_LABELS

/**
 * The labels of the parts that differ, in display order. Empty when either side is unknown
 * (a brief stored before the parts existed) — the caller then keeps its generic hint.
 */
export function changedConsultSourceParts(
  stored: Readonly<Record<string, string>> | null | undefined,
  current: Readonly<Record<string, string>> | null | undefined,
): string[] {
  if (!stored || !current) return []
  return (Object.keys(CONSULT_SOURCE_PART_LABELS) as ConsultSourcePart[])
    .filter((part) => stored[part] !== current[part])
    .map((part) => CONSULT_SOURCE_PART_LABELS[part])
}
