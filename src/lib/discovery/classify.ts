import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "@/lib/product-identity"
import { suggestCategoryFromRetailerName } from "@/lib/scan/enrichment/suggest-category"

/**
 * Batch 5 (plan `plans/discovery-flat-checklist/plan.md`, Rev. 3 task 2): pure, client-safe.
 *
 * Two separate answers about one captured product (Rev. 2 „identity ≠ usage"):
 *
 *  - its PRODUCT TYPE — what the product IS. From the catalog's `products.category_key`
 *    whenever there is a catalog product (P2-6), otherwise from its name (R2), otherwise
 *    unknown („Was ist das?" + „Weiß ich nicht", R4). It feeds the research submission
 *    (F1) and never follows the usage answer.
 *  - its USAGE — how SHE uses it: a category, plus a routine role for the multi-role oil
 *    step (R9). It drives routine binding only.
 *
 * `discoveryUsageStepFor` says which usage question follows a product type and which
 * answer is preselected (F5), so confirming the detected usage is one tap.
 * `isDiscoveryUsageWithinProductFamily` (F2) is the same R9 family map read the other way:
 * a usage one of the product type's own options offers is a legitimate difference.
 */

// --- Vocabulary ---------------------------------------------------------------------

/** The oil step's three roles (`PlanProductRole`), offered by the oil question. */
export const DISCOVERY_OIL_USAGE_ROLES = [
  "pre_wash_fibre_treatment",
  "leave_on_fibre_conditioning",
  "dry_finish",
] as const

/**
 * Every value `discovery_intake_items.usage_role` may hold — mirrors the migration's
 * `discovery_intake_items_usage_role_pair` CHECK (20260924120000). The scalp oil role only
 * ever goes with the `scalp_care` category.
 */
export const DISCOVERY_USAGE_ROLES = [
  ...DISCOVERY_OIL_USAGE_ROLES,
  "scalp_flake_oil_adjunct",
] as const

export type DiscoveryUsageRole = (typeof DISCOVERY_USAGE_ROLES)[number]

export type DiscoveryUsage = {
  category: PersonalPlanCategory
  role: DiscoveryUsageRole | null
}

const SUPPORTED = new Set<string>(SUPPORTED_PRODUCT_CATEGORY_KEYS)

export function isDiscoveryProductCategory(value: unknown): value is PersonalPlanCategory {
  return typeof value === "string" && SUPPORTED.has(value)
}

/** The DB CHECK's pairs, in code: no role, or an oil role with oil, or the scalp oil role with scalp care. */
export function isValidDiscoveryUsage(usage: {
  category: string
  role: string | null
}): usage is DiscoveryUsage {
  if (!isDiscoveryProductCategory(usage.category)) return false
  if (usage.role === null) return true
  if (usage.category === "oil") {
    return (DISCOVERY_OIL_USAGE_ROLES as readonly string[]).includes(usage.role)
  }
  return usage.category === "scalp_care" && usage.role === "scalp_flake_oil_adjunct"
}

// --- R9 questions -------------------------------------------------------------------

export type DiscoveryUsageQuestionKind = "oil_use" | "care_use" | "shampoo_use"

export type DiscoveryUsageOptionKey =
  | "oil_pre_wash"
  | "oil_damp"
  | "oil_dry_finish"
  | "oil_scalp"
  | "conditioner"
  | "mask"
  | "leave_in"
  | "shampoo"
  | "deep_cleansing_shampoo"

export type DiscoveryUsageOption = {
  key: DiscoveryUsageOptionKey
  label: string
  usage: DiscoveryUsage
}

export type DiscoveryUsageQuestion = {
  kind: DiscoveryUsageQuestionKind
  prompt: string
  options: readonly DiscoveryUsageOption[]
}

