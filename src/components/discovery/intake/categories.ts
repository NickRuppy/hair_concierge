import { CATEGORY_COPY } from "@/components/personal-plan-products/stage3-product-copy"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"

/**
 * The checklist's presentation layer over the ten product categories.
 *
 * The four groups are DISPLAY ONLY (plan §4): nothing downstream — not the
 * table's CHECK, not the cockpit, not the routine engine — knows about them.
 * They exist because ten flat rows read as a form, and four short blocks read as
 * a bathroom shelf.
 *
 * `article` and `interrogative` carry the German gender the shared
 * `CATEGORY_COPY.label` cannot: „Dein Shampoo" but „Deine Maske", „Welchen
 * Conditioner" but „Welches Öl".
 *
 * `LABEL_OVERRIDES` renames a category for THIS checklist only. The shared
 * `CATEGORY_COPY` stays untouched — the personal plan and Stage 3 keep their
 * own wording. „Kopfhautpflege" is the shelf term dm, Rossmann and Douglas use
 * for serums, tonics and peelings; „Kopfhautprodukt" read as a catch-all in
 * the field test.
 *
 * `label` is also what the cockpit and the admin pages print, so it stays the
 * bare noun. `rowLabel` is the participant's own row: the name plus, where the
 * name alone did not say what counts, the contents in brackets. The brackets
 * list the scalp-care roles the routine engine actually knows (comfort serum,
 * density tonic, scalp oil, exfoliant) — and they replace the entry screen's
 * former „z. B. …" line, so the same thing is never said twice.
 */

export type DiscoveryIntakeCategoryCopy = {
  key: PersonalPlanCategory
  label: string
  /** The participant's overview row and entry-screen breadcrumb. */
  rowLabel: string
  /** „Dein Shampoo" / „Deine Maske" — the possessive for the heading. */
  possessive: "Dein" | "Deine"
  /** „Welches Shampoo …" / „Welchen Conditioner …" / „Welche Maske …" */
  interrogative: "Welches" | "Welchen" | "Welche"
}

const LABEL_OVERRIDES: Partial<Record<PersonalPlanCategory, { label: string; rowLabel?: string }>> =
  {
    scalp_care: {
      label: "Kopfhautpflege",
      rowLabel: "Kopfhautpflege (Serum, Tonikum, Peeling)",
    },
  }

const GRAMMAR: Record<
  PersonalPlanCategory,
  {
    possessive: DiscoveryIntakeCategoryCopy["possessive"]
    interrogative: DiscoveryIntakeCategoryCopy["interrogative"]
  }
> = {
  shampoo: { possessive: "Dein", interrogative: "Welches" },
  conditioner: { possessive: "Dein", interrogative: "Welchen" },
  deep_cleansing_shampoo: { possessive: "Deine", interrogative: "Welche" },
  mask: { possessive: "Deine", interrogative: "Welche" },
  leave_in: { possessive: "Dein", interrogative: "Welches" },
  oil: { possessive: "Dein", interrogative: "Welches" },
  bondbuilder: { possessive: "Dein", interrogative: "Welchen" },
  // Grammar of the checklist's label („die Kopfhautpflege"), not of the shared one.
  scalp_care: { possessive: "Deine", interrogative: "Welche" },
  heat_protectant: { possessive: "Dein", interrogative: "Welchen" },
  dry_shampoo: { possessive: "Dein", interrogative: "Welches" },
}

export type DiscoveryIntakeGroup = {
  label: string
  categories: DiscoveryIntakeCategoryCopy[]
}

function copyFor(key: PersonalPlanCategory): DiscoveryIntakeCategoryCopy {
  const override = LABEL_OVERRIDES[key]
  const label = override?.label ?? CATEGORY_COPY[key].label
  return { key, label, rowLabel: override?.rowLabel ?? label, ...GRAMMAR[key] }
}

/**
 * Which shelf each category sits on. Waschen is what cleanses; Pflege is what
 * conditions the lengths — conditioner included, it rinses out but it does not
 * wash; Kopfhaut is scalp care; Styling is what goes on for the look or the heat.
 */
export const DISCOVERY_INTAKE_GROUP_KEYS: ReadonlyArray<{
  label: string
  keys: readonly PersonalPlanCategory[]
}> = [
  { label: "Waschen", keys: ["shampoo", "deep_cleansing_shampoo"] },
  { label: "Pflege", keys: ["conditioner", "mask", "leave_in", "oil", "bondbuilder"] },
  { label: "Kopfhaut", keys: ["scalp_care"] },
  { label: "Styling", keys: ["heat_protectant", "dry_shampoo"] },
]

export const DISCOVERY_INTAKE_GROUPS: DiscoveryIntakeGroup[] = DISCOVERY_INTAKE_GROUP_KEYS.map(
  (group) => ({ label: group.label, categories: group.keys.map(copyFor) }),
)

export const DISCOVERY_INTAKE_CATEGORY_COPY: Record<
  PersonalPlanCategory,
  DiscoveryIntakeCategoryCopy
> = Object.fromEntries(
  DISCOVERY_INTAKE_GROUPS.flatMap((group) => group.categories).map((category) => [
    category.key,
    category,
  ]),
) as Record<PersonalPlanCategory, DiscoveryIntakeCategoryCopy>

export const DISCOVERY_INTAKE_CATEGORY_COUNT = DISCOVERY_INTAKE_GROUPS.reduce(
  (total, group) => total + group.categories.length,
  0,
)
