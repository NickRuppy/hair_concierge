import {
  classifyDiscoveryProduct,
  discoveryUsageStepFor,
  DISCOVERY_SPRAY_QUESTION,
  DISCOVERY_STYLING_PRODUCT_TYPE,
  type DiscoveryProductType,
  type DiscoverySprayOption,
  type DiscoverySprayOptionKey,
  type DiscoverySprayQuestion,
  type DiscoveryUsage,
  type DiscoveryUsageOption,
  type DiscoveryUsageOptionKey,
  type DiscoveryUsageQuestion,
  type DiscoveryUsageRole,
  type DiscoveryUsageStep,
} from "@/lib/discovery/classify"
import {
  DISCOVERY_FREQUENCY_LABELS,
  discoveryFrequencySuggestion,
  type DiscoveryItemFrequency,
} from "@/lib/discovery/frequency"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { composeProductIdentityTitle } from "@/lib/product-identity/display-title"
import type { ProductFrequency } from "@/lib/vocabulary/frequencies"

import { DISCOVERY_INTAKE_CATEGORY_COPY } from "./categories"
import type {
  DiscoveryIntakeItemView,
  DiscoveryIntakeProductBody,
  DiscoveryIntakeProductCaptureInput,
  DiscoveryIntakeUsagePatchBody,
} from "./types"

/**
 * The participant's add sheet (batch 7, plan `plans/discovery-refinement-b7/plan.md` Rev. 3
 * §2.1 items 1–3; prototype round 6): ONE persistent sheet whose steps are a stack —
 *
 *   search → pick → [usage | spray | „Was ist das?"] → frequency → saved
 *   scan   → barcode read → (same as a pick; back goes to the search)
 *   search → „Selbst eintragen" → „Wie heißt es?" → [„Was ist das?"] → [usage] → frequency
 *   card tap (edit) → [usage | spray | „Was ist das?"] → frequency → saved
 *
 * The usage question comes only when the classifier asks (R9, D1 pre-wash conditioner, D2
 * spray); the frequency is asked for EVERY product (ruling round 4), and its tap is the one
 * that writes — exactly one request per flow, POST at add, PATCH on an edit.
 *
 * Pure and React-free: the checklist holds an `AddFlow` in state and hands it to the sheet.
 */

// --- Slots and display ---------------------------------------------------------------------

/** The ghost slots of „Deine Produkte", in shelf order; everything else sits after them. */
export const DISCOVERY_PRODUCT_SLOTS = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "heat_protectant",
] as const satisfies readonly PersonalPlanCategory[]

export type DiscoveryProductSlot = (typeof DISCOVERY_PRODUCT_SLOTS)[number]

export const DISCOVERY_CATEGORY_OPEN_LABEL = "Kategorie offen"
export const DISCOVERY_STYLING_CAPSULE_LABEL = "Styling"
export const DISCOVERY_UNNAMED_PRODUCT = "Gescanntes Produkt"

export function isProductItem(item: Pick<DiscoveryIntakeItemView, "source">): boolean {
  return item.source !== "none"
}

export function categoryLabel(category: PersonalPlanCategory): string {
  return DISCOVERY_INTAKE_CATEGORY_COPY[category].label
}

/** The ghost slot a card lands in — `null` for everything outside the six slots. */
export function slotOf(item: Pick<DiscoveryIntakeItemView, "category" | "productType">) {
  if (item.productType === DISCOVERY_STYLING_PRODUCT_TYPE) return null
  return (DISCOVERY_PRODUCT_SLOTS as readonly string[]).includes(item.category ?? "")
    ? (item.category as DiscoveryProductSlot)
    : null
}

/** One title for aria labels and alt texts: brand + line + name, de-duplicated. */
export function itemDisplayName(item: DiscoveryIntakeItemView): string {
  if (!item.productNameText) return DISCOVERY_UNNAMED_PRODUCT
  return (
    composeProductIdentityTitle({
      brand: item.brandText,
      productLine: item.productLine,
      name: item.productNameText,
    }) || DISCOVERY_UNNAMED_PRODUCT
  )
}

