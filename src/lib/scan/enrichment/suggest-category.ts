import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"

// Unicode boundaries matter for German Öl / Sprühkur; JS \b treats umlauts as punctuation.
function keyword(name: string, pattern: string): boolean {
  return new RegExp("(?:^|[^\\p{L}\\p{N}])(?:" + pattern + ")(?=$|[^\\p{L}\\p{N}])", "iu").test(
    name,
  )
}

export function suggestCategoryFromRetailerName(name: string): PersonalPlanCategory | null {
  if (keyword(name, "Tönung|Color|Farbe|2[-\\u2010-\\u2015\\s]*in[-\\u2010-\\u2015\\s]*1"))
    return null
  const matches = new Set<PersonalPlanCategory>()
  const dry = keyword(name, "Trockenshampoo|Dry\\s+Shampoo")
  const deep = keyword(name, "Tiefenreinigung|Clarifying|Detox")
  if (dry) matches.add("dry_shampoo")
  if (deep) matches.add("deep_cleansing_shampoo")
  if (keyword(name, "Shampoo") && !dry && !deep && !keyword(name, "Peeling")) matches.add("shampoo")
  const map: Array<[PersonalPlanCategory, string]> = [
    ["conditioner", "Conditioner|Spülung|Balsam"],
    ["mask", "Maske|Kur|Haarkur|Treatment"],
    ["leave_in", "Leave[-\\s]in|Sprühkur|Sprühpflege"],
    ["oil", "Öl|Oil|Haaröl"],
    ["heat_protectant", "Hitzeschutz|Heat\\s+Protect"],
    ["scalp_care", "Kopfhaut[-\\s]Serum|Kopfhaut[-\\s]Peeling|Scalp"],
  ]
  for (const [category, pattern] of map) if (keyword(name, pattern)) matches.add(category)
  return matches.size === 1 ? [...matches][0] : null
}
