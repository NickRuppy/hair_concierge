import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  ApplicationDayView,
  ApplicationPageView,
} from "@/components/application/application-types"
import { toApplicationPageView } from "@/components/application/application-view-adapter"
import { unresolvedProductCopyDe } from "@/components/application/unresolved-product-block"
import {
  normalizeApplicationRoutineProducts,
  normalizedProfileFromNeedSnapshot,
  readApplicationCatalogRows,
  type ApplicationCatalogRows,
  type ApplicationRoutineProductCandidate,
  type ApplicationRoutineReadClient,
} from "@/lib/personal-plan/routine/application-adapter"
import { CATEGORY_LABELS } from "@/lib/personal-plan/decision-presentation"
import { CATEGORY_ROLE_POLICIES } from "@/lib/personal-plan/products/authorities"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { SEMANTIC_ROLE_BY_ROUTINE_ROLE } from "@/lib/personal-plan/routine/application-adapter"
import { PERSONAL_PLAN_STAGE5_CONTRACT_VERSION } from "@/lib/personal-plan/stage5-access"
import type { PlanProductRole } from "@/lib/personal-plan/types"
import { projectApplicationCadenceByDay } from "@/lib/routines/personal-plan/application/cadence-projector"
import { compileApplicationViewV2 } from "@/lib/routines/personal-plan/application/compiler-v2"
import { adaptReviewedProductApplicationPointersV2 } from "@/lib/routines/personal-plan/application/product-protocol-adapter"
import type {
  ApplicationDayTypeKey,
  NormalizedProfile,
} from "@/lib/routines/personal-plan/application/contracts"
import {
  applicationFamilyTemplateV2Schema,
  type ApplicationFamilyTemplateV2,
} from "@/lib/routines/personal-plan/application/contracts-v2"
import {
  createApplicationGuidanceRepository,
  type ApplicationContentQueryClient,
  type ApplicationDayTypeDefinition,
} from "@/lib/routines/personal-plan/application/repository"
import type { ScanEvaluationContext } from "@/lib/scan/profile-context"

import { discoveryCadenceLabel } from "./cadence-label"
import { isDiscoveryUsageWithinProductFamily } from "./classify"
import type { DiscoveryRefinedRoutine } from "./refined-routine"

/**
 * „So wendest du es an" on the participant's sheet (batch 6): the PRODUCTION application
 * pipeline (`/anwendung`), run read-only over the products the call sheet prints.
 *
 * Nothing about how a product is applied is decided here. The guidance is what research
 * verified per product (`product_application_protocols`) composed with the shared family
 * templates (`application_guidance_protocols`), through the same pieces the Anwendung page
 * runs — `readApplicationCatalogRows` / `normalizeApplicationRoutineProducts` (the accepted
 * Routine's adapter, split so a caller can name its own products), `compileApplicationViewV2`,
 * `projectApplicationCadenceByDay` and `toApplicationPageView`. Only two inputs differ:
 *
 *  - **The products** are the sheet's printed ones — kept, swapped-in and newly recommended
 *    — with the Idealplan step's own role and the cadence the sheet prints for that step.
 *    No Personal Plan artifact is read: the participant has no accepted Routine.
 *  - **The profile** comes from the evaluation context the cockpit already prepared (it may
 *    be an `initial` need snapshot — `loadImmutableRoutineProfile` would insist on a
 *    `refined` need version), through the same pure `normalizedProfileFromNeedSnapshot`.
 *
 * A printed product the compiler cannot give complete guidance for is a GAP: the cockpit
 * names it and finalising waits (Nick, 2026-09-24) — never an invented instruction.
 *
 * A product she uses differently from what it IS, within its family (a conditioner as a
 * mask, an oil on the scalp — `isDiscoveryUsageWithinProductFamily`), prints the product's
 * OWN verified guidance with the note „als Maske benutzt" (Nick, 2026-09-24): see
 * `resolveDiscoveryUsageDifferences`. Any other category conflict stays a gap.
 */

const CONTRACT_VERSION = PERSONAL_PLAN_STAGE5_CONTRACT_VERSION

// --- printed products → routine candidates ------------------------------------------------

