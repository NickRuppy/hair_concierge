import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  PLAN_FORK_ACCEPT_ERROR,
  PLAN_FORK_ACCEPT_UNAVAILABLE,
  acceptStatusAfterStale,
  PLAN_FORK_ACCEPT_LABEL,
  PLAN_FORK_ACCEPT_PENDING_LABEL,
  PLAN_FORK_REFINE_ERROR,
  PLAN_FORK_REFINE_LABEL,
  PLAN_FORK_STALE_NOTICE,
  PlanForkScreen,
  derivePlanForkPreviewState,
  interpretAcceptIdealPlanResponse,
} from "../src/components/personal-plan-journey/plan-fork-screen"
import { requestAcceptIdealPlan } from "../src/components/personal-plan-start/plan-start-flow"
import { directAcceptanceAssumptions } from "../src/lib/personal-plan/direct-acceptance/defaults"
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
  commerce: {
    priceEur: 21.5,
    purchaseLinkStatus: "available" as const,
    netContentValue: 150,
    netContentUnit: "ml" as const,
    priceLabel: "21,50 €",
    netContentLabel: "150 ml",
    availabilityLabel: "Aktuell verfügbar",
    productUrl: "https://example.com/leave-in-hitze",
    affiliateDisclosure: null,
  },
})

test("the accept payload echoes every recommendation role with its exact pinned fields", () => {
  const state = derivePlanForkPreviewState(
    previewResponse([recommendation(), leadLeaveIn, secondaryLeaveIn]),
  )

  assert.ok(state)
  assert.deepEqual(state.seenRoles, [
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
  ])
})

test("only roles the Stage-1 cards never showed become the disclosure list", () => {
  const state = derivePlanForkPreviewState(
    previewResponse([recommendation(), leadLeaveIn, secondaryLeaveIn]),
  )

  assert.ok(state)
  // The decisionKey is the stable per-role identity the list keys on: two roles
  // can legitimately disclose the same product name.
  assert.deepEqual(state.additionalItems, [
    {
      decisionKey: "decision:leave_in:pre_heat_application:gap",
      productName: "Leave-in Hitzeschutz",
      priceLabel: "21,50 €",
    },
  ])
})

test("a single-role plan discloses nothing extra", () => {
  const state = derivePlanForkPreviewState(previewResponse([recommendation()]))

  assert.ok(state)
  assert.deepEqual(state.additionalItems, [])
  assert.equal(state.fallbackNotice, null)
})

test("an open product choice blocks direct acceptance and names the category", () => {
  const state = derivePlanForkPreviewState(
    previewResponse([
      recommendation(),
      {
        kind: "fallback",
        category: "mask",
        role: "intensive_conditioning_mask",
        decisionKey: "decision:mask:intensive_conditioning_mask:gap",
        authorityVersion: "personal-plan.mask.v4",
        fallback: "post_refinement",
      },
    ]),
  )

  assert.ok(state)
  assert.equal(
    state.fallbackNotice,
    "Für Haarmaske steht die Produktwahl noch aus — der Feinschliff schließt das ab.",
  )
})

test("several open product choices stay honest without listing every category", () => {
  const state = derivePlanForkPreviewState(
    previewResponse([
      recommendation(),
      {
        kind: "fallback",
        category: "mask",
        role: "intensive_conditioning_mask",
        decisionKey: "decision:mask:intensive_conditioning_mask:gap",
        authorityVersion: "personal-plan.mask.v4",
        fallback: "post_refinement",
      },
      {
        kind: "fallback",
        category: "oil",
        role: "dry_finish",
        decisionKey: "decision:oil:dry_finish:gap",
        authorityVersion: "personal-plan.oil.v2",
        fallback: "post_refinement",
      },
    ]),
  )

  assert.ok(state)
  assert.equal(
    state.fallbackNotice,
    "Für einige Kategorien steht die Produktwahl noch aus — der Feinschliff schließt das ab.",
  )
})

