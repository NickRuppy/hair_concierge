import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  createRoutineProposalStagerRpcAdapter,
  type RoutineProposalRpcClient,
} from "../src/lib/personal-plan/routine-proposal-stager"

const migrationPath = new URL(
  "../supabase/migrations/20260825140000_personal_plan_refinement_recompute_activation.sql",
  import.meta.url,
)

/* ── Migration shape: additive wrapper, service-only, narrow gate ── */

test("the recompute-activation migration wraps the existing RPCs instead of copying them", async () => {
  const source = await readFile(migrationPath, "utf8")

  assert.ok(Buffer.byteLength("personal_plan_complete_draft_activate_v2", "utf8") <= 63)
  assert.match(
    source,
    /CREATE OR REPLACE FUNCTION public\.personal_plan_complete_draft_activate_v2/,
  )
  assert.match(source, /p_mark_unrefined_direct_accept boolean DEFAULT false/)
  assert.match(source, /public\.personal_plan_complete_draft_activate_initial_v1\(/)
  assert.match(source, /public\.personal_plan_confirm_routine_proposal\(/)
  // The immediate activation is gated on server-derived module lineage only.
  assert.match(source, /refinement\.module_projections <> '\{\}'::jsonb/)
  assert.match(source, /projection\.value->>'needVersionId' = v_refined_id::text/)
  assert.match(source, /refinement\.result_refined_need_version_id = v_refined_id/)
  // ...and only for the recompute the module completion itself caused: any
  // earlier Routine from the same version means this is an ordinary successor.
  assert.match(source, /source_refined_need_version_id = v_refined_id/)
  assert.match(source, /prior\.id <> v_routine_id/)
  // No second lifecycle implementation, and no proposal rows of its own.
  assert.doesNotMatch(source, /INSERT INTO public\.personal_plan_routine_/)
  assert.match(source, /RAISE EXCEPTION 'refinement recompute could not activate its successor/)
  // ...but only for a proposal this transaction staged: an unconfirmable
  // proposal on the replay path degrades to reporting it, never a 503 loop.
  assert.match(source, /ELSIF \(v_result->>'status'\) = 'already_completed' THEN/)
  // Source reconciliation never reaches this RPC, so it must not be listed.
  assert.doesNotMatch(source, /editor edits, source reconciliation/)
  assert.match(source, /unrefined_direct_accept = true/)
  assert.match(source, /nudge_dismissed_until = NULL/)
  assert.match(source, /SET search_path = ''/)
  assert.match(
    source,
    /REVOKE ALL ON FUNCTION public\.personal_plan_complete_draft_activate_v2[\s\S]*FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    source,
    /GRANT EXECUTE ON FUNCTION public\.personal_plan_complete_draft_activate_v2[\s\S]*TO service_role/,
  )
  // Never applied from a migration file.
  assert.doesNotMatch(source, /SELECT public\.personal_plan_complete_draft_activate_v2/)
})

test("the recompute-activation migration keeps the provenance write out of the revision CAS", async () => {
  const source = await readFile(migrationPath, "utf8")
  const provenanceWrite = source.slice(source.indexOf("IF p_mark_unrefined_direct_accept THEN"))

  assert.match(provenanceWrite, /UPDATE public\.personal_plans/)
  assert.doesNotMatch(provenanceWrite, /revision = revision \+ 1/)
})

/* ── Behavioral mirror of the SQL, driven through the real stager adapter ── */

type ModuleProjections = Record<string, { needVersionId: string }>

type V2World = {
  plan: {
    activeRoutineVersionId: string | null
    pendingProposalId: string | null
    revision: number
    unrefinedDirectAccept: boolean
  }
  proposals: Array<{ id: string; candidateRoutineVersionId: string; status: string }>
  routineVersions: string[]
  /** routineVersionId -> the refined Need version it was compiled from. */
  routineSources: Record<string, string>
}

/**
 * In-memory mirror of `personal_plan_complete_draft_activate_v2` (SQL cannot be
 * exercised here — the migration is never applied). It models exactly the
 * decision structure the migration pins above: delegate → module-lineage gate →
 * confirm → atomic provenance, with a full rollback on failure.
 */
function createV2Client(options: {
  productDraftRefinedVersionId: string
  refinementDrafts: Array<{
    moduleProjections: ModuleProjections
    resultRefinedNeedVersionId: string | null
  }>
  world: V2World
  draftAlreadyCompleted?: boolean
  provenanceWriteFails?: boolean
  /** Outcome of `personal_plan_confirm_routine_proposal`; defaults to accepted. */
  confirmOutcome?: "accepted" | "stale_source"
  calls?: string[]
}): RoutineProposalRpcClient {
  const { world } = options
  return {
    async rpc(fn, args) {
      options.calls?.push(fn)
      const snapshot = structuredClone(world)
      try {
        // --- personal_plan_complete_draft_activate_initial_v1 -------------
        let routineVersionId: string
        let routineProposalId: string | null
        let status: "completed" | "already_completed"
        if (options.draftAlreadyCompleted) {
          status = "already_completed"
          routineVersionId = world.routineVersions[0]!
          routineProposalId =
            world.proposals.find(
              (proposal) => proposal.candidateRoutineVersionId === routineVersionId,
            )?.id ?? null
          // v1 delegates to `personal_plan_complete_product_draft_and_stage_routine`
          // whenever a Routine is already active, and THAT path returns
          // `routineProposalId` unconditionally. v1's own already-completed
          // branch is reachable only with no active Routine, and is the sole
          // place that nulls the id (`CASE WHEN active IS NOT DISTINCT FROM
          // v_routine_id`). Modeling this faithfully is what makes the replay
          // test actually reach the lineage gate and the accepted-proposal
          // branch below.
          if (
            world.plan.activeRoutineVersionId === null &&
            world.plan.activeRoutineVersionId === routineVersionId
          ) {
            routineProposalId = null
          }
        } else {
          status = "completed"
          routineVersionId = `routine-${world.routineVersions.length + 1}`
          world.routineVersions.push(routineVersionId)
          world.routineSources[routineVersionId] = options.productDraftRefinedVersionId
          if (world.plan.activeRoutineVersionId === null) {
            world.plan.activeRoutineVersionId = routineVersionId
            world.plan.pendingProposalId = null
            routineProposalId = null
          } else {
            routineProposalId = `proposal-${world.proposals.length + 1}`
            world.proposals.push({
              id: routineProposalId,
              candidateRoutineVersionId: routineVersionId,
              status: "pending",
            })
            world.plan.pendingProposalId = routineProposalId
          }
          world.plan.revision += 1
        }
        let revision = world.plan.revision

        // --- module-lineage gate -----------------------------------------
        if (routineProposalId !== null) {
          // Condition 2: this completion's Routine is the first from the version.
          const firstFromVersion = !world.routineVersions.some(
            (id) =>
              id !== routineVersionId &&
              world.routineSources[id] === options.productDraftRefinedVersionId,
          )
          // Condition 1: module lineage.
          const moduleDriven = options.refinementDrafts.some(
            (draft) =>
              Object.keys(draft.moduleProjections).length > 0 &&
              (draft.resultRefinedNeedVersionId === options.productDraftRefinedVersionId ||
                Object.values(draft.moduleProjections).some(
                  (projection) => projection.needVersionId === options.productDraftRefinedVersionId,
                )),
          )
          if (firstFromVersion && moduleDriven) {
            const proposal = world.proposals.find((entry) => entry.id === routineProposalId)!
            if (proposal.status === "pending") {
              if ((options.confirmOutcome ?? "accepted") === "accepted") {
                proposal.status = "accepted"
                world.plan.activeRoutineVersionId = proposal.candidateRoutineVersionId
                world.plan.pendingProposalId = null
                world.plan.revision += 1
                revision = world.plan.revision
                routineProposalId = null
              } else if (status === "already_completed") {
                // Recoverable replay corner: keep the pending proposal.
                void 0
              } else {
                throw new Error("refinement recompute could not activate its successor")
              }
            } else if (proposal.status === "accepted") {
              routineProposalId = null
            }
          }
        }

        // --- atomic direct-accept provenance ------------------------------
        if (args.p_mark_unrefined_direct_accept === true) {
          if (options.provenanceWriteFails) throw new Error("provenance write failed")
          world.plan.unrefinedDirectAccept = true
        }

        return {
          data: {
            status,
            portfolioVersionId: "portfolio-1",
            routineVersionId,
            routineProposalId,
            revision,
          },
          error: null,
        }
      } catch (error) {
        Object.assign(world, snapshot)
        throw error
      }
    },
  }
}

function emptyWorld(activeRoutineVersionId: string | null): V2World {
  return {
    plan: {
      activeRoutineVersionId,
      pendingProposalId: null,
      revision: 4,
      unrefinedDirectAccept: false,
    },
    proposals: [],
    routineVersions: activeRoutineVersionId ? [activeRoutineVersionId] : [],
    // The already-active Routine predates this completion and came from an
    // earlier refined version, so it never collides with the one under test.
    routineSources: activeRoutineVersionId ? { [activeRoutineVersionId]: "refined-previous" } : {},
  }
}

const stageRequest = {
  userId: "user-1",
  personalPlanId: "plan-1",
  productDraftId: "draft-1",
  expectedRevision: 4,
  expectedSourceRevision: 7,
  portfolio: { schemaVersion: 1, snapshot: { personalPlanId: "plan-1" } },
  candidate: {
    schemaVersion: 1,
    compilerVersion: "routine-v1",
    authorityVersions: { shampoo: "authority-1" },
    sourceFingerprint: "source-fingerprint",
    payload: { steps: [] },
    proposalDelta: { kind: "recompute" },
  },
}

test("a module-driven recompute activates the successor immediately instead of proposing it", async () => {
  const world = emptyWorld("routine-active")
  const stager = createRoutineProposalStagerRpcAdapter({
    client: createV2Client({
      productDraftRefinedVersionId: "refined-module-2",
      refinementDrafts: [
        {
          moduleProjections: { products: { needVersionId: "refined-module-1" } },
          resultRefinedNeedVersionId: "refined-module-2",
        },
      ],
      world,
    }),
  })

  const result = await stager.stage(stageRequest)

  assert.equal(result.status, "completed")
  assert.equal(result.status === "completed" ? result.routineProposalId : "unset", null)
  assert.equal(world.plan.activeRoutineVersionId, world.routineVersions.at(-1))
  assert.equal(world.plan.pendingProposalId, null)
  assert.deepEqual(
    world.proposals.map((proposal) => proposal.status),
    ["accepted"],
  )
})

test("a module-1 projection activates immediately even before the closing module", async () => {
  const world = emptyWorld("routine-active")
  const stager = createRoutineProposalStagerRpcAdapter({
    client: createV2Client({
      productDraftRefinedVersionId: "refined-module-1",
      refinementDrafts: [
        {
          moduleProjections: { products: { needVersionId: "refined-module-1" } },
          resultRefinedNeedVersionId: null,
        },
      ],
      world,
    }),
  })

  const result = await stager.stage(stageRequest)

  assert.equal(result.status === "completed" ? result.routineProposalId : "unset", null)
  assert.equal(world.plan.pendingProposalId, null)
})

test("today's linear refinement keeps its pending proposal", async () => {
  const world = emptyWorld("routine-active")
  const stager = createRoutineProposalStagerRpcAdapter({
    client: createV2Client({
      productDraftRefinedVersionId: "refined-linear",
      refinementDrafts: [{ moduleProjections: {}, resultRefinedNeedVersionId: "refined-linear" }],
      world,
    }),
  })

  const result = await stager.stage(stageRequest)

  assert.equal(result.status, "completed")
  assert.equal(result.status === "completed" ? result.routineProposalId : null, "proposal-1")
  assert.equal(world.plan.activeRoutineVersionId, "routine-active")
  assert.equal(world.plan.pendingProposalId, "proposal-1")
  assert.deepEqual(
    world.proposals.map((proposal) => proposal.status),
    ["pending"],
  )
})

test("a refined version from another plan's module lineage never activates this one", async () => {
  const world = emptyWorld("routine-active")
  const stager = createRoutineProposalStagerRpcAdapter({
    client: createV2Client({
      productDraftRefinedVersionId: "refined-linear",
      refinementDrafts: [
        {
          moduleProjections: { products: { needVersionId: "refined-somewhere-else" } },
          resultRefinedNeedVersionId: "refined-somewhere-else",
        },
      ],
      world,
    }),
  })

  const result = await stager.stage(stageRequest)

  assert.equal(result.status === "completed" ? result.routineProposalId : null, "proposal-1")
  assert.equal(world.plan.pendingProposalId, "proposal-1")
})

/**
 * The module lineage marks a VERSION, not a single completion. Only the
 * recompute the module completion itself caused may activate; every later
 * Stage-3 completion against that same version (a product edit, the Routine-
 * authority repair, a source reconciliation) is an ordinary successor and keeps
 * the pending proposal.
 */
test("a later recompute on the same module-projected version proposes instead of activating", async () => {
  const world = emptyWorld("routine-active")
  // The module completion's own recompute already activated from this version.
  world.routineVersions.push("routine-from-module")
  world.routineSources["routine-from-module"] = "refined-module-1"
  world.plan.activeRoutineVersionId = "routine-from-module"

  const stager = createRoutineProposalStagerRpcAdapter({
    client: createV2Client({
      productDraftRefinedVersionId: "refined-module-1",
      refinementDrafts: [
        {
          moduleProjections: { products: { needVersionId: "refined-module-1" } },
          resultRefinedNeedVersionId: null,
        },
      ],
      world,
    }),
  })

  const result = await stager.stage(stageRequest)

  assert.equal(result.status === "completed" ? result.routineProposalId : null, "proposal-1")
  assert.equal(world.plan.pendingProposalId, "proposal-1")
  assert.equal(world.plan.activeRoutineVersionId, "routine-from-module")
  assert.deepEqual(
    world.proposals.map((proposal) => proposal.status),
    ["pending"],
  )
})

test("the first Routine still activates without any proposal", async () => {
  const world = emptyWorld(null)
  const stager = createRoutineProposalStagerRpcAdapter({
    client: createV2Client({
      productDraftRefinedVersionId: "refined-1",
      refinementDrafts: [{ moduleProjections: {}, resultRefinedNeedVersionId: "refined-1" }],
      world,
    }),
  })

  const result = await stager.stage(stageRequest)

  assert.equal(result.status === "completed" ? result.routineProposalId : "unset", null)
  assert.deepEqual(world.proposals, [])
  assert.equal(world.plan.activeRoutineVersionId, "routine-1")
})

test("replaying a module-driven completion reports the activation, not a pending proposal", async () => {
  const world: V2World = {
    plan: {
      activeRoutineVersionId: "routine-1",
      pendingProposalId: null,
      revision: 6,
      unrefinedDirectAccept: false,
    },
    proposals: [{ id: "proposal-1", candidateRoutineVersionId: "routine-1", status: "accepted" }],
    routineVersions: ["routine-1"],
    // The replayed completion's own Routine — it must not count as a "previous
    // recompute on this version" against itself.
    routineSources: { "routine-1": "refined-module-1" },
  }
  const stager = createRoutineProposalStagerRpcAdapter({
    client: createV2Client({
      productDraftRefinedVersionId: "refined-module-1",
      refinementDrafts: [
        {
          moduleProjections: { products: { needVersionId: "refined-module-1" } },
          resultRefinedNeedVersionId: null,
        },
      ],
      world,
      draftAlreadyCompleted: true,
    }),
  })

  const result = await stager.stage(stageRequest)

  assert.equal(result.status, "already_completed")
  assert.equal(result.status === "already_completed" ? result.routineProposalId : "unset", null)
  assert.equal(world.plan.activeRoutineVersionId, "routine-1")
  assert.deepEqual(
    world.proposals.map((proposal) => proposal.status),
    ["accepted"],
  )
})

/**
 * A proposal staged by an EARLIER transaction can legitimately be unconfirmable
 * on replay (the plan's source revision moved on since). Raising there would
 * turn a retryable replay into a permanent 503, so the corner degrades to
 * today's behavior: the pending proposal survives and is reported.
 */
test("an unconfirmable proposal on the replay path degrades to its pending proposal", async () => {
  const world: V2World = {
    plan: {
      activeRoutineVersionId: "routine-active",
      pendingProposalId: "proposal-1",
      revision: 6,
      unrefinedDirectAccept: false,
    },
    proposals: [{ id: "proposal-1", candidateRoutineVersionId: "routine-1", status: "pending" }],
    routineVersions: ["routine-1", "routine-active"],
    routineSources: { "routine-1": "refined-module-1", "routine-active": "refined-previous" },
  }
  const stager = createRoutineProposalStagerRpcAdapter({
    client: createV2Client({
      productDraftRefinedVersionId: "refined-module-1",
      refinementDrafts: [
        {
          moduleProjections: { products: { needVersionId: "refined-module-1" } },
          resultRefinedNeedVersionId: null,
        },
      ],
      world,
      draftAlreadyCompleted: true,
      confirmOutcome: "stale_source",
    }),
  })

  const result = await stager.stage(stageRequest)

  assert.equal(result.status, "already_completed")
  assert.equal(
    result.status === "already_completed" ? result.routineProposalId : "unset",
    "proposal-1",
  )
  // Nothing was activated and nothing was lost: the proposal is still there.
  assert.equal(world.plan.activeRoutineVersionId, "routine-active")
  assert.equal(world.plan.pendingProposalId, "proposal-1")
  assert.deepEqual(
    world.proposals.map((proposal) => proposal.status),
    ["pending"],
  )
})

test("an unconfirmable proposal the completion itself staged still fails loudly", async () => {
  const world = emptyWorld("routine-active")
  const stager = createRoutineProposalStagerRpcAdapter({
    client: createV2Client({
      productDraftRefinedVersionId: "refined-module-1",
      refinementDrafts: [
        {
          moduleProjections: { products: { needVersionId: "refined-module-1" } },
          resultRefinedNeedVersionId: null,
        },
      ],
      world,
      confirmOutcome: "stale_source",
    }),
  })

  const result = await stager.stage(stageRequest)

  // The invariant violation rolls the whole completion back.
  assert.deepEqual(result, { status: "temporarily_unavailable" })
  assert.equal(world.plan.activeRoutineVersionId, "routine-active")
  assert.deepEqual(world.routineVersions, ["routine-active"])
  assert.equal(world.plan.revision, 4)
})

test("the direct-accept provenance is written by the same transaction that activates", async () => {
  const world = emptyWorld(null)
  const stager = createRoutineProposalStagerRpcAdapter({
    client: createV2Client({
      productDraftRefinedVersionId: "refined-1",
      refinementDrafts: [],
      world,
    }),
  })

  await stager.stage({ ...stageRequest, markUnrefinedDirectAccept: true })

  assert.equal(world.plan.unrefinedDirectAccept, true)
  assert.equal(world.plan.activeRoutineVersionId, "routine-1")
})

test("a failing provenance write rolls the whole completion back", async () => {
  const world = emptyWorld(null)
  const stager = createRoutineProposalStagerRpcAdapter({
    client: createV2Client({
      productDraftRefinedVersionId: "refined-1",
      refinementDrafts: [],
      world,
      provenanceWriteFails: true,
    }),
  })

  const result = await stager.stage({ ...stageRequest, markUnrefinedDirectAccept: true })

  assert.deepEqual(result, { status: "temporarily_unavailable" })
  assert.equal(world.plan.unrefinedDirectAccept, false)
  assert.equal(world.plan.activeRoutineVersionId, null)
  assert.deepEqual(world.routineVersions, [])
  assert.equal(world.plan.revision, 4)
})
