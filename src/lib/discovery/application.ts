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
import { PERSONAL_PLAN_STAGE5_CONTRACT_VERSION } from "@/lib/personal-plan/stage5-access"
import { projectApplicationCadenceByDay } from "@/lib/routines/personal-plan/application/cadence-projector"
import { compileApplicationViewV2 } from "@/lib/routines/personal-plan/application/compiler-v2"
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
 */

const CONTRACT_VERSION = PERSONAL_PLAN_STAGE5_CONTRACT_VERSION

// --- printed products → routine candidates ------------------------------------------------

/**
 * The sheet's printed products as application candidates, in routine order. Only what the
 * document prints: a kept product, a readable swap target, the Idealplan's pick on an open
 * step. An undecided step prints „Noch offen" and has nothing to apply yet.
 */
export function discoveryApplicationCandidates(
  routine: Pick<DiscoveryRefinedRoutine, "steps">,
): ApplicationRoutineProductCandidate[] {
  return routine.steps.flatMap((entry, index): ApplicationRoutineProductCandidate[] => {
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
      },
    ]
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

function printDay(day: ApplicationDayView): DiscoveryApplicationPrintDay {
  return {
    dayType: day.dayType,
    label: day.labelDe,
    summary: day.summaryDe,
    cadence: day.cadenceDe ? sentenceCase(day.cadenceDe) : null,
    steps: day.steps.map((step): DiscoveryApplicationPrintStep => {
      if (step.kind === "product") {
        return {
          kind: "product",
          productId: step.productId,
          name: step.productName,
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
export function discoveryApplicationPrint(view: ApplicationPageView): DiscoveryApplicationPrint {
  if (view.state !== "ready") return { days: [] }
  return {
    days: [...view.days]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .filter((day) => day.dayType !== "rest_day")
      .map(printDay),
  }
}

/**
 * Printed products the compiled page cannot fully instruct: one the catalog no longer
 * serves under its identity, one that appears on no application day at all, or one that
 * sits as an unresolved slot on any day. Named by the sheet's own label, in routine order.
 */
export function discoveryApplicationGaps(input: {
  candidates: readonly ApplicationRoutineProductCandidate[]
  degradedProductIds: ReadonlySet<string>
  view: ApplicationPageView
}): DiscoveryApplicationGap[] {
  const days = input.view.state === "ready" ? input.view.days : []
  const instructed = new Set<string>()
  const unresolved = new Set<string>()
  for (const day of days) {
    for (const step of day.steps) {
      if (step.kind === "product") instructed.add(step.productId)
      if (step.kind === "unresolved_product" && step.productId) unresolved.add(step.productId)
    }
  }
  const gaps: DiscoveryApplicationGap[] = []
  const seen = new Set<string>()
  for (const candidate of input.candidates) {
    if (seen.has(candidate.productId)) continue
    if (
      input.degradedProductIds.has(candidate.productId) ||
      !instructed.has(candidate.productId) ||
      unresolved.has(candidate.productId)
    ) {
      seen.add(candidate.productId)
      gaps.push({ productId: candidate.productId, name: candidate.productName })
    }
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
  candidates: readonly ApplicationRoutineProductCandidate[]
  catalog: ApplicationCatalogRows
  dayDefinitions: readonly ApplicationDayTypeDefinition[]
  familyTemplates: readonly ApplicationFamilyTemplateV2[]
  profile: NormalizedProfile
}): DiscoveryApplication {
  const normalized = normalizeApplicationRoutineProducts({
    ...input.catalog,
    candidates: input.candidates,
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
  const view = toApplicationPageView({
    compiled,
    dayDefinitions: input.dayDefinitions,
    cadenceByDay: projectApplicationCadenceByDay({
      routineItems: normalized.routineItems,
      compiledDayKeys: compiled.days.map((day) => day.key),
    }),
  })
  return {
    print: discoveryApplicationPrint(view),
    gaps: discoveryApplicationGaps({
      candidates: input.candidates,
      degradedProductIds: new Set(normalized.degradedItems.map((item) => item.productId)),
      view,
    }),
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
  })
}
