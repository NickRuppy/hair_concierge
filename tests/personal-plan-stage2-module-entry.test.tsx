import assert from "node:assert/strict"
import test from "node:test"
import type React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  parseRefineModuleParam,
  parseRefineParam,
  resolvePlanStartPageState,
  type PlanStartPageDeps,
} from "../src/app/plan-start/page"
import { RefinementFlow } from "../src/components/personal-plan-refinement/refinement-flow"
import {
  firstOpenStage2Module,
  parseStage2RefineEntry,
  resolveStage2EntryModule,
  resolveStage2FlowEntryView,
  scopeStage2PathToModule,
  scopeStage2SessionToModule,
} from "../src/lib/personal-plan/refinement/module-scope"
import { createStage2FixtureGateway } from "../src/lib/personal-plan/refinement/fixture-gateway"
import { Stage2RefinementError } from "../src/lib/personal-plan/refinement/gateway"
import {
  createStage2RefinementSession,
  type Stage2RefinementSession,
} from "../src/lib/personal-plan/refinement/session"
import type { Stage2TriggerContext } from "../src/lib/personal-plan/refinement/types"

const plainTriggerContext: Stage2TriggerContext = {
  relevantCategories: [],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
}

const conditionalTriggerContext: Stage2TriggerContext = {
  relevantCategories: ["shampoo", "oil", "dry_shampoo"],
  hasReportedIrritatedScalp: true,
  dryShampooBridgeEligibility: "eligible",
}

/** Products answered, habits untouched — the state a Modul-1 completion produces. */
function productsDoneSession(): Stage2RefinementSession {
  return createStage2RefinementSession({
    pathVersion: "stage2-module-test",
    triggerContext: plainTriggerContext,
    answers: { currentProductCategories: [], wetWashFrequency: "weekly_2x" },
    completedQuestionIds: ["current_product_categories", "wet_wash_frequency"],
    revision: 2,
  })
}

function untouchedSession(
  triggerContext: Stage2TriggerContext = plainTriggerContext,
): Stage2RefinementSession {
  return createStage2RefinementSession({
    pathVersion: "stage2-module-test",
    triggerContext,
  })
}

function fullyAnsweredSession(status: "in_progress" | "complete"): Stage2RefinementSession {
  return createStage2RefinementSession({
    pathVersion: "stage2-module-test",
    triggerContext: plainTriggerContext,
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_2x",
      towel: { material: "no_towel" },
      dryingRoutes: [],
      additionalHeatTools: [],
      nightProtection: [],
    },
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
    ],
    revision: 6,
    status,
    completedHandoff:
      status === "complete"
        ? { refinedVersionId: "refined-module-test", nextHref: "/plan-start" }
        : undefined,
  })
}

test("the refine param carries a module and keeps plain refine=1 as the first open module", () => {
  assert.deepEqual(parseStage2RefineEntry("1"), { refine: true, module: "first_open" })
  assert.deepEqual(parseStage2RefineEntry("products"), { refine: true, module: "products" })
  assert.deepEqual(parseStage2RefineEntry("habits"), { refine: true, module: "habits" })
  assert.deepEqual(parseStage2RefineEntry(["habits", "1"]), { refine: true, module: "habits" })
  assert.deepEqual(parseStage2RefineEntry("true"), { refine: false })
  assert.deepEqual(parseStage2RefineEntry("PRODUCTS"), { refine: false })
  assert.deepEqual(parseStage2RefineEntry(undefined), { refine: false })

  // The page-level helpers stay backward compatible for the existing nudge link.
  assert.equal(parseRefineParam("1"), true)
  assert.equal(parseRefineParam(["1", "0"]), true)
  assert.equal(parseRefineParam("products"), true)
  assert.equal(parseRefineParam("true"), false)
  assert.equal(parseRefineParam(undefined), false)
  assert.equal(parseRefineModuleParam("1"), "first_open")
  assert.equal(parseRefineModuleParam("habits"), "habits")
  assert.equal(parseRefineModuleParam("true"), undefined)
  assert.equal(parseRefineModuleParam(undefined), undefined)
})