/**
 * A printed product as an application candidate. For her own product, `typed` says the row
 * carries a batch-5 product type (only then may a usage difference be legitimate, as in the
 * verdict loader) and `usageLabel` is the sheet's „als Maske benutzt" when it has one.
 */
export type DiscoveryApplicationCandidate = ApplicationRoutineProductCandidate & {
  typed?: boolean
  usageLabel?: string
  /**
   * For a usage difference: the product's verified roles in the deterministic order (see
   * `resolveDiscoveryUsageDifferences`); the compile picks the first that fully compiles.
   */
  roleOptions?: PlanProductRole[]
}

/**
 * The sheet's printed products as application candidates, in routine order. Only what the
 * document prints: a kept product, a readable swap target, the Idealplan's pick on an open
 * step. An undecided step prints „Noch offen" and has nothing to apply yet.
 */
export function discoveryApplicationCandidates(
  routine: Pick<DiscoveryRefinedRoutine, "steps">,
): DiscoveryApplicationCandidate[] {
  return routine.steps.flatMap((entry, index): DiscoveryApplicationCandidate[] => {
    const { step } = entry
    const printed =
      entry.outcome === "kept" && entry.item?.productId && entry.ownedLabel
        ? { productId: entry.item.productId, name: entry.ownedLabel, kind: "owned" as const }
        : entry.outcome === "swapped" && entry.swapProduct && entry.swapProductLabel
          ? {
              productId: entry.swapProduct.id,
              name: entry.swapProductLabel,
              kind: "planned" as const,
            }
          : entry.outcome === "ideal" &&
              step.preview?.kind === "recommendation" &&
              entry.recommendationLabel
            ? {
                productId: step.preview.productId,
                name: entry.recommendationLabel,
                kind: "planned" as const,
              }
            : null
    if (!printed) return []
    return [
      {
        itemId: step.decisionKey,
        applicationInstanceKey: step.decisionKey,
        routineOrder: index,
        category: step.category,
        routineRole: step.role,
        productId: printed.productId,
        productName: printed.name,
        kind: printed.kind,
        // Agreed in the call: every printed product is one she uses from now on.
        executable: true,
        effectiveCadenceDe: discoveryCadenceLabel(step.frequencyLabel),
        ...(printed.kind === "owned" && entry.item?.productType !== undefined
          ? { typed: true }
          : {}),
        ...(printed.kind === "owned" && entry.ownedUsageLabel
          ? { usageLabel: entry.ownedUsageLabel }
          : {}),
      },
    ]
  })
}

function isPlanCategory(value: unknown): value is PersonalPlanCategory {
  return typeof value === "string" && value in CATEGORY_ROLE_POLICIES
}

/**
 * Nick's ruling (2026-09-24) for her own product used differently from what it IS, within
 * the product's family: it is instructed as what it is — its own catalog category and the
 * role its verified protocol exists for — and carries the usage note.
 *
 * The role, deterministically: the roles this product has a verified (V2) pointer for in
 * its own category, ordered
 *   1. Idealplan step roles of that category (routine order), then
 *   2. the category's `allowedRoles` (policy order).
 * This returns the first as `routineRole` and the whole order as `roleOptions`;
 * `compileDiscoveryApplication` then keeps the first role whose guidance compiles WITHOUT
 * a pointer issue or unresolved slot for this product in this routine. If none does (or
 * there is no verified role at all — then the category's first allowed role), it is a gap,
 * never invented guidance.
 *
 * Out-of-family conflicts, legacy rows without a product type, swaps and recommendations
 * are left untouched (a category conflict there stays a gap).
 */
