import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  claimMetaOfferView,
  deriveMetaOfferViewEventId,
  metaOfferViewStorageKey,
  trackMetaOfferViewOnce,
} from "../src/lib/analytics/meta-offer-view-client"

const identity = {
  entryContext: "quiz_completion" as const,
  funnelPackageKey: "default_organic",
  funnelSessionId: "20000000-0000-4000-8000-000000000093",
  leadId: "10000000-0000-4000-8000-000000000093",
  offerRevision: "product_led_v2",
  offerVariant: "default",
}

test("offer provider keeps internal views separate from the dedicated Meta path", () => {
  const source = readFileSync(
    new URL("../src/components/quiz/offer-tracking-provider.tsx", import.meta.url),
    "utf8",
  )
  assert.match(source, /trackAppEvent\("offer_viewed"/)
  assert.match(source, /entryContext !== "quiz_completion" \|\| !leadId/)
  assert.match(source, /void trackMetaOfferViewOnce\(\{/)
})

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  }
}

test("Meta offer view is claimed once per browser funnel and variant", () => {
  const storage = memoryStorage()

  assert.equal(claimMetaOfferView(identity, storage), true)
  assert.equal(claimMetaOfferView(identity, storage), false)
  assert.equal(claimMetaOfferView({ ...identity, offerVariant: "alternate" }, storage), true)
  assert.match(metaOfferViewStorageKey(identity), /10000000-0000-4000-8000-000000000093/)
})

test("Meta offer view fails closed when local storage is unavailable", () => {
  assert.equal(claimMetaOfferView(identity, null), false)
  assert.equal(
    claimMetaOfferView(identity, {
      getItem: () => {
        throw new Error("storage blocked")
      },
      setItem: () => undefined,
    }),
    false,
  )
  assert.equal(
    claimMetaOfferView(identity, {
      getItem: () => null,
      setItem: () => {
        throw new Error("storage blocked")
      },
    }),
    false,
  )
})

test("Meta offer view derives one UUID-shaped id from stable identity", async () => {
  const first = await deriveMetaOfferViewEventId(identity)
  const second = await deriveMetaOfferViewEventId(identity)
  const other = await deriveMetaOfferViewEventId({
    ...identity,
    leadId: "10000000-0000-4000-8000-000000000094",
  })

  assert.equal(first, second)
  assert.notEqual(first, other)
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(first.includes(identity.leadId), false)
})

test("event-id derivation failure leaves the browser claim available for retry", async () => {
  const storage = memoryStorage()
  assert.equal(
    await trackMetaOfferViewOnce(identity, {
      deriveEventId: async () => {
        throw new Error("crypto unavailable")
      },
      storage,
    }),
    false,
  )
  assert.equal(storage.values.size, 0)
})

test("Meta offer view sends Pixel and endpoint with the identical id", async () => {
  const storage = memoryStorage()
  const pixelIds: string[] = []
  const requests: Array<{ body: string; keepalive?: boolean }> = []

  const tracked = await trackMetaOfferViewOnce(identity, {
    storage,
    trackPixel: (metaEventId) => {
      pixelIds.push(metaEventId)
      return true
    },
    send: async (_input, init) => {
      requests.push({ body: String(init?.body), keepalive: init?.keepalive })
      return new Response(null, { status: 202 })
    },
  })

  assert.equal(tracked, true)
  assert.equal(pixelIds.length, 1)
  assert.equal(requests.length, 1)
  assert.equal(requests[0]?.keepalive, true)
  assert.deepEqual(JSON.parse(requests[0]?.body ?? "{}"), {
    entryContext: "quiz_completion",
    leadId: identity.leadId,
    metaEventId: pixelIds[0],
  })
  assert.equal(await trackMetaOfferViewOnce(identity, { storage }), false)
})

test("non-completion entries never claim or send the primary Meta offer view", async () => {
  const storage = memoryStorage()
  let sends = 0
  const tracked = await trackMetaOfferViewOnce(
    { ...identity, entryContext: "result_email" },
    {
      storage,
      trackPixel: () => {
        sends += 1
        return true
      },
      send: async () => {
        sends += 1
        return new Response(null, { status: 202 })
      },
    },
  )

  assert.equal(tracked, false)
  assert.equal(sends, 0)
  assert.equal(storage.values.size, 0)
})

test("a transport failure never rejects the offer render path", async () => {
  const tracked = await trackMetaOfferViewOnce(identity, {
    storage: memoryStorage(),
    trackPixel: () => true,
    send: async () => {
      throw new Error("offline")
    },
  })

  assert.equal(tracked, true)
})

test("a Pixel failure does not suppress the matching server request", async () => {
  let requests = 0
  const tracked = await trackMetaOfferViewOnce(identity, {
    storage: memoryStorage(),
    trackPixel: () => {
      throw new Error("pixel blocked")
    },
    send: async () => {
      requests += 1
      return new Response(null, { status: 202 })
    },
  })

  assert.equal(tracked, true)
  assert.equal(requests, 1)
})