test("a scoped path keeps only its own module's questions in canonical order", () => {
  const session = createStage2RefinementSession({
    pathVersion: "stage2-module-test",
    triggerContext: conditionalTriggerContext,
    answers: {
      currentProductCategories: ["oil", "dry_shampoo"],
      wetWashFrequency: "weekly_2x",
      scalpIrritationDetail: "mild_sensitive_or_itchy",
      dryShampooVisibleHairColor: "dark",
      dryingRoutes: ["ordinary_blow_dry"],
    },
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "scalp_irritation_detail",
      "dry_shampoo_visible_hair_color",
      "drying_routes",
    ],
  })

  const products = scopeStage2PathToModule(session.path, "products")
  assert.deepEqual(products.orderedQuestionIds, [
    "current_product_categories",
    "wet_wash_frequency",
    "scalp_irritation_detail",
    "dry_shampoo_visible_hair_color",
    "oil_purposes",
  ])
  assert.equal(products.firstUnresolvedQuestionId, "oil_purposes")

  const habits = scopeStage2PathToModule(session.path, "habits")
  assert.deepEqual(habits.orderedQuestionIds, [
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "heat:ordinary_blow_dry",
    "night_protection",
  ])
  // Resume inside a module lands on the first UNRESOLVED question of that module,
  // not on the global first unresolved one.
  assert.equal(habits.firstUnresolvedQuestionId, "towel_handling")
  assert.deepEqual(habits.completedQuestionIds, ["drying_routes"])

  // A scoped session keeps the FULL completed set (the save path needs it) and
  // only narrows the path.
  const scoped = scopeStage2SessionToModule(session, "habits")
  assert.deepEqual(scoped.completedQuestionIds, session.completedQuestionIds)
  assert.deepEqual(scoped.path.orderedQuestionIds, habits.orderedQuestionIds)
  assert.equal(scopeStage2SessionToModule(session, null), session)
})

test("the entry module resolves products first and falls back to legacy when nothing is open", () => {
  assert.equal(firstOpenStage2Module(untouchedSession()), "products")
  assert.equal(firstOpenStage2Module(productsDoneSession()), "habits")
  assert.equal(firstOpenStage2Module(fullyAnsweredSession("in_progress")), null)

  assert.equal(resolveStage2EntryModule(productsDoneSession(), "first_open"), "habits")
  assert.equal(resolveStage2EntryModule(productsDoneSession(), "products"), "products")
  assert.equal(resolveStage2EntryModule(productsDoneSession(), null), null)
  // `?refine=1` on an all-answered draft must stay on the legacy linear entry.
  assert.equal(resolveStage2EntryModule(fullyAnsweredSession("in_progress"), "first_open"), null)
})

test("module entry resumes question-exact and never re-bridges a consumed handoff", () => {
  const fresh = untouchedSession()
  assert.deepEqual(
    resolveStage2FlowEntryView({
      session: scopeStage2SessionToModule(fresh, "products"),
      moduleScoped: true,
      directEntry: true,
    }),
    {
      mode: "question",
      activeQuestionId: "current_product_categories",
      status: "idle",
      liveMessage: "",
      bridge: false,
    },
  )

  const midModule = createStage2RefinementSession({
    pathVersion: "stage2-module-test",
    triggerContext: plainTriggerContext,
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_2x",
      towel: { material: "no_towel" },
    },
    completedQuestionIds: ["current_product_categories", "wet_wash_frequency", "towel_handling"],
  })
  assert.deepEqual(
    resolveStage2FlowEntryView({
      session: scopeStage2SessionToModule(midModule, "habits"),
      moduleScoped: true,
      directEntry: true,
    }),
    {
      mode: "resume",
      activeQuestionId: "drying_routes",
      status: "idle",
      liveMessage: "",
      bridge: false,
    },
  )

  // Handoff consumption: re-entering an ALREADY finished module (a reload after
  // Stage-3 entry, or the banner pointing back at it) re-walks the module and
  // never re-arms the Stage-3 bridge.
  assert.deepEqual(
    resolveStage2FlowEntryView({
      session: scopeStage2SessionToModule(productsDoneSession(), "products"),
      moduleScoped: true,
      directEntry: true,
    }),
    {
      mode: "question",
      activeQuestionId: "current_product_categories",
      status: "idle",
      liveMessage: "",
      bridge: false,
    },
  )

  // Legacy (unscoped) entry keeps today's behaviour byte for byte.
  assert.deepEqual(
    resolveStage2FlowEntryView({
      session: fullyAnsweredSession("in_progress"),
      moduleScoped: false,
      directEntry: true,
    }),
    {
      mode: "question",
      activeQuestionId: "night_protection",
      status: "completion_failed",
      liveMessage: "Deine Antworten sind gespeichert. Die Übergabe ist noch offen.",
      bridge: false,
    },
  )
  assert.deepEqual(
    resolveStage2FlowEntryView({
      session: fullyAnsweredSession("complete"),
      moduleScoped: false,
      directEntry: true,
    }),
    {
      mode: "bridge",
      activeQuestionId: null,
      status: "idle",
      liveMessage: "",
      bridge: true,
    },
  )
  assert.deepEqual(
    resolveStage2FlowEntryView({
      session: untouchedSession(),
      moduleScoped: false,
      directEntry: false,
    }).mode,
    "invitation",
  )
})

