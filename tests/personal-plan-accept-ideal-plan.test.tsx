import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  PLAN_ACCEPT_ERROR,
  PLAN_ACCEPT_REFINE_HREF,
  PLAN_ACCEPT_UNAVAILABLE_NOTICE,
  acceptIdealPlanReadiness,
  acceptStatusAfterStale,
  deriveAcceptIdealPlanSeenRoles,
  interpretAcceptIdealPlanResponse,
  resolveStage1PreviewLoadState,
  runAcceptIdealPlanFlow,
  type AcceptIdealPlanOutcome,
  type AcceptIdealPlanSeenRole,
} from "../src/components/personal-plan-journey/accept-ideal-plan"
import {
  PLAN_START_ACCEPT_LABEL,
  PLAN_START_ACCEPT_PENDING_LABEL,
  PLAN_START_REFINE_ERROR,
  PLAN_START_REFINE_LABEL,
  PLAN_START_REFINE_PENDING_LABEL,
} from "../src/components/personal-plan-start/need-plan-screen"
import {
  PlanStartCustomerJourney,
  PlanStartFlow,
  planStartCtaState,
  requestAcceptIdealPlan,
} from "../src/components/personal-plan-start/plan-start-flow"
import {
  isStage1ProductExamplePreviewResponse,
  type Stage1ProductExamplePreviewResponse,
} from "../src/lib/personal-plan/product-preview-contract"

function recommendation(
  overrides: Partial<Stage1ProductExamplePreviewResponse["previews"][number]> = {},
) {
  return {
    kind: "recommendation" as const,
    category: "shampoo" as const,
    role: "shampoo_everyday" as const,
    decisionKey: "decision:shampoo:shampoo_everyday:gap",
    productId: "redken-all-soft",
    productName: "Redken All Soft Shampoo",
    imageUrl: "https://example.com/redken.webp",
    verdict: "ideal" as const,
    authorityVersion: "personal-plan.shampoo.v4",
    factFingerprint: "facts-redken",
    commerce: {
      priceEur: 17.95,
      purchaseLinkStatus: "available" as const,
      netContentValue: 300,
      netContentUnit: "ml" as const,
      priceLabel: "17,95 €",
      netContentLabel: "300 ml",
      availabilityLabel: "Aktuell verfügbar",
      productUrl: "https://example.com/redken",
      affiliateDisclosure: null,
    },
    reasoning: {
      productCriteria: "Sanfte Tenside.",
      fit: "Passt zu deiner Kopfhaut.",
      frequency: "2x pro Woche",
    },
    ...overrides,
  } as Stage1ProductExamplePreviewResponse["previews"][number]
}

function previewResponse(
  previews: Stage1ProductExamplePreviewResponse["previews"],
  directAcceptance: Stage1ProductExamplePreviewResponse["directAcceptance"] = { available: true },
): Stage1ProductExamplePreviewResponse {
  return {
    schemaVersion: 2,
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    sourceInputHash: "input-1",
    previews,
    directAcceptance,
  }
}

const leadLeaveIn = recommendation({
  category: "leave_in",
  role: "post_wash_leave_in",
  decisionKey: "decision:leave_in:post_wash_leave_in:gap",
  productId: "leave-in-basis",
  productName: "Leave-in Basis",
  authorityVersion: "personal-plan.leave-in.v3",
  factFingerprint: "facts-leave-in-basis",
})
const secondaryLeaveIn = recommendation({
  category: "leave_in",
  role: "pre_heat_application",
  decisionKey: "decision:leave_in:pre_heat_application:gap",
  productId: "leave-in-hitze",
  productName: "Leave-in Hitzeschutz",
  authorityVersion: "personal-plan.leave-in.v3",
  factFingerprint: "facts-leave-in-hitze",
})
const maskFallback = {
  kind: "fallback" as const,
  category: "mask" as const,
  role: "intensive_conditioning_mask" as const,
  decisionKey: "decision:mask:intensive_conditioning_mask:gap",
  authorityVersion: "personal-plan.mask.v4",
  fallback: "post_refinement" as const,
} as Stage1ProductExamplePreviewResponse["previews"][number]

const seenRole: AcceptIdealPlanSeenRole = {
  decisionKey: "d",
  productId: "p",
  factFingerprint: "f",
}