export function resolveDiscoveryUsageDifferences(input: {
  candidates: readonly DiscoveryApplicationCandidate[]
  catalog: ApplicationCatalogRows
  idealRoles: readonly { category: PersonalPlanCategory; role: PlanProductRole }[]
}): DiscoveryApplicationCandidate[] {
  const pointers = adaptReviewedProductApplicationPointersV2(input.catalog.protocolRows)
  return input.candidates.map((candidate) => {
    if (candidate.kind !== "owned" || !candidate.typed) return candidate
    const product = input.catalog.products.get(candidate.productId)
    const own = product?.category_key ?? product?.category
    if (!isPlanCategory(own) || own === candidate.category) return candidate
    const usage = candidate.category as PersonalPlanCategory
    if (!isDiscoveryUsageWithinProductFamily(own, usage)) return candidate
    const verified = new Set(
      pointers
        .filter(
          (pointer) =>
            pointer.scope.productId === candidate.productId && pointer.scope.category === own,
        )
        .map((pointer) => pointer.sourceRole),
    )
    const allowed = CATEGORY_ROLE_POLICIES[own].allowedRoles as readonly PlanProductRole[]
    const roleOptions = [
      ...new Set([
        ...input.idealRoles
          .filter((entry) => entry.category === own && verified.has(entry.role))
          .map((entry) => entry.role),
        ...allowed.filter((entry) => verified.has(entry)),
      ]),
    ]
    return {
      ...candidate,
      category: own,
      routineRole: roleOptions[0] ?? allowed[0]!,
      roleOptions,
      usageLabel: candidate.usageLabel ?? `als ${CATEGORY_LABELS[usage]} benutzt`,
    }
  })
}

/** The application profile from the context the cockpit already holds — no need-version read. */
export function discoveryApplicationProfile(
  context: Pick<ScanEvaluationContext, "snapshot">,
): NormalizedProfile {
  return normalizedProfileFromNeedSnapshot(context.snapshot)
}

// --- the printed section ------------------------------------------------------------------

export type DiscoveryApplicationPrintStep =
  | {
      kind: "product"
      productId: string
      name: string
      /** „als Maske benutzt" — present ONLY for a usage difference (hash-stable otherwise). */
      usage?: string
      imageUrl: string | null
      categoryLabel: string
      purpose: string
      /** The verified steps in order — amounts live in the step copy, as on `/anwendung`. */
      actions: string[]
      note: string | null
    }
  | { kind: "transition"; copy: string }
  | { kind: "unresolved"; categoryLabel: string; title: string; body: string }

export type DiscoveryApplicationPrintDay = {
  dayType: ApplicationDayTypeKey
  label: string
  summary: string
  cadence: string | null
  steps: DiscoveryApplicationPrintStep[]
}

/** Exactly what the sheet prints — and so exactly what `sourceHash` covers. */
export type DiscoveryApplicationPrint = { days: DiscoveryApplicationPrintDay[] }

/** A printed product without complete verified guidance (finalising waits for it). */
export type DiscoveryApplicationGap = { productId: string; name: string }

function sentenceCase(value: string): string {
  return value ? `${value.charAt(0).toLocaleUpperCase("de-DE")}${value.slice(1)}` : value
}

/** The usage note for one printed product block (product AND the roles it instructs). */
type DiscoveryUsageLookup = (
  dayType: ApplicationDayTypeKey,
  productId: string,
  applicationInstanceKey: string,
) => string | undefined

function printDay(
  day: ApplicationDayView,
  usageOf: DiscoveryUsageLookup,
): DiscoveryApplicationPrintDay {
  return {
    dayType: day.dayType,
    label: day.labelDe,
    summary: day.summaryDe,
    cadence: day.cadenceDe ? sentenceCase(day.cadenceDe) : null,
    steps: day.steps.map((step): DiscoveryApplicationPrintStep => {
      if (step.kind === "product") {
        const usage = usageOf(day.dayType, step.productId, step.applicationInstanceKey)
        return {
          kind: "product",
          productId: step.productId,
          name: step.productName,
          ...(usage ? { usage } : {}),
          imageUrl: step.imageUrl,
          categoryLabel: step.categoryLabelDe,
          purpose: step.purposeDe,
          actions: step.actions.map((action) => action.copyDe),
          note: step.coverageNoteDe,
        }
      }
      if (step.kind === "unresolved_product") {
        const copy = unresolvedProductCopyDe(step)
        return {
          kind: "unresolved",
          categoryLabel: step.categoryLabelDe,
          title: copy.titleDe,
          body: copy.bodyDe,
        }
      }
      return { kind: "transition", copy: step.copyDe }
    }),
  }
}

/**
 * The production page's view as the sheet prints it: every application day in the page's
 * own order, without the rest day (nothing to apply). A page with no complete day prints
 * no section at all.
 */
