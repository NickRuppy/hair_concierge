import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import {
  conditionerReviewFingerprint,
  readConditionerLabReviewState,
  readConditionerReworkQueue,
  saveConditionerLabReviewState,
  updateConditionerReworkQueue,
} from "../src/lib/conditioner-research/review-state"

const PRODUCT_ID = "952a4834-e451-4dc3-ba19-ebb8927eb5e4"
const HASH_A = "a".repeat(64)
const HASH_B = "b".repeat(64)

function withTempDirectory(run: (directory: string) => void) {
  const directory = mkdtempSync(path.join(tmpdir(), "conditioner-review-state-"))
  try {
    run(directory)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test("Conditioner review fingerprints are canonical and key-order independent", () => {
  assert.equal(
    conditionerReviewFingerprint({ b: [2, 1], a: "value" }),
    conditionerReviewFingerprint({ a: "value", b: [2, 1] }),
  )
  assert.notEqual(
    conditionerReviewFingerprint({ a: "value", b: [2, 1] }),
    conditionerReviewFingerprint({ a: "value", b: [1, 2] }),
  )
})

test("Conditioner review state persists exact-version decisions and rejects malformed state", () =>
  withTempDirectory((directory) => {
    const filePath = path.join(directory, "lab-review-state.json")
    saveConditionerLabReviewState({
      filePath,
      snapshot: {
        productId: PRODUCT_ID,
        formulaFingerprint: HASH_A,
        profileFingerprint: HASH_B,
        standardVersion: "conditioner-classification-v1.4",
        boundary: "eligible",
        reviewStatus: "needs_review",
        propertyStatuses: { weight_potential: "approved" },
        fieldFingerprints: { weight_potential: HASH_A },
      },
      decision: {
        action: "approve_property",
        propertyPath: "weight_potential",
        comment: "Geprüft.",
      },
      now: new Date("2026-08-26T08:00:00.000Z"),
    })

    const stored = readConditionerLabReviewState(filePath)
    assert.equal(stored?.products.length, 1)
    assert.equal(stored?.products[0]?.formulaFingerprint, HASH_A)
    assert.equal(stored?.products[0]?.profileFingerprint, HASH_B)
    assert.equal(stored?.products[0]?.decisions[0]?.action, "approve_property")

    writeFileSync(filePath, JSON.stringify({ schemaVersion: "wrong" }), "utf8")
    assert.throws(
      () => readConditionerLabReviewState(filePath),
      /Conditioner Lab review state is malformed/,
    )
  }))

test("Conditioner rework queue exposes unresolved worker handoffs and resolves them after approval", () =>
  withTempDirectory((directory) => {
    const filePath = path.join(directory, "rework-queue.json")
    const base = {
      productId: PRODUCT_ID,
      productName: "NEQI Volume Victory Conditioner",
      propertyPath: "weight_potential",
      comment: "Bitte Gewichtslogik erneut gegen die Formel prüfen.",
      formulaFingerprint: HASH_A,
      profileFingerprint: HASH_B,
      fieldFingerprint: HASH_A,
      standardVersion: "conditioner-classification-v1.4",
    }
    updateConditionerReworkQueue({
      filePath,
      operation: "open",
      entry: base,
      now: new Date("2026-08-26T08:00:00.000Z"),
    })

    assert.equal(readConditionerReworkQueue(filePath)?.entries[0]?.status, "open")
    assert.match(readFileSync(filePath, "utf8"), /Gewichtslogik/)

    updateConditionerReworkQueue({
      filePath,
      operation: "resolve",
      productId: PRODUCT_ID,
      propertyPath: "weight_potential",
      now: new Date("2026-08-26T09:00:00.000Z"),
    })
    const resolved = readConditionerReworkQueue(filePath)?.entries[0]
    assert.equal(resolved?.status, "resolved")
    assert.equal(resolved?.resolvedAt, "2026-08-26T09:00:00.000Z")
  }))

test("Conditioner rework queue keeps only the latest handoff open for one product property", () =>
  withTempDirectory((directory) => {
    const filePath = path.join(directory, "rework-queue.json")
    const entry = {
      productId: PRODUCT_ID,
      productName: "NEQI Volume Victory Conditioner",
      propertyPath: "weight_potential",
      comment: "First review note.",
      formulaFingerprint: HASH_A,
      profileFingerprint: HASH_B,
      fieldFingerprint: HASH_A,
      standardVersion: "conditioner-classification-v1.4",
    }
    updateConditionerReworkQueue({
      filePath,
      operation: "open",
      entry,
      now: new Date("2026-08-26T08:00:00.000Z"),
    })
    updateConditionerReworkQueue({
      filePath,
      operation: "open",
      entry: { ...entry, comment: "Latest review note." },
      now: new Date("2026-08-26T08:05:00.000Z"),
    })

    const queue = readConditionerReworkQueue(filePath)
    const open = queue?.entries.filter((candidate) => candidate.status === "open") ?? []
    assert.equal(open.length, 1)
    assert.equal(open[0]?.comment, "Latest review note.")
  }))