test("the accept payload echoes every recommendation role with its exact pinned fields", () => {
  assert.deepEqual(
    deriveAcceptIdealPlanSeenRoles(
      previewResponse([recommendation(), leadLeaveIn, secondaryLeaveIn]),
    ),
    [
      {
        decisionKey: "decision:shampoo:shampoo_everyday:gap",
        productId: "redken-all-soft",
        factFingerprint: "facts-redken",
      },
      {
        decisionKey: "decision:leave_in:post_wash_leave_in:gap",
        productId: "leave-in-basis",
        factFingerprint: "facts-leave-in-basis",
      },
      {
        decisionKey: "decision:leave_in:pre_heat_application:gap",
        productId: "leave-in-hitze",
        factFingerprint: "facts-leave-in-hitze",
      },
    ],
  )
})

/**
 * The former fork blocked acceptance whenever a role had no product or the
 * server declared a category refinement-bound. Those roles are now server-side
 * `deferred` decisions, so the client must send what the user saw — including
 * nothing at all — and let the accept contract resolve the rest.
 */
test("an empty or partial preview payload still produces an acceptable seen state", () => {
  assert.deepEqual(deriveAcceptIdealPlanSeenRoles(null), [])
  assert.deepEqual(deriveAcceptIdealPlanSeenRoles(previewResponse([maskFallback])), [])
  assert.deepEqual(
    deriveAcceptIdealPlanSeenRoles(previewResponse([recommendation(), maskFallback])),
    [
      {
        decisionKey: "decision:shampoo:shampoo_everyday:gap",
        productId: "redken-all-soft",
        factFingerprint: "facts-redken",
      },
    ],
  )
})

test("the accept response maps every documented outcome to its own recovery", () => {
  assert.deepEqual(
    interpretAcceptIdealPlanResponse(200, {
      status: "accepted",
      next: { stage: 4, href: "/routine" },
    }),
    { kind: "accepted", href: "/routine" },
  )
  assert.deepEqual(interpretAcceptIdealPlanResponse(409, { error: "seen_state_stale" }), {
    kind: "seen_state_stale",
  })
  assert.deepEqual(interpretAcceptIdealPlanResponse(409, { error: "refinement_in_progress" }), {
    kind: "refinement_in_progress",
  })
  assert.deepEqual(interpretAcceptIdealPlanResponse(409, { error: "plan_already_accepted" }), {
    kind: "plan_already_accepted",
    href: "/routine",
  })
  // A pinned product that stopped being plannable is a seen-state problem:
  // fresh previews may resolve it, so it earns the same retry as a stale set.
  assert.deepEqual(interpretAcceptIdealPlanResponse(409, { error: "recommendation_unavailable" }), {
    kind: "recommendation_unavailable",
  })
  // Re-posting the identical payload can never clear these — only the
  // refinement can, and it ends in an accepted plan too.
  for (const error of ["acceptance_not_ready", "conflict", "stage_not_ready"]) {
    assert.deepEqual(
      interpretAcceptIdealPlanResponse(409, { error }),
      { kind: "refinement_required" },
      `expected ${error} to route into the refinement`,
    )
  }
  // Genuinely transient or terminal-for-the-whole-feature: an inline retry is
  // the honest offer, and the refinement would not help either.
  for (const [status, body] of [
    [404, { error: "personal_plan_not_available" }],
    [404, { error: "stage_not_available" }],
    [429, { error: "rate_limited" }],
    [503, { error: "temporarily_unavailable" }],
    [409, { error: "some_unknown_conflict" }],
    [200, { status: "accepted" }],
  ] as const) {
    assert.deepEqual(interpretAcceptIdealPlanResponse(status, body), { kind: "error" })
  }
})

function scriptedFlow(
  outcomes: AcceptIdealPlanOutcome[],
  options: {
    seenRoles?: AcceptIdealPlanSeenRole[]
    refreshed?: AcceptIdealPlanSeenRole[] | null
  } = {},
) {
  const acceptCalls: AcceptIdealPlanSeenRole[][] = []
  let refreshes = 0
  const effect = runAcceptIdealPlanFlow({
    seenRoles: options.seenRoles ?? [seenRole],
    accept: async (roles) => {
      acceptCalls.push(roles as AcceptIdealPlanSeenRole[])
      const next = outcomes.shift()
      if (!next) throw new Error("unexpected extra accept attempt")
      return next
    },
    refreshSeenRoles: async () => {
      refreshes += 1
      return options.refreshed === undefined ? [seenRole] : options.refreshed
    },
  })
  return { effect, acceptCalls, refreshes: () => refreshes }
}

