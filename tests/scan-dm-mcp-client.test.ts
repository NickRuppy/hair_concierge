import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { createDmMcpClient, DmMcpError } from "../src/lib/scan/enrichment/dm-mcp-client"

const table = readFileSync(
  new URL("./fixtures/dm-mcp/details-all-gtins.txt", import.meta.url),
  "utf8",
)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
function fakeServer(
  options: {
    sse?: boolean
    expire?: number
    body?: unknown
    delays?: number[]
    stall?: string
    onStall?: () => void
  } = {},
) {
  let sessions = 0
  let calls = 0
  let active = 0
  let aborted = 0
  const requests: Array<{ method: string; session: string | null; params?: unknown }> = []
  const fetcher: typeof fetch = async (_input, init) => {
    if (init?.method === "GET") return new Response(null, { status: 405 })
    const request = JSON.parse(String(init?.body))
    requests.push({
      method: request.method,
      session: new Headers(init?.headers).get("mcp-session-id"),
      params: request.params,
    })
    if (request.method === options.stall) {
      active++
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            active--
            aborted++
            reject(new DOMException("aborted", "AbortError"))
          },
          { once: true },
        )
        options.onStall?.()
      })
    }
    const responseDelay =
      options.delays?.[
        request.method === "initialize" ? 0 : request.method === "notifications/initialized" ? 1 : 2
      ] ?? 0
    if (responseDelay > 0) await delay(responseDelay)
    if (request.method === "notifications/initialized") return new Response(null, { status: 202 })
    if (request.method === "tools/call" && ++calls <= (options.expire ?? 0))
      return new Response("expired", { status: 404 })
    const result =
      request.method === "initialize"
        ? {
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "dm-test", version: "1" },
          }
        : (options.body ?? { content: [{ type: "text", text: JSON.stringify({ result: table }) }] })
    const headers: Record<string, string> = {
      "content-type": options.sse ? "text/event-stream" : "application/json",
    }
    if (request.method === "initialize") headers["mcp-session-id"] = "session-" + ++sessions
    const json = JSON.stringify({ jsonrpc: "2.0", id: request.id, result })
    return new Response(options.sse ? "event: message\ndata: " + json + "\n\n" : json, { headers })
  }
  return { fetch: fetcher, requests, counts: () => ({ sessions, calls, active, aborted }) }
}
const reason = (expected: string) => (error: unknown) =>
  error instanceof DmMcpError && error.reason === expected

test(
  "a stalled SDK close cannot hold a timeout result or leave a live request",
  { timeout: 10_000 },
  async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    let clock = 0
    let notificationStarted!: () => void
    const ready = new Promise<void>((resolve) => {
      notificationStarted = resolve
    })
    const originalClose = Client.prototype.close
    let releaseClose!: () => void
    const stalledClose = new Promise<void>((resolve) => {
      releaseClose = resolve
    })
    // Preserve real transport abort side effects; only delay completion of SDK cleanup.
    Client.prototype.close = function () {
      void originalClose.call(this).catch(() => {})
      return stalledClose
    }
    const server = fakeServer({ stall: "notifications/initialized", onStall: notificationStarted })
    try {
      let outcome = "pending"
      const lookup = createDmMcpClient({ fetch: server.fetch, deadlineMs: 30, now: () => clock })
        .getProductDetails(["4001638530378"])
        .then(
          () => "late_success",
          (error: unknown) => (error instanceof DmMcpError ? error.reason : "unexpected"),
        )
        .then((result) => {
          outcome = result
          return result
        })
      // Cold SDK setup must not consume a real-time budget before the request under test exists.
      await ready
      assert.equal(server.counts().active, 1)
      assert.equal(outcome, "pending")
      clock = 30
      t.mock.timers.tick(30)
      await new Promise<void>((resolve) => setImmediate(resolve))
      assert.equal(outcome, "timeout")
      assert.equal(server.counts().active, 0)
      assert.equal(server.counts().aborted, 1)
      assert.equal(server.counts().calls, 0)
      releaseClose()
      await new Promise<void>((resolve) => setImmediate(resolve))
      assert.equal(await lookup, "timeout")
      assert.equal(server.counts().calls, 0)
    } finally {
      releaseClose()
      Client.prototype.close = originalClose
    }
  },
)