export function discoveryApplicationPrint(
  view: ApplicationPageView,
  usageOf: DiscoveryUsageLookup = () => undefined,
): DiscoveryApplicationPrint {
  if (view.state !== "ready") return { days: [] }
  return {
    days: [...view.days]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .filter((day) => day.dayType !== "rest_day")
      .map((day) => printDay(day, usageOf)),
  }
}

/**
 * Printed products the compiled page cannot fully instruct — checked per printed candidate
 * (product AND role), because one product may print in two roles with guidance for only
 * one of them. A candidate is a gap when
 *  - the catalog no longer serves it under its identity (demoted to unresolved),
 *  - the V2 compiler reported a pointer issue for its product and role (no pointer, no
 *    family template, missing contact time, companion missing …),
 *  - no compiled day instructs its product in its role, or
 *  - it sits as an unresolved slot on any compiled day.
 * Named by the sheet's own label, in routine order, each name once.
 */
type DiscoveryCompileRun = {
  degradedItemIds: ReadonlySet<string>
  compiled: ReturnType<typeof compileApplicationViewV2>
}

/** Is this printed candidate (product AND role) without complete guidance in this run? */
function discoveryCandidateHasGap(
  candidate: ApplicationRoutineProductCandidate,
  run: DiscoveryCompileRun,
): boolean {
  const role = SEMANTIC_ROLE_BY_ROUTINE_ROLE[candidate.routineRole]
  const productId = candidate.productId
  const pointerIssue = run.compiled.pointerIssues.some(
    (issue) => issue.productId === productId && issue.role === role,
  )
  const instructed = run.compiled.days.some((day) =>
    day.productBlocks.some((block) => block.productId === productId && block.roles.includes(role)),
  )
  const unresolved = run.compiled.days.some((day) =>
    day.outerSequence.some(
      (step) =>
        step.kind === "unresolved_product" &&
        step.block.productId === productId &&
        step.block.role === role,
    ),
  )
  return run.degradedItemIds.has(candidate.itemId) || pointerIssue || !instructed || unresolved
}

export function discoveryApplicationGaps(
  input: { candidates: readonly ApplicationRoutineProductCandidate[] } & DiscoveryCompileRun,
): DiscoveryApplicationGap[] {
  const gaps: DiscoveryApplicationGap[] = []
  const seen = new Set<string>()
  for (const candidate of input.candidates) {
    if (!discoveryCandidateHasGap(candidate, input)) continue
    const key = `${candidate.productId}\u0000${candidate.productName}`
    if (seen.has(key)) continue
    seen.add(key)
    gaps.push({ productId: candidate.productId, name: candidate.productName })
  }
  return gaps
}

// --- compile ------------------------------------------------------------------------------

export type DiscoveryApplication = {
  print: DiscoveryApplicationPrint
  gaps: DiscoveryApplicationGap[]
}

/**
 * Pure: the production compile path (the same calls, in the same order, as
 * `resolveAnwendungPage`) over the discovery candidates.
 */