test("a successful accept sends the user straight to the routine", async () => {
  const run = scriptedFlow([{ kind: "accepted", href: "/routine" }])
  assert.deepEqual(await run.effect, { kind: "open_routine", href: "/routine" })
  assert.deepEqual(run.acceptCalls, [[seenRole]])
  assert.equal(run.refreshes(), 0)
})

test("an already accepted plan is not an error — it is the same routine", async () => {
  const run = scriptedFlow([{ kind: "plan_already_accepted", href: "/routine" }])
  assert.deepEqual(await run.effect, { kind: "open_routine", href: "/routine" })
})

test("a refinement already under way continues that refinement instead of accepting", async () => {
  const run = scriptedFlow([{ kind: "refinement_in_progress" }])
  assert.deepEqual(await run.effect, { kind: "continue_refinement" })
})

test("a failed accept stays an inline error the user can retry", async () => {
  const run = scriptedFlow([{ kind: "error" }])
  assert.deepEqual(await run.effect, { kind: "error" })
  assert.equal(run.refreshes(), 0)
})

test("one stale seen state re-fetches the previews and retries silently", async () => {
  const refreshed = [{ decisionKey: "d2", productId: "p2", factFingerprint: "f2" }]
  const run = scriptedFlow([{ kind: "seen_state_stale" }, { kind: "accepted", href: "/routine" }], {
    refreshed,
  })

  assert.deepEqual(await run.effect, { kind: "open_routine", href: "/routine" })
  assert.equal(run.refreshes(), 1)
  // The retry must accept what the user can now see, never the stale set.
  assert.deepEqual(run.acceptCalls, [[seenRole], refreshed])
})

test("a second consecutive stale seen state opens the refinement instead of looping", async () => {
  const run = scriptedFlow([{ kind: "seen_state_stale" }, { kind: "seen_state_stale" }])

  assert.deepEqual(await run.effect, {
    kind: "open_refinement_route",
    href: PLAN_ACCEPT_REFINE_HREF,
  })
  assert.equal(run.acceptCalls.length, 2)
  assert.equal(run.refreshes(), 1)
  assert.equal(PLAN_ACCEPT_REFINE_HREF, "/plan-start?refine=1")
})

test("a stale retry whose preview re-fetch fails opens the refinement, never accepts blind", async () => {
  const run = scriptedFlow([{ kind: "seen_state_stale" }], { refreshed: null })

  assert.deepEqual(await run.effect, {
    kind: "open_refinement_route",
    href: PLAN_ACCEPT_REFINE_HREF,
  })
  // Never a second POST with the seen state we know is stale.
  assert.equal(run.acceptCalls.length, 1)
})

test("a newly unplannable recommendation gets the stale treatment, then the refinement", async () => {
  const refreshed = [{ decisionKey: "d2", productId: "p2", factFingerprint: "f2" }]
  const recovered = scriptedFlow(
    [{ kind: "recommendation_unavailable" }, { kind: "accepted", href: "/routine" }],
    { refreshed },
  )
  assert.deepEqual(await recovered.effect, { kind: "open_routine", href: "/routine" })
  assert.deepEqual(recovered.acceptCalls, [[seenRole], refreshed])
  assert.equal(recovered.refreshes(), 1)

  const exhausted = scriptedFlow([
    { kind: "recommendation_unavailable" },
    { kind: "recommendation_unavailable" },
  ])
  assert.deepEqual(await exhausted.effect, {
    kind: "open_refinement_route",
    href: PLAN_ACCEPT_REFINE_HREF,
  })
  assert.equal(exhausted.acceptCalls.length, 2)

  // The two attempts are one budget: a stale set that turns unplannable stops
  // just as fast, instead of alternating forever.
  const mixed = scriptedFlow([{ kind: "seen_state_stale" }, { kind: "recommendation_unavailable" }])
  assert.deepEqual(await mixed.effect, {
    kind: "open_refinement_route",
    href: PLAN_ACCEPT_REFINE_HREF,
  })
  assert.equal(mixed.acceptCalls.length, 2)
})

test("an unacceptable plan state routes into the refinement without a doomed retry", async () => {
  const run = scriptedFlow([{ kind: "refinement_required" }])

  assert.deepEqual(await run.effect, {
    kind: "open_refinement_route",
    href: PLAN_ACCEPT_REFINE_HREF,
  })
  assert.equal(run.acceptCalls.length, 1)
  assert.equal(run.refreshes(), 0)
})

