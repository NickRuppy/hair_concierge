import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  handleShampooV14PilotReviewRequest,
  type ShampooV14PilotReviewRouteOptions,
} from "@/app/api/labs/shampoo-research/review/route"
import {
  ShampooV14PilotReviewError,
  loadShampooV14PilotReviewItems,
} from "@/lib/labs/shampoo-v14-pilot-review"

function temporaryRouteOptions(): {
  directory: string
  options: ShampooV14PilotReviewRouteOptions
} {
  const directory = mkdtempSync(join(tmpdir(), "shampoo-v14-review-api-"))
  return {
    directory,
    options: {
      environment: "development",
      reviewOptions: { reviewStatePath: join(directory, "review-state.json") },
    },
  }
}

test("is independently unavailable outside development", async () => {
  const response = handleShampooV14PilotReviewRequest({}, { environment: "production" })
  assert.equal(response.status, 404)
  assert.equal((await response.json()).error, "Nur lokal in development verfuegbar.")
})

test("rejects malformed review actions before reaching local persistence", async () => {
  const response = handleShampooV14PilotReviewRequest(
    {
      action: "approve_formula",
      productId: "isana-sensitiv",
      expectedHash: "not-a-hash",
      extra: true,
    },
    { environment: "development" },
  )
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, "Ungueltige Review-Anfrage")
})

test("routes review actions to the requested isolated dataset", async () => {
  let receivedRoot = ""
  const firstWave = handleShampooV14PilotReviewRequest(
    {
      action: "approve_formula",
      productId: "wave-product",
      expectedHash: "0".repeat(64),
      datasetId: "wave-01",
    },
    {
      environment: "development",
      deps: {
        applyAction: (_input, options) => {
          receivedRoot = options.pilotRoot ?? ""
          throw new ShampooV14PilotReviewError(409, "stale")
        },
        loadItems: () => [],
      },
    },
  )

  assert.equal(firstWave.status, 409)
  assert.match(receivedRoot, /shampoo-v14\/pilot\/waves\/wave-01$/)

  const secondWave = handleShampooV14PilotReviewRequest(
    {
      action: "approve_formula",
      productId: "wave-product",
      expectedHash: "0".repeat(64),
      datasetId: "wave-02",
    },
    {
      environment: "development",
      deps: {
        applyAction: (_input, options) => {
          receivedRoot = options.pilotRoot ?? ""
          throw new ShampooV14PilotReviewError(409, "stale")
        },
        loadItems: () => [],
      },
    },
  )

  assert.equal(secondWave.status, 409)
  assert.match(receivedRoot, /shampoo-v14\/pilot\/waves\/wave-02$/)
})

test("rejects unknown dataset identifiers before applying a review action", async () => {
  const response = handleShampooV14PilotReviewRequest(
    {
      action: "approve_formula",
      productId: "wave-product",
      expectedHash: "0".repeat(64),
      datasetId: "../pilot",
    },
    { environment: "development" },
  )
  assert.equal(response.status, 404)
})

test("rejects stale hashes and returns a refreshed local queue after an accepted action", async () => {
  const temporary = temporaryRouteOptions()
  try {
    const item = loadShampooV14PilotReviewItems(temporary.options.reviewOptions)[0]!
    const stale = handleShampooV14PilotReviewRequest(
      { action: "approve_formula", productId: item.id, expectedHash: "0".repeat(64) },
      temporary.options,
    )
    assert.equal(stale.status, 409)
    const staleBody = await stale.json()
    assert.equal(staleBody.items.length, 5)
    assert.equal(staleBody.items[0].integrity.hash, item.integrity.hash)
    assert.deepEqual(staleBody.summary, { total: 5, ready: 5, blocked: 0, approved: 0 })

    const accepted = handleShampooV14PilotReviewRequest(
      { action: "approve_formula", productId: item.id, expectedHash: item.integrity.hash },
      temporary.options,
    )
    assert.equal(accepted.status, 200)
    const body = await accepted.json()
    assert.equal(body.item.id, item.id)
    assert.equal(body.item.review.formula.status, "approved")
    assert.equal(body.items.length, 5)
    assert.deepEqual(body.summary, { total: 5, ready: 5, blocked: 0, approved: 0 })
  } finally {
    rmSync(temporary.directory, { recursive: true, force: true })
  }
})
