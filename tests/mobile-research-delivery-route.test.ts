import assert from "node:assert/strict"
import test from "node:test"
import { handleMobileResearchDeliveryReconcile } from "@/app/api/mobile/v1/research-delivery/reconcile/route"

test("delivery cron requires its secret even when disabled, without opening a client", async () => {
  for (const secret of [undefined, "secret"]) {
    const result = await handleMobileResearchDeliveryReconcile(
      new Request("https://example.test"),
      {
        cronSecret: secret,
        enabled: false,
        createClient: () => {
          throw new Error("must not open")
        },
      },
    )
    assert.equal(result.status, 401)
  }
})

test("authenticated disabled cron performs no database or provider work", async () => {
  const result = await handleMobileResearchDeliveryReconcile(
    new Request("https://example.test", { headers: { authorization: "Bearer secret" } }),
    {
      cronSecret: "secret",
      enabled: false,
      createClient: () => {
        throw new Error("must not open")
      },
    },
  )
  assert.deepEqual(result, { status: 200, body: { disabled: true } })
})

test("cron storage failure returns a generic retryable response", async () => {
  const result = await handleMobileResearchDeliveryReconcile(
    new Request("https://example.test", { headers: { authorization: "Bearer secret" } }),
    {
      cronSecret: "secret",
      enabled: true,
      createClient: () => {
        throw new Error("private environment detail")
      },
    },
  )
  assert.deepEqual(result, { status: 503, body: { error: "temporarily_unavailable" } })
})
