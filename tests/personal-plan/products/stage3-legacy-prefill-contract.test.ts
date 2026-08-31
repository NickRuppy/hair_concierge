import assert from "node:assert/strict"
import test from "node:test"

import { stage3ProductDraftSchema } from "../../../src/lib/personal-plan/products/contracts"
import { createStage3Draft } from "../../../src/lib/personal-plan/products/state-machine"

const draft = createStage3Draft({
  draftId: "draft-1",
  userId: "owner-1",
  personalPlanId: "plan-1",
  refinedVersionId: "refined-1",
  requirements: [
    {
      category: "conditioner",
      requiredRoles: ["conditioner_rinse_out"],
      needSummary: "Pflege",
      authorityVersion: "conditioner-rinse-out-v1",
    },
  ],
  now: "2026-08-28T00:00:00.000Z",
})

test("Stage 3 draft decoder accepts only the versioned legacy prefill hint overlay", () => {
  const parsed = stage3ProductDraftSchema.safeParse({
    ...draft,
    legacyPrefillHints: {
      schemaVersion: 1,
      sourceFingerprint: "legacy-prefill-v1:sha256:" + "a".repeat(64),
      categories: {
        conditioner: [
          {
            kind: "search_name",
            usageId: "usage-1",
            category: "conditioner",
            productName: "Alte Spülung",
          },
        ],
      },
    },
  })

  assert.equal(parsed.success, true)

  const malformed = stage3ProductDraftSchema.safeParse({
    ...draft,
    legacyPrefillHints: {
      schemaVersion: 1,
      sourceFingerprint: "legacy-prefill-v1:sha256:" + "a".repeat(64),
      categories: {
        conditioner: [
          {
            kind: "search_name",
            usageId: "usage-1",
            category: "shampoo",
            productName: "Falsche Kategorie",
          },
        ],
      },
    },
  })

  assert.equal(malformed.success, false)
  assert.match(
    malformed.success ? "" : malformed.error.issues.map((issue) => issue.message).join("\n"),
    /does not match conditioner/,
  )
})