/**
 * The seen state IS the accept payload. Previews we asked for and did not get
 * must never read as "the user saw nothing" — that would defer roles they were
 * shown. Previews that were never requestable are a different thing: nothing
 * was rendered, so an empty seen state is the truth.
 */
test("preview readiness separates 'never requested' from 'requested and failed'", () => {
  assert.equal(acceptIdealPlanReadiness("not_requested"), "accept")
  assert.equal(acceptIdealPlanReadiness("ready"), "accept")
  assert.equal(acceptIdealPlanReadiness("loading"), "wait")
  assert.equal(acceptIdealPlanReadiness("unavailable"), "refine")
})

/**
 * The blocked-scalp cohort used to be refused client-side. The accept contract
 * now defers that role server-side, so the exact same journey must reach the
 * routine.
 */
test("a plan whose scalp role is refinement-bound now accepts successfully", async () => {
  const seenRoles = deriveAcceptIdealPlanSeenRoles(
    previewResponse([recommendation()], {
      available: false,
      reason: "refinement_required",
      blockedCategories: ["scalp_care"],
    }),
  )
  const run = scriptedFlow([{ kind: "accepted", href: "/routine" }], { seenRoles })

  assert.deepEqual(await run.effect, { kind: "open_routine", href: "/routine" })
  assert.deepEqual(run.acceptCalls, [seenRoles])
})

test("the stale two-strikes rule keeps its exact thresholds", () => {
  assert.equal(acceptStatusAfterStale(1), "idle")
  assert.equal(acceptStatusAfterStale(2), "unavailable")
  assert.equal(acceptStatusAfterStale(3), "unavailable")
})

test("the accept request posts the raw per-role seen state and reads the stale conflict", async () => {
  const seenRoles = deriveAcceptIdealPlanSeenRoles(
    previewResponse([recommendation(), leadLeaveIn, secondaryLeaveIn]),
  )
  const calls: { url: string; body: unknown }[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) })
    return {
      status: 409,
      json: async () => ({ error: "seen_state_stale" }),
    } as unknown as Response
  }) as typeof globalThis.fetch

  try {
    assert.deepEqual(await requestAcceptIdealPlan(seenRoles), { kind: "seen_state_stale" })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "/api/personal-plan/accept-ideal-plan")
  assert.deepEqual(calls[0].body, { seenRoles })
})

test("a network failure during acceptance stays an inline error, never a silent success", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new Error("offline")
  }) as typeof globalThis.fetch
  try {
    assert.deepEqual(await requestAcceptIdealPlan([seenRole]), { kind: "error" })
  } finally {
    globalThis.fetch = originalFetch
  }
})

const readyPlanScreen = {
  kind: "basis" as const,
  overline: "Dein Idealplan",
  title: "Deine Basis",
  lead: "Das braucht dein Haar.",
  sectionTitle: "Basis",
  countLabel: "1 Kategorie",
  cards: [],
  progress: 100 as const,
}

function renderPlanStart(props: Partial<React.ComponentProps<typeof PlanStartFlow>> = {}): string {
  return renderToStaticMarkup(
    <PlanStartFlow
      state="ready"
      plan={{ basis: readyPlanScreen, optional: null }}
      onContinue={() => {}}
      {...props}
    />,
  )
}

function renderJourney(
  props: Partial<React.ComponentProps<typeof PlanStartCustomerJourney>> = {},
): string {
  return renderToStaticMarkup(
    <PlanStartCustomerJourney
      initialPlan={{
        basis: readyPlanScreen,
        optional: null,
        personalPlanId: "plan-1",
        sourceInputHash: "input-1",
      }}
      initialJourney={{ stage: "stage1", directAcceptanceAvailable: true }}
      personalPlanId="plan-1"
      {...props}
    />,
  )
}

/**
 * B1. Effects do not run on the server and run only AFTER the first client
 * paint, so an initial `not_requested` would read as "previews were never
 * requestable" for exactly one render — and a click in that window posts
 * `seenRoles: []`, which the server turns into an all-deferred, productless
 * routine. The first paint must therefore already know that previews ARE
 * coming.
 */
test("the server-rendered Idealplan CTA is held whenever previews are still coming", () => {
  const requestable = renderJourney()

  assert.match(requestable, new RegExp(PLAN_START_ACCEPT_LABEL))
  assert.match(requestable, /aria-busy="true"/)
  assert.match(requestable, /disabled=""/)
})