/** What the card and the pinned header show about a product. */
export type DiscoveryProductSubject = {
  /** „Balea · Professional" — muted; `null` when neither is known. */
  brandLine: string | null
  /** Bold, without a repeated brand or line in front. */
  name: string
  imageUrl: string | null
}

function stripLeading(name: string, prefix: string | null | undefined): string {
  const head = prefix?.trim()
  if (!head) return name
  if (name.toLocaleLowerCase("de").startsWith(`${head.toLocaleLowerCase("de")} `)) {
    return name.slice(head.length).trim()
  }
  return name
}

export function productSubject(input: {
  brand?: string | null
  line?: string | null
  name?: string | null
  imageUrl?: string | null
  /** An unnamed scan shows its barcode as the muted line. */
  barcode?: string | null
}): DiscoveryProductSubject {
  const brand = input.brand?.trim() || null
  const lineText = input.line?.trim() || null
  const line =
    lineText && brand && lineText.toLocaleLowerCase("de") === brand.toLocaleLowerCase("de")
      ? null
      : lineText
  const rawName = input.name?.trim() || null
  if (!rawName) {
    return {
      brandLine: input.barcode ?? null,
      name: DISCOVERY_UNNAMED_PRODUCT,
      imageUrl: input.imageUrl ?? null,
    }
  }
  const name = stripLeading(stripLeading(rawName, brand), line) || rawName
  const brandLine = [brand, line].filter(Boolean).join(" · ") || null
  return { brandLine, name, imageUrl: input.imageUrl ?? null }
}

export function itemSubject(item: DiscoveryIntakeItemView): DiscoveryProductSubject {
  return productSubject({
    brand: item.brandText,
    line: item.productLine,
    name: item.productNameText,
    imageUrl: item.imageUrl,
    barcode: item.barcodeIdentifier,
  })
}

/** What the capsule and captions read — a stored item or a draft in the sheet. */
type UsageFacts = {
  category: PersonalPlanCategory | null
  productType?: DiscoveryProductType | null
  usageRole?: DiscoveryUsageRole | null
}

const ROLE_SHORT: Record<DiscoveryUsageRole, string> = {
  pre_wash_fibre_treatment: "Vor der Wäsche",
  leave_on_fibre_conditioning: "Ins feuchte Haar",
  dry_finish: "Als Finish",
  scalp_flake_oil_adjunct: "Kopfhaut",
  pre_wash_conditioner: "Vor der Wäsche",
}

/** The plum capsule: her usage category, „Styling", or „Kategorie offen". */
export function capsuleLabel(item: UsageFacts): string {
  if (item.productType === DISCOVERY_STYLING_PRODUCT_TYPE) return DISCOVERY_STYLING_CAPSULE_LABEL
  if (!item.category) return DISCOVERY_CATEGORY_OPEN_LABEL
  // The scalp oil answers „Auf die Kopfhaut" to the OIL question: it stays an „Öl" here.
  if (item.usageRole === "scalp_flake_oil_adjunct") return categoryLabel("oil")
  return categoryLabel(item.category)
}

/** „Vor der Wäsche · 1× pro Woche" — `null` while the frequency was never asked. */
export function frequencyLine(
  item: Pick<DiscoveryIntakeItemView, "usageRole" | "frequency">,
): string | null {
  if (!item.frequency) return null
  const role = item.usageRole ? ROLE_SHORT[item.usageRole] : null
  const label = DISCOVERY_FREQUENCY_LABELS[item.frequency]
  return role ? `${role} · ${label}` : label
}

/** The routine card's second line: the capsule plus the WHEN of an oil or pre-wash role. */
export function routineItemCaption(item: UsageFacts): string {
  const capsule = capsuleLabel(item)
  const role = item.usageRole ? ROLE_SHORT[item.usageRole] : null
  return role ? `${capsule} · ${role}` : capsule
}

