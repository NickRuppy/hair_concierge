import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { handleStage1LoadOrCreate } from "@/app/api/personal-plan/stage-1/route"
import { NeedPlanScreen } from "@/components/personal-plan-start/need-plan-screen"
import { interpretPlanStartApiResponse } from "@/components/personal-plan-start/plan-start-flow"
import {
  adaptInitialNeedSnapshotToPlanStartViewModel,
  planStartHasOptionalPage,
} from "@/components/personal-plan-start/snapshot-adapter"
import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { buildDirectAcceptanceStage2Defaults } from "@/lib/personal-plan/direct-acceptance/defaults"
import { TOOL_DERIVED_NOTE } from "@/lib/personal-plan/tools/presentation"
import { withStage1ToolCards, type ToolFactsSource } from "@/lib/personal-plan/tools/read-view"
import { toCareHabitsPatch, toFieldProvenance } from "@/lib/user-facts/from-refinement-draft"
import type { PersonalPlanQuizSubmissionEnvelope } from "@/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

type Answers = PersonalPlanQuizSubmissionEnvelope["answers"]

const NO_FACTS: ToolFactsSource = { careHabits: null, fieldProvenance: undefined }

function snapshotFor(overrides: Partial<Answers> = {}) {
  const computed = computeNeedPlan({
    rawEnvelope: {
      ...COMPLETE_V3_PLAN_ENVELOPE,
      answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, ...overrides },
    },
    artifactId: "artifact-1",
    projection: "initial_quiz",
    computationVersion: "test",
    createdAt: "2026-08-21T00:00:00.000Z",
  })
  assert.equal(computed.status, "ready")
  if (computed.status !== "ready") throw new Error("unreachable")
  return computed.snapshot
}

/** What the server hands the adapter while the rollout is on. */
function decorated(snapshot: unknown, facts: ToolFactsSource = NO_FACTS) {
  return withStage1ToolCards(snapshot, {
    facts,
    hasOptionalPage: planStartHasOptionalPage(snapshot),
  })
}

function planFor(overrides: Partial<Answers>, options: { toolsEnabled: boolean }) {
  const snapshot = snapshotFor(overrides)
  return adaptInitialNeedSnapshotToPlanStartViewModel(
    options.toolsEnabled ? decorated(snapshot) : snapshot,
    options,
  )
}

test("Tools off leaves the released Idealplan shape-identical, not just visually equal", () => {
  const snapshot = snapshotFor({ hairLength: "long" })
  const off = adaptInitialNeedSnapshotToPlanStartViewModel(snapshot, { toolsEnabled: false })
  // Tool-only properties must be ABSENT while off, not present-and-falsy …
  assert.equal("toolBlock" in (off!.basis as object), false)
  if (off!.optional) assert.equal("toolBlock" in (off!.optional as object), false)
  // … even when a decorated snapshot reaches an off adapter.
  const offDecorated = adaptInitialNeedSnapshotToPlanStartViewModel(decorated(snapshot), {
    toolsEnabled: false,
  })
  assert.deepEqual(offDecorated, off)
})

test("the stored snapshot is never decorated: computeNeedPlan emits no Tool field", () => {
  const snapshot = snapshotFor({ hairLength: "long" })
  assert.equal("stage1ToolCards" in snapshot, false)
  const withCards = decorated(snapshot) as typeof snapshot
  assert.ok(withCards.stage1ToolCards)
  assert.equal("stage1ToolCards" in snapshot, false, "decoration copies, never mutates")
  assert.equal(withCards.inputHash, snapshot.inputHash)
})

test("Tools on adds one compact tier-local block after the care-product cards", () => {
  const on = planFor({ hairLength: "long" }, { toolsEnabled: true })
  const block = on?.basis.toolBlock
  assert.ok(block, "the Basis page gets its own Tool block")
  assert.equal(block?.title, "Deine Tools")
  assert.ok(block!.cards.length > 0)
  const comb = block!.cards.find((card) => card.family === "brushes_combs")
  assert.ok(comb)
  assert.equal(comb.familyLabel, "Bürsten & Kämme")
  assert.equal(comb.stateLabel, "Bestand im Feinschliff prüfen")
  // A durable Tool must not borrow the exact care-product card anatomy.
  for (const forbidden of ["priceLabel", "availabilityLabel", "frequency", "product"]) {
    assert.equal(forbidden in comb, false, `${forbidden} must not appear on a Tool card`)
  }
})

