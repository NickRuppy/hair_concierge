import assert from "node:assert/strict"
import test from "node:test"
import type Stripe from "stripe"

import { STAGE1_STAGE2_LAB_ENVELOPE } from "../src/app/labs/personal-plan-stage-1-2/fixture"
import {
  createFreemiumPurchaseCompletionHandler,
  type FreemiumPurchaseCompletionDeps,
} from "../src/app/api/freemium/purchase/complete/route"
import {
  createFreemiumProvisioningService,
  type FreemiumProvisioningResult,
} from "../src/lib/freemium/plan-provisioning"
import { classifyRoutineAcceptanceFailure } from "../src/lib/freemium/plan-provisioning-supabase"
import { DirectAcceptanceError } from "../src/lib/personal-plan/direct-acceptance/accept"
import {
  provisionFreemiumPayPalSubscription,
  runFreemiumPayPalSubscriptionProvisioning,
  type FreemiumPayPalWebhookIntent,
} from "../src/lib/paypal/freemium-webhook-provisioning"
import {
  provisionFreemiumCheckoutSession,
  runFreemiumCheckoutProvisioning,
} from "../src/lib/stripe/webhook-handlers"

/*
 * C7 (freemium post-purchase, default taken 2026-10-09): with the shopping-budget gate on and
 * no saved budget, provisioning admits and derives the plan but deliberately builds no Routine.
 * That is a DISTINCT, non-retryable state end to end — never `routine_not_accepted`, never a
 * webhook retry storm — and the Premium sheet asks the budget question instead.
 */

const USER = "user-1"
const SESSION_ID = "cs_test_budget_1"

const budgetRequired: FreemiumProvisioningResult = {
  outcome: "provisioned",
  enrollmentSourceId: "admission-1",
  personalPlanId: "plan-1",
  needVersionId: "need-1",
  routineAccepted: false,
  budgetRequired: true,
}

/* ---------------------------------------------------------------- acceptance classification */

test("C7: a budget_required acceptance is its own outcome, not a failure", async () => {
  let confirmations = 0
  const result = await classifyRoutineAcceptanceFailure(
    new DirectAcceptanceError("budget_required"),
    async () => {
      confirmations += 1
      return false
    },
  )
  assert.equal(result, "budget_required")
  assert.equal(confirmations, 1)
})

test("C7: a buyer who already has an active Routine is not asked for a budget", async () => {
  assert.equal(
    await classifyRoutineAcceptanceFailure(
      new DirectAcceptanceError("budget_required"),
      async () => true,
    ),
    "already_accepted",
  )
})

/* ---------------------------------------------------------------- provisioning service */

test("C7: provisioning reports budgetRequired with no accepted Routine — never a throw", async () => {
  let acceptCalls = 0
  const result = await createFreemiumProvisioningService({
    loadLinkedQuizArtifact: async () => ({
      id: "11111111-1111-4111-8111-111111111111",
      leadId: "lead-1",
      quizAnswers: STAGE1_STAGE2_LAB_ENVELOPE,
    }),
    ensureAdmission: async () => ({ id: "admission-1" }),
    pinEnrollmentSource: async () => "pinned",
    createOrReuseInitialNeed: async (request) => ({
      outcome: "completed",
      personalPlanId: "plan-1",
      needVersionId: "need-1",
      outputSnapshot: request.outputSnapshot as never,
    }),
    acceptInitialRoutine: async () => {
      acceptCalls += 1
      return "budget_required"
    },
  }).provisionAfterPurchase({ userId: USER, provider: "stripe", providerReference: SESSION_ID })

  assert.equal(acceptCalls, 1)
  assert.deepEqual(result, budgetRequired)
})

/* ---------------------------------------------------------------- purchase completion */

