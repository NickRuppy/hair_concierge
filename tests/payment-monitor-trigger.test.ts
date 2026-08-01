import assert from "node:assert/strict"
import test from "node:test"

import {
  KEYCHAIN_SERVICE_NAME,
  main,
  PRODUCTION_MONITOR_ENDPOINT,
  REQUEST_TIMEOUT_MS,
  runPaymentMonitor,
} from "../scripts/billing/trigger-payment-monitor.mjs"

const endpoint = PRODUCTION_MONITOR_ENDPOINT
const secret = "payment-monitor-secret-must-not-leak"

function loggerOutput() {
  const output: string[] = []
  return {
    output,
    logger: (message: string) => output.push(message),
  }
}

test("local trigger encloses the server monitor deadline", () => {
  assert.equal(REQUEST_TIMEOUT_MS, 50_000)
})

test("runs the HTTPS monitor with a Keychain secret that never enters argv or logs", async () => {
  let keychainArgs: string[] | undefined
  let request: { url: string; init?: RequestInit } | undefined
  const { logger, output } = loggerOutput()

  const result = await runPaymentMonitor({
    endpoint,
    getKeychainSecret: async (serviceName) => {
      keychainArgs = ["find-generic-password", "-s", serviceName, "-w"]
      return secret
    },
    fetch: async (url, init) => {
      request = { url: String(url), init }
      return new Response("customer data must not be read", { status: 200 })
    },
  })

  assert.equal(result.status, 200)
  assert.deepEqual(keychainArgs, ["find-generic-password", "-s", KEYCHAIN_SERVICE_NAME, "-w"])
  assert.equal(request?.url, endpoint)
  assert.equal(request?.init?.method, "POST")
  assert.equal(request?.init?.redirect, "error")
  assert.equal(new Headers(request?.init?.headers).get("authorization"), `Bearer ${secret}`)
  assert.equal(JSON.stringify(request).includes(secret), true)

  const exitCode = await main(["--endpoint", endpoint], {
    getKeychainSecret: async () => secret,
    fetch: async () => new Response("response body is private", { status: 200 }),
    logger,
  })
  assert.equal(exitCode, 0)
  assert.equal(output.join("\n").includes(secret), false)
  assert.equal(output.join("\n").includes("response body is private"), false)
  assert.match(output[0], /^\d{4}-\d{2}-\d{2}T.* success status=200$/)
})

test("rejects non-HTTPS endpoints before Keychain access", async () => {
  let keychainCalled = false

  await assert.rejects(
    () =>
      runPaymentMonitor({
        endpoint: "http://chaarlie.de/api/billing/payment-monitor",
        getKeychainSecret: async () => {
          keychainCalled = true
          return secret
        },
        fetch: async () => new Response(null, { status: 204 }),
      }),
    { message: "configuration_failure" },
  )
  assert.equal(keychainCalled, false)
})

test("rejects every HTTPS host, path, query, or fragment except the production monitor route", async () => {
  const rejected = [
    "https://example.com/api/billing/payment-monitor",
    "https://www.chaarlie.de/api/billing/payment-monitor",
    "https://chaarlie.de/api/billing/reconcile",
    `${endpoint}?redirect=https://example.com`,
    `${endpoint}#fragment`,
  ]

  for (const candidate of rejected) {
    let keychainCalled = false
    await assert.rejects(
      () =>
        runPaymentMonitor({
          endpoint: candidate,
          getKeychainSecret: async () => {
            keychainCalled = true
            return secret
          },
          fetch: async () => new Response(null, { status: 204 }),
        }),
      { message: "configuration_failure" },
    )
    assert.equal(keychainCalled, false)
  }
})

test("returns a nonzero, secret-free result for Keychain, network, and HTTP failures", async () => {
  const cases = [
    {
      expected: "keychain_failure",
      getKeychainSecret: async () => {
        throw new Error(`Keychain could not find ${secret}`)
      },
      fetch: async () => new Response(null, { status: 204 }),
    },
    {
      expected: "network_failure",
      getKeychainSecret: async () => secret,
      fetch: async () => {
        throw new Error(`Network rejected ${secret}`)
      },
    },
    {
      expected: "http_failure status=503",
      getKeychainSecret: async () => secret,
      fetch: async () => {
        const response = new Response("response body must not be consumed", { status: 503 })
        Object.defineProperty(response, "text", {
          value: async () => {
            throw new Error("response body must not be consumed")
          },
        })
        return response
      },
    },
  ]

  for (const scenario of cases) {
    const { logger, output } = loggerOutput()
    const exitCode = await main(["--endpoint", endpoint], {
      getKeychainSecret: scenario.getKeychainSecret,
      fetch: scenario.fetch,
      logger,
    })

    assert.equal(exitCode, 1)
    assert.match(output[0], new RegExp(` ${scenario.expected}$`))
    assert.equal(output.join("\n").includes(secret), false)
  }
})

test("logs only privacy-safe monitor failure categories from the authenticated endpoint", async () => {
  const { logger, output } = loggerOutput()
  const exitCode = await main(["--endpoint", endpoint], {
    getKeychainSecret: async () => secret,
    fetch: async () =>
      Response.json(
        {
          paymentIntegrity: {
            status: "monitor_failed",
            counters: { findings: 0 },
            failures: [
              {
                provider: "stripe",
                reason: "provider_error",
                errorFamily: "provider_unavailable",
                rawProviderReference: "must-not-leak",
              },
            ],
            customerEmail: "must-not-leak@example.com",
          },
        },
        { status: 500 },
      ),
    logger,
  })

  assert.equal(exitCode, 1)
  assert.match(
    output[0],
    / http_failure status=500 failures=stripe:provider_error:provider_unavailable$/,
  )
  assert.equal(output.join("\n").includes("must-not-leak"), false)
  assert.equal(output.join("\n").includes("@"), false)
  assert.equal(output.join("\n").includes(secret), false)
})

test("requires the endpoint argument and does not place a Keychain value in process arguments", async () => {
  const { logger, output } = loggerOutput()
  const before = [...process.argv]
  const exitCode = await main([], {
    getKeychainSecret: async () => secret,
    fetch: async () => new Response(null, { status: 204 }),
    logger,
  })

  assert.equal(exitCode, 1)
  assert.deepEqual(process.argv, before)
  assert.match(output[0], /^\d{4}-\d{2}-\d{2}T.* configuration_failure$/)
  assert.equal(output.join("\n").includes(secret), false)
})
