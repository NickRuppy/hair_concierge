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
 * the field test, so the entry screen also names examples (`hint`).
 */

export type DiscoveryIntakeCategoryCopy = {
  key: PersonalPlanCategory
  label: string
  /** „Dein Shampoo" / „Deine Maske" — the possessive for the heading. */
  possessive: "Dein" | "Deine"
  /** „Welches Shampoo …" / „Welchen Conditioner …" / „Welche Maske …" */
  interrogative: "Welches" | "Welchen" | "Welche"
  /** Optional guidance line under the entry screen's question. */
  hint?: string
}

const LABEL_OVERRIDES: Partial<Record<PersonalPlanCategory, { label: string; hint?: string }>> = {
  scalp_care: {
    label: "Kopfhautpflege",
    hint: "z. B. Kopfhaut-Serum, -Tonikum oder -Peeling",
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
  return { key, label: CATEGORY_COPY[key].label, ...GRAMMAR[key], ...LABEL_OVERRIDES[key] }
}

export const DISCOVERY_INTAKE_GROUPS: DiscoveryIntakeGroup[] = [
  {
    label: "Waschen",
    categories: ["shampoo", "conditioner", "deep_cleansing_shampoo"].map((key) =>
      copyFor(key as PersonalPlanCategory),
    ),
  },
  {
    label: "Pflege",
    categories: ["mask", "leave_in", "oil", "bondbuilder"].map((key) =>
      copyFor(key as PersonalPlanCategory),
    ),
  },
  {
    label: "Kopfhaut",
    categories: ["scalp_care"].map((key) => copyFor(key as PersonalPlanCategory)),
  },
  {
    label: "Styling",
    categories: ["heat_protectant", "dry_shampoo"].map((key) =>
      copyFor(key as PersonalPlanCategory),
    ),
  },
]

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
