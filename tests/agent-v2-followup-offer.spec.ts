import assert from "node:assert/strict"
import test from "node:test"

type FollowupOfferModule = {
  hasShortFollowupConfirmation: (message: string) => boolean
  shouldClearFollowupOfferForMessage: (message: string) => boolean
  resolveFollowupExecution: (offer: unknown) => string | null
  doesRoutineCallMatchFollowupOffer: (args: Record<string, unknown>, offer: unknown) => boolean
  isFollowupOfferRendered: (visibleAnswer: string, labelDe: string) => boolean
  resolveFollowupRoutineMutationPolicy: (params: { message: string; followupOffer: unknown }) => {
    hardDenyReason: string | null
    pendingConfirmationAllowed: boolean
    followupOffer: unknown
  }
}

async function loadFollowupOfferModule(): Promise<FollowupOfferModule> {
  let loaded: FollowupOfferModule | null = null
  let loadError: unknown = null
  try {
    loaded = (await import("../src/lib/agent-v2/followup-offer")) as FollowupOfferModule
  } catch (error) {
    loadError = error
  }

  assert.equal(loadError, null)
  assert.ok(loaded)
  return loaded
}

function followupOffer(overrides: Record<string, unknown> = {}) {
  return {
    type: "elaborate",
    label_de: "Ich kann dir die Anwendung genauer erklären.",
    care_category: "mask",
    product_categories: [],
    routine_layer: null,
    routine_action: null,
    ...overrides,
  }
}

test("hasShortFollowupConfirmation detects narrow German confirmations", async () => {
  const mod = await loadFollowupOfferModule()

  assert.equal(mod.hasShortFollowupConfirmation("Ja bitte"), true)
  assert.equal(mod.hasShortFollowupConfirmation("gerne"), true)
  assert.equal(mod.hasShortFollowupConfirmation("mach das bitte"), true)
  assert.equal(mod.hasShortFollowupConfirmation("baue das ein bitte"), true)

  assert.equal(mod.hasShortFollowupConfirmation("Ja bitte, erklär mir die Anwendung"), false)
  assert.equal(mod.hasShortFollowupConfirmation("Welche Maske passt zu mir?"), false)
})

test("followup_offer execution maps model-facing types into runtime buckets", async () => {
  const mod = await loadFollowupOfferModule()

  assert.equal(mod.resolveFollowupExecution(null), null)
  assert.equal(mod.resolveFollowupExecution(followupOffer({ type: "adjust" })), "routine_mutation")
  assert.equal(
    mod.resolveFollowupExecution(
      followupOffer({ type: "recommend", product_categories: ["mask"] }),
    ),
    "product_selection",
  )
  assert.equal(
    mod.resolveFollowupExecution(
      followupOffer({ type: "compare", product_categories: ["mask", "conditioner"] }),
    ),
    "product_selection",
  )
  assert.equal(
    mod.resolveFollowupExecution(followupOffer({ type: "compare", product_categories: [] })),
    "advisor_response",
  )
  assert.equal(mod.resolveFollowupExecution(followupOffer({ type: "plan" })), "advisor_response")
})

test("doesRoutineCallMatchFollowupOffer only authorizes matching adjust offers", async () => {
  const mod = await loadFollowupOfferModule()
  const offer = followupOffer({
    type: "adjust",
    care_category: "mask",
    routine_layer: "goals",
    routine_action: "add_step",
  })

  assert.equal(
    mod.doesRoutineCallMatchFollowupOffer(
      {
        requested_category: "mask",
        requested_layer: "goals",
        routine_intent: "modify",
        mutation_kind: "add_step",
      },
      offer,
    ),
    true,
  )
  assert.equal(
    mod.doesRoutineCallMatchFollowupOffer(
      {
        requested_category: "conditioner",
        requested_layer: "goals",
        routine_intent: "modify",
        mutation_kind: "add_step",
      },
      offer,
    ),
    false,
  )
  assert.equal(
    mod.doesRoutineCallMatchFollowupOffer(
      {
        requested_category: "mask",
        requested_layer: "goals",
        routine_intent: "modify",
        mutation_kind: "add_step",
      },
      followupOffer({ type: "recommend", product_categories: ["mask"] }),
    ),
    false,
  )
})

test("followup offer helpers render and clear state conservatively", async () => {
  const mod = await loadFollowupOfferModule()

  assert.equal(mod.shouldClearFollowupOfferForMessage("Ja bitte"), false)
  assert.equal(mod.shouldClearFollowupOfferForMessage("Kannst du mir eine Maske empfehlen?"), true)
  assert.equal(
    mod.isFollowupOfferRendered(
      "Gern. Ich kann dir die Anwendung genauer erklaeren!",
      "Ich kann dir die Anwendung genauer erklären.",
    ),
    true,
  )
  assert.equal(
    mod.isFollowupOfferRendered(
      "Gern. Ich kann dir erklären, welche Maske passt.",
      "Ich kann dir die Anwendung genauer erklären.",
    ),
    false,
  )
})

test("resolveFollowupRoutineMutationPolicy keeps summary and non-mutation turns out of routine writes", async () => {
  const mod = await loadFollowupOfferModule()
  const adjustOffer = followupOffer({
    type: "adjust",
    care_category: "mask",
    routine_layer: "goals",
    routine_action: "add_step",
  })

  assert.deepEqual(
    mod.resolveFollowupRoutineMutationPolicy({
      message: "Ich will es nur verstehen, bitte nichts ändern.",
      followupOffer: adjustOffer,
    }),
    {
      hardDenyReason: "routine_action_not_authorized",
      pendingConfirmationAllowed: false,
      followupOffer: null,
    },
  )
  assert.deepEqual(
    mod.resolveFollowupRoutineMutationPolicy({
      message: "Fass mir das nochmal zusammen.",
      followupOffer: adjustOffer,
    }),
    {
      hardDenyReason: "routine_summary_rebuild_not_requested",
      pendingConfirmationAllowed: false,
      followupOffer: null,
    },
  )
  assert.deepEqual(
    mod.resolveFollowupRoutineMutationPolicy({
      message: "Ja bitte",
      followupOffer: adjustOffer,
    }),
    {
      hardDenyReason: null,
      pendingConfirmationAllowed: true,
      followupOffer: adjustOffer,
    },
  )
})
