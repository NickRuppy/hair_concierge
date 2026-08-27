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
import {
  applyStage2ModuleCompletion,
  RefinementFlow,
  stage2BridgeAutoContinues,
  stage2BridgePresentation,
  type Stage2ModuleCompletionPayload,
  type Stage2RefinementTelemetryEvent,
} from "../src/components/personal-plan-refinement/refinement-flow"
import { PLAN_ACCEPT_REFINE_HREF } from "../src/components/personal-plan-journey/accept-ideal-plan"
import {
  moduleCompletionRoutineHref,
  planStartRefinementExitDestination,
  planStartSuppressesChapterCeremony,
  stage3CompletionRoutineHref,
} from "../src/components/personal-plan-start/plan-start-flow"
import {
  firstOpenStage2Module,
  hostSessionFor,
  parseStage2RefineEntry,
  resolveStage2EntryModule,
  resolveStage2FlowEntryView,
  resolveStage2ModuleScope,
  scopeStage2PathToModule,
  scopeStage2SessionToModule,
  stage2SecondaryExitDestination,
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
      moduleScope: "explicit",
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
      moduleScope: "explicit",
      directEntry: true,
    }),
    {
      // Field test 26.08.2026: an explicit module entry never shows the resume
      // chapter — it opens the first open question of that module directly.
      mode: "question",
      activeQuestionId: "drying_routes",
      status: "idle",
      liveMessage: "",
      bridge: false,
    },
  )
  // `?refine=1` (first_open) is still the funnel's own re-entry and keeps it.
  assert.equal(
    resolveStage2FlowEntryView({
      session: scopeStage2SessionToModule(midModule, "habits"),
      moduleScope: "first_open",
      directEntry: true,
    }).mode,
    "resume",
  )

  // Handoff consumption: re-entering an ALREADY finished module (a reload after
  // Stage-3 entry, or the banner pointing back at it) re-walks the module and
  // never re-arms the Stage-3 bridge.
  assert.deepEqual(
    resolveStage2FlowEntryView({
      session: scopeStage2SessionToModule(productsDoneSession(), "products"),
      moduleScope: "explicit",
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
      moduleScope: "none",
      directEntry: true,
    }),
    {
      mode: "question",
      activeQuestionId: "night_protection",
      status: "completion_failed",
      liveMessage: "Deine Antworten sind gespeichert. Das Abschließen ist noch offen.",
      bridge: false,
    },
  )
  assert.deepEqual(
    resolveStage2FlowEntryView({
      session: fullyAnsweredSession("complete"),
      moduleScope: "none",
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
      moduleScope: "none",
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

/**
 * A10 (founder ruling 27.08.2026). The universal escape hatch used to be
 * `/plan-start?refine=1`, which resolves to `first_open` — a NON-explicit entry
 * that resurrects the retired ceremony: the invitation/resume chapter shells and
 * the chapter screens the module entry had already retired. Pointing it at the
 * `products` module makes it an explicit module deep link, so a buyer whose
 * accept could not resolve lands directly in their product questions.
 */
test("the accept escape hatch opens the products module with no chapter screen and no 5-stage bar", async () => {
  const refineParam = new URL(PLAN_ACCEPT_REFINE_HREF, "https://chaarlie.de").searchParams.get(
    "refine",
  )
  assert.equal(refineParam, "products")
  assert.equal(parseRefineParam(refineParam ?? undefined), true)
  assert.equal(parseRefineModuleParam(refineParam ?? undefined), "products")

  const refinement = untouchedSession()
  const state = await resolvePlanStartPageState(
    {
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
    },
    {
      refine: parseRefineParam(refineParam ?? undefined),
      refineModule: parseRefineModuleParam(refineParam ?? undefined),
    },
  )
  assert.equal(state.state, "production")
  const initialJourney = state.state === "production" ? state.initialJourney : null
  assert.ok(initialJourney)
  assert.equal(planStartSuppressesChapterCeremony(initialJourney), true)
  assert.equal(planStartRefinementExitDestination(initialJourney), "routine")

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
  const html = renderToStaticMarkup(
    <RefinementFlow
      gateway={gateway}
      initialSession={refinement}
      moduleEntry={initialJourney.stage === "stage2" ? initialJourney.refineModule : undefined}
      directEntry
    />,
  )

  // The products module's first question, straight away.
  assert.match(html, /Was du heute benutzt/)
  // No chapter ceremony: neither the Stage-2 invitation nor the resume shell.
  assert.doesNotMatch(html, /Jetzt geben wir deinem Plan den Feinschliff\./)
  assert.doesNotMatch(html, /Feinschliff starten/)
  assert.doesNotMatch(html, /Wir laden deinen Feinschliff\./)
  assert.doesNotMatch(html, /Zum Plan/)
  // No 5-stage bar — that row narrates a sequence this arrival is not in.
  assert.doesNotMatch(html, /Personal-Plan-Stufen/)
  assert.doesNotMatch(html, /Stufen im Personal Plan/)
})

test("the retired `?refine=1` escape hatch would have resurrected the ceremony", () => {
  // The negative half of A10: proof the constant change is what removes the
  // ceremony, not an incidental property of the module flow.
  assert.equal(parseRefineModuleParam("1"), "first_open")
  assert.equal(
    planStartSuppressesChapterCeremony({ stage: "stage2", refineModule: "first_open" }),
    false,
  )
  // The cohort the escape hatch exists for is the direct-accept cohort: a
  // COMPLETE draft. `first_open` dead-ends it on the bridge chapter; only an
  // explicit module opens the questions.
  const completeDraft = fullyAnsweredSession("complete")
  assert.equal(
    resolveStage2FlowEntryView({
      session: scopeStage2SessionToModule(completeDraft, "products"),
      moduleScope: "first_open",
      directEntry: true,
    }).mode,
    "bridge",
  )
  assert.equal(
    resolveStage2FlowEntryView({
      session: scopeStage2SessionToModule(completeDraft, "products"),
      moduleScope: "explicit",
      directEntry: true,
    }).mode,
    "question",
  )
})

/**
 * The direct-accept cohort: every canonical question is answered (by the
 * assumption resolver, not by the user), so the draft is `complete`.
 */
function directAcceptSession(): Stage2RefinementSession {
  return fullyAnsweredSession("complete")
}

test("an explicit module deep link opens the module even on a complete direct-accept draft", () => {
  const session = directAcceptSession()

  // The banner / Profil deep link must NOT dead-end on the bridge.
  assert.equal(resolveStage2EntryModule(session, "products"), "products")
  assert.equal(resolveStage2ModuleScope("products", "products"), "explicit")
  assert.deepEqual(
    resolveStage2FlowEntryView({
      session: scopeStage2SessionToModule(session, "products"),
      moduleScope: "explicit",
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
  assert.deepEqual(
    resolveStage2FlowEntryView({
      session: scopeStage2SessionToModule(session, "habits"),
      moduleScope: "explicit",
      directEntry: true,
    }).activeQuestionId,
    "towel_handling",
  )

  // `?refine=1` keeps the legacy bridge for the nudge cohort: nothing is open,
  // so no module is resolved and the entry stays unscoped.
  assert.equal(resolveStage2EntryModule(session, "first_open"), null)
  assert.equal(resolveStage2ModuleScope("first_open", null), "none")
  assert.deepEqual(
    resolveStage2FlowEntryView({ session, moduleScope: "none", directEntry: true }),
    { mode: "bridge", activeQuestionId: null, status: "idle", liveMessage: "", bridge: true },
  )
})

test("a module deep link renders the module's first question for a completed draft", () => {
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

  const html = renderToStaticMarkup(
    <RefinementFlow
      gateway={gateway}
      initialSession={directAcceptSession()}
      moduleEntry="habits"
      directEntry
    />,
  )
  assert.match(html, /Wie du dein Haar behandelst/)
  assert.doesNotMatch(html, /Jetzt gleichen wir deine Produkte ab\./)

  // The same completed draft without a module deep link still bridges.
  const legacyHtml = renderToStaticMarkup(
    <RefinementFlow gateway={gateway} initialSession={directAcceptSession()} directEntry />,
  )
  assert.match(legacyHtml, /Jetzt gleichen wir deine Produkte ab\./)
})

test("a module-scoped session never leaves the flow", () => {
  const unscoped = productsDoneSession()
  const view = scopeStage2SessionToModule(unscoped, "habits")

  assert.equal(hostSessionFor(unscoped, view), unscoped)
  assert.equal(hostSessionFor(null, view), view)
  assert.equal(view.path.orderedQuestionIds.includes("current_product_categories"), false)
  assert.equal(unscoped.path.orderedQuestionIds.includes("current_product_categories"), true)
})

test("leaving an explicit module entry returns to the Routine, not the Idealplan", () => {
  assert.equal(stage2SecondaryExitDestination("products"), "routine")
  assert.equal(stage2SecondaryExitDestination("habits"), "routine")
  assert.equal(stage2SecondaryExitDestination("first_open"), "stage1")
  assert.equal(stage2SecondaryExitDestination(undefined), "stage1")

  assert.equal(
    planStartRefinementExitDestination({ stage: "stage2", refineModule: "habits" }),
    "routine",
  )
  assert.equal(
    planStartRefinementExitDestination({ stage: "stage2", refineModule: "first_open" }),
    "stage1",
  )
  assert.equal(planStartRefinementExitDestination({ stage: "stage2" }), "stage1")
  assert.equal(planStartRefinementExitDestination({ stage: "stage1" }), "stage1")
})

test("Task 2.6: a habits-first module completion signals the toast only for an explicit module entry", () => {
  assert.equal(
    moduleCompletionRoutineHref({ stage: "stage2", refineModule: "habits" }),
    "/routine?planUpdated=1",
  )
  assert.equal(
    moduleCompletionRoutineHref({ stage: "stage2", refineModule: "products" }),
    "/routine?planUpdated=1",
  )
  // `?refine=1` (first_open) and the legacy linear entry are ordinary
  // Routine visits from the toast's perspective — no signal.
  assert.equal(
    moduleCompletionRoutineHref({ stage: "stage2", refineModule: "first_open" }),
    "/routine",
  )
  assert.equal(moduleCompletionRoutineHref({ stage: "stage2" }), "/routine")
  assert.equal(moduleCompletionRoutineHref({ stage: "stage1" }), "/routine")
})

test("Task 2.6: a Stage-3 completion signals the toast only when it followed an explicit module entry", () => {
  assert.equal(
    stage3CompletionRoutineHref({ stage: "stage2", refineModule: "products" }, "/routine"),
    "/routine?planUpdated=1",
  )
  // An ordinary direct-accept or resumed Stage-3 session must never toast —
  // nothing was explicitly re-opened from the Routine banner or Profil tab.
  assert.equal(
    stage3CompletionRoutineHref({ stage: "stage2", refineModule: "first_open" }, "/routine"),
    "/routine",
  )
  assert.equal(stage3CompletionRoutineHref({ stage: "stage1" }, "/routine"), "/routine")
  assert.equal(
    stage3CompletionRoutineHref({ stage: "stage3", refinedVersionId: "refined-1" }, "/routine"),
    "/routine",
  )
})

type RecordedEffects = {
  events: Stage2RefinementTelemetryEvent[]
  completed: Stage2RefinementSession[]
  bridged: Stage2RefinementSession[]
  handedBack: Stage2ModuleCompletionPayload[]
}

function recordingEffects() {
  const recorded: RecordedEffects = { events: [], completed: [], bridged: [], handedBack: [] }
  return {
    recorded,
    effects: {
      emit: (event: Stage2RefinementTelemetryEvent) => recorded.events.push(event),
      showCompletedSession: (session: Stage2RefinementSession) => recorded.completed.push(session),
      showStage3Bridge: (session: Stage2RefinementSession) => recorded.bridged.push(session),
      handBackToHost: (payload: Stage2ModuleCompletionPayload) => {
        recorded.handedBack.push(payload)
      },
    },
  }
}

const habitsAnswers = {
  towel: { material: "no_towel" as const },
  dryingRoutes: [],
  additionalHeatTools: [],
  nightProtection: [],
}
const habitsQuestionIds = [
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "night_protection",
] as const

test("module completion routes its three outcomes through a fake gateway", async () => {
  // 1. products first: bridge into Stage 3, draft stays open.
  const productsGateway = createStage2FixtureGateway({
    runtimeEnvironment: "test",
    triggerContext: plainTriggerContext,
    initialAnswers: { currentProductCategories: [], wetWashFrequency: "weekly_2x" },
    initialCompletedQuestionIds: ["current_product_categories", "wet_wash_frequency"],
    initialRevision: 2,
  })
  const productsSession = await productsGateway.load()
  const products = recordingEffects()
  await applyStage2ModuleCompletion(
    {
      session: scopeStage2SessionToModule(productsSession, "products"),
      hostSession: productsSession,
      moduleCompletion: await productsGateway.completeModule({
        module: "products",
        expectedRevision: 2,
      }),
    },
    products.effects,
  )
  assert.equal(products.recorded.bridged.length, 1)
  assert.equal(products.recorded.completed.length, 0)
  assert.equal(products.recorded.handedBack.length, 0)
  assert.deepEqual(
    products.recorded.events.map((event) => event.name),
    ["personal_plan_stage2_module_completed", "personal_plan_stage2_bridge_viewed"],
  )

  // 2. habits FIRST: nothing to hand off, so the host routes the user away.
  const habitsGateway = createStage2FixtureGateway({
    runtimeEnvironment: "test",
    triggerContext: plainTriggerContext,
    initialAnswers: habitsAnswers,
    initialCompletedQuestionIds: [...habitsQuestionIds],
    initialRevision: 4,
  })
  const habitsSession = await habitsGateway.load()
  const habitsCompletion = await habitsGateway.completeModule({
    module: "habits",
    expectedRevision: 4,
  })
  assert.equal(habitsCompletion.status, "in_progress")
  assert.equal(habitsCompletion.stage3Handoff, false)
  const habits = recordingEffects()
  await applyStage2ModuleCompletion(
    {
      session: scopeStage2SessionToModule(habitsSession, "habits"),
      hostSession: habitsSession,
      moduleCompletion: habitsCompletion,
    },
    habits.effects,
  )
  assert.equal(habits.recorded.handedBack.length, 1)
  assert.equal(habits.recorded.bridged.length, 0)
  assert.equal(habits.recorded.completed.length, 0)
  assert.deepEqual(
    habits.recorded.events.map((event) => event.name),
    ["personal_plan_stage2_module_completed"],
  )
  // The host payload must carry the FULL path, never the module-scoped one.
  assert.deepEqual(
    habits.recorded.handedBack[0].session.path.orderedQuestionIds,
    habitsSession.path.orderedQuestionIds,
  )
  assert.equal(
    habits.recorded.handedBack[0].session.path.orderedQuestionIds.includes(
      "current_product_categories",
    ),
    true,
  )

  // 3. the closing module: the draft is complete, exactly like the linear flow.
  const closingGateway = createStage2FixtureGateway({
    runtimeEnvironment: "test",
    triggerContext: plainTriggerContext,
    initialAnswers: {
      ...habitsAnswers,
      currentProductCategories: [],
      wetWashFrequency: "weekly_2x",
    },
    initialCompletedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      ...habitsQuestionIds,
    ],
    initialRevision: 6,
  })
  const closingSession = await closingGateway.load()
  const closingCompletion = await closingGateway.completeModule({
    module: "habits",
    expectedRevision: 6,
  })
  assert.equal(closingCompletion.status, "complete")
  const closing = recordingEffects()
  await applyStage2ModuleCompletion(
    {
      session: scopeStage2SessionToModule(closingSession, "habits"),
      hostSession: closingSession,
      moduleCompletion: closingCompletion,
    },
    closing.effects,
  )
  assert.equal(closing.recorded.completed.length, 1)
  assert.equal(closing.recorded.bridged.length, 0)
  assert.equal(closing.recorded.handedBack.length, 0)
})

/* ------------------------------------------------------------------------ *
 * Founder field test, 26.08.2026 — the post-accept loop is a set of surface
 * hops, not a funnel. Two rules follow: module questions carry the banner's
 * own coarse meter, and no chapter screen may appear between the surfaces.
 * ------------------------------------------------------------------------ */

const inertGateway = {
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

test("module questions carry the banner's coarse meter, verbatim from the server value", () => {
  const productsHtml = renderToStaticMarkup(
    <RefinementFlow
      gateway={inertGateway}
      initialSession={untouchedSession()}
      moduleEntry="products"
      moduleProgress={{ completedSteps: 2, totalSteps: 4 }}
      directEntry
    />,
  )
  assert.match(productsHtml, />2 von 4</)
  assert.match(productsHtml, /aria-valuenow="2"/)
  assert.match(productsHtml, /aria-valuemax="4"/)
  // The retired 5-stage bar must not come back with it (Task 2.7).
  assert.doesNotMatch(productsHtml, /Personal-Plan-Stufen/)

  const habitsHtml = renderToStaticMarkup(
    <RefinementFlow
      gateway={inertGateway}
      initialSession={productsDoneSession()}
      moduleEntry="habits"
      moduleProgress={{ completedSteps: 3, totalSteps: 4 }}
      directEntry
    />,
  )
  assert.match(habitsHtml, />3 von 4</)
  assert.match(habitsHtml, /aria-valuenow="3"/)

  // No server value (unavailable read, or the legacy linear funnel): no meter,
  // never an invented one.
  const withoutProgress = renderToStaticMarkup(
    <RefinementFlow
      gateway={inertGateway}
      initialSession={untouchedSession()}
      moduleEntry="products"
      directEntry
    />,
  )
  assert.doesNotMatch(withoutProgress, /von 4/)
  assert.doesNotMatch(withoutProgress, /role="progressbar"/)
})

test("an explicit module entry opens its first open question, never the resume chapter", () => {
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

  const html = renderToStaticMarkup(
    <RefinementFlow
      gateway={inertGateway}
      initialSession={midModule}
      moduleEntry="habits"
      directEntry
    />,
  )
  assert.doesNotMatch(html, /Du machst bei der ersten offenen Frage weiter\./)
  assert.doesNotMatch(html, /Bei der offenen Frage fortfahren/)
  assert.doesNotMatch(html, /Jetzt geben wir deinem Plan den Feinschliff\./)
  assert.match(html, /Wie du dein Haar behandelst/)
})

test("the bridge ceremony is suppressed for an explicit module entry but kept for failures", () => {
  // Auto-continue: the funnel's `autoHandoff` rule, overridden by an explicit
  // module entry (which the host turns `autoHandoff` off for).
  assert.equal(
    stage2BridgeAutoContinues({ autoHandoff: false, explicitModuleEntry: true }),
    true,
    "a finished module must hand off without a chapter tap",
  )
  assert.equal(stage2BridgeAutoContinues({ autoHandoff: false, explicitModuleEntry: false }), false)
  assert.equal(stage2BridgeAutoContinues({ autoHandoff: true, explicitModuleEntry: false }), true)

  for (const handoffStatus of ["idle", "loading", "complete"] as const) {
    assert.equal(
      stage2BridgePresentation({ explicitModuleEntry: true, handoffStatus }),
      "pending",
      `expected the quiet pending surface while ${handoffStatus}`,
    )
    assert.equal(
      stage2BridgePresentation({ explicitModuleEntry: false, handoffStatus }),
      "chapter",
      "the creation funnel keeps its chapter",
    )
  }
  // A failed handoff keeps a real surface in BOTH entries — it is the only
  // screen carrying the error copy and the retry action.
  assert.equal(
    stage2BridgePresentation({ explicitModuleEntry: true, handoffStatus: "error" }),
    "chapter",
  )
})

test("chapter ceremony is suppressed exactly for explicit module journeys", () => {
  assert.equal(
    planStartSuppressesChapterCeremony({ stage: "stage2", refineModule: "products" }),
    true,
  )
  assert.equal(
    planStartSuppressesChapterCeremony({ stage: "stage2", refineModule: "habits" }),
    true,
  )
  // The creation funnel and the plain `?refine=1` nudge keep every chapter.
  assert.equal(
    planStartSuppressesChapterCeremony({ stage: "stage2", refineModule: "first_open" }),
    false,
  )
  assert.equal(planStartSuppressesChapterCeremony({ stage: "stage2" }), false)
  assert.equal(planStartSuppressesChapterCeremony({ stage: "stage1" }), false)
  assert.equal(
    planStartSuppressesChapterCeremony({ stage: "stage3", refinedVersionId: "refined-1" }),
    false,
  )
})

test("plan-start carries the banner's progress into an explicit module entry only", async () => {
  const refinement = productsDoneSession()
  let progressReads = 0
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
    loadRefinementProgress: async () => {
      progressReads += 1
      return { completedSteps: 3, totalSteps: 4 }
    },
  }

  const scoped = await resolvePlanStartPageState(deps, { refine: true, refineModule: "habits" })
  assert.deepEqual(scoped, {
    state: "production",
    initialJourney: {
      stage: "stage2",
      returningToRefinement: true,
      refineModule: "habits",
      moduleProgress: { completedSteps: 3, totalSteps: 4 },
    },
    personalPlanId: "plan-1",
    initialRefinementSession: refinement,
  })
  assert.equal(progressReads, 1)

  // `?refine=1` shows no meter, so it must not pay for the read either.
  const legacy = await resolvePlanStartPageState(deps, {
    refine: true,
    refineModule: "first_open",
  })
  assert.deepEqual(legacy, {
    state: "production",
    initialJourney: {
      stage: "stage2",
      returningToRefinement: true,
      refineModule: "first_open",
    },
    personalPlanId: "plan-1",
    initialRefinementSession: refinement,
  })
  assert.equal(progressReads, 1)

  // A failing progress read must never cost the user the module entry.
  const failing = await resolvePlanStartPageState(
    {
      ...deps,
      loadRefinementProgress: async () => {
        throw new Error("refinement status unavailable")
      },
    },
    { refine: true, refineModule: "products" },
  )
  assert.deepEqual(failing, {
    state: "production",
    initialJourney: {
      stage: "stage2",
      returningToRefinement: true,
      refineModule: "products",
    },
    personalPlanId: "plan-1",
    initialRefinementSession: refinement,
  })
})
