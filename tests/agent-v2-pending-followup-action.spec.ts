import assert from "node:assert/strict"
import test from "node:test"

import {
  AgentV2PendingFollowupActionSchema,
  type AgentV2RoutineThreadContext,
} from "../src/lib/agent-v2/contracts"
import {
  doesRoutineCallMatchPendingAction,
  isPendingRoutineMutation,
  legacyRoutineActionToFollowup,
  readPendingFollowupAction,
  resolvePendingRoutineMutationPolicy,
} from "../src/lib/agent-v2/pending-followup-action"

function routineThreadContext(
  pending_followup_action: AgentV2RoutineThreadContext["pending_followup_action"],
): Parameters<typeof resolvePendingRoutineMutationPolicy>[0]["routineThreadContext"] {
  return {
    active: true,
    current_layer: "basics",
    last_answer_mode: "routine",
    last_routine_categories: ["mask"],
    last_user_goal: "Routine leichter machen",
    summary_de: "Eine Maske ist optional.",
    pending_followup_action,
    visible_steps: [],
  }
}

test("AgentV2PendingFollowupActionSchema accepts the valid action variants", () => {
  const variants = [
    {
      kind: "product_recommendation",
      category: "mask",
      routine_layer: null,
      routine_action: null,
      source: "assistant_offer",
    },
    {
      kind: "advisor_response",
      category: "unknown",
      routine_layer: "basics",
      routine_action: null,
      source: "assistant_offer",
    },
    {
      kind: "routine_mutation",
      category: "mask",
      routine_layer: "basics",
      routine_action: "add_step",
      source: "assistant_offer",
    },
  ]

  for (const variant of variants) {
    assert.deepEqual(AgentV2PendingFollowupActionSchema.parse(variant), variant)
  }
})

test("AgentV2PendingFollowupActionSchema rejects invalid field combinations", () => {
  const invalidVariants = [
    {
      kind: "product_recommendation",
      category: "mask",
      routine_layer: "basics",
      routine_action: null,
      source: "assistant_offer",
    },
    {
      kind: "advisor_response",
      category: "mask",
      routine_layer: null,
      routine_action: "add_step",
      source: "assistant_offer",
    },
    {
      kind: "routine_mutation",
      category: "mask",
      routine_layer: "basics",
      routine_action: null,
      source: "assistant_offer",
    },
    {
      kind: "product_recommendation",
      category: "none",
      routine_layer: null,
      routine_action: null,
      source: "assistant_offer",
    },
    {
      kind: "product_recommendation",
      category: "unknown",
      routine_layer: null,
      routine_action: null,
      source: "assistant_offer",
    },
    {
      kind: "product_recommendation",
      category: "styling",
      routine_layer: null,
      routine_action: null,
      source: "assistant_offer",
    },
    {
      kind: "product_recommendation",
      category: "treatment",
      routine_layer: null,
      routine_action: null,
      source: "assistant_offer",
    },
  ]

  for (const variant of invalidVariants) {
    assert.equal(AgentV2PendingFollowupActionSchema.safeParse(variant).success, false)
  }
})

test("legacyRoutineActionToFollowup converts valid legacy routine action state", () => {
  assert.deepEqual(
    legacyRoutineActionToFollowup({
      category: "mask",
      routine_layer: "goals",
      action: "add_step",
    }),
    {
      kind: "routine_mutation",
      category: "mask",
      routine_layer: "goals",
      routine_action: "add_step",
      source: "assistant_offer",
    },
  )

  assert.equal(legacyRoutineActionToFollowup({ category: "mask", action: null }), null)
})

test("readPendingFollowupAction reads current action state and falls back to legacy state", () => {
  const current = {
    kind: "advisor_response",
    category: null,
    routine_layer: null,
    routine_action: null,
    source: "assistant_offer",
  }

  assert.deepEqual(readPendingFollowupAction(current), current)
  assert.deepEqual(
    readPendingFollowupAction({
      pending_routine_action: {
        category: "leave_in",
        routine_layer: "basics",
        action: "add_step",
      },
    }),
    {
      kind: "routine_mutation",
      category: "leave_in",
      routine_layer: "basics",
      routine_action: "add_step",
      source: "assistant_offer",
    },
  )
  assert.equal(readPendingFollowupAction({ pending_followup_action: { kind: "bogus" } }), null)
})

