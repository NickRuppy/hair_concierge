import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { mobileRowsFromScanDimensions } from "../src/lib/mobile/result-presentation"
import {
  mobileScanResolveResultSchema,
  mobileScanRowSchema,
} from "../src/lib/mobile/scan-contracts"

test("mobile scan fixture is runtime-valid and carries full alternative rows", async () => {
  const fixture = JSON.parse(
    await readFile(new URL("./fixtures/mobile/scan-v1.json", import.meta.url), "utf8"),
  )
  const parsed = mobileScanResolveResultSchema.parse(fixture)
  assert.equal(parsed.kind, "assessment")
  if (parsed.kind === "assessment") {
    assert.equal(parsed.alternatives[0]?.rows[0]?.state, "in_target")
    assert.equal(parsed.rows[0]?.axisKind, "ordered")
    assert.equal(
      parsed.rows[0]?.stops[0]?.meaning,
      "Legt wenig auf. Für feines Haar oder schnell beschwerte Längen.",
    )
  }
})

test("glossary fixture validates the real ordered, set, binary, and cleansing rows", async () => {
  const fixture = JSON.parse(
    await readFile(new URL("./fixtures/mobile/glossary-v1.json", import.meta.url), "utf8"),
  ) as { rows: unknown[] }
  const rows = fixture.rows.map((row) => mobileScanRowSchema.parse(row))
  assert.deepEqual(
    rows.map((row) => row.dimensionId),
    [
      "conditioner.repair_support",
      "shampoo.scalp_route",
      "leave_in.heat_protection",
      "shampoo.cleansing_intensity",
    ],
  )
  assert.ok(rows.every((row) => row.stops.every((stop) => stop.meaning.trim().length > 0)))
})

test("mobile rows retain complete set values rather than treating missing values as a match", () => {
  const [row] = mobileRowsFromScanDimensions(
    [
      {
        dimensionId: "x",
        label: "Eigenschaft",
        stops: [
          { stopId: "fine", label: "fein" },
          { stopId: "normal", label: "normal" },
        ],
        targetStopIds: ["fine", "normal"],
        productStopIds: [],
        state: "unknown",
      },
    ],
    null,
  )
  assert.deepEqual(row?.targetValue, "fein, normal")
  assert.equal(row?.productValue, null)
  assert.equal(row?.state, "unknown")
  assert.equal(row?.displayStatus, "neutral")
  assert.equal(row?.stops[0]?.meaning, "fein")
})