export const DISCOVERY_USAGE_QUESTIONS: Record<DiscoveryUsageQuestionKind, DiscoveryUsageQuestion> =
  {
    oil_use: {
      kind: "oil_use",
      prompt: "Wann benutzt du das Öl?",
      options: [
        {
          key: "oil_pre_wash",
          label: "Vor der Haarwäsche",
          usage: { category: "oil", role: "pre_wash_fibre_treatment" },
        },
        {
          key: "oil_damp",
          label: "Nach der Wäsche ins feuchte Haar",
          usage: { category: "oil", role: "leave_on_fibre_conditioning" },
        },
        {
          key: "oil_dry_finish",
          label: "Als Finish ins trockene Haar",
          usage: { category: "oil", role: "dry_finish" },
        },
        {
          key: "oil_scalp",
          label: "Auf die Kopfhaut",
          usage: { category: "scalp_care", role: "scalp_flake_oil_adjunct" },
        },
      ],
    },
    care_use: {
      kind: "care_use",
      prompt: "Wie benutzt du das?",
      options: [
        {
          key: "conditioner",
          label: "Kurz einwirken & ausspülen",
          usage: { category: "conditioner", role: null },
        },
        {
          key: "mask",
          label: "Länger einwirken als Kur",
          usage: { category: "mask", role: null },
        },
        { key: "leave_in", label: "Bleibt im Haar", usage: { category: "leave_in", role: null } },
      ],
    },
    shampoo_use: {
      kind: "shampoo_use",
      prompt: "Wie oft benutzt du das?",
      options: [
        { key: "shampoo", label: "Bei jeder Wäsche", usage: { category: "shampoo", role: null } },
        {
          key: "deep_cleansing_shampoo",
          label: "Ab und zu zur Tiefenreinigung",
          usage: { category: "deep_cleansing_shampoo", role: null },
        },
      ],
    },
  }

/** R4: the question for a product whose type is unknown. */
export const DISCOVERY_WHAT_IS_IT_PROMPT = "Was ist das?"
export const DISCOVERY_UNKNOWN_TYPE_LABEL = "Weiß ich nicht"

const QUESTION_BY_TYPE: Partial<Record<PersonalPlanCategory, DiscoveryUsageQuestionKind>> = {
  oil: "oil_use",
  conditioner: "care_use",
  mask: "care_use",
  leave_in: "care_use",
  shampoo: "shampoo_use",
  deep_cleansing_shampoo: "shampoo_use",
}

/** The usage question a product type is asked, or null (heat protectant, dry shampoo, bondbuilder, scalp care). */
export function discoveryUsageQuestionFor(
  productType: PersonalPlanCategory,
): DiscoveryUsageQuestion | null {
  const kind = QUESTION_BY_TYPE[productType]
  return kind ? DISCOVERY_USAGE_QUESTIONS[kind] : null
}

/**
 * F2: is `usageCategory` a usage the product type's own R9 question offers? Same category is
 * never a difference. One-directional by construction: an oil may be used on the scalp, but
 * a scalp-care product is never asked, so it has no oil use.
 */
export function isDiscoveryUsageWithinProductFamily(
  productType: PersonalPlanCategory,
  usageCategory: PersonalPlanCategory,
): boolean {
  if (productType === usageCategory) return true
  const question = discoveryUsageQuestionFor(productType)
  return question?.options.some((option) => option.usage.category === usageCategory) ?? false
}

// --- Product type -------------------------------------------------------------------

export type DiscoveryTypeRuleId =
  | "T1_catalog"
  | "T2_catalog_unsupported"
  | "T3_never_guessed"
  | "T4_scalp_treatment"
  | "T5_name"
  | "T6_compound_oil"
  | "T7_scalp_modifier"
  | "T8_leave_in_dominates"
  | "T9_oil_treatment"
  | "T10_oil_pre_wash"
  | "T11_oil_leave_in"
  | "T12_unknown"

export type DiscoveryProductTypeResult = {
  productType: PersonalPlanCategory | null
  rule: DiscoveryTypeRuleId
}

const WORD_START = "(?:^|[^\\p{L}\\p{N}])"
const WORD_END = "(?=$|[^\\p{L}\\p{N}])"

function hasWord(name: string, pattern: string): boolean {
  return new RegExp(WORD_START + "(?:" + pattern + ")" + WORD_END, "iu").test(name)
}

function withoutWords(name: string, ...patterns: string[]): string {
  return patterns.reduce(
    (rest, pattern) =>
      rest.replace(new RegExp(WORD_START + "(?:" + pattern + ")" + WORD_END, "giu"), " "),
    name,
  )
}

/** The retailer rules' own „never guess" words: colour products and 2-in-1s. */
const NEVER_GUESSED_WORDS = "Tönung|Color|Farbe|2\\s*in\\s*1"
const SCALP_WORDS = "Kopfhaut|Scalp"
const OIL_WORDS = "Öl|Oil|Haaröl"
const LEAVE_IN_WORDS = "Leave[-\\s]in|Sprühkur|Sprühpflege"
/** A treatment word — „Kur" on its own (not „Haarkur", which is a mask), „Treatment". */
const TREATMENT_WORDS = "Kur|Treatment"
const SCALP_TREATMENT_WORDS = "Kur|Treatment|Serum|Tonikum|Tonic"
const PRE_WASH_WORDS = "Pre[-\\s]?Shampoo|Pre[-\\s]?Wash|vor\\s+der\\s+(?:Haar)?wäsche"