export function compileDiscoveryApplication(input: {
  candidates: readonly DiscoveryApplicationCandidate[]
  catalog: ApplicationCatalogRows
  dayDefinitions: readonly ApplicationDayTypeDefinition[]
  familyTemplates: readonly ApplicationFamilyTemplateV2[]
  profile: NormalizedProfile
  /** The Idealplan's (category, role) steps in routine order — for usage differences. */
  idealRoles?: readonly { category: PersonalPlanCategory; role: PlanProductRole }[]
}): DiscoveryApplication {
  const run = (trial: readonly DiscoveryApplicationCandidate[]) => {
    const normalized = normalizeApplicationRoutineProducts({
      ...input.catalog,
      candidates: trial,
      contractVersion: CONTRACT_VERSION,
    })
    const compiled = compileApplicationViewV2({
      input: {
        routineItems: normalized.routineItems,
        unresolvedRoutineItems: normalized.unresolvedRoutineItems,
        profile: input.profile,
        dayTypes: input.dayDefinitions.map((day) => ({ key: day.key, sortOrder: day.sortOrder })),
      },
      familyTemplates: input.familyTemplates,
      productPointers: normalized.applicationPointersV2,
    })
    return {
      normalized,
      compiled,
      degradedItemIds: new Set(normalized.unresolvedRoutineItems.map((item) => item.itemId)),
    }
  }
  let candidates = resolveDiscoveryUsageDifferences({
    candidates: input.candidates,
    catalog: input.catalog,
    idealRoles: input.idealRoles ?? [],
  })
  // A usage difference keeps the first role (in its deterministic order) whose guidance
  // fully compiles in THIS routine — a verified pointer can still fail to compose (no family
  // template, a companion missing from the routine …). None → the first role, a gap.
  for (let index = 0; index < candidates.length; index += 1) {
    const options = candidates[index]!.roleOptions ?? []
    if (options.length < 2) continue
    for (const role of options) {
      const trial = candidates.map((candidate, position) =>
        position === index ? { ...candidate, routineRole: role } : candidate,
      )
      if (!discoveryCandidateHasGap(trial[index]!, run(trial))) {
        candidates = trial
        break
      }
    }
  }
  const { normalized, compiled, degradedItemIds } = run(candidates)
  const view = toApplicationPageView({
    compiled,
    dayDefinitions: input.dayDefinitions,
    // Discovery-side projection (Nick, 2026-09-24): every printed product is agreed in the
    // call, so a planned (swapped-in or new) product's cadence names its day too. The
    // projector itself — and so /anwendung — keeps reading owned products only.
    cadenceByDay: projectApplicationCadenceByDay({
      routineItems: normalized.routineItems.map((item) => ({
        ...item,
        availability: "owned" as const,
      })),
      compiledDayKeys: compiled.days.map((day) => day.key),
    }),
  })
  // The note belongs to the printed product IN the role she uses it for — a second printed
  // role of the same product carries none.
  const rolesByBlock = new Map(
    compiled.days.flatMap((day) =>
      day.productBlocks.map((block) => [`${day.key}|${block.applicationInstanceKey}`, block.roles]),
    ),
  )
  const usageOf: DiscoveryUsageLookup = (dayType, productId, applicationInstanceKey) => {
    const roles = rolesByBlock.get(`${dayType}|${applicationInstanceKey}`) ?? []
    return candidates.find(
      (candidate) =>
        candidate.usageLabel &&
        candidate.productId === productId &&
        roles.includes(SEMANTIC_ROLE_BY_ROUTINE_ROLE[candidate.routineRole]),
    )?.usageLabel
  }
  return {
    print: discoveryApplicationPrint(view, usageOf),
    gaps: discoveryApplicationGaps({ candidates, degradedItemIds, compiled }),
  }
}

// --- load ---------------------------------------------------------------------------------

/**
 * The section for a composed routine: the catalog's application facts and reviewed product
 * protocols, the active day definitions and family templates — plain selects, nothing
 * written — then the pure compile. Any read or contract failure throws; the cockpit model
 * turns that into „not available right now" (finalising and the PDF wait), never into a
 * sheet without its guidance.
 */
export async function loadDiscoveryApplication(
  admin: SupabaseClient,
  input: {
    routine: Pick<DiscoveryRefinedRoutine, "steps">
    context: Pick<ScanEvaluationContext, "snapshot">
  },
): Promise<DiscoveryApplication> {
  const candidates = discoveryApplicationCandidates(input.routine)
  if (candidates.length === 0) return { print: { days: [] }, gaps: [] }
  const content = createApplicationGuidanceRepository(
    admin as unknown as ApplicationContentQueryClient,
    { contractVersion: CONTRACT_VERSION },
  )
  const [catalog, dayDefinitions, protocols] = await Promise.all([
    readApplicationCatalogRows({
      client: admin as unknown as ApplicationRoutineReadClient,
      productIds: [...new Set(candidates.map((candidate) => candidate.productId))].sort(),
      contractVersion: CONTRACT_VERSION,
    }),
    content.loadActiveDayTypeDefinitions(),
    content.loadActiveGuidanceProtocols(),
  ])
  return compileDiscoveryApplication({
    candidates,
    catalog,
    dayDefinitions,
    familyTemplates: protocols.map((protocol) =>
      applicationFamilyTemplateV2Schema.parse(protocol.payload),
    ),
    profile: discoveryApplicationProfile(input.context),
    idealRoles: input.routine.steps.map((entry) => ({
      category: entry.step.category,
      role: entry.step.role,
    })),
  })
}