test("the Tool block renders its own list without a catalog disclaimer", () => {
  const on = planFor({ hairLength: "long" }, { toolsEnabled: true })
  const markup = renderToStaticMarkup(
    <NeedPlanScreen screen={on!.basis} hasOptionalPage={Boolean(on!.optional)} />,
  )
  assert.ok(markup.includes("data-plan-start-tool-block"))
  assert.ok(markup.includes("Deine Tools"))
  assert.ok(markup.includes("Bestand im Feinschliff prüfen"))
  assert.ok(
    markup.indexOf("data-plan-start-card-list") < markup.indexOf("data-plan-start-tool-block"),
    "products first",
  )
  assert.equal(
    markup.includes("Für jede Kategorie haben wir das passendste Produkt"),
    true,
    "the existing care-product disclaimer stays above the products, not on Tools",
  )
  const toolSection = markup.slice(markup.indexOf("data-plan-start-tool-block"))
  assert.equal(
    toolSection.includes("aus unserem Katalog"),
    false,
    "the Tool block must not repeat the catalog disclaimer",
  )
})

test("the Idealplan never gains a third page for Tools", () => {
  const on = planFor({ hairLength: "long" }, { toolsEnabled: true })
  assert.deepEqual(Object.keys(on!).includes("tools"), false)
  assert.ok("basis" in on! && "optional" in on!)
})

test("a very short profile with no mismatch gets no Tool block at all", () => {
  const on = planFor(
    {
      hairLength: "very_short",
      currentConcerns: ["low_shine"],
      concernRecurrence: { concernId: "low_shine", frequency: "sometimes" },
      goals: ["moisture"],
    },
    { toolsEnabled: true },
  )
  assert.equal(on?.basis.toolBlock ?? null, null)
  assert.equal(on?.optional?.toolBlock ?? null, null)
})

test("direct-accept planning defaults never become Tool ownership on Stage 1 (D5)", () => {
  const defaults = buildDirectAcceptanceStage2Defaults({
    relevantCategories: [],
    hasReportedIrritatedScalp: false,
    dryShampooBridgeEligibility: "ineligible",
    toolsEnabled: true,
  })
  const careHabits = toCareHabitsPatch(defaults.answers, {
    completedQuestionIds: defaults.completedQuestionIds,
    answerProvenance: defaults.answerProvenance,
  })
  const fieldProvenance = toFieldProvenance({
    completedQuestionIds: defaults.completedQuestionIds,
    answerProvenance: defaults.answerProvenance,
    answers: defaults.answers,
  })
  const snapshot = snapshotFor({ hairLength: "long" })
  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(
    decorated(snapshot, { careHabits, fieldProvenance } as ToolFactsSource),
    { toolsEnabled: true },
  )
  const cards = [
    ...(plan?.basis.toolBlock?.cards ?? []),
    ...(plan?.optional?.toolBlock?.cards ?? []),
  ]
  assert.ok(cards.length > 0)
  for (const card of cards) {
    assert.notEqual(card.state, "use_yours", `${card.id} must not claim ownership`)
    assert.notEqual(card.state, "catalog_gap", `${card.id} must not claim explicit absence`)
  }
})

test("a derived use-yours card carries its derived marking into the rendered block", () => {
  const snapshot = snapshotFor({ hairLength: "long" })
  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(
    decorated(snapshot, {
      careHabits: { dryingRoutes: ["ordinary_blow_dry"] },
      fieldProvenance: { dryingRoutes: "user" },
    }),
    { toolsEnabled: true },
  )
  const dryer = plan?.basis.toolBlock?.cards.find((card) => card.family === "airflow")
  assert.equal(dryer?.derived, true)
  const markup = renderToStaticMarkup(
    <NeedPlanScreen screen={plan!.basis} hasOptionalPage={Boolean(plan!.optional)} />,
  )
  assert.ok(markup.includes('data-plan-start-tool-derived="true"'))
  assert.ok(markup.includes(TOOL_DERIVED_NOTE))
})

