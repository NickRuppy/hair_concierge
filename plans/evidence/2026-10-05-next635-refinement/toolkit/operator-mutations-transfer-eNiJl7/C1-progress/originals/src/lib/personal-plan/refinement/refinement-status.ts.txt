import { z } from "zod"

import {
  isModuleBannerDismissed,
  type ModuleBannerDismissalState,
} from "@/lib/personal-plan/lifecycle/repository"
import { stage2ModuleStates, type Stage2ModuleStatusInput } from "./module-status"
import { STAGE2_MODULES, type Stage2ModuleProjections } from "./types"

/**
 * The read-only module-status contract PR 2's Routine banner and Profil tab
 * consume (Task 1.7). Pure derivation over already-loaded state — no I/O here;
 * the route (`/api/personal-plan/refinement-status`) owns loading the draft,
 * the initial-need trigger context, and the banner-dismissal marks.
 *
 * Progress semantics (decision 4, Nick): the coarse "X von 4" counts
 * Haar-Analyse (quiz) and Idealplan as always done for a plan owner — a
 * `personal_plans` row cannot exist without both — plus the two Stage-2
 * modules, counted done only once EVERY question the module currently has on
 * its path carries user provenance (see `module-status.ts`).
 */

const BASE_COMPLETED_STEPS = 2
const TOTAL_STEPS = 4

export const refinementModuleStatusSchema = z.object({
  module: z.enum(STAGE2_MODULES),
  status: z.enum(["open", "complete"]),
  openQuestionCount: z.number().int().nonnegative(),
})
export type RefinementModuleStatus = z.infer<typeof refinementModuleStatusSchema>

export const refinementStatusBannerSchema = z.object({
  visible: z.boolean(),
  /** The next open module the banner would point at, even while dismissed/not visible. */
  module: z.enum(STAGE2_MODULES).nullable(),
  dismissed: z.boolean(),
})
export type RefinementStatusBanner = z.infer<typeof refinementStatusBannerSchema>

export const refinementStatusResponseSchema = z.object({
  modules: z.array(refinementModuleStatusSchema).length(STAGE2_MODULES.length),
  progress: z.object({
    completedSteps: z.number().int().min(0).max(TOTAL_STEPS),
    totalSteps: z.literal(TOTAL_STEPS),
  }),
  /**
   * The persisted Modul-1 handoff marker (`module_projections.products.stage3Handoff`,
   * Task 1.4): true once the `products` module has been completed at least once, so
   * Stage-3 re-entry survives a reload even while the draft is still `in_progress`.
   *
   * Named for what it is, not what a consumer might do with it: this is a persistent
   * "has `products` ever handed off" fact, not a one-shot "pending, still needs
   * consuming" signal — Task 1.4's data model has no "consumed" state, so it never
   * resets. A consumer that needs one-shot behavior (e.g. auto-navigate to Stage 3
   * exactly once) must track "already consumed" on its own side.
   */
  module1HandedOff: z.boolean(),
  banner: refinementStatusBannerSchema,
})
export type RefinementStatusResponse = z.infer<typeof refinementStatusResponseSchema>

export function buildRefinementStatusResponse(input: {
  moduleStatusInput: Stage2ModuleStatusInput
  moduleProjections: Stage2ModuleProjections
  bannerDismissals: ModuleBannerDismissalState
}): RefinementStatusResponse {
  const states = stage2ModuleStates(input.moduleStatusInput)
  const modules: RefinementModuleStatus[] = STAGE2_MODULES.map((stage2Module) => ({
    module: stage2Module,
    status: states[stage2Module].status,
    openQuestionCount: states[stage2Module].openQuestionIds.length,
  }))
  const completedModuleCount = modules.filter((entry) => entry.status === "complete").length

  // The banner always points at the first open module in canonical order
  // (products, then habits) — "the next open module" from module-status.ts's
  // per-module dismissal contract.
  const nextOpenModule =
    STAGE2_MODULES.find((stage2Module) => states[stage2Module].status === "open") ?? null
  const dismissed = nextOpenModule
    ? isModuleBannerDismissed(input.bannerDismissals, nextOpenModule)
    : false

  return refinementStatusResponseSchema.parse({
    modules,
    progress: {
      completedSteps: BASE_COMPLETED_STEPS + completedModuleCount,
      totalSteps: TOTAL_STEPS,
    },
    module1HandedOff: input.moduleProjections.products?.stage3Handoff === true,
    banner: {
      visible: nextOpenModule !== null && !dismissed,
      module: nextOpenModule,
      dismissed,
    },
  })
}