test("a plan whose previews are not requestable keeps its CTA live from the first paint", () => {
  // No `sourceInputHash`: the effect will never request previews, so an empty
  // seen state is the truth and the all-deferred acceptance is legitimate.
  const notRequestable = renderJourney({
    initialPlan: { basis: readyPlanScreen, optional: null, personalPlanId: "plan-1" },
  })

  assert.match(notRequestable, new RegExp(PLAN_START_ACCEPT_LABEL))
  assert.doesNotMatch(notRequestable, /aria-busy="true"/)
  assert.doesNotMatch(notRequestable, /disabled=""/)
})

/**
 * B1, defense in depth. The accept handler recomputes readiness from the same
 * fact rather than trusting the stored state: a plan that arrives from
 * `enterStage1()` re-opens the very same window (render before effect), and the
 * handler must not accept blind inside it.
 */
test("an unrequested state reads as loading exactly while previews are requestable", () => {
  assert.equal(resolveStage1PreviewLoadState("not_requested", true), "loading")
  assert.equal(
    acceptIdealPlanReadiness(resolveStage1PreviewLoadState("not_requested", true)),
    "wait",
  )
  assert.equal(resolveStage1PreviewLoadState("not_requested", false), "not_requested")
  assert.equal(
    acceptIdealPlanReadiness(resolveStage1PreviewLoadState("not_requested", false)),
    "accept",
  )

  // A state the effect already owns is never rewritten in either direction.
  for (const state of ["loading", "ready", "unavailable"] as const) {
    assert.equal(resolveStage1PreviewLoadState(state, true), state)
    assert.equal(resolveStage1PreviewLoadState(state, false), state)
  }
})

test("the Idealplan CTA leads to the routine once acceptance is the only path", () => {
  const html = renderPlanStart({ nextIntent: "accept" })

  assert.match(html, new RegExp(PLAN_START_ACCEPT_LABEL))
  assert.doesNotMatch(html, new RegExp(PLAN_START_REFINE_LABEL))
  assert.equal(PLAN_START_ACCEPT_LABEL, "Zu deiner Routine")
})

test("the accepting CTA reports its own preparing, pending and error states", () => {
  // Previews still loading: blocked, but nothing is being "set up" yet, so the
  // label must not claim it is.
  const preparing = renderPlanStart({ nextIntent: "accept", nextStatus: "preparing" })
  assert.match(preparing, new RegExp(PLAN_START_ACCEPT_LABEL))
  assert.doesNotMatch(preparing, new RegExp(PLAN_START_ACCEPT_PENDING_LABEL))
  assert.match(preparing, /aria-busy="true"/)
  assert.match(preparing, /disabled=""/)

  const pending = renderPlanStart({ nextIntent: "accept", nextStatus: "loading" })
  assert.match(pending, new RegExp(PLAN_START_ACCEPT_PENDING_LABEL))
  assert.match(pending, /aria-busy="true"/)

  const failed = renderPlanStart({ nextIntent: "accept", nextStatus: "error" })
  assert.match(failed, new RegExp(PLAN_ACCEPT_ERROR))
  assert.match(failed, /role="alert"/)
  assert.doesNotMatch(failed, /disabled=""/)
})

/**
 * M3: the refinement detour must not read as "Routine wird eingerichtet …" —
 * nothing is being set up, the user is being taken to the Feinschliff.
 */
test("the refinement detour names the Feinschliff instead of claiming a setup", () => {
  const detour = renderPlanStart({
    nextIntent: "refine",
    nextStatus: "loading",
    nextNotice: PLAN_ACCEPT_UNAVAILABLE_NOTICE,
  })

  assert.match(detour, new RegExp(PLAN_START_REFINE_PENDING_LABEL))
  assert.doesNotMatch(detour, new RegExp(PLAN_START_ACCEPT_PENDING_LABEL))
  assert.match(detour, new RegExp(PLAN_ACCEPT_UNAVAILABLE_NOTICE))
  assert.match(detour, /role="status"/)
})

/**
 * I2: a `refinement_in_progress` accept hands off to `enterStage2()`. Its
 * loading and failure states have to reach the same CTA, or the button snaps
 * back to idle and the user is told nothing.
 */