test("a malformed stage1ToolCards payload renders no block rather than breaking the plan", () => {
  const snapshot = {
    ...snapshotFor({ hairLength: "long" }),
    stage1ToolCards: { basis: { cards: "x" } },
  }
  const plan = adaptInitialNeedSnapshotToPlanStartViewModel(snapshot, { toolsEnabled: true })
  assert.ok(plan)
  assert.equal("toolBlock" in plan!.basis, false)
})

/* ── the Stage-1 route ───────────────────────────────────────────────── */

function stage1Deps(input: {
  toolsEnabled: boolean
  loadToolFacts?: (userId: string) => Promise<ToolFactsSource>
  hairLength?: Answers["hairLength"]
}) {
  const envelope = {
    ...COMPLETE_V3_PLAN_ENVELOPE,
    answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, hairLength: input.hairLength ?? "long" },
  }
  const stored: unknown[] = []
  return {
    stored,
    deps: {
      getAuthenticatedUser: async () => ({ id: "user-1" }),
      loadJourneyAccess: async () => ({
        kind: "personal_plan_start" as const,
        frontier: "stage1" as const,
        nextHref: "/plan-start" as const,
        allowed: { stage1: true, stage2: false, stage3: false, stage4: false, stage5: false },
      }),
      toolsEnabled: async () => input.toolsEnabled,
      loadToolFacts: input.loadToolFacts,
      persistence: {
        isEnabled: () => true,
        cohortCutoff: () => new Date("2026-08-08T00:00:00.000Z"),
        findEntitlement: async () => ({
          accessState: "active" as const,
          enrollmentSourceId: "purchase-1",
          qualifiedAt: "2026-08-08T01:00:00.000Z",
          artifactLeadId: "lead-1",
        }),
        loadArtifact: async () => ({ id: "artifact-1", quizAnswers: envelope }),
        createOrReuseInitialNeed: async (request: { outputSnapshot: unknown }) => {
          stored.push(request.outputSnapshot)
          return {
            outcome: "completed" as const,
            personalPlanId: "plan-1",
            needVersionId: "need-1",
            outputSnapshot: request.outputSnapshot,
          }
        },
      },
    } as never,
  }
}

type Stage1Body = { outputSnapshot: Record<string, unknown>; toolsEnabled?: true }

test("route, flag off: the response is exactly today's and no facts are read", async () => {
  let reads = 0
  const { deps } = stage1Deps({
    toolsEnabled: false,
    loadToolFacts: async () => {
      reads += 1
      return NO_FACTS
    },
  })
  const off = await handleStage1LoadOrCreate(deps)
  assert.equal(reads, 0)
  const body = off.body as Stage1Body
  assert.equal("toolsEnabled" in body, false)
  assert.equal("stage1ToolCards" in body.outputSnapshot, false)
})

test("route, flag on: the snapshot carries the read-time cards; the stored snapshot does not", async () => {
  const { deps, stored } = stage1Deps({ toolsEnabled: true, loadToolFacts: async () => NO_FACTS })
  const on = await handleStage1LoadOrCreate(deps)
  const body = on.body as Stage1Body
  assert.equal(body.toolsEnabled, true)
  assert.ok(body.outputSnapshot.stage1ToolCards)
  assert.equal(stored.length, 1)
  assert.equal(
    "stage1ToolCards" in (stored[0] as object),
    false,
    "persisted version stays tools-off",
  )

  const relayed = interpretPlanStartApiResponse(200, body)
  assert.equal(relayed.state, "ready")
  if (relayed.state === "ready") assert.ok(relayed.plan.basis.toolBlock)
})

test("route, flag on: a failed facts read means no cards, never a failed Idealplan", async () => {
  const { deps } = stage1Deps({
    toolsEnabled: true,
    loadToolFacts: async () => {
      throw new Error("facts unavailable")
    },
  })
  const on = await handleStage1LoadOrCreate(deps)
  assert.equal(on.status, 200)
  const body = on.body as Stage1Body
  assert.equal("stage1ToolCards" in body.outputSnapshot, false)
  assert.equal(body.toolsEnabled, true)
})