for (const sse of [false, true])
  test(
    "official SDK accepts " +
      (sse ? "SSE" : "JSON") +
      " framing and sends only numeric GTIN arguments",
    async () => {
      const server = fakeServer({ sse })
      const rows = await createDmMcpClient({
        fetch: server.fetch,
        deadlineMs: 1000,
      }).getProductDetails(["04001638530378"])
      assert.equal(rows.length, 10)
      assert.deepEqual(
        server.requests.map((r) => r.method),
        ["initialize", "notifications/initialized", "tools/call"],
      )
      assert.deepEqual(server.requests[2].params, {
        name: "getProductDetails",
        arguments: { gtins: [4001638530378] },
      })
      assert.equal(server.requests[2].session, "session-1")
    },
  )
test("expired session reconnects once with a fresh session", async () => {
  const server = fakeServer({ expire: 1 })
  assert.equal(
    (
      await createDmMcpClient({ fetch: server.fetch, deadlineMs: 1000 }).getProductDetails([
        "4001638530378",
      ])
    ).length,
    10,
  )
  assert.deepEqual(
    server.requests.filter((r) => r.method === "tools/call").map((r) => r.session),
    ["session-1", "session-2"],
  )
})
test("two expiries return sanitized session_expired without a third attempt", async () => {
  const server = fakeServer({ expire: 2 })
  await assert.rejects(
    createDmMcpClient({ fetch: server.fetch, deadlineMs: 1000 }).getProductDetails([
      "4001638530378",
    ]),
    reason("session_expired"),
  )
  assert.equal(server.counts().sessions, 2)
})
test("absolute budget includes initialize, notification and tool call", async () => {
  const server = fakeServer({ delays: [20, 20, 30] })
  await assert.rejects(
    createDmMcpClient({ fetch: server.fetch, deadlineMs: 55 }).getProductDetails(["4001638530378"]),
    reason("timeout"),
  )
})
test(
  "a stalled initialized notification aborts at deadline and never issues tools/call",
  { timeout: 10_000 },
  async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    let clock = 0
    let notificationStarted!: () => void
    const ready = new Promise<void>((resolve) => {
      notificationStarted = resolve
    })
    const server = fakeServer({ stall: "notifications/initialized", onStall: notificationStarted })
    const lookup = createDmMcpClient({
      fetch: server.fetch,
      deadlineMs: 30,
      now: () => clock,
    }).getProductDetails(["4001638530378"])
    const rejected = assert.rejects(lookup, reason("timeout"))
    await ready
    assert.equal(server.counts().active, 1)
    clock = 30
    t.mock.timers.tick(30)
    await rejected
    assert.equal(server.counts().active, 0)
    assert.equal(server.counts().aborted, 1)
    assert.equal(server.counts().calls, 0)
  },
)
test("retry shares the original budget", async () => {
  const server = fakeServer({ expire: 1, delays: [20, 20, 90] })
  await assert.rejects(
    createDmMcpClient({ fetch: server.fetch, deadlineMs: 220 }).getProductDetails([
      "4001638530378",
    ]),
    reason("timeout"),
  )
  assert.equal(server.counts().sessions, 2)
})
test("concurrent calls on the same factory never share sessions", async () => {
  const server = fakeServer()
  const client = createDmMcpClient({ fetch: server.fetch, deadlineMs: 1000 })
  const results = await Promise.all([
    client.getProductDetails(["4001638530378"]),
    client.getProductDetails(["4262391991626"]),
  ])
  assert.deepEqual(
    results.map((r) => r.length),
    [10, 10],
  )
  assert.equal(
    new Set(server.requests.filter((r) => r.method === "tools/call").map((r) => r.session)).size,
    2,
  )
})
test("malformed table, missing JSON result and tool isError fail with sanitized errors", async () => {
  for (const body of [
    { content: [{ type: "text", text: JSON.stringify({ result: "[1]{a|b}:\n  short" }) }] },
    { content: [{ type: "text", text: "{}" }] },
    { isError: true, content: [{ type: "text", text: "SECRET PRODUCT" }] },
  ]) {
    const server = fakeServer({ body })
    await assert.rejects(
      createDmMcpClient({ fetch: server.fetch, deadlineMs: 1000 }).getProductDetails([
        "4001638530378",
      ]),
      reason("malformed"),
    )
  }
})
test("transport error contains neither original exception nor its URL", async () => {
  await assert.rejects(
    createDmMcpClient({
      fetch: async () => {
        throw new Error("https://secret.test/4001638530378")
      },
      deadlineMs: 1000,
    }).getProductDetails(["4001638530378"]),
    (error) => {
      assert.ok(error instanceof DmMcpError)
      assert.equal(error.reason, "transport")
      assert.equal(error.message, "dm lookup failed: transport")
      assert.equal(error.cause, undefined)
      return true
    },
  )
})
