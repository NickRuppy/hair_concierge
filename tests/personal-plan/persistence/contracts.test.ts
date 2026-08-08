import assert from "node:assert/strict"
import test from "node:test"

import {
  createNeedVersionDecoderRegistry,
  decodeNeedVersionSnapshot,
  hashPersonalPlanNeedVersionInput,
  needVersionRowSchema,
  userProductSchema,
} from "../../../src/lib/personal-plan/persistence"
import { parseRoutineProposalStageResult } from "../../../src/lib/personal-plan/routine-proposal-stager"

const INITIAL_ID = "initial-version"

test("need-version hashes normalize object order without erasing array semantics", () => {
  const left = hashPersonalPlanNeedVersionInput({
    schemaVersion: 1,
    computationVersion: "stage1-v1",
    inputSnapshot: { concerns: ["frizz", "dryness"], hair: { texture: "wavy", thickness: "fine" } },
  })
  const right = hashPersonalPlanNeedVersionInput({
    computationVersion: "stage1-v1",
    schemaVersion: 1,
    inputSnapshot: { hair: { thickness: "fine", texture: "wavy" }, concerns: ["frizz", "dryness"] },
  })

  assert.equal(left, right)
  assert.notEqual(
    left,
    hashPersonalPlanNeedVersionInput({
      schemaVersion: 1,
      computationVersion: "stage1-v1",
      inputSnapshot: {
        concerns: ["dryness", "frizz"],
        hair: { texture: "wavy", thickness: "fine" },
      },
    }),
  )
})

test("refined need-version hashes remain separated by their initial parent", () => {
  const input = {
    schemaVersion: 1,
    computationVersion: "stage2-v1",
    inputSnapshot: { shampooFrequency: "twice_weekly" },
  }

  assert.notEqual(
    hashPersonalPlanNeedVersionInput({ ...input, parentNeedVersionId: "initial-a" }),
    hashPersonalPlanNeedVersionInput({ ...input, parentNeedVersionId: "initial-b" }),
  )
})

test("need-version decoders dispatch only their registered schema and computation pair", () => {
  const registry = createNeedVersionDecoderRegistry([
    {
      schemaVersion: 1,
      computationVersion: "stage1-v1",
      decodeInput: (value) =>
        value === "input" ? { ok: true as const, value } : { ok: false as const },
      decodeOutput: (value) =>
        value === "output" ? { ok: true as const, value } : { ok: false as const },
    },
  ])
  const row = needVersionRowSchema.parse({
    id: INITIAL_ID,
    userId: "user",
    personalPlanId: "plan",
    kind: "initial",
    parentNeedVersionId: null,
    preparedArtifactSourceId: null,
    schemaVersion: 1,
    computationVersion: "stage1-v1",
    inputHash: "a".repeat(64),
    inputSnapshot: "input",
    outputSnapshot: "output",
    createdAt: "2026-08-08T10:00:00.000Z",
  })

  assert.deepEqual(decodeNeedVersionSnapshot(registry, row), {
    ok: true,
    input: "input",
    output: "output",
  })
  assert.deepEqual(
    decodeNeedVersionSnapshot(registry, { ...row, computationVersion: "future-v2" }),
    {
      ok: false,
      error: {
        code: "unsupported_snapshot_version",
        schemaVersion: 1,
        computationVersion: "future-v2",
      },
    },
  )
})

test("user-product identity requires a catalog link only for matched identities", () => {
  const identityAudit = {
    intakeSource: "catalog_search" as const,
    createdAt: "2026-08-08T10:00:00.000Z",
    updatedAt: "2026-08-08T10:00:00.000Z",
  }
  assert.equal(
    userProductSchema.safeParse({
      id: "owned-shampoo",
      userId: "user",
      category: "shampoo",
      catalogProductId: "catalog-shampoo",
      brandText: "Brand",
      productNameText: "Shampoo",
      identityStatus: "matched",
      ownershipStatus: "owned",
      ...identityAudit,
    }).success,
    true,
  )
  assert.equal(
    userProductSchema.safeParse({
      id: "pending-shampoo",
      userId: "user",
      category: "shampoo",
      catalogProductId: "catalog-shampoo",
      brandText: "Brand",
      productNameText: "Shampoo",
      identityStatus: "pending_review",
      ownershipStatus: "owned",
      ...identityAudit,
    }).success,
    false,
  )
  assert.equal(
    userProductSchema.safeParse({
      id: "unmatched-shampoo",
      userId: "user",
      category: "shampoo",
      catalogProductId: null,
      brandText: "Brand",
      productNameText: "Shampoo",
      identityStatus: "matched",
      ownershipStatus: "owned",
      ...identityAudit,
    }).success,
    false,
  )
  assert.equal(
    userProductSchema.safeParse({
      id: "pending-shampoo",
      userId: "user",
      category: "shampoo",
      catalogProductId: null,
      brandText: "Brand",
      productNameText: "Shampoo",
      identityStatus: "pending_review",
      ownershipStatus: "owned",
      ...identityAudit,
    }).success,
    true,
  )
  assert.equal(
    userProductSchema.safeParse({
      id: "missing-audit",
      userId: "user",
      category: "shampoo",
      catalogProductId: "catalog-shampoo",
      brandText: "Brand",
      productNameText: "Shampoo",
      identityStatus: "matched",
      ownershipStatus: "owned",
    }).success,
    false,
  )
})

test("routine-proposal stager parses atomic success and typed retryable errors", () => {
  assert.deepEqual(
    parseRoutineProposalStageResult({
      status: "completed",
      portfolioVersionId: "portfolio",
      routineVersionId: "routine",
      routineProposalId: "proposal",
      revision: 1,
    }),
    {
      ok: true,
      value: {
        status: "completed",
        portfolioVersionId: "portfolio",
        routineVersionId: "routine",
        routineProposalId: "proposal",
        revision: 1,
      },
    },
  )
  assert.deepEqual(parseRoutineProposalStageResult({ status: "temporarily_unavailable" }), {
    ok: true,
    value: { status: "temporarily_unavailable" },
  })
  assert.deepEqual(
    parseRoutineProposalStageResult({ status: "completed", portfolioVersionId: "only-one" }),
    {
      ok: false,
      error: { code: "invalid_stager_response" },
    },
  )
})
