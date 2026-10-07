export const SOURCE_TYPES = [
  "book",
  "product_list",
  "qa",
  "narrative",
  "transcript",
  "live_call",
  "product_links",
  "community_qa",
] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  book: "Fachbuch",
  product_list: "Produktmatrix",
  qa: "FAQ",
  narrative: "Fachartikel",
  transcript: "Kurs-Transkript",
  live_call: "Live-Beratung",
  product_links: "Produktlinks",
  community_qa: "Community-Beratung",
} satisfies Record<SourceType, string>