test("a Stage-2 handoff after acceptance keeps its pending and error states on the CTA", () => {
  const base = {
    acceptAvailable: true,
    acceptStatus: "idle",
    stage2LoadState: "idle",
    previewLoadState: "ready",
  } as const

  // `refinement_in_progress` resets acceptStatus and hands off to enterStage2 —
  // the CTA must follow that load instead of snapping back to idle.
  assert.deepEqual(planStartCtaState({ ...base, stage2LoadState: "loading" }), {
    intent: "refine",
    status: "loading",
  })
  assert.deepEqual(planStartCtaState({ ...base, stage2LoadState: "error" }), {
    intent: "refine",
    status: "error",
  })

  const handingOff = renderPlanStart({ nextIntent: "refine", nextStatus: "loading" })
  assert.match(handingOff, new RegExp(PLAN_START_REFINE_PENDING_LABEL))

  const handoffFailed = renderPlanStart({ nextIntent: "refine", nextStatus: "error" })
  assert.match(handoffFailed, new RegExp(PLAN_START_REFINE_ERROR))
  assert.doesNotMatch(handoffFailed, new RegExp(PLAN_ACCEPT_ERROR))
})

test("the CTA state machine covers every accept and preview combination", () => {
  const base = {
    acceptAvailable: true,
    acceptStatus: "idle",
    stage2LoadState: "idle",
    previewLoadState: "ready",
  } as const

  assert.deepEqual(planStartCtaState(base), { intent: "accept", status: "idle" })
  // Previews in flight block the CTA without relabelling it (M3).
  assert.deepEqual(planStartCtaState({ ...base, previewLoadState: "loading" }), {
    intent: "accept",
    status: "preparing",
  })
  // Nothing was ever requestable — an empty seen state is honest, so accept.
  assert.deepEqual(planStartCtaState({ ...base, previewLoadState: "not_requested" }), {
    intent: "accept",
    status: "idle",
  })
  assert.deepEqual(planStartCtaState({ ...base, acceptStatus: "pending" }), {
    intent: "accept",
    status: "loading",
  })
  assert.deepEqual(planStartCtaState({ ...base, acceptStatus: "error" }), {
    intent: "accept",
    status: "error",
  })
  // The refinement detour never claims a routine is being set up (M3).
  assert.deepEqual(planStartCtaState({ ...base, acceptStatus: "unavailable" }), {
    intent: "refine",
    status: "loading",
  })
  assert.deepEqual(planStartCtaState({ ...base, acceptAvailable: false }), {
    intent: "refine",
    status: "idle",
  })
})

test("without direct acceptance the CTA keeps naming the Feinschliff it opens", () => {
  const html = renderPlanStart()

  assert.match(html, new RegExp(PLAN_START_REFINE_LABEL))
  assert.doesNotMatch(html, new RegExp(PLAN_START_ACCEPT_LABEL))
})

test("the Idealplan CTA accepts directly and never opens the fork that no longer exists", () => {
  const source = readFileSync("src/components/personal-plan-start/plan-start-flow.tsx", "utf8")

  assert.doesNotMatch(source, /"fork"/)
  assert.doesNotMatch(source, /PlanForkScreen/)
  assert.match(source, /acceptIdealPlanDirectly/)
  assert.throws(() =>
    readFileSync("src/components/personal-plan-journey/plan-fork-screen.tsx", "utf8"),
  )
})

test("the preview contract rejects a payload whose acceptance verdict is missing or malformed", () => {
  const valid = previewResponse([recommendation()])
  assert.equal(isStage1ProductExamplePreviewResponse(valid), true)
  assert.equal(
    isStage1ProductExamplePreviewResponse(
      previewResponse([recommendation()], {
        available: false,
        reason: "refinement_required",
        blockedCategories: ["scalp_care"],
      }),
    ),
    true,
  )

  // Fail closed: an absent or unparseable verdict must not read as "acceptable".
  const { directAcceptance: _omitted, ...withoutVerdict } = valid
  assert.equal(isStage1ProductExamplePreviewResponse(withoutVerdict), false)
  for (const verdict of [
    null,
    { available: "yes" },
    { available: false },
    { available: false, reason: "refinement_required" },
    { available: false, reason: "other", blockedCategories: ["scalp_care"] },
    { available: false, reason: "refinement_required", blockedCategories: ["not_a_category"] },
  ]) {
    assert.equal(
      isStage1ProductExamplePreviewResponse({ ...valid, directAcceptance: verdict }),
      false,
      `expected rejection for ${JSON.stringify(verdict)}`,
    )
  }
})