test("a preview payload without a single recommendation cannot be accepted at all", () => {
  assert.equal(derivePlanForkPreviewState(null), null)
  assert.equal(
    derivePlanForkPreviewState(
      previewResponse([
        {
          kind: "fallback",
          category: "mask",
          role: "intensive_conditioning_mask",
          decisionKey: "decision:mask:intensive_conditioning_mask:gap",
          authorityVersion: "personal-plan.mask.v4",
          fallback: "post_refinement",
        },
      ]),
    ),
    null,
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
  for (const [status, body] of [
    [404, { error: "personal_plan_not_available" }],
    [429, { error: "rate_limited" }],
    [503, { error: "temporarily_unavailable" }],
    [409, { error: "recommendation_unavailable" }],
    [200, { status: "accepted" }],
  ] as const) {
    assert.deepEqual(interpretAcceptIdealPlanResponse(status, body), { kind: "error" })
  }
})

const assumptions = directAcceptanceAssumptions({
  relevantCategories: ["shampoo", "conditioner"],
  hasReportedIrritatedScalp: true,
  dryShampooBridgeEligibility: "eligible",
})

test("the fork renders this user's real default assumptions, not example copy", () => {
  const html = renderToStaticMarkup(
    <PlanForkScreen
      assumptions={assumptions}
      previewState={derivePlanForkPreviewState(previewResponse([recommendation()]))}
      directAcceptanceAvailable
      onRefine={() => {}}
      onAccept={() => {}}
    />,
  )

  assert.match(html, /Dein Idealplan steht\./)
  assert.match(html, /Dafür haben wir angenommen/)
  assert.match(html, /Der Feinschliff ersetzt diese Annahmen durch deine echten Angaben\./)
  for (const assumption of assumptions) {
    assert.ok(html.includes(assumption.label), `missing assumption: ${assumption.label}`)
  }
  // The mockup's illustrative bullets must never be hard-coded.
  assert.doesNotMatch(html, /Gelegentliches Hitzestyling/)
})

test("the fork keeps the personal-plan column width and scales its type at sm", () => {
  // Without this the screen renders mobile-scale type inside an unbounded
  // desktop viewport. Content column and action dock share one width so the
  // CTAs stay under the copy; the type scale follows the chapter transition.
  const html = renderToStaticMarkup(
    <PlanForkScreen
      assumptions={assumptions}
      previewState={derivePlanForkPreviewState(previewResponse([recommendation()]))}
      directAcceptanceAvailable
      onRefine={() => {}}
      onAccept={() => {}}
    />,
  )
  const columnClasses = [...html.matchAll(/class="([^"]*max-w-\[430px\][^"]*)"/g)].map(
    (match) => match[1],
  )

  // The content column and the fixed action dock's inner column.
  assert.equal(columnClasses.length, 2)
  for (const classes of columnClasses) {
    assert.match(classes, /\bmx-auto\b/)
    assert.match(classes, /(?:^|\s)sm:max-w-\[560px\](?:\s|$)/)
  }
  assert.match(
    html,
    /text-\[21px\][^"]*\[@media\(min-height:731px\)\]:text-\[24px\][^"]*sm:text-\[26px\]/,
  )
  assert.match(html, /text-\[11\.5px\][^"]*sm:text-\[13px\]/)
})

test("both ways out are explicit buttons with the refinement leading", () => {
  const html = renderToStaticMarkup(
    <PlanForkScreen
      assumptions={assumptions}
      previewState={derivePlanForkPreviewState(previewResponse([recommendation()]))}
      directAcceptanceAvailable
      onRefine={() => {}}
      onAccept={() => {}}
    />,
  )

  assert.ok(html.indexOf(PLAN_FORK_REFINE_LABEL) < html.indexOf(PLAN_FORK_ACCEPT_LABEL))
  assert.match(html, /Nichts ist endgültig — verfeinern kannst du jederzeit später\./)
  assert.doesNotMatch(html, /disabled=""/)
})

test("secondary-role products the cards never showed are disclosed before accepting", () => {
  const html = renderToStaticMarkup(
    <PlanForkScreen
      assumptions={assumptions}
      previewState={derivePlanForkPreviewState(
        previewResponse([recommendation(), leadLeaveIn, secondaryLeaveIn]),
      )}
      directAcceptanceAvailable
      onRefine={() => {}}
      onAccept={() => {}}
    />,
  )

  assert.match(html, /Außerdem in deinem Plan/)
  assert.match(html, /Leave-in Hitzeschutz/)
  assert.match(html, /21,50 €/)
  // The card-leading products are not repeated as an "extra".
  assert.doesNotMatch(html, /Leave-in Basis/)
})

test("an open product choice disables acceptance and says why", () => {
  const html = renderToStaticMarkup(
    <PlanForkScreen
      assumptions={assumptions}
      previewState={derivePlanForkPreviewState(
        previewResponse([
          recommendation(),
          {
            kind: "fallback",
            category: "mask",
            role: "intensive_conditioning_mask",
            decisionKey: "decision:mask:intensive_conditioning_mask:gap",
            authorityVersion: "personal-plan.mask.v4",
            fallback: "post_refinement",
          },
        ]),
      )}
      directAcceptanceAvailable
      onRefine={() => {}}
      onAccept={() => {}}
    />,
  )

  assert.match(html, /Für Haarmaske steht die Produktwahl noch aus/)
  assert.match(html, /disabled=""/)
  assert.match(html, new RegExp(PLAN_FORK_REFINE_LABEL.replace(/[.·]/g, ".")))
})

test("the accept button disappears when the accept endpoint is out of reach", () => {
  const html = renderToStaticMarkup(
    <PlanForkScreen
      assumptions={assumptions}
      previewState={derivePlanForkPreviewState(previewResponse([recommendation()]))}
      directAcceptanceAvailable={false}
      onRefine={() => {}}
      onAccept={() => {}}
    />,
  )

  assert.doesNotMatch(html, /Plan direkt übernehmen/)
  assert.doesNotMatch(html, /Dafür haben wir angenommen/)
  assert.match(html, new RegExp(PLAN_FORK_REFINE_LABEL.replace(/[.·]/g, ".")))
})

test("an unavailable preview payload hides acceptance instead of guessing a payload", () => {
  const html = renderToStaticMarkup(
    <PlanForkScreen
      assumptions={assumptions}
      previewState={null}
      directAcceptanceAvailable
      onRefine={() => {}}
      onAccept={() => {}}
    />,
  )

  assert.doesNotMatch(html, /Plan direkt übernehmen/)
})

test("pending, stale and failure states stay visible on the fork", () => {
  const pending = renderToStaticMarkup(
    <PlanForkScreen
      assumptions={assumptions}
      previewState={derivePlanForkPreviewState(previewResponse([recommendation()]))}
      directAcceptanceAvailable
      acceptStatus="pending"
      onRefine={() => {}}
      onAccept={() => {}}
    />,
  )
  assert.match(pending, new RegExp(PLAN_FORK_ACCEPT_PENDING_LABEL))
  assert.match(pending, /aria-busy="true"/)

  const failed = renderToStaticMarkup(
    <PlanForkScreen
      assumptions={assumptions}
      previewState={derivePlanForkPreviewState(previewResponse([recommendation()]))}
      directAcceptanceAvailable
      acceptStatus="error"
      noticeMessage={PLAN_FORK_STALE_NOTICE}
      onRefine={() => {}}
      onAccept={() => {}}
    />,
  )
  assert.match(failed, new RegExp(PLAN_FORK_ACCEPT_ERROR))
  assert.match(failed, new RegExp(PLAN_FORK_STALE_NOTICE))

  const refineFailed = renderToStaticMarkup(
    <PlanForkScreen
      assumptions={assumptions}
      previewState={derivePlanForkPreviewState(previewResponse([recommendation()]))}
      directAcceptanceAvailable
      refineStatus="error"
      onRefine={() => {}}
      onAccept={() => {}}
    />,
  )
  assert.match(refineFailed, new RegExp(PLAN_FORK_REFINE_ERROR))
})

test("the Stage-1 CTA opens the fork without touching the Stage-2 gateway first", () => {
  const source = readFileSync("src/components/personal-plan-start/plan-start-flow.tsx", "utf8")

  // The Stage-1 CTA must reach the fork, never `enterStage2` (which awaits
  // `stage2Gateway.load()` and whose error state would blank the whole screen).
  const handler = source.slice(
    source.indexOf("onContinueToRefinement={(sourceStep)"),
    source.indexOf("onContinueToRefinement={(sourceStep)") + 400,
  )
  assert.match(handler, /setStage\("fork"\)/)
  assert.doesNotMatch(handler, /enterStage2/)
  // Only the fork's own refine action may enter Stage 2.
  assert.match(source, /onRefine=\{\(\) => void enterStage2\(\)\}/)
})

test("the fork is its own component, not a fifth caller of the shared chapter screen", () => {
  const source = readFileSync("src/components/personal-plan-journey/plan-fork-screen.tsx", "utf8")

  assert.doesNotMatch(source, /PersonalPlanChapterTransition/)
})

test("the accept request posts the raw per-role seen state and reads the stale conflict", async () => {
  const state = derivePlanForkPreviewState(
    previewResponse([recommendation(), leadLeaveIn, secondaryLeaveIn]),
  )
  assert.ok(state)
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
    const outcome = await requestAcceptIdealPlan(state.seenRoles)
    assert.deepEqual(outcome, { kind: "seen_state_stale" })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "/api/personal-plan/accept-ideal-plan")
  assert.deepEqual(calls[0].body, { seenRoles: state.seenRoles })
})

test("a network failure during acceptance stays an inline error, never a silent success", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new Error("offline")
  }) as typeof globalThis.fetch
  try {
    assert.deepEqual(
      await requestAcceptIdealPlan([{ decisionKey: "d", productId: "p", factFingerprint: "f" }]),
      { kind: "error" },
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("a second consecutive stale response retires acceptance instead of looping", () => {
  const previewState = derivePlanForkPreviewState(previewResponse([recommendation()]))

  // First stale response: honest "updated" notice, accept still offered.
  const firstStale = renderToStaticMarkup(
    <PlanForkScreen
      assumptions={assumptions}
      previewState={previewState}
      directAcceptanceAvailable
      noticeMessage={PLAN_FORK_STALE_NOTICE}
      onRefine={() => {}}
      onAccept={() => {}}
    />,
  )
  assert.match(firstStale, new RegExp(PLAN_FORK_STALE_NOTICE))
  assert.match(firstStale, /Plan direkt übernehmen/)

  // Second one: the mismatch is structural, so the accept path is retired and
  // the user is pointed at the path that works.
  const secondStale = renderToStaticMarkup(
    <PlanForkScreen
      assumptions={assumptions}
      previewState={previewState}
      directAcceptanceAvailable
      acceptStatus="unavailable"
      onRefine={() => {}}
      onAccept={() => {}}
    />,
  )
  assert.match(secondStale, new RegExp(PLAN_FORK_ACCEPT_UNAVAILABLE))
  assert.doesNotMatch(secondStale, /Plan direkt übernehmen/)
  assert.doesNotMatch(secondStale, new RegExp(PLAN_FORK_STALE_NOTICE))
  // The refinement path stays fully available.
  assert.match(secondStale, new RegExp(PLAN_FORK_REFINE_LABEL.replace(/[.·]/g, ".")))
})

test("the flow retires acceptance only on the SECOND consecutive stale response", async () => {
  const responses = [
    { status: 409, body: { error: "seen_state_stale" } },
    { status: 409, body: { error: "seen_state_stale" } },
  ]
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    const next = responses.shift()!
    return { status: next.status, json: async () => next.body } as unknown as Response
  }) as typeof globalThis.fetch

  const statuses: string[] = []
  try {
    let consecutiveStale = 0
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const outcome = await requestAcceptIdealPlan([
        { decisionKey: "d", productId: "p", factFingerprint: "f" },
      ])
      assert.deepEqual(outcome, { kind: "seen_state_stale" })
      consecutiveStale += 1
      statuses.push(acceptStatusAfterStale(consecutiveStale))
    }
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.deepEqual(statuses, ["idle", "unavailable"])
  // Any non-stale outcome resets the run, so an isolated race never accumulates.
  assert.equal(acceptStatusAfterStale(1), "idle")
  assert.equal(acceptStatusAfterStale(3), "unavailable")
})

test("a server-declared refinement requirement blocks acceptance with its own reason", () => {
  const state = derivePlanForkPreviewState(
    previewResponse([recommendation()], {
      available: false,
      reason: "refinement_required",
      blockedCategories: ["scalp_care"],
    }),
  )

  assert.ok(state)
  assert.equal(
    state.refinementRequiredNotice,
    "Für deine Kopfhaut-Empfehlung brauchen wir den Feinschliff — er stellt sicher, dass die Produktwahl zu deiner Kopfhaut passt.",
  )
  // Nothing is missing from the plan itself, so the fallback line must stay silent.
  assert.equal(state.fallbackNotice, null)

  const html = renderToStaticMarkup(
    <PlanForkScreen
      assumptions={assumptions}
      previewState={state}
      directAcceptanceAvailable
      onRefine={() => {}}
      onAccept={() => {}}
    />,
  )
  assert.match(html, /Für deine Kopfhaut-Empfehlung brauchen wir den Feinschliff/)
  assert.match(html, /disabled=""/)
  assert.doesNotMatch(html, /steht die Produktwahl noch aus/)
  assert.match(html, new RegExp(PLAN_FORK_REFINE_LABEL.replace(/[.·]/g, ".")))
})

test("an available verdict leaves acceptance untouched", () => {
  const state = derivePlanForkPreviewState(previewResponse([recommendation()]))

  assert.ok(state)
  assert.equal(state.refinementRequiredNotice, null)
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
