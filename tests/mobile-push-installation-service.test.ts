import assert from "node:assert/strict"
import test from "node:test"
import {
  mobilePushRegistrationSchema,
  readApnsTopicAllowlist,
  registerMobilePushInstallation,
  revokeMobilePushInstallation,
} from "@/lib/mobile/push-installation-service"

const owner = "11111111-1111-4111-8111-111111111111"
const installationId = "22222222-2222-4222-8222-222222222222"
const token = "AB".repeat(32)
const enabled = {
  MOBILE_RESEARCH_DELIVERY_ENABLED: "true",
  MOBILE_APNS_ALLOWED_TOPICS: JSON.stringify({
    sandbox: ["de.chaarlie.app"],
    production: ["de.chaarlie.app"],
  }),
}

test("push registration accepts APNs hex in either case and normalizes it", () => {
  const parsed = mobilePushRegistrationSchema.parse({
    installationId,
    token,
    environment: "sandbox",
    topic: "de.chaarlie.app",
  })
  assert.equal(parsed.token, token.toLowerCase())
  assert.equal(
    mobilePushRegistrationSchema.safeParse({ ...parsed, token: "not-a-token" }).success,
    false,
  )
  assert.equal(
    mobilePushRegistrationSchema.safeParse({ ...parsed, topic: "not a topic" }).success,
    false,
  )
})

test("registration is disabled by default and fails closed without a complete server allowlist", async () => {
  let calls = 0
  const client = {
    rpc: async () => {
      calls++
      return { data: true, error: null }
    },
  }
  const input = mobilePushRegistrationSchema.parse({
    installationId,
    token,
    environment: "sandbox",
    topic: "de.chaarlie.app",
  })
  await assert.rejects(
    registerMobilePushInstallation(client as never, owner, input, {}),
    /not_found/,
  )
  await assert.rejects(
    registerMobilePushInstallation(client as never, owner, input, {
      MOBILE_RESEARCH_DELIVERY_ENABLED: "true",
    }),
    /temporarily_unavailable/,
  )
  assert.equal(calls, 0)
  assert.throws(
    () => readApnsTopicAllowlist({ MOBILE_APNS_ALLOWED_TOPICS: '{"sandbox":["de.chaarlie.app"]}' }),
    /temporarily_unavailable/,
  )
})

test("registration allows only the server configured topic and never passes a client user id", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      return { data: true, error: null }
    },
  }
  const input = mobilePushRegistrationSchema.parse({
    installationId,
    token,
    environment: "sandbox",
    topic: "de.chaarlie.app",
  })
  await registerMobilePushInstallation(client as never, owner, input, enabled)
  assert.deepEqual(calls, [
    {
      name: "mobile_push_installation_register",
      args: {
        p_user_id: owner,
        p_installation_id: installationId,
        p_apns_token: token.toLowerCase(),
        p_environment: "sandbox",
        p_topic: "de.chaarlie.app",
      },
    },
  ])
  await assert.rejects(
    registerMobilePushInstallation(
      client as never,
      owner,
      { ...input, topic: "com.example.other" },
      enabled,
    ),
    /invalid_request/,
  )
  assert.equal(calls.length, 1)
})

test("owner-scoped revocation remains available while delivery is disabled", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      return { data: true, error: null }
    },
  }
  await revokeMobilePushInstallation(client as never, owner, installationId)
  assert.deepEqual(calls, [
    {
      name: "mobile_push_installation_revoke",
      args: { p_user_id: owner, p_installation_id: installationId },
    },
  ])
})
