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
  type Stage2ModuleCompletionPayload,
  type Stage2RefinementTelemetryEvent,
} from "../src/components/personal-plan-refinement/refinement-flow"
import { PLAN_ACCEPT_REFINE_HREF } from "../src/components/personal-plan-journey/accept-ideal-plan"
import {
  moduleCompletionRoutineHref,
  planStartModuleEntry,
  planStartRefinementExitDestination,
  planStartSuppressesChapterCeremony,
  stage2ModuleCompletionRoutingProps,
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

test("the entry module resolves products first and first_open always lands on a module", () => {
  assert.equal(firstOpenStage2Module(untouchedSession()), "products")
  assert.equal(firstOpenStage2Module(productsDoneSession()), "habits")
  assert.equal(firstOpenStage2Module(fullyAnsweredSession("in_progress")), null)

  assert.equal(resolveStage2EntryModule(productsDoneSession(), "first_open"), "habits")
  assert.equal(resolveStage2EntryModule(productsDoneSession(), "products"), "products")
  assert.equal(resolveStage2EntryModule(productsDoneSession(), null), null)
  // `?refine=1` on an all-answered draft behaves like an explicit entry into the
  // first module — the same edit visit a `?refine=products` deep link gets.
  assert.equal(
    resolveStage2EntryModule(fullyAnsweredSession("in_progress"), "first_open"),
    "products",
  )
  assert.equal(resolveStage2EntryModule(fullyAnsweredSession("complete"), "first_open"), "products")

  // A resolved first_open request IS an explicit module scope.
  assert.equal(resolveStage2ModuleScope("first_open", "products"), "explicit")
  assert.equal(resolveStage2ModuleScope("first_open", "habits"), "explicit")
  assert.equal(resolveStage2ModuleScope(null, null), "none")
  assert.equal(resolveStage2ModuleScope(undefined, null), "none")
})

test("module entry resumes question-exact and never re-bridges a consumed handoff", () => {
  const fresh = untouchedSession()
  assert.deepEqual(
    resolveStage2FlowEntryView({
      session: scopeStage2SessionToModule(fresh, "products"),
      moduleScope: "explicit",
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

  // Handoff consumption: re-entering an ALREADY finished module (a reload after
  // Stage-3 entry, or the banner pointing back at it) re-walks the module and
  // never re-arms the Stage-3 bridge.
  assert.deepEqual(
    resolveStage2FlowEntryView({
      session: scopeStage2SessionToModule(productsDoneSession(), "products"),
      moduleScope: "explicit",
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
    }),
    {
      mode: "bridge",
      activeQuestionId: null,
      status: "idle",
      liveMessage: "",
      bridge: true,
    },
  )
  // A fresh legacy entry opens its first question — the invitation chapter is
  // retired (relic removal 28.08.2026).
  assert.deepEqual(
    resolveStage2FlowEntryView({
      session: untouchedSession(),
      moduleScope: "none",
    }).mode,
    "question",
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
 * A10 (founder ruling 27.08.2026). The failed-accept escape hatch is an
 * explicit `products` deep link, so a buyer whose accept could not resolve
 * lands directly in their product questions. (Since the relic removal
 * 28.08.2026, `?refine=1` behaves the same way — resolved to the first open
 * module — so the hatch's `products` target is about naming the right module,
 * not about escaping retired ceremony.)
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
  // SCOPE without post-accept ORIGIN: this fixture has no Stage-4 access, which
  // is the failed-accept cohort's defining fact. The exit stays inside the flow
  // rather than aiming at a /routine the frontier redirect would bounce
  // straight back to a bare /plan-start (Codex review blocker 2).
  assert.equal(planStartRefinementExitDestination(initialJourney), "stage1")

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

test("`?refine=1` behaves like an explicit entry into the first open module", () => {
  // Relic removal 28.08.2026: `first_open` no longer resurrects the retired
  // ceremony — it IS an explicit module entry, resolved against the session.
  assert.equal(parseRefineModuleParam("1"), "first_open")
  assert.equal(
    planStartSuppressesChapterCeremony({ stage: "stage2", refineModule: "first_open" }),
    true,
  )
  // The direct-accept cohort (COMPLETE draft) gets the same edit visit an
  // explicit `?refine=products` deep link gets — never the bridge chapter.
  const completeDraft = fullyAnsweredSession("complete")
  assert.equal(resolveStage2EntryModule(completeDraft, "first_open"), "products")
  assert.equal(
    resolveStage2FlowEntryView({
      session: scopeStage2SessionToModule(completeDraft, "products"),
      moduleScope: resolveStage2ModuleScope("first_open", "products"),
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
    }).activeQuestionId,
    "towel_handling",
  )

  // The unscoped LEGACY entry (no refine request at all) still bridges — that
  // is the linear cohort's surface, untouched by the module entries.
  assert.equal(resolveStage2EntryModule(session, null), null)
  assert.equal(resolveStage2ModuleScope(null, null), "none")
  assert.deepEqual(resolveStage2FlowEntryView({ session, moduleScope: "none" }), {
    mode: "bridge",
    activeQuestionId: null,
    status: "idle",
    liveMessage: "",
    bridge: true,
  })
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
    />,
  )
  assert.match(html, /Wie du dein Haar behandelst/)
  assert.doesNotMatch(html, /Jetzt gleichen wir deine Produkte ab\./)

  // The same completed draft without a module deep link still bridges.
  const legacyHtml = renderToStaticMarkup(
    <RefinementFlow gateway={gateway} initialSession={directAcceptSession()} />,
  )
  assert.match(legacyHtml, /Deine Produkte werden vorbereitet\./)
  assert.doesNotMatch(legacyHtml, /data-personal-plan-chapter/)
  assert.doesNotMatch(legacyHtml, /Produkte erfassen/)
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
  // `?refine=1` is the Routine refinement nudge — an explicit module entry too.
  assert.equal(stage2SecondaryExitDestination("first_open"), "routine")
  assert.equal(stage2SecondaryExitDestination(undefined), "stage1")

  // The journey-level destination additionally needs the post-accept ORIGIN —
  // see "the secondary exit leaves for /routine only once the plan is accepted".
  assert.equal(
    planStartRefinementExitDestination({
      stage: "stage2",
      refineModule: "habits",
      planAccepted: true,
    }),
    "routine",
  )
  assert.equal(
    planStartRefinementExitDestination({
      stage: "stage2",
      refineModule: "first_open",
      planAccepted: true,
    }),
    "routine",
  )
  // Without the accepted ORIGIN the exit stays inside the flow.
  assert.equal(
    planStartRefinementExitDestination({ stage: "stage2", refineModule: "first_open" }),
    "stage1",
  )
  assert.equal(planStartRefinementExitDestination({ stage: "stage2" }), "stage1")
  assert.equal(planStartRefinementExitDestination({ stage: "stage1" }), "stage1")
})

test("Task 2.6: a habits-first module completion signals the toast only for an explicit module entry", () => {
  // `planAccepted` is what makes this a re-computation rather than a first
  // activation — see "the „Plan aktualisiert“ toast is never claimed for an
  // initial activation" below for the escape-hatch half of this contract.
  // Task 2.2: origin alone is no longer enough — the outcome must be
  // "applied" too (see the dedicated Task 2.2 test below for the full matrix).
  assert.equal(
    moduleCompletionRoutineHref(
      { stage: "stage2", refineModule: "habits", planAccepted: true },
      "applied",
    ),
    "/routine?planUpdated=1",
  )
  assert.equal(
    moduleCompletionRoutineHref(
      { stage: "stage2", refineModule: "products", planAccepted: true },
      "applied",
    ),
    "/routine?planUpdated=1",
  )
  // `?refine=1` is the Routine refinement nudge — on an accepted plan its
  // completion is a refinement-driven recompute like any other module entry.
  assert.equal(
    moduleCompletionRoutineHref({
      stage: "stage2",
      refineModule: "first_open",
      planAccepted: true,
    }),
    "/routine?planUpdated=1",
  )
  // Without the accepted ORIGIN, and for the legacy linear entry: no signal.
  assert.equal(
    moduleCompletionRoutineHref({ stage: "stage2", refineModule: "first_open" }, "applied"),
    "/routine",
  )
  assert.equal(moduleCompletionRoutineHref({ stage: "stage2" }, "applied"), "/routine")
  assert.equal(moduleCompletionRoutineHref({ stage: "stage1" }, "applied"), "/routine")
})

/**
 * Task 2.2. `moduleCompletionRoutineHref`'s honesty fix: origin
 * (`isPostAcceptModuleEntry`) is necessary but no longer sufficient — the
 * server-reported recompute outcome (T1.4's `moduleCompletion.recompute?.outcome`)
 * must ALSO be `"applied"`. `"unchanged"`, `"unavailable"`, and an absent
 * field (no active routine yet, or an older server) all mean the routine was
 * NOT touched, so the toast must not ride along even on a genuine post-accept
 * module entry.
 */
test("Task 2.2: the toast is claimed only when the server actually recomputed the routine", () => {
  const postAcceptHabits = {
    stage: "stage2",
    refineModule: "habits",
    planAccepted: true,
  } as const

  // applied + post-accept origin -> the one case that toasts.
  assert.equal(moduleCompletionRoutineHref(postAcceptHabits, "applied"), "/routine?planUpdated=1")
  // unchanged / unavailable / absent field -> nothing was recomputed, no toast.
  assert.equal(moduleCompletionRoutineHref(postAcceptHabits, "unchanged"), "/routine")
  assert.equal(moduleCompletionRoutineHref(postAcceptHabits, "unavailable"), "/routine")
  assert.equal(moduleCompletionRoutineHref(postAcceptHabits), "/routine")

  // Non-post-accept journeys stay plain regardless of outcome — origin is
  // still a necessary condition, this task only tightens it further.
  const escapeHatchHabits = { stage: "stage2", refineModule: "habits" } as const
  assert.equal(moduleCompletionRoutineHref(escapeHatchHabits, "applied"), "/routine")
  assert.equal(moduleCompletionRoutineHref(escapeHatchHabits, "unchanged"), "/routine")
  assert.equal(moduleCompletionRoutineHref(escapeHatchHabits, "unavailable"), "/routine")
  assert.equal(moduleCompletionRoutineHref(escapeHatchHabits), "/routine")
})

test("Task 2.6: a Stage-3 completion signals the toast only when it followed an explicit module entry", () => {
  assert.equal(
    stage3CompletionRoutineHref(
      { stage: "stage2", refineModule: "products", planAccepted: true },
      "/routine",
    ),
    "/routine?planUpdated=1",
  )
  // The accepted `?refine=1` nudge cohort toasts too — it is a module entry.
  assert.equal(
    stage3CompletionRoutineHref(
      { stage: "stage2", refineModule: "first_open", planAccepted: true },
      "/routine",
    ),
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

// Fix-round IMPORTANT 1: `plan-start-flow.tsx`'s JSX spreads
// `stage2ModuleCompletionRoutingProps(initialJourney)` onto `<RefinementFlow>`
// instead of listing `moduleEntry`/`postAcceptModuleEntry` as separate prop
// lines (see the call site) — precisely so this exported pure function IS the
// wiring, not just a proxy for it. Deleting or breaking that spread at the
// call site cannot leave this pinned without also either breaking these
// assertions (if the fix is inside the function) or being visible as an
// explicit, reviewable prop override in the JSX diff (if the divergence is
// only at the call site) — there is no way to reintroduce the T2.1 bug by
// silently deleting one line.
test("stage2ModuleCompletionRoutingProps threads the post-accept origin signal the host hands to RefinementFlow", () => {
  // stage1: no module scope, never post-accept.
  assert.deepEqual(stage2ModuleCompletionRoutingProps({ stage: "stage1" }), {
    moduleEntry: undefined,
    postAcceptModuleEntry: false,
  })
  // stage2, no explicit module (plain resume/first_open): never post-accept,
  // regardless of `planAccepted` — SCOPE gates origin, not acceptance alone.
  assert.deepEqual(stage2ModuleCompletionRoutingProps({ stage: "stage2", planAccepted: true }), {
    moduleEntry: undefined,
    postAcceptModuleEntry: false,
  })
  // stage2, explicit module deep link, ALREADY ACCEPTED plan — the post-accept
  // loop this task fixes (Routine banner / Profil row tap).
  assert.deepEqual(
    stage2ModuleCompletionRoutingProps({
      stage: "stage2",
      refineModule: "habits",
      planAccepted: true,
    }),
    { moduleEntry: "habits", postAcceptModuleEntry: true },
  )
  // stage2, explicit module deep link, but the plan is NOT accepted yet — the
  // failed-accept escape hatch / unaccepted-cohort exception: scope without
  // origin.
  assert.deepEqual(
    stage2ModuleCompletionRoutingProps({ stage: "stage2", refineModule: "products" }),
    { moduleEntry: "products", postAcceptModuleEntry: false },
  )
  // stage3, reloaded Modul-1 journey with an explicit module marker and an
  // accepted plan (Back-out-of-Stage-3 case): still post-accept.
  assert.deepEqual(
    stage2ModuleCompletionRoutingProps({
      stage: "stage3",
      refinedVersionId: "refined-1",
      refineModule: "products",
      planAccepted: true,
    }),
    { moduleEntry: "products", postAcceptModuleEntry: true },
  )
})

/**
 * Builds a fixture gateway whose products questions are already answered, so
 * `completeModule({ module: "habits", ... })` can close the draft (habits was
 * NOT the first module). Shared by the closing-module cases below.
 */
function closingHabitsGateway() {
  return createStage2FixtureGateway({
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
}

test("Modul 1 (products) completing NON-closing always bridges into Stage 3", async () => {
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
      postAcceptModuleEntry: false,
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
})

test("Modul 1 (products) completing as the CLOSING module (habits-first order) is unaffected by origin — exactly today's completed-session path, never handed back", async () => {
  for (const postAcceptModuleEntry of [false, true]) {
    const gateway = createStage2FixtureGateway({
      runtimeEnvironment: "test",
      triggerContext: plainTriggerContext,
      initialAnswers: {
        ...habitsAnswers,
        currentProductCategories: [],
        wetWashFrequency: "weekly_2x",
      },
      initialCompletedQuestionIds: [
        ...habitsQuestionIds,
        "current_product_categories",
        "wet_wash_frequency",
      ],
      initialRevision: 6,
    })
    const session = await gateway.load()
    const completion = await gateway.completeModule({ module: "products", expectedRevision: 6 })
    assert.equal(completion.status, "complete")
    assert.equal(completion.stage3Handoff, true)
    const recording = recordingEffects()
    await applyStage2ModuleCompletion(
      {
        session: scopeStage2SessionToModule(session, "products"),
        hostSession: session,
        moduleCompletion: completion,
        postAcceptModuleEntry,
      },
      recording.effects,
    )
    // `stage3Handoff` is exclusive to `products` — the ONLY module whose
    // closing completion is unaffected by the T2.1 origin routing. It still
    // marks the session complete (today's `showCompletedSession` path, not
    // `showStage3Bridge`), so a later Back-out-of-Stage-3 sees a correctly
    // completed draft rather than a falsely reopened one.
    assert.equal(recording.recorded.completed.length, 1)
    assert.equal(recording.recorded.bridged.length, 0)
    assert.equal(recording.recorded.handedBack.length, 0)
  }
})

test("Modul 2 (habits) completing NON-closing hands back to the host — origin-independent", async () => {
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
      postAcceptModuleEntry: true,
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
})

// The bug report (T2.1): Verhalten is the CLOSING module in the canonical
// order (Produkte → Stage 3 → Routine → Verhalten). Its completion must NOT
// re-arm the Stage-3 bridge for a post-accept module entry — the user already
// walked Stage 3 in this very cohort and must go back to the Routine instead.
test("Modul 2 (habits) completing as the CLOSING module on a POST-ACCEPT run hands back to the host, not the bridge", async () => {
  const closingGateway = closingHabitsGateway()
  const closingSession = await closingGateway.load()
  const closingCompletion = await closingGateway.completeModule({
    module: "habits",
    expectedRevision: 6,
  })
  assert.equal(closingCompletion.status, "complete")
  assert.equal(closingCompletion.stage3Handoff, false)
  const closing = recordingEffects()
  await applyStage2ModuleCompletion(
    {
      session: scopeStage2SessionToModule(closingSession, "habits"),
      hostSession: closingSession,
      moduleCompletion: closingCompletion,
      postAcceptModuleEntry: true,
    },
    closing.effects,
  )
  assert.equal(closing.recorded.handedBack.length, 1)
  assert.equal(closing.recorded.bridged.length, 0)
  assert.equal(closing.recorded.completed.length, 0)
  // The host payload must carry the FULL (unscoped) path — same discipline as
  // the non-closing habits hand-back above.
  assert.deepEqual(
    closing.recorded.handedBack[0].session.path.orderedQuestionIds,
    closingSession.path.orderedQuestionIds,
  )
  // The draft DID fully complete server-side — the canonical completion event
  // still fires (future telemetry wiring should see it), but bridge_viewed
  // must NOT: the bridge never shows on this path (fix-round MINOR 3).
  assert.deepEqual(
    closing.recorded.events.map((event) => event.name),
    ["personal_plan_stage2_module_completed", "personal_plan_stage2_completed"],
  )
})

// The unaccepted-cohort exception: reachable only via a hand-built
// `?refine=habits` link on a draft that was never accepted (no product surface
// links it). `/routine` would bounce that cohort, so the closing completion
// keeps today's behavior — the bridge, since the full completion ran — so
// their journey can still reach initial activation.
test("Modul 2 (habits) completing as the CLOSING module WITHOUT an accepted plan keeps the bridge (unaccepted-cohort exception)", async () => {
  const closingGateway = closingHabitsGateway()
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
      postAcceptModuleEntry: false,
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
    <RefinementFlow gateway={inertGateway} initialSession={midModule} moduleEntry="habits" />,
  )
  assert.doesNotMatch(html, /Du machst bei der ersten offenen Frage weiter\./)
  assert.doesNotMatch(html, /Bei der offenen Frage fortfahren/)
  assert.doesNotMatch(html, /Jetzt geben wir deinem Plan den Feinschliff\./)
  assert.match(html, /Wie du dein Haar behandelst/)

  // `first_open` resolves to that same module and renders identically — the
  // `?refine=1` nudge is an explicit module entry end to end.
  const firstOpenHtml = renderToStaticMarkup(
    <RefinementFlow
      gateway={inertGateway}
      initialSession={midModule}
      moduleEntry="first_open"
      moduleProgress={{ completedSteps: 3, totalSteps: 4 }}
    />,
  )
  assert.match(firstOpenHtml, /Wie du dein Haar behandelst/)
  assert.match(firstOpenHtml, />3 von 4</)
  assert.doesNotMatch(firstOpenHtml, /Du machst bei der ersten offenen Frage weiter\./)
  assert.doesNotMatch(firstOpenHtml, /Personal-Plan-Stufen/)
})

test("the bridge auto-handoff rule no longer implies a chapter presentation", () => {
  // Auto-continue: the funnel's `autoHandoff` rule, overridden by an explicit
  // module entry (which the host turns `autoHandoff` off for). The rendered
  // surface is now always the inline handoff shell; there is no separate
  // chapter/presentation branch left to choose from.
  assert.equal(
    stage2BridgeAutoContinues({ autoHandoff: false, explicitModuleEntry: true }),
    true,
    "a finished module must hand off without a chapter tap",
  )
  assert.equal(stage2BridgeAutoContinues({ autoHandoff: false, explicitModuleEntry: false }), false)
  assert.equal(stage2BridgeAutoContinues({ autoHandoff: true, explicitModuleEntry: false }), true)
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
  // The `?refine=1` nudge is a module entry too (relic removal 28.08.2026);
  // only the legacy linear journeys keep the remaining chapters.
  assert.equal(
    planStartSuppressesChapterCeremony({ stage: "stage2", refineModule: "first_open" }),
    true,
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

  // `?refine=1` is a module entry end to end, so it carries the meter too.
  const firstOpen = await resolvePlanStartPageState(deps, {
    refine: true,
    refineModule: "first_open",
  })
  assert.deepEqual(firstOpen, {
    state: "production",
    initialJourney: {
      stage: "stage2",
      returningToRefinement: true,
      refineModule: "first_open",
      moduleProgress: { completedSteps: 3, totalSteps: 4 },
    },
    personalPlanId: "plan-1",
    initialRefinementSession: refinement,
  })
  assert.equal(progressReads, 2)

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

/**
 * BLOCKER 2 (Codex whole-branch review). Module SCOPE and journey ORIGIN are
 * two different facts, and round 1 conflated them.
 *
 * `?refine=products` is now reached from two places: the Routine banner / Profil
 * row (an ACCEPTED plan, post-activation) and the failed-accept escape hatch (an
 * UNACCEPTED plan, pre-activation). Both are explicit module entries, so both
 * correctly suppress the chapter ceremony — but the unaccepted cohort has no
 * Routine to go back to and no previous plan to have "updated".
 */
test("the secondary exit leaves for /routine only once the plan is accepted", () => {
  assert.equal(
    planStartRefinementExitDestination({
      stage: "stage2",
      refineModule: "products",
      planAccepted: true,
    }),
    "routine",
  )
  // Failed-accept escape hatch: the plan was never activated, so /routine would
  // be bounced by the frontier redirect back to a BARE /plan-start — losing the
  // module scope and landing the user on the resume shell. Staying inside the
  // flow and showing them the plan they were trying to accept is the honest exit.
  assert.equal(
    planStartRefinementExitDestination({ stage: "stage2", refineModule: "products" }),
    "stage1",
  )
  assert.equal(
    planStartRefinementExitDestination({
      stage: "stage3",
      refinedVersionId: "refined-1",
      refineModule: "products",
    }),
    "stage1",
  )
})

test("the ceremony stays suppressed for BOTH module cohorts, accepted or not", () => {
  // Scope is independent of origin: the escape-hatch cohort must not regain the
  // chapter screens just because their plan is not accepted yet.
  for (const planAccepted of [true, false]) {
    assert.equal(
      planStartSuppressesChapterCeremony({
        stage: "stage2",
        refineModule: "products",
        ...(planAccepted ? { planAccepted } : {}),
      }),
      true,
    )
  }
})

test("the „Plan aktualisiert“ toast is never claimed for an initial activation", () => {
  // An accepted plan really is being updated — signal it (only once the
  // server confirms it actually recomputed, Task 2.2 — see "applied" here).
  assert.equal(
    moduleCompletionRoutineHref(
      {
        stage: "stage2",
        refineModule: "habits",
        planAccepted: true,
      },
      "applied",
    ),
    "/routine?planUpdated=1",
  )
  assert.equal(
    stage3CompletionRoutineHref(
      { stage: "stage2", refineModule: "products", planAccepted: true },
      "/routine",
    ),
    "/routine?planUpdated=1",
  )

  // The failed-accept cohort is arriving at their FIRST routine. Nothing was
  // updated; the arrival speaks for itself.
  assert.equal(
    moduleCompletionRoutineHref({ stage: "stage2", refineModule: "habits" }, "applied"),
    "/routine",
  )
  assert.equal(
    stage3CompletionRoutineHref({ stage: "stage2", refineModule: "products" }, "/routine"),
    "/routine",
  )
  assert.equal(
    stage3CompletionRoutineHref(
      { stage: "stage3", refinedVersionId: "refined-1", refineModule: "products" },
      "/routine",
    ),
    "/routine",
  )
})

/**
 * BLOCKER 3 (Codex whole-branch review). `page.tsx` restores
 * `refineModule: "products"` on the reloaded Modul-1 Stage-3 journey, but the
 * flow only read that field when `initialJourney.stage === "stage2"`. Pressing
 * Back out of Stage 3 switches the LOCAL stage to `stage2` while
 * `initialJourney.stage` stays `"stage3"` forever — so the module scope was
 * dropped exactly on the path the round-1 fix existed to protect.
 */
test("a reloaded Modul-1 Stage-3 journey keeps its product scope when Back is pressed", () => {
  const reloaded = {
    stage: "stage3",
    refinedVersionId: "refined-1",
    refineModule: "products",
    planAccepted: true,
  } as const

  assert.equal(planStartModuleEntry(reloaded), "products")
  // A Stage-3 journey that is NOT a module run still has no module scope.
  assert.equal(planStartModuleEntry({ stage: "stage3", refinedVersionId: "refined-1" }), undefined)
  assert.equal(planStartModuleEntry({ stage: "stage1" }), undefined)
  assert.equal(planStartModuleEntry({ stage: "stage2", refineModule: "habits" }), "habits")
})

test("Back out of a reloaded Stage-3 module run renders the module's questions, not the resume shell", () => {
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
  const reloaded = {
    stage: "stage3",
    refinedVersionId: "refined-1",
    refineModule: "products",
    planAccepted: true,
  } as const
  // The seed the flow retains across the Stage-3 → Stage-2 switch: a partially
  // answered draft, which is exactly what makes the resume shell appear when the
  // module scope is lost.
  const session = productsDoneSession()

  const scoped = renderToStaticMarkup(
    <RefinementFlow
      gateway={gateway}
      initialSession={session}
      moduleEntry={planStartModuleEntry(reloaded)}
    />,
  )
  assert.match(scoped, /Was du heute benutzt/)
  assert.doesNotMatch(scoped, /Wir laden deinen Feinschliff\./)

  // The regression this pins: without the module marker the same seed renders
  // the resume shell — the retired ceremony, on a post-accept surface hop.
  const unscoped = renderToStaticMarkup(
    <RefinementFlow gateway={gateway} initialSession={session} />,
  )
  assert.match(unscoped, /Wie du dein Haar behandelst/)
  assert.doesNotMatch(unscoped, /Wir laden deinen Feinschliff\./)
})

/**
 * Codex review 28.08.2026: the direct-accept `?refine=1` cohort, integrated —
 * parse → page journey → complete-draft render → the products edit through the
 * fused module completion the component submits — plus the revision-conflict
 * reload keeping the first_open scope. The separate helper assertions above
 * each pin one seam; this pins the composition.
 */
test("the ?refine=1 direct-accept journey opens products and completes the edit end to end", async () => {
  const fullyAnsweredIds = [
    "current_product_categories",
    "wet_wash_frequency",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "night_protection",
  ] as const
  const fullyAnsweredAnswers = {
    currentProductCategories: [],
    wetWashFrequency: "weekly_2x" as const,
    towel: { material: "no_towel" as const },
    dryingRoutes: [],
    additionalHeatTools: [],
    nightProtection: [],
  }

  // Parse → page journey: an ACCEPTED plan whose draft is complete.
  const journeyState = await resolvePlanStartPageState(
    {
      enabled: () => true,
      stage2Enabled: () => true,
      getUserId: async () => "owner-1",
      loadJourneyAccess: async () => ({
        kind: "personal_plan",
        personalPlanId: "plan-1",
        frontier: "stage4",
        nextHref: "/routine",
        activeRoutineVersionId: "routine-1",
        allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: false },
      }),
      loadExistingRefinementSession: async () => fullyAnsweredSession("complete"),
      loadRefinementProgress: async () => ({ completedSteps: 4, totalSteps: 4 }),
    },
    { refine: parseRefineParam("1"), refineModule: parseRefineModuleParam("1") },
  )
  assert.equal(journeyState.state, "production")
  const journey = journeyState.state === "production" ? journeyState.initialJourney : null
  assert.ok(journey)
  assert.deepEqual(journey, {
    stage: "stage2",
    returningToRefinement: true,
    refineModule: "first_open",
    moduleProgress: { completedSteps: 4, totalSteps: 4 },
    planAccepted: true,
  })
  assert.equal(planStartModuleEntry(journey), "first_open")
  assert.equal(planStartSuppressesChapterCeremony(journey), true)
  assert.equal(planStartRefinementExitDestination(journey), "routine")
  assert.equal(moduleCompletionRoutineHref(journey), "/routine?planUpdated=1")

  // The REAL fixture gateway's complete draft renders the products module's
  // first question with the meter — never the bridge chapter or a shell.
  const gateway = createStage2FixtureGateway({
    runtimeEnvironment: "test",
    triggerContext: plainTriggerContext,
    initialAnswers: fullyAnsweredAnswers,
    initialCompletedQuestionIds: [...fullyAnsweredIds],
    initialRevision: 6,
    initialStatus: "complete",
  })
  const loaded = await gateway.load()
  assert.equal(loaded.status, "complete")
  const seededHandoffVersion = loaded.completedHandoff?.refinedVersionId
  assert.ok(seededHandoffVersion)
  const html = renderToStaticMarkup(
    <RefinementFlow
      gateway={gateway}
      initialSession={loaded}
      moduleEntry={planStartModuleEntry(journey)}
      moduleProgress={journey.stage === "stage2" ? (journey.moduleProgress ?? null) : null}
    />,
  )
  assert.match(html, /Was du heute benutzt/)
  assert.match(html, />4 von 4</)
  assert.doesNotMatch(html, /Jetzt gleichen wir deine Produkte ab\./)
  assert.doesNotMatch(html, /Wir laden deinen Feinschliff\./)
  assert.doesNotMatch(html, /Personal-Plan-Stufen/)

  // The edit the component submits when the module page completes again: the
  // fused save + module completion, at the loaded revision. The save reopens
  // the complete draft, so the completion mints a FRESH handoff.
  const fused = await gateway.saveAnswerAndCompleteModule({
    module: "products",
    questionId: "current_product_categories",
    answer: ["shampoo"],
    expectedRevision: loaded.revision,
  })
  assert.equal(fused.session.revision, loaded.revision + 1)
  assert.equal(fused.moduleCompletion.module, "products")
  assert.equal(fused.moduleCompletion.stage3Handoff, true)
  // Every question is answered, so this is the closing-module path: the draft
  // closes again, exactly like the linear completion.
  assert.equal(fused.moduleCompletion.status, "complete")
  assert.notEqual(fused.moduleCompletion.refinedVersionId, seededHandoffVersion)
  // Despite `returningToRefinement` (autoHandoff off), a bridge armed by THIS
  // session's module completion auto-continues into Stage 3.
  assert.equal(stage2BridgeAutoContinues({ autoHandoff: false, explicitModuleEntry: true }), true)

  // A concurrent write conflicts, and the reload keeps the first_open scope:
  // the reloaded draft still resolves to a module entry in question mode.
  const staleRevision = fused.session.revision
  gateway.simulateExternalRevision()
  await assert.rejects(
    gateway.saveAnswer({
      questionId: "current_product_categories",
      answer: [],
      expectedRevision: staleRevision,
    }),
    (error: unknown) =>
      error instanceof Stage2RefinementError && error.code === "revision_conflict",
  )
  const reloaded = await gateway.load()
  const reloadedModule = resolveStage2EntryModule(reloaded, "first_open")
  assert.ok(reloadedModule)
  assert.equal(resolveStage2ModuleScope("first_open", reloadedModule), "explicit")
  assert.equal(
    resolveStage2FlowEntryView({
      session: scopeStage2SessionToModule(reloaded, reloadedModule),
      moduleScope: "explicit",
    }).mode,
    "question",
  )
})
