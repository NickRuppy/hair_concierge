import assert from "node:assert/strict"
import test from "node:test"

import {
  shouldStartStage1ProductPreviewWarmup,
  warmStage1ProductExampleImages,
} from "../src/lib/personal-plan/product-preview-warmup"

type RecordedRequest = {
  url: string
  init?: RequestInit
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

function emptyCommerce() {
  return {
    priceEur: null,
    purchaseLinkStatus: null,
    netContentValue: null,
    netContentUnit: null,
    priceLabel: null,
    netContentLabel: null,
    availabilityLabel: "Aktuelle Verfügbarkeit nicht bestätigt",
    productUrl: null,
    affiliateDisclosure: null,
  }
}

function emptyReasoning() {
  return { productCriteria: "Kriterien.", fit: "Begründung.", frequency: "Rhythmus." }
}

test("warms every unique source-matched Basis and Optional preview image", async () => {
  const requests: RecordedRequest[] = []
  const warmed: string[] = []
  const previewUrl =
    "/api/personal-plan/stage-1/previews?personalPlanId=plan-1&sourceInputHash=input-1"
  const fetcher = async (url: string, init?: RecordedRequest["init"]) => {
    requests.push({ url, init })
    if (url === "/api/personal-plan/stage-1") {
      return jsonResponse({
        status: "completed",
        personalPlanId: "plan-1",
        outputSnapshot: { inputHash: "input-1" },
      })
    }
    assert.equal(url, previewUrl)
    return jsonResponse({
      schemaVersion: 2,
      personalPlanId: "plan-1",
      sourceNeedVersionId: "need-1",
      sourceInputHash: "input-1",
      directAcceptance: { available: true },
      previews: [
        {
          kind: "recommendation",
          category: "shampoo",
          role: "shampoo_everyday",
          decisionKey: "decision:shampoo:shampoo_everyday:gap",
          productId: "basis-product",
          productName: "Basis Produkt",
          imageUrl: "https://images.example/basis.webp",
          verdict: "ideal",
          authorityVersion: "personal-plan.shampoo.v4",
          factFingerprint: "facts-basis-product",
          commerce: emptyCommerce(),
          reasoning: emptyReasoning(),
        },
        {
          kind: "recommendation",
          category: "oil",
          role: "dry_finish",
          decisionKey: "decision:oil:dry_finish:gap",
          productId: "optional-product",
          productName: "Optionales Produkt",
          imageUrl: "https://images.example/optional.webp",
          verdict: "supportive",
          authorityVersion: "personal-plan.oil.v2",
          factFingerprint: "facts-optional-product",
          commerce: emptyCommerce(),
          reasoning: emptyReasoning(),
        },
        {
          // Same product, a different role of the same category (Oil's
          // recommendation cache is shared across roles) — its image must
          // still only be warmed once.
          kind: "recommendation",
          category: "oil",
          role: "leave_on_fibre_conditioning",
          decisionKey: "decision:oil:leave_on_fibre_conditioning:gap",
          productId: "optional-product",
          productName: "Optionales Produkt",
          imageUrl: "https://images.example/optional.webp",
          verdict: "supportive",
          authorityVersion: "personal-plan.oil.v2",
          factFingerprint: "facts-optional-product",
          commerce: emptyCommerce(),
          reasoning: emptyReasoning(),
        },
        {
          kind: "fallback",
          category: "scalp_care",
          role: "scalp_comfort",
          decisionKey: "decision:scalp_care:scalp_comfort:gap",
          authorityVersion: "personal-plan.scalp-care.v3",
          fallback: "post_refinement",
        },
      ],
    })
  }

  const result = await warmStage1ProductExampleImages({
    fetcher,
    warmImage: (url) => warmed.push(url),
  })

  assert.deepEqual(requests, [
    {
      url: "/api/personal-plan/stage-1",
      init: {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    },
    {
      url: previewUrl,
      init: {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "default",
      },
    },
  ])
  assert.deepEqual(warmed, [
    "https://images.example/basis.webp",
    "https://images.example/optional.webp",
  ])
  assert.deepEqual(result, { status: "warmed", imageUrls: warmed })
})

test("starts only for the first ready transition", () => {
  for (const status of [
    "checking",
    "source_pending",
    "paid_pending",
    "missing_source_facts",
    "forbidden",
    "invalid_source",
    "transient_error",
    "timeout",
  ]) {
    assert.equal(shouldStartStage1ProductPreviewWarmup(status, false), false)
  }
  assert.equal(shouldStartStage1ProductPreviewWarmup("ready", false), true)
  assert.equal(shouldStartStage1ProductPreviewWarmup("ready", true), false)
})

test("fails open before warming images when the preview source does not match", async () => {
  const warmed: string[] = []
  const result = await warmStage1ProductExampleImages({
    fetcher: async (url) =>
      url === "/api/personal-plan/stage-1"
        ? jsonResponse({
            status: "completed",
            personalPlanId: "plan-1",
            outputSnapshot: { inputHash: "input-1" },
          })
        : jsonResponse({
            schemaVersion: 2,
            personalPlanId: "plan-1",
            sourceNeedVersionId: "need-stale",
            sourceInputHash: "input-stale",
            directAcceptance: { available: true },
            previews: [
              {
                kind: "recommendation",
                category: "shampoo",
                role: "shampoo_everyday",
                decisionKey: "decision:shampoo:shampoo_everyday:gap",
                productId: "stale-product",
                productName: "Veraltetes Produkt",
                imageUrl: "https://images.example/stale.webp",
                verdict: "ideal",
                authorityVersion: "personal-plan.shampoo.v4",
                factFingerprint: "facts-stale-product",
                commerce: emptyCommerce(),
                reasoning: emptyReasoning(),
              },
            ],
          }),
    warmImage: (url) => warmed.push(url),
  })

  assert.deepEqual(result, { status: "unavailable", imageUrls: [] })
  assert.deepEqual(warmed, [])
})

test("fails open when Stage 1 is not ready or a request fails", async () => {
  const notReady = await warmStage1ProductExampleImages({
    fetcher: async () => jsonResponse({ error: "activation_pending" }, 409),
    warmImage: () => assert.fail("must not warm an image"),
  })
  const networkFailure = await warmStage1ProductExampleImages({
    fetcher: async () => {
      throw new Error("offline")
    },
    warmImage: () => assert.fail("must not warm an image"),
  })

  assert.deepEqual(notReady, { status: "unavailable", imageUrls: [] })
  assert.deepEqual(networkFailure, { status: "unavailable", imageUrls: [] })
})
