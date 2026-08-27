import type { Stage3DecisionDeferralReason } from "@/lib/personal-plan/products/contracts"

import type { RefinementStatusResponse } from "./refinement-status"
import type { Stage2Module } from "./types"

/**
 * View model of the Profil tab's „Dein Haarprofil" section (Task 2.5) — the
 * durable home of the Feinschliff (mockup screen 2, signed off 25.08.2026).
 *
 * Pure derivation over the refinement-status contract (Task 1.7). The section
 * NEVER re-derives module status, progress or handoff state on the client: the
 * only inputs are that server response plus one already-loaded cohort fact.
 *
 * Decision 6: no minutes in these rows — the duration hint lives on the Routine
 * banner's button alone.
 */

export type HairProfileSectionRowKey = "hair_analysis" | "ideal_plan" | "products" | "habits"

export type HairProfileSectionRow = {
  key: HairProfileSectionRowKey
  label: string
  status: "done" | "open"
  /** 1-based step, shown in an open row's icon; a done row shows ✓ instead. */
  step: number
  /**
   * Primary target of the whole row. A finished MODULE deliberately has none
   * (2.4 M4): re-entering a module the user already answered is an edit visit,
   * not a chevron row that makes re-walking feel accidental. „Dein Plan"
   * keeps its link because it points at the plan view, not into a re-walk.
   */
  href: string | null
  /** Quiet secondary edit entry for a finished module (2.4 M4). */
  editHref: string | null
  /** One-line sub-note under the row label. */
  note: string | null
}

export type HairProfileSectionViewModel = {
  completedSteps: number
  totalSteps: number
  /** Width of the plum bar, already clamped to 0…100. */
  progressPercent: number
  rows: HairProfileSectionRow[]
}

const MODULE_LABELS: Record<Stage2Module, string> = {
  products: "Deine Produkte",
  habits: "Deine Gewohnheiten",
}

/** Where the plan itself lives: the accepted Routine is the plan view. */
const PLAN_VIEW_HREF = "/routine"

const moduleHref = (stage2Module: Stage2Module) => `/plan-start?refine=${stage2Module}`

/**
 * Partially-deferred cohort signal (2.1 M4 successor): Stage 3 may leave a role
 * uncovered with the server-derived reason `refinement_required`. That is the one
 * deferral the products module actually unlocks — `no_product` and
 * `preview_unavailable` are not resolved by answering anything.
 *
 * Read off the portfolio presentation the Profil tab already loads, so this costs
 * no extra request.
 */
export function hasRefinementDeferredRoles(
  presentation: { deferredRoleReasons?: Record<string, Stage3DecisionDeferralReason> } | null,
): boolean {
  return Object.values(presentation?.deferredRoleReasons ?? {}).some(
    (reason) => reason === "refinement_required",
  )
}

/**
 * Structural guard for the fetched `refinement-status` body. The route validates
 * its own response with zod, but that schema lives behind server-side imports —
 * so the client keeps this narrow check instead of pulling the schema into the
 * bundle. Anything unexpected leaves the section absent rather than throwing
 * inside the Profil page's render.
 */
export function parseHairProfileStatus(body: unknown): RefinementStatusResponse | null {
  if (!body || typeof body !== "object") return null
  const candidate = body as Partial<RefinementStatusResponse>
  const progress = candidate.progress
  if (!Array.isArray(candidate.modules)) return null
  if (
    !progress ||
    typeof progress.completedSteps !== "number" ||
    typeof progress.totalSteps !== "number"
  ) {
    return null
  }
  return candidate as RefinementStatusResponse
}

export function buildHairProfileSection(input: {
  status: RefinementStatusResponse
  /** True only when `hasRefinementDeferredRoles` holds for this plan. */
  deferredRolesPendingRefinement?: boolean
}): HairProfileSectionViewModel {
  const { completedSteps, totalSteps } = input.status.progress
  const moduleStatus = (stage2Module: Stage2Module): "done" | "open" =>
    input.status.modules.find((entry) => entry.module === stage2Module)?.status === "complete"
      ? "done"
      : "open"

  const moduleRow = (stage2Module: Stage2Module, step: number): HairProfileSectionRow => {
    const status = moduleStatus(stage2Module)
    const open = status === "open"
    return {
      key: stage2Module,
      label: MODULE_LABELS[stage2Module],
      status,
      step,
      href: open ? moduleHref(stage2Module) : null,
      editHref: open ? null : moduleHref(stage2Module),
      note:
        open && stage2Module === "products" && input.deferredRolesPendingRefinement
          ? "Schaltet offene Empfehlungen frei."
          : null,
    }
  }

  return {
    completedSteps,
    totalSteps,
    progressPercent:
      totalSteps > 0 ? Math.max(0, Math.min(100, (completedSteps / totalSteps) * 100)) : 0,
    rows: [
      // A `personal_plans` row cannot exist without both of these (decision 4),
      // so they are structurally done for every owner of this section.
      {
        key: "hair_analysis",
        label: "Haar-Analyse",
        status: "done",
        step: 1,
        href: null,
        editHref: null,
        note: null,
      },
      {
        key: "ideal_plan",
        label: "Dein Plan",
        status: "done",
        step: 2,
        href: PLAN_VIEW_HREF,
        editHref: null,
        note: null,
      },
      moduleRow("products", 3),
      moduleRow("habits", 4),
    ],
  }
}
