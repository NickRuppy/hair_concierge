import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import { unresolvedConditionerReworkPacket } from "../scripts/conditioner-research-rework-queue"
import { updateConditionerReworkQueue } from "../src/lib/conditioner-research/review-state"

test("Conditioner rework CLI packet exposes only unresolved exact-version handoffs", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "conditioner-rework-cli-"))
  const filePath = path.join(directory, "rework-queue.json")
  try {
    const base = {
      productId: "952a4834-e451-4dc3-ba19-ebb8927eb5e4",
      productName: "NEQI Volume Victory Conditioner",
      propertyPath: "weight_potential",
      comment: "Bitte Gewichtslogik erneut prüfen.",
      formulaFingerprint: "a".repeat(64),
      profileFingerprint: "b".repeat(64),
      fieldFingerprint: "c".repeat(64),
      standardVersion: "1.3-rc1",
    }
    updateConditionerReworkQueue({ filePath, operation: "open", entry: base })
    const packet = unresolvedConditionerReworkPacket(filePath)
    assert.equal(packet.openCount, 1)
    assert.equal(packet.entries[0]?.propertyPath, "weight_potential")
    assert.equal(packet.entries[0]?.reviewerComment, "Bitte Gewichtslogik erneut prüfen.")
    assert.equal(packet.entries[0]?.standardVersion, "1.3-rc1")
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
