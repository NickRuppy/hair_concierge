import assert from "node:assert/strict"
import test from "node:test"
import { bootstrapSchema } from "@/lib/mobile/contracts"

const access = { status: "active" as const, source: "open" as const, appStore: null }

test("delivery capability is optional for older servers and disabled by default", () => {
  assert.equal(
    bootstrapSchema.parse({
      status: "ready",
      profileRevision: "profile-1",
      contextRevision: "context-1",
      access,
    }).researchDeliveryEnabled,
    false,
  )
  assert.equal(
    bootstrapSchema.parse({
      status: "ready",
      profileRevision: "profile-1",
      contextRevision: "context-1",
      researchDeliveryEnabled: true,
      access,
    }).researchDeliveryEnabled,
    true,
  )
})