function completionDeps(
  provision: FreemiumPurchaseCompletionDeps["provision"],
  captured: string[],
): FreemiumPurchaseCompletionDeps {
  return {
    enabled: () => true,
    getUser: async () => ({ id: USER }),
    checkRateLimit: (async () => ({ allowed: true })) as never,
    retrieveSession: async () =>
      ({
        id: SESSION_ID,
        status: "complete",
        metadata: { freemium_admission: "1", freemium_user_id: USER },
      }) as unknown as Stripe.Checkout.Session,
    assertActivatable: () => {},
    activate: async () =>
      ({ userId: USER, email: "buyer@example.com", canSetInitialPassword: false }) as never,
    findPayPalIntent: async () => null,
    activatePayPal: async () => {
      throw new Error("unused")
    },
    provision,
    captureException: ((_error: unknown, context: { reason?: string }) => {
      captured.push(String(context.reason))
    }) as never,
  }
}

async function complete(deps: FreemiumPurchaseCompletionDeps) {
  const response = await createFreemiumPurchaseCompletionHandler(deps)(
    new Request("https://chaarlie.de/api/freemium/purchase/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: SESSION_ID }),
    }),
  )
  return { status: response.status, body: await response.json() }
}

test("C7: purchase completion answers budget_required — not retryable, not routine_not_accepted", async () => {
  const captured: string[] = []
  const result = await complete(completionDeps(async () => budgetRequired, captured))
  assert.deepEqual(result, { status: 200, body: { status: "budget_required" } })
  assert.deepEqual(captured, [], "a missing budget answer is not an incident")
})

test("C7: once the budget is saved, the same completion call accepts the Routine", async () => {
  let calls = 0
  const deps = completionDeps(async () => {
    calls += 1
    return calls === 1
      ? budgetRequired
      : { ...budgetRequired, routineAccepted: true, budgetRequired: undefined }
  }, [])
  assert.deepEqual((await complete(deps)).body, { status: "budget_required" })
  assert.deepEqual((await complete(deps)).body, { status: "complete", routineReady: true })
})

/* ---------------------------------------------------------------- webhook lanes */

function freemiumSession() {
  return {
    id: SESSION_ID,
    metadata: { freemium_admission: "1", freemium_user_id: USER },
  } as unknown as Stripe.Checkout.Session
}

test("C7: the Stripe webhook treats budget_required as handled for now — no retry, no Sentry", async () => {
  const captured: unknown[] = []
  const logged: unknown[][] = []
  const originalInfo = console.info
  console.info = (...args: unknown[]) => void logged.push(args)
  try {
    const deps = {
      freemiumEnabled: () => true,
      provisionFreemiumPurchase: async () => budgetRequired,
      captureFreemiumProvisioningException: ((error: unknown) => captured.push(error)) as never,
    }
    // The runner throws only for `retryable`; this must return.
    assert.deepEqual(
      await runFreemiumCheckoutProvisioning(freemiumSession(), deps, { userId: USER }),
      {
        status: "awaiting_budget",
      },
    )
    assert.deepEqual(
      await provisionFreemiumCheckoutSession(freemiumSession(), deps, { userId: USER }),
      { status: "awaiting_budget" },
    )
  } finally {
    console.info = originalInfo
  }
  assert.deepEqual(captured, [])
  // Logged once per delivery.
  assert.equal(logged.filter((args) => String(args[0]).includes("awaits the budget")).length, 2)
})

test("C7: the PayPal webhook lane classifies budget_required the same way", async () => {
  const captured: unknown[] = []
  const originalInfo = console.info
  console.info = () => {}
  try {
    const deps = {
      freemiumEnabled: () => true,
      provisionFreemiumPurchase: async () => budgetRequired,
      captureFreemiumProvisioningException: ((error: unknown) => captured.push(error)) as never,
    }
    const intent = { source: "premium_sheet", user_id: USER } as FreemiumPayPalWebhookIntent
    const activation = { userId: USER, subscriptionId: "I-PAYPALSUB1" }
    assert.deepEqual(await runFreemiumPayPalSubscriptionProvisioning(intent, deps, activation), {
      status: "awaiting_budget",
    })
    assert.deepEqual(await provisionFreemiumPayPalSubscription(intent, deps, activation), {
      status: "awaiting_budget",
    })
  } finally {
    console.info = originalInfo
  }
  assert.deepEqual(captured, [])
})
