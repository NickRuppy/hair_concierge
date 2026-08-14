import assert from "node:assert/strict"
import test from "node:test"

import {
  clearStage3ReviewDraft,
  clearStage3ReviewDraftsForOwner,
  readStage3ReviewDraft,
  writeStage3ReviewDraft,
} from "../../../src/lib/personal-plan/products/review-draft"
import { createMemoryPendingStage3RecoveryStorage } from "../../../src/lib/personal-plan/products/pending-recovery"

const scope = { ownerId: "user-1", personalPlanId: "plan-1", draftId: "draft-1" }

test("review draft preserves ordered local choices without marking them as submitted", () => {
  const storage = createMemoryPendingStage3RecoveryStorage()
  writeStage3ReviewDraft(storage, scope, {
    expectedRevision: 4,
    choices: {
      "decision:conditioner": {
        kind: "decision",
        intent: {
          type: "resolve_decision",
          subjectKey: "decision:conditioner",
          action: "keep_owned",
        },
      },
      "inventory:dry-shampoo": {
        kind: "inventory_disposition",
        dispositionKey: "inventory:dry-shampoo",
      },
    },
    order: ["decision:conditioner", "inventory:dry-shampoo"],
    updatedAt: 1_000,
  })

  assert.deepEqual(readStage3ReviewDraft(storage, scope, 1_100), {
    expectedRevision: 4,
    choices: {
      "decision:conditioner": {
        kind: "decision",
        intent: {
          type: "resolve_decision",
          subjectKey: "decision:conditioner",
          action: "keep_owned",
        },
      },
      "inventory:dry-shampoo": {
        kind: "inventory_disposition",
        dispositionKey: "inventory:dry-shampoo",
      },
    },
    order: ["decision:conditioner", "inventory:dry-shampoo"],
    updatedAt: 1_000,
  })

  clearStage3ReviewDraft(storage, scope)
  assert.equal(readStage3ReviewDraft(storage, scope, 1_100), null)
})

test("review drafts are owner-scoped and cleared on logout", () => {
  const storage = createMemoryPendingStage3RecoveryStorage()
  const ownerScope = { ownerId: "user/one", personalPlanId: "plan-1", draftId: "draft-1" }
  const otherScope = { ownerId: "user-two", personalPlanId: "plan-2", draftId: "draft-2" }
  const localDraft = { expectedRevision: 1, choices: {}, order: [], updatedAt: 1_000 }
  writeStage3ReviewDraft(storage, ownerScope, localDraft)
  writeStage3ReviewDraft(storage, otherScope, localDraft)

  clearStage3ReviewDraftsForOwner(storage, ownerScope.ownerId)

  assert.equal(readStage3ReviewDraft(storage, ownerScope, 1_100), null)
  assert.deepEqual(readStage3ReviewDraft(storage, otherScope, 1_100), localDraft)
})

test("review draft discards malformed and expired local state", () => {
  const storage = createMemoryPendingStage3RecoveryStorage()
  storage.setItem(
    "personal-plan.stage3.review-draft.v1:user-1:plan-1:draft-1",
    JSON.stringify({ expectedRevision: 1, choices: {}, order: ["missing"], updatedAt: 1_000 }),
  )
  assert.equal(readStage3ReviewDraft(storage, scope, 1_100), null)

  writeStage3ReviewDraft(storage, scope, {
    expectedRevision: 1,
    choices: {},
    order: [],
    updatedAt: 1_000,
  })
  assert.equal(readStage3ReviewDraft(storage, scope, 86_401_001), null)
})