/** A draft from the old checklist: the card shows „Wie oft?" instead of a frequency. */
export function needsFrequency(item: DiscoveryIntakeItemView): boolean {
  return isProductItem(item) && !item.frequency
}

// --- Flow ------------------------------------------------------------------------------------

export type AddTarget =
  | { kind: "add"; capture: DiscoveryIntakeProductCaptureInput }
  | { kind: "change"; item: DiscoveryIntakeItemView }

export type AddDraft = {
  target: AddTarget
  subject: DiscoveryProductSubject
  /** What the product IS so far; `null` = „Weiß ich nicht" / not known. */
  productType: DiscoveryProductType | null
  usage: DiscoveryUsage | null
  /** The type was answered in THIS flow („Was ist das?", the spray question, a slot). */
  typeChosen: boolean
  /** The usage was decided in THIS flow — an edit then sends it. */
  usageDecided: boolean
}

export type AddStep =
  | { kind: "search" }
  | { kind: "scan" }
  | { kind: "name" }
  | { kind: "type"; current: PersonalPlanCategory | "unknown" | null }
  | { kind: "usage"; question: DiscoveryUsageQuestion; highlighted: DiscoveryUsageOptionKey | null }
  | {
      kind: "spray"
      question: DiscoverySprayQuestion
      highlighted: DiscoverySprayOptionKey | null
    }
  | {
      kind: "frequency"
      /** Plum: her current answer on an edit. */
      current: DiscoveryItemFrequency | null
      /** Plum + „Wie dein Shampoo": the latest shampoo's frequency (conditioner, leave-in). */
      suggestion: ProductFrequency | null
    }

export type AddFlow = {
  mode: "add" | "edit"
  /** The ghost slot she tapped: the typed path pre-sets that category. */
  slot: DiscoveryProductSlot | null
  /** Navigation stack; the last entry is on screen. */
  steps: AddStep[]
  draft: AddDraft | null
  /** Which way the last step change went — the sheet slides accordingly. */
  direction: 1 | -1
}

export type AddCommit =
  | { kind: "add"; body: DiscoveryIntakeProductBody }
  | { kind: "patch"; itemId: string; body: DiscoveryIntakeUsagePatchBody }

type Items = readonly DiscoveryIntakeItemView[]

export function currentStep(flow: AddFlow): AddStep {
  return flow.steps[flow.steps.length - 1]
}

export function canGoBack(flow: AddFlow): boolean {
  return flow.steps.length > 1
}

function push(flow: AddFlow, draft: AddDraft | null, step: AddStep): AddFlow {
  return { ...flow, draft, steps: [...flow.steps, step], direction: 1 }
}

export function openAddSearch(slot: DiscoveryProductSlot | null = null): AddFlow {
  return { mode: "add", slot, steps: [{ kind: "search" }], draft: null, direction: 1 }
}

export function openAddScan(): AddFlow {
  return { mode: "add", slot: null, steps: [{ kind: "scan" }], draft: null, direction: 1 }
}

function frequencyStep(draft: AddDraft, items: Items): AddStep {
  const current = draft.target.kind === "change" ? (draft.target.item.frequency ?? null) : null
  return {
    kind: "frequency",
    current,
    suggestion: current ? null : discoveryFrequencySuggestion(draft.usage?.category ?? null, items),
  }
}

function usageKeyOf(
  question: DiscoveryUsageQuestion,
  usage: DiscoveryUsage | null,
): DiscoveryUsageOptionKey | null {
  if (!usage) return null
  return (
    question.options.find(
      (option) => option.usage.category === usage.category && option.usage.role === usage.role,
    )?.key ?? null
  )
}

