import { createHash } from "node:crypto"
import { pathToFileURL } from "node:url"

import { config as loadEnv } from "dotenv"
import { existsSync } from "node:fs"
import { join, sep } from "node:path"

import {
  HEAT_ACTIVATION_ROUTES,
  type HeatActivationRoute,
} from "../../src/lib/heat-activation/contract"
import {
  planCatalogChangeRepick,
  recomputeRoutineAfterCatalogChange,
} from "../../src/lib/personal-plan/refinement-recompute/catalog-change"
import {
  createProductionCatalogChangeDeps,
  createProductionCatalogFitProbe,
} from "../../src/lib/personal-plan/refinement-recompute/catalog-change-production"
import { createSupabaseStage3ProductionPersistence } from "../../src/lib/personal-plan/products/stage3-persistence-supabase"
import { createProductionStage3RecomputeDeps } from "../../src/lib/personal-plan/refinement-recompute/production-deps"
import type { PlanProductRole } from "../../src/lib/personal-plan/types"
import { createAdminClient } from "../../src/lib/supabase/admin"

/**
 * Catalogue-change re-pick (Nick Q8, 2026-10-13; S3 + S5 T5.5b): for every plan whose
 * ACTIVE routine plans `--product` in `--role`, re-check the product's fit and re-pick
 * the slot to the authority's next-best product through the headless recompute lane
 * (`recomputeRoutineAfterCatalogChange`). Owned or explicitly chosen products are never
 * replaced — they are listed as needs-attention.
 *
 *   node --import ./tests/server-only-register.cjs --import tsx \
 *     scripts/personal-plan/repick-planned-products.ts --product <id> --role <role> --dry-run \
 *     [--simulate-heat-activation airflow_shaping]
 *   … --apply --confirm        (Nick runs this after approving the dry run)
 *
 * `--dry-run` reads only. `--simulate-heat-activation` (dry run only) evaluates the
 * product as heat-activated before the S3 data batch is applied. Owner-scoped per plan,
 * idempotent (a re-run reports `unchanged`), prints plan ids only as short hashes.
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment.
 */

type Args = {
  productId: string
  role: PlanProductRole
  mode: "dry-run" | "apply"
  confirm: boolean
  simulateRoute: HeatActivationRoute | null
}

export function parseArgs(argv: readonly string[]): Args {
  const value = (flag: string) => {
    const index = argv.indexOf(flag)
    return index >= 0 ? (argv[index + 1] ?? null) : null
  }
  const productId = value("--product")
  const role = value("--role")
  const dryRun = argv.includes("--dry-run")
  const apply = argv.includes("--apply")
  const simulate = value("--simulate-heat-activation")
  if (!productId || !role) throw new Error("usage: --product <id> --role <role> --dry-run|--apply")
  if (dryRun === apply) throw new Error("exactly one of --dry-run or --apply")
  if (simulate !== null && !(HEAT_ACTIVATION_ROUTES as readonly string[]).includes(simulate))
    throw new Error("--simulate-heat-activation must be a heat-activation route")
  if (simulate !== null && apply) throw new Error("--simulate-heat-activation is dry-run only")
  return {
    productId,
    role: role as PlanProductRole,
    mode: dryRun ? "dry-run" : "apply",
    confirm: argv.includes("--confirm"),
    simulateRoute: simulate as HeatActivationRoute | null,
  }
}

export function assertApplyAllowed(args: Args): void {
  if (args.mode === "apply" && !args.confirm)
    throw new Error("--apply refuses without --confirm (Nick runs the apply after approval)")
}

export const planHash = (planId: string) =>
  createHash("sha256").update(planId).digest("hex").slice(0, 12)

function loadLocalEnv(): void {
  const cwd = process.cwd()
  const candidates = [join(cwd, ".env.local")]
  const worktreeIndex = cwd.indexOf(`${sep}.worktrees${sep}`)
  if (worktreeIndex >= 0) candidates.push(join(cwd.slice(0, worktreeIndex), ".env.local"))
  for (const envPath of [...new Set(candidates)])
    if (existsSync(envPath)) loadEnv({ path: envPath })
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  assertApplyAllowed(args)
  loadLocalEnv()
  const admin = createAdminClient()

  // Plans whose ACTIVE routine names the product (narrowed per owner below).
  const { data: plans, error } = await admin
    .from("personal_plans")
    .select("id,user_id,active_routine_version_id")
    .not("active_routine_version_id", "is", null)
  if (error) throw new Error("repick_plans_unavailable")
  const rows: Array<Record<string, string>> = []
  for (const plan of plans ?? []) {
    const { data: version } = await admin
      .from("personal_plan_routine_versions")
      .select("payload")
      .eq("id", plan.active_routine_version_id)
      .eq("user_id", plan.user_id)
      .maybeSingle()
    if (!version || !JSON.stringify(version.payload).includes(args.productId)) continue

    const input = {
      userId: plan.user_id as string,
      personalPlanId: plan.id as string,
      productId: args.productId,
      role: args.role,
    }
    if (args.mode === "dry-run") {
      const probe = createProductionCatalogFitProbe(
        admin,
        args.simulateRoute
          ? { productId: args.productId, heatActivationRoute: args.simulateRoute }
          : undefined,
      )
      const recomputeDeps = createProductionStage3RecomputeDeps({ userId: input.userId, admin })
      const planned = await planCatalogChangeRepick(
        {
          routineState: recomputeDeps.routineState,
          persistence: createSupabaseStage3ProductionPersistence(admin),
          catalogFit: probe,
        },
        input,
      )
      let replacement = ""
      if (planned.status === "repick") {
        const affected = planned.routine.payload.items.find(
          (item) => item.sourceDecisionKeys[0] === planned.subjects[0]?.subjectKey,
        )
        const next = await probe.previewNextBest({
          ...input,
          refinedVersionId: planned.routine.source.refinedVersionId,
          category: affected?.category ?? "leave_in",
        })
        replacement = next ? `${next.displayName} (${next.productId})` : "— (gap)"
      }
      rows.push({
        plan: planHash(input.personalPlanId),
        status: planned.status,
        ...(planned.status === "needs_attention"
          ? { reason: planned.cases.map((entry) => entry.reason).join(",") }
          : {}),
        ...(replacement ? { replacement } : {}),
      })
    } else {
      const result = await recomputeRoutineAfterCatalogChange(
        createProductionCatalogChangeDeps({ userId: input.userId, admin }),
        input,
      )
      rows.push({
        plan: planHash(input.personalPlanId),
        status: result.status,
        ...(result.status === "unavailable" ? { reason: result.reason } : {}),
        ...(result.status === "applied"
          ? { replacement: result.repicked.map((entry) => entry.toProductId ?? "gap").join(",") }
          : {}),
      })
    }
  }
  console.table(rows)
  const counts = rows.reduce<Record<string, number>>(
    (total, row) => ({ ...total, [row.status]: (total[row.status] ?? 0) + 1 }),
    {},
  )
  console.log(JSON.stringify({ mode: args.mode, product: args.productId, role: args.role, counts }))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) void main()