/** T7 only turns a scalp-modified name into one of these. */
const SCALP_MODIFIABLE = new Set<PersonalPlanCategory>(["oil", "shampoo", "deep_cleansing_shampoo"])
/** T8: a leave-in statement decides only inside the care family. */
const LEAVE_IN_DOMINATES = new Set<PersonalPlanCategory>(["conditioner", "mask"])

/**
 * „Arganöl" → „Argan Öl", „Ölkur" → „Öl kur": the retailer rules need the oil word (and a
 * glued-on „kur") on their own.
 */
function splitCompoundOil(name: string): string {
  return name
    .replace(/öl(?=kur(?:$|[^\p{L}\p{N}]))/giu, "Öl ")
    .replace(/(\p{L})öl(?=$|[^\p{L}\p{N}])/giu, "$1 Öl")
}

/** Nothing but the words already accounted for: no second product noun left over. */
function nothingElse(name: string, ...accounted: string[]): boolean {
  return suggestCategoryFromRetailerName(withoutWords(name, ...accounted)) === null
}

/**
 * The product type of a capture. Rules, first match wins:
 *
 *  T1  a catalog category (`products.category_key`) is authoritative (P2-6);
 *  T2  …but a catalog key outside the ten supported categories is no type;
 *  T3  a colour product or a 2-in-1 is never guessed (she says which product she means);
 *  T4  a scalp word with a treatment word and no oil is scalp care („Scalp Treatment",
 *      „Kopfhaut-Kur", „Kopfhaut-Serum") — before T5, whose „Kur" would say mask;
 *  T5  the retailer-name rules (`suggestCategoryFromRetailerName`) found exactly one type;
 *  T6  …after splitting a German „…öl" compound;
 *  T7  a scalp word in front of an oil or shampoo is a modifier („Scalp Oil" is an oil);
 *  T8  a leave-in word decides inside the care family („Leave-in Conditioner");
 *  T9  an oil with a treatment word is an oil („Öl-Kur", „Oil Treatment", „Haaröl-Kur");
 *  T10 an oil with a pre-wash word is an oil („Pre-Shampoo Öl");
 *  T11 an oil with a leave-in word is an oil („Leave-in Öl");
 *  T12 otherwise unknown — including brand-only names.
 *
 * T9–T11 only fire when no other product noun is left once the oil, qualifier and scalp
 * words are taken out: „Leave-in Conditioner mit Öl" or „Argan Oil Shampoo" stay unknown.
 */
export function classifyDiscoveryProductType(input: {
  catalogCategory?: string | null
  name?: string | null
}): DiscoveryProductTypeResult {
  const catalogCategory = input.catalogCategory?.trim()
  if (catalogCategory) {
    return isDiscoveryProductCategory(catalogCategory)
      ? { productType: catalogCategory, rule: "T1_catalog" }
      : { productType: null, rule: "T2_catalog_unsupported" }
  }

  const name = input.name?.trim() ?? ""
  if (!name) return { productType: null, rule: "T12_unknown" }
  if (hasWord(name, NEVER_GUESSED_WORDS)) return { productType: null, rule: "T3_never_guessed" }

  const split = splitCompoundOil(name)
  const hasOil = hasWord(split, OIL_WORDS)

  if (
    !hasOil &&
    hasWord(split, SCALP_WORDS) &&
    hasWord(split, SCALP_TREATMENT_WORDS) &&
    nothingElse(split, SCALP_WORDS, SCALP_TREATMENT_WORDS)
  ) {
    return { productType: "scalp_care", rule: "T4_scalp_treatment" }
  }

  const direct = suggestCategoryFromRetailerName(name)
  if (direct) return { productType: direct, rule: "T5_name" }

  if (split !== name) {
    const compound = suggestCategoryFromRetailerName(split)
    if (compound) return { productType: compound, rule: "T6_compound_oil" }
  }

  if (hasWord(split, SCALP_WORDS)) {
    const base = suggestCategoryFromRetailerName(withoutWords(split, SCALP_WORDS))
    if (base && SCALP_MODIFIABLE.has(base)) {
      return { productType: base, rule: "T7_scalp_modifier" }
    }
  }

  if (hasWord(split, LEAVE_IN_WORDS)) {
    const base = suggestCategoryFromRetailerName(withoutWords(split, LEAVE_IN_WORDS))
    if (base && LEAVE_IN_DOMINATES.has(base)) {
      return { productType: "leave_in", rule: "T8_leave_in_dominates" }
    }
  }

  if (hasOil) {
    const oilWith = (qualifier: string) =>
      hasWord(split, qualifier) && nothingElse(split, OIL_WORDS, qualifier, SCALP_WORDS)
    if (oilWith(TREATMENT_WORDS)) return { productType: "oil", rule: "T9_oil_treatment" }
    if (oilWith(PRE_WASH_WORDS)) return { productType: "oil", rule: "T10_oil_pre_wash" }
    if (oilWith(LEAVE_IN_WORDS)) return { productType: "oil", rule: "T11_oil_leave_in" }
  }

  return { productType: null, rule: "T12_unknown" }
}