/** What follows once the product type is settled: its usage question, or the frequency. */
function afterType(
  flow: AddFlow,
  draft: AddDraft,
  step: DiscoveryUsageStep,
  items: Items,
): AddFlow {
  switch (step.kind) {
    case "what_is_it":
      return push(flow, draft, { kind: "type", current: null })
    case "spray":
      return push(flow, draft, {
        kind: "spray",
        question: step.question,
        highlighted: step.preselected,
      })
    case "ask":
      return push(flow, draft, {
        kind: "usage",
        question: step.question,
        highlighted: step.preselected,
      })
    case "fixed": {
      const next = { ...draft, usage: step.usage, usageDecided: true }
      return push(flow, next, frequencyStep(next, items))
    }
  }
}

/**
 * A search row or a barcode read: the catalog's category decides the type when there is one,
 * the name otherwise (R2), and the classifier says which usage question follows — or none.
 */
export function pickCapture(
  flow: AddFlow,
  capture: DiscoveryIntakeProductCaptureInput,
  subject: DiscoveryProductSubject,
  classifyAs: { catalogCategory?: string | null; name: string | null },
  items: Items,
): AddFlow {
  const { productType, step } = classifyDiscoveryProduct(classifyAs)
  const draft: AddDraft = {
    target: { kind: "add", capture },
    subject,
    productType,
    usage: null,
    typeChosen: false,
    usageDecided: false,
  }
  // A barcode read replaces the scanner: back goes to the search, as from any pick.
  const base: AddFlow =
    currentStep(flow).kind === "scan" ? { ...flow, steps: [{ kind: "search" }] } : flow
  return afterType(base, draft, step, items)
}

/** „Selbst eintragen": the typed path, in the same sheet. */
export function startTyped(flow: AddFlow): AddFlow {
  return push(flow, null, { kind: "name" })
}

/** „Wie heißt es?" answered: a ghost slot pre-sets the category, else the name decides. */
export function submitTypedName(
  flow: AddFlow,
  typed: { brandText: string; productNameText: string },
  items: Items,
): AddFlow {
  const draft: AddDraft = {
    target: { kind: "add", capture: { source: "name_research", ...typed } },
    subject: productSubject({ brand: typed.brandText, name: typed.productNameText }),
    productType: null,
    usage: null,
    typeChosen: false,
    usageDecided: false,
  }
  if (flow.slot) {
    return afterType(
      flow,
      { ...draft, productType: flow.slot, typeChosen: true },
      discoveryUsageStepFor(flow.slot, typed.productNameText),
      items,
    )
  }
  const { productType, step } = classifyDiscoveryProduct({ name: typed.productNameText })
  // A typed name the classifier cannot read asks „Was ist das?" (C5) — the chips hold it.
  return afterType(flow, { ...draft, productType }, step, items)
}

/** A „Was ist das?" chip; `null` = „Weiß ich nicht" (stored type-open, no usage). */
export function answerType(
  flow: AddFlow,
  productType: PersonalPlanCategory | null,
  items: Items,
): AddFlow {
  const draft = flow.draft
  if (!draft) return flow
  if (productType === null) {
    const next = { ...draft, productType: null, usage: null, typeChosen: false }
    return push(flow, next, frequencyStep(next, items))
  }
  return afterType(
    flow,
    { ...draft, productType, typeChosen: true },
    discoveryUsageStepFor(productType, draft.subject.name),
    items,
  )
}

export function answerUsage(flow: AddFlow, option: DiscoveryUsageOption, items: Items): AddFlow {
  const draft = flow.draft
  if (!draft) return flow
  const next = { ...draft, usage: option.usage, usageDecided: true }
  return push(flow, next, frequencyStep(next, items))
}

/** D2: the spray answer decides what the product IS as well as its usage. */
export function answerSpray(flow: AddFlow, option: DiscoverySprayOption, items: Items): AddFlow {
  const draft = flow.draft
  if (!draft) return flow
  const next: AddDraft = {
    ...draft,
    productType: option.productType,
    usage: option.usage,
    typeChosen: option.productType !== null,
    usageDecided: option.usage !== null,
  }
  return push(flow, next, frequencyStep(next, items))
}

