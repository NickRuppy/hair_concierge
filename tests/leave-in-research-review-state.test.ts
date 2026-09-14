import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import {
  leaveInReviewFingerprint,
  readLeaveInLabReviewState,
  readLeaveInReworkQueue,
  saveLeaveInLabReviewState,
  updateLeaveInReworkQueue,
} from "../src/lib/leave-in-research/review-state"

const PRODUCT_ID = "slot-01-alverde-naturkosmetik-leave-in-spruehkur-express-7in1"
const HASH_A = "a".repeat(64)
const HASH_B = "b".repeat(64)

function withTempDirectory(run: (directory: string) => void) {
  const directory = mkdtempSync(path.join(tmpdir(), "leave-in-review-state-"))
  try {
    run(directory)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test("Leave-In review fingerprints are canonical and key-order independent", () => {
  assert.equal(
    leaveInReviewFingerprint({ b: [2, 1], a: "value" }),
    leaveInReviewFingerprint({ a: "value", b: [2, 1] }),
  )
  assert.notEqual(
    leaveInReviewFingerprint({ a: "value", b: [2, 1] }),
    leaveInReviewFingerprint({ a: "value", b: [1, 2] }),
  )
})

test("Leave-In review state appends decisions and rejects malformed state", () =>
  withTempDirectory((directory) => {
    const filePath = path.join(directory, "lab-review-state.json")
    const snapshot = {
      productId: PRODUCT_ID,
      formulaFingerprint: HASH_A,
      productFingerprint: HASH_B,
      standardVersion: "leave-in-inci-v0.4",
      boundary: "eligible" as const,
      reviewStatus: "needs_review" as const,
      propertyStatuses: { "dimension.weight_residue_potential": "approved" as const },
      propertyFingerprints: { "dimension.weight_residue_potential": HASH_A },
    }
    saveLeaveInLabReviewState({
      filePath,
      snapshot,
      decision: {
        action: "approve_property",
        propertyPath: "dimension.weight_residue_potential",
        comment: "Geprüft.",
      },
      now: new Date("2026-09-04T08:00:00.000Z"),
    })
    saveLeaveInLabReviewState({
      filePath,
      snapshot: { ...snapshot, reviewStatus: "rework_open" as const },
      decision: {
        action: "request_rework",
        propertyPath: "dimension.weight_residue_potential",
        comment: "Bitte neu begründen.",
      },
      now: new Date("2026-09-04T09:00:00.000Z"),
    })

    const stored = readLeaveInLabReviewState(filePath)
    assert.ok(stored)
    assert.equal(stored.schemaVersion, "leave-in-inci-lab-review-state-v1")
    assert.equal(stored.products.length, 1)
    assert.equal(stored.products[0]!.decisions.length, 2)
    assert.equal(stored.products[0]!.reviewStatus, "rework_open")

    writeFileSync(filePath, "{ not json")
    assert.throws(() => readLeaveInLabReviewState(filePath), /malformed/)
    assert.equal(readLeaveInLabReviewState(path.join(directory, "missing.json")), null)
  }))

test("Leave-In rework queue opens one entry per property and resolves it again", () =>
  withTempDirectory((directory) => {
    const filePath = path.join(directory, "rework-queue.json")
    const entry = {
      productId: PRODUCT_ID,
      productName: "alverde Leave-In Sprühkur",
      propertyPath: "profile.focus.primary",
      comment: "Permissive Lesart prüfen.",
      formulaFingerprint: HASH_A,
      productFingerprint: HASH_B,
      propertyFingerprint: HASH_A,
      standardVersion: "leave-in-inci-v0.4",
    }
    updateLeaveInReworkQueue({
      filePath,
      operation: "open",
      entry,
      now: new Date("2026-09-04T08:00:00.000Z"),
    })
    updateLeaveInReworkQueue({
      filePath,
      operation: "open",
      entry: { ...entry, comment: "Nochmal." },
      now: new Date("2026-09-04T09:00:00.000Z"),
    })
    let queue = readLeaveInReworkQueue(filePath)
    assert.ok(queue)
    assert.equal(queue.entries.length, 2)
    assert.equal(queue.entries.filter((item) => item.status === "open").length, 1)

    updateLeaveInReworkQueue({
      filePath,
      operation: "resolve",
      productId: PRODUCT_ID,
      now: new Date("2026-09-04T10:00:00.000Z"),
    })
    queue = readLeaveInReworkQueue(filePath)
    assert.ok(queue)
    assert.equal(queue.entries.filter((item) => item.status === "open").length, 0)
    assert.ok(JSON.parse(readFileSync(filePath, "utf8")).updatedAt)
  }))