// --- Usage step + preselection (F5) ---------------------------------------------------

export type DiscoveryPreselectRuleId =
  | "P1_oil_scalp"
  | "P2_oil_pre_wash"
  | "P3_oil_finish"
  | "P4_oil_default"
  | "P5_care_type"
  | "P6_shampoo_type"
  | "P7_no_question"
  | "P8_what_is_it"

export type DiscoveryUsageStep =
  | {
      kind: "ask"
      question: DiscoveryUsageQuestion
      preselected: DiscoveryUsageOptionKey
      rule: DiscoveryPreselectRuleId
    }
  /** No question: the usage is the product type itself. */
  | { kind: "fixed"; usage: DiscoveryUsage; rule: "P7_no_question" }
  /** R4: „Was ist das?" chips plus „Weiß ich nicht". */
  | { kind: "what_is_it"; rule: "P8_what_is_it" }

// German compounds („Kopfhautöl", „Glanzöl") make these substring matches on purpose;
// „kur" is read only at a word end so „kurzes Haar" is not a treatment, and never as
// „Sprühkur" (a leave-in word: that oil stays in the hair).
const OIL_SCALP = /kopfhaut|scalp/iu
const OIL_PRE_WASH =
  /pre[-\s]?wash|pre[-\s]?shampoo|vor der (?:haar)?wäsche|treatment|(?<!sprüh)kur(?=$|[^\p{L}\p{N}])/iu
const OIL_FINISH = /finish|glanz|serum/iu

function preselectOil(name: string): {
  key: DiscoveryUsageOptionKey
  rule: DiscoveryPreselectRuleId
} {
  if (OIL_SCALP.test(name)) return { key: "oil_scalp", rule: "P1_oil_scalp" }
  if (OIL_PRE_WASH.test(name)) return { key: "oil_pre_wash", rule: "P2_oil_pre_wash" }
  if (OIL_FINISH.test(name)) return { key: "oil_dry_finish", rule: "P3_oil_finish" }
  return { key: "oil_damp", rule: "P4_oil_default" }
}

/**
 * What follows a product type at capture (R9) — also after a „Was ist das?" chip answer,
 * with the chip as `productType`. `name` only matters for oil (F5).
 */
export function discoveryUsageStepFor(
  productType: PersonalPlanCategory | null,
  name: string | null | undefined,
): DiscoveryUsageStep {
  if (productType === null) return { kind: "what_is_it", rule: "P8_what_is_it" }
  const question = discoveryUsageQuestionFor(productType)
  if (!question) {
    return { kind: "fixed", usage: { category: productType, role: null }, rule: "P7_no_question" }
  }
  if (question.kind === "oil_use") {
    const { key, rule } = preselectOil(name?.trim() ?? "")
    return { kind: "ask", question, preselected: key, rule }
  }
  return {
    kind: "ask",
    question,
    // Care and shampoo families: the detected type is itself one of the options.
    preselected: productType as DiscoveryUsageOptionKey,
    rule: question.kind === "care_use" ? "P5_care_type" : "P6_shampoo_type",
  }
}

export type DiscoveryProductClassification = DiscoveryProductTypeResult & {
  step: DiscoveryUsageStep
}

/** Product type and the usage step in one call — what the capture flow asks after an add. */
export function classifyDiscoveryProduct(input: {
  catalogCategory?: string | null
  name?: string | null
}): DiscoveryProductClassification {
  const type = classifyDiscoveryProductType(input)
  return { ...type, step: discoveryUsageStepFor(type.productType, input.name) }
}