/** One step back; the search step forgets the picked product. */
export function backStep(flow: AddFlow): AddFlow {
  if (!canGoBack(flow)) return flow
  const steps = flow.steps.slice(0, -1)
  const top = steps[steps.length - 1]
  const draft = flow.draft
  if (top.kind === "search") return { ...flow, steps, draft: null, direction: -1 }
  // Show what she already answered, not what was preselected when the step first opened.
  let refreshed: AddStep = top
  if (top.kind === "usage" && draft?.usageDecided) {
    refreshed = { ...top, highlighted: usageKeyOf(top.question, draft.usage) ?? top.highlighted }
  }
  return { ...flow, steps: [...steps.slice(0, -1), refreshed], direction: -1 }
}

/** The frequency tap — the only write of the flow. */
export function answerFrequency(
  flow: AddFlow,
  frequency: DiscoveryItemFrequency,
): AddCommit | null {
  const draft = flow.draft
  if (!draft) return null
  if (draft.target.kind === "add") {
    return {
      kind: "add",
      body: {
        capture: draft.target.capture,
        productType: draft.productType,
        usage: draft.productType === DISCOVERY_STYLING_PRODUCT_TYPE ? null : draft.usage,
        frequency,
      },
    }
  }
  return {
    kind: "patch",
    itemId: draft.target.item.id,
    body: {
      ...(draft.typeChosen && draft.productType ? { productType: draft.productType } : {}),
      ...(draft.usageDecided ? { usage: draft.usage } : {}),
      frequency,
    },
  }
}

/**
 * A card tap (or its „Wie oft?" pill, `frequencyOnly`): the sheet opens at the product's
 * first question with her current answers in plum. `null` for a „benutzt sie nicht" row.
 *
 *  - type-open („Weiß ich nicht" at capture): the spray question for a spray, else „Was ist
 *    das?" — the type, once answered, opens its research server-side;
 *  - a type with a usage question (R9, D1): that question;
 *  - everything else (fixed types, styling, „Wie oft?"): straight to the frequency.
 */
export function openAddEdit(
  item: DiscoveryIntakeItemView,
  items: Items,
  options: { frequencyOnly?: boolean } = {},
): AddFlow | null {
  if (!isProductItem(item)) return null
  const draft: AddDraft = {
    target: { kind: "change", item },
    subject: itemSubject(item),
    productType: item.productType ?? null,
    usage: item.category ? { category: item.category, role: item.usageRole ?? null } : null,
    typeChosen: false,
    usageDecided: false,
  }
  const flow: AddFlow = { mode: "edit", slot: null, steps: [], draft, direction: 1 }
  const single = (step: AddStep): AddFlow => ({ ...flow, steps: [step] })

  if (options.frequencyOnly || item.productType === DISCOVERY_STYLING_PRODUCT_TYPE) {
    return single(frequencyStep(draft, items))
  }
  const type = item.productType ?? item.category
  if (!type) {
    const classified = classifyDiscoveryProduct({ name: item.productNameText })
    if (classified.step.kind === "spray") {
      return single({
        kind: "spray",
        question: DISCOVERY_SPRAY_QUESTION,
        highlighted: "spray_unknown",
      })
    }
    return single({ kind: "type", current: "unknown" })
  }
  const step = discoveryUsageStepFor(type, item.productNameText)
  if (step.kind === "ask") {
    return single({
      kind: "usage",
      question: step.question,
      highlighted: usageKeyOf(step.question, draft.usage),
    })
  }
  return single(frequencyStep(draft, items))
}

/** The pinned header's capsule while the flow runs: the usage, else the type. */
export function draftCapsule(draft: AddDraft): string | null {
  if (draft.productType === DISCOVERY_STYLING_PRODUCT_TYPE) return DISCOVERY_STYLING_CAPSULE_LABEL
  if (draft.usage) {
    return capsuleLabel({
      category: draft.usage.category,
      productType: draft.productType,
      usageRole: draft.usage.role,
    })
  }
  return draft.productType ? categoryLabel(draft.productType) : null
}