test("isPendingRoutineMutation only accepts routine mutation actions", () => {
  assert.equal(
    isPendingRoutineMutation({
      kind: "routine_mutation",
      category: null,
      routine_layer: null,
      routine_action: "simplify",
      source: "assistant_offer",
    }),
    true,
  )
  assert.equal(
    isPendingRoutineMutation({
      kind: "product_recommendation",
      category: "mask",
      routine_layer: null,
      routine_action: null,
      source: "assistant_offer",
    }),
    false,
  )
})

test("doesRoutineCallMatchPendingAction matches category, layer, and action", () => {
  const action = {
    kind: "routine_mutation" as const,
    category: "mask" as const,
    routine_layer: "basics" as const,
    routine_action: "add_step" as const,
    source: "assistant_offer" as const,
  }

  assert.equal(
    doesRoutineCallMatchPendingAction(
      {
        requested_category: "mask",
        requested_layer: "basics",
        routine_intent: "modify",
        mutation_kind: "add_step",
      },
      action,
    ),
    true,
  )
  assert.equal(
    doesRoutineCallMatchPendingAction(
      {
        requested_category: "leave_in",
        requested_layer: "basics",
        routine_intent: "modify",
        mutation_kind: "add_step",
      },
      action,
    ),
    false,
  )
  assert.equal(
    doesRoutineCallMatchPendingAction(
      {
        requested_category: "mask",
        requested_layer: "goals",
        routine_intent: "modify",
        mutation_kind: "add_step",
      },
      action,
    ),
    false,
  )
  assert.equal(
    doesRoutineCallMatchPendingAction(
      {
        requested_category: "mask",
        requested_layer: "basics",
        routine_intent: "modify",
        mutation_kind: "simplify",
      },
      action,
    ),
    false,
  )
})

test("doesRoutineCallMatchPendingAction denies non-routine pending actions", () => {
  assert.equal(
    doesRoutineCallMatchPendingAction(
      {
        requested_category: "mask",
        requested_layer: "basics",
        routine_intent: "modify",
        mutation_kind: "add_step",
      },
      {
        kind: "advisor_response",
        category: "mask",
        routine_layer: "basics",
        routine_action: null,
        source: "assistant_offer",
      },
    ),
    false,
  )
})

test("resolvePendingRoutineMutationPolicy denies short confirmations without routine mutation state", () => {
  assert.deepEqual(
    resolvePendingRoutineMutationPolicy({
      message: "Ja bitte",
      routineThreadContext: routineThreadContext(null),
    }),
    {
      hardDenyReason: "routine_action_not_authorized",
      pendingConfirmationAllowed: false,
      pendingFollowupAction: null,
    },
  )

  assert.deepEqual(
    resolvePendingRoutineMutationPolicy({
      message: "Ja bitte",
      routineThreadContext: routineThreadContext({
        kind: "product_recommendation",
        category: "mask",
        routine_layer: null,
        routine_action: null,
        source: "assistant_offer",
      }),
    }),
    {
      hardDenyReason: "routine_action_not_authorized",
      pendingConfirmationAllowed: false,
      pendingFollowupAction: null,
    },
  )
})

test("resolvePendingRoutineMutationPolicy authorizes short confirmations for routine mutation state", () => {
  const action = {
    kind: "routine_mutation" as const,
    category: "mask" as const,
    routine_layer: "basics" as const,
    routine_action: "add_step" as const,
    source: "assistant_offer" as const,
  }

  assert.deepEqual(
    resolvePendingRoutineMutationPolicy({
      message: "mach das bitte",
      routineThreadContext: routineThreadContext(action),
    }),
    {
      hardDenyReason: null,
      pendingConfirmationAllowed: true,
      pendingFollowupAction: action,
    },
  )
})