test("the fixture gateway completes one module and delegates the closing one", async () => {
  const gateway = createStage2FixtureGateway({
    runtimeEnvironment: "test",
    triggerContext: plainTriggerContext,
  })
  let session = await gateway.saveAnswer({
    questionId: "current_product_categories",
    answer: [],
    expectedRevision: 0,
  })
  session = await gateway.saveAnswer({
    questionId: "wet_wash_frequency",
    answer: "weekly_2x",
    expectedRevision: session.revision,
  })

  await assert.rejects(
    gateway.completeModule({ module: "habits", expectedRevision: session.revision }),
    (error: unknown) =>
      error instanceof Stage2RefinementError && error.code === "incomplete_refinement",
  )
  await assert.rejects(
    gateway.completeModule({ module: "products", expectedRevision: session.revision - 1 }),
    (error: unknown) =>
      error instanceof Stage2RefinementError && error.code === "revision_conflict",
  )

  const productsDone = await gateway.completeModule({
    module: "products",
    expectedRevision: session.revision,
  })
  assert.equal(productsDone.module, "products")
  assert.equal(productsDone.status, "in_progress")
  assert.equal(productsDone.stage3Handoff, true)
  assert.equal(productsDone.nextHref, "/plan-start")
  assert.match(productsDone.refinedVersionId, /^fixture-refined-/)
  // The module completion leaves the draft open — Modul 2 is still ahead.
  assert.equal((await gateway.load()).status, "in_progress")

  for (const [questionId, answer] of [
    ["towel_handling", { material: "no_towel" }],
    ["drying_routes", []],
    ["additional_heat_tools", []],
    ["night_protection", []],
  ] as const) {
    session = await gateway.saveAnswer({ questionId, answer, expectedRevision: session.revision })
  }
  const habitsDone = await gateway.completeModule({
    module: "habits",
    expectedRevision: session.revision,
  })
  assert.equal(habitsDone.module, "habits")
  assert.equal(habitsDone.status, "complete")
  assert.equal(habitsDone.stage3Handoff, false)
  const loaded = await gateway.load()
  assert.equal(loaded.status, "complete")
  assert.equal(loaded.completedHandoff?.refinedVersionId, habitsDone.refinedVersionId)
})

test("the fixture gateway fuses the final module answer with its completion", async () => {
  const gateway = createStage2FixtureGateway({
    runtimeEnvironment: "test",
    triggerContext: plainTriggerContext,
  })
  const first = await gateway.saveAnswer({
    questionId: "current_product_categories",
    answer: [],
    expectedRevision: 0,
  })
  const fused = await gateway.saveAnswerAndCompleteModule({
    module: "products",
    questionId: "wet_wash_frequency",
    answer: "weekly_2x",
    expectedRevision: first.revision,
  })
  assert.equal(fused.session.revision, first.revision + 1)
  assert.equal(fused.moduleCompletion.stage3Handoff, true)
  assert.equal(fused.moduleCompletion.status, "in_progress")
})

test("a module-scoped flow renders only its own module's questions", () => {
  const gateway = {
    load: async () => {
      throw new Error("not used")
    },
    saveAnswer: async () => {
      throw new Error("not used")
    },
    complete: async () => {
      throw new Error("not used")
    },
  } as unknown as React.ComponentProps<typeof RefinementFlow>["gateway"]

  const habitsHtml = renderToStaticMarkup(
    <RefinementFlow
      gateway={gateway}
      initialSession={productsDoneSession()}
      moduleEntry="habits"
      directEntry
    />,
  )
  assert.match(habitsHtml, /Wie du dein Haar behandelst/)
  assert.doesNotMatch(habitsHtml, /Was du heute benutzt/)

  // Re-entering the finished products module walks it again instead of bridging.
  const productsHtml = renderToStaticMarkup(
    <RefinementFlow
      gateway={gateway}
      initialSession={productsDoneSession()}
      moduleEntry="products"
      directEntry
    />,
  )
  assert.match(productsHtml, /Was du heute benutzt/)
  assert.doesNotMatch(productsHtml, /Jetzt gleichen wir deine Produkte ab\./)
})

test("plan-start turns a module deep link into a module-scoped Stage-2 entry", async () => {
  const refinement = productsDoneSession()
  const deps: PlanStartPageDeps = {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => ({
      kind: "personal_plan",
      personalPlanId: "plan-1",
      frontier: "stage2",
      nextHref: "/plan-start",
      allowed: { stage1: true, stage2: true, stage3: false, stage4: false, stage5: false },
    }),
    loadExistingRefinementSession: async () => refinement,
  }

  const scoped = await resolvePlanStartPageState(deps, { refine: true, refineModule: "habits" })
  assert.deepEqual(scoped, {
    state: "production",
    initialJourney: { stage: "stage2", returningToRefinement: true, refineModule: "habits" },
    personalPlanId: "plan-1",
    initialRefinementSession: refinement,
  })

  const legacy = await resolvePlanStartPageState(deps, { refine: true })
  assert.deepEqual(legacy, {
    state: "production",
    initialJourney: { stage: "stage2", returningToRefinement: true },
    personalPlanId: "plan-1",
    initialRefinementSession: refinement,
  })
})
