import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test, { type TestContext } from "node:test"
import { createClient } from "@supabase/supabase-js"
import sharp from "sharp"
import {
  downloadRawImageCandidate,
  stageRawImageCandidate,
} from "../src/lib/product-intake/pipeline/raw-candidate-staging"
import { mockCandidateTransport } from "./fixtures/raw-candidate-transport"
import { createSupabaseClientFromEnv } from "../scripts/product-intake/cli"

const submissionId = "04832d5d-f1fe-4108-a302-93081360e58e"
const image = () =>
  sharp({ create: { width: 2, height: 2, channels: 4, background: "red" } })
    .png()
    .toBuffer()
const execution = () => ({ signal: new AbortController().signal, deadlineMs: Date.now() + 60_000 })

function offlineCliEnvironment(t: TestContext) {
  // Avoid reading the real checkout's credentials or initializing a telemetry transport.
  t.mock.method(process, "cwd", () => "/tmp/intake-offline-transport-fixture/no-env")
  for (const [key, value] of Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: "https://storage.example",
    SUPABASE_SERVICE_ROLE_KEY: "offline-key",
    NEXT_PUBLIC_SENTRY_DSN: "",
  })) {
    const previous = process.env[key]
    process.env[key] = value
    t.after(() => {
      if (previous === undefined) delete process.env[key]
      else process.env[key] = previous
    })
  }
}

test("current-pass candidate stages exact original bytes privately at the next revision", async (t) => {
  const bytes = await image()
  const transport = mockCandidateTransport(t, { responses: [{ chunks: [bytes] }] })
  const uploads: Array<{ url: string; bytes: Buffer; signal?: AbortSignal | null }> = []
  const result = await stageRawImageCandidate({
    ...execution(),
    submissionId,
    expectedRevision: 4,
    artifacts: [
      { kind: "image_candidate", payload: { image_url: "https://images.example/pack.png" } },
    ],
    createStorageClient: (signal) =>
      createClient("https://storage.example", "offline-key", {
        auth: { persistSession: false },
        global: {
          fetch: async (input, init) => {
            uploads.push({
              url: String(input),
              bytes: Buffer.from(init?.body as ArrayBuffer),
              signal,
            })
            return Response.json({ Key: "stored" })
          },
        },
      }),
  })
  assert.equal(result?.kind, "raw")
  assert.equal(result?.sha256, createHash("sha256").update(bytes).digest("hex"))
  assert.equal(result?.storage_key, `${submissionId}/5/${result?.sha256}`)
  assert.equal(uploads.length, 1)
  assert.ok(uploads[0].url.includes("/product-intake-review/"))
  assert.deepEqual(uploads[0].bytes, bytes)
  assert.equal(transport.requests[0].options.agent, false)
  assert.deepEqual(transport.requests[0].pinned, [{ address: "93.184.216.34", family: 4 }])
})

test("absence of current candidate never selects final image or other artifact evidence", async (t) => {
  const transport = mockCandidateTransport(t, { responses: [] })
  const result = await stageRawImageCandidate({
    ...execution(),
    submissionId,
    expectedRevision: 1,
    artifacts: [{ kind: "research", payload: { image_url: "https://old.example/final.png" } }],
    createStorageClient: () => {
      throw new Error("Storage must not be reached")
    },
  })
  assert.equal(result, null)
  assert.equal(transport.requests.length, 0)
})

test("unsafe URL and non-public literal destinations never open a connection", async (t) => {
  const transport = mockCandidateTransport(t, { responses: [] })
  for (const url of [
    "http://images.example/a",
    "https://user:secret@images.example/a",
    "https://images.example:8443/a",
    "file:///etc/passwd",
    "https://127.1/a",
    "https://2130706433/a",
    "https://0x7f000001/a",
    "https://10.2.3.4/a",
    "https://172.16.0.1/a",
    "https://192.168.1.1/a",
    "https://169.254.169.254/a",
    "https://100.64.1.1/a",
    "https://0.1.2.3/a",
    "https://198.18.0.1/a",
    "https://224.0.0.1/a",
    "https://[::1]/a",
    "https://[::ffff:127.0.0.1]/a",
    "https://[::ffff:8.8.8.8]/a",
    "https://[fc00::1]/a",
    "https://[fe80::1]/a",
    "https://[2001:db8::1]/a",
    "https://[2002:7f00:1::]/a",
  ])
    await assert.rejects(downloadRawImageCandidate(url, execution()), /raw_candidate_unsafe_/, url)
  assert.equal(transport.requests.length, 0)
})

test("DNS rejects any unsafe answer and pins the validated answer without re-resolution", async (t) => {
  const bytes = await image()
  const transport = mockCandidateTransport(t, {
    responses: [{ chunks: [bytes] }],
    lookup: async (host) =>
      host === "mixed.example"
        ? [
            { address: "93.184.216.34", family: 4 },
            { address: "127.0.0.1", family: 4 },
          ]
        : transport.dnsQueries.filter((name) => name === host).length === 1
          ? [{ address: "2606:4700::1111", family: 6 }]
          : [{ address: "::ffff:127.0.0.1", family: 6 }],
  })
  await assert.rejects(
    downloadRawImageCandidate("https://mixed.example/image", execution()),
    /unsafe_destination/,
  )
  const result = await downloadRawImageCandidate("https://changing.example/image", execution())
  assert.deepEqual(result.bytes, bytes)
  assert.deepEqual(transport.dnsQueries, ["mixed.example", "changing.example"])
  assert.deepEqual(transport.requests[0].pinned, [{ address: "2606:4700::1111", family: 6 }])
})

test("redirect targets repeat destination checks and cannot downgrade transport", async (t) => {
  const transport = mockCandidateTransport(t, {
    responses: [
      { status: 302, headers: { location: "https://private.example/image" } },
      { status: 307, headers: { location: "http://images.example/image" } },
      { status: 308, headers: { location: "https://secret@images.example/image" } },
    ],
    addresses: { "private.example": [{ address: "192.168.1.1", family: 4 }] },
  })
  for (let i = 0; i < 3; i++)
    await assert.rejects(
      downloadRawImageCandidate("https://images.example/redirect", execution()),
      /unsafe_/,
    )
  assert.equal(transport.requests.length, 3)
  assert.ok(transport.requests.every((request) => request.destroyed))
})

test("three validated redirects succeed and a fourth redirect fails without connecting again", async (t) => {
  const bytes = await image()
  const redirect = { status: 302, headers: { location: "/next" } }
  const transport = mockCandidateTransport(t, {
    responses: [
      redirect,
      redirect,
      redirect,
      { chunks: [bytes] },
      redirect,
      redirect,
      redirect,
      redirect,
    ],
  })
  assert.deepEqual(
    (await downloadRawImageCandidate("https://images.example/start", execution())).bytes,
    bytes,
  )
  await assert.rejects(
    downloadRawImageCandidate("https://images.example/loop", execution()),
    /redirect_limit/,
  )
  assert.equal(transport.requests.length, 8)
})

test("advertised and streamed byte bounds stop the body before decode or storage", async (t) => {
  const transport = mockCandidateTransport(t, {
    responses: [
      { headers: { "content-length": String(10 * 1024 * 1024 + 1) }, stall: true },
      { chunks: [Buffer.alloc(6 * 1024 * 1024), Buffer.alloc(5 * 1024 * 1024)], stall: true },
    ],
  })
  for (let i = 0; i < 2; i++)
    await assert.rejects(
      downloadRawImageCandidate("https://images.example/large", execution()),
      /too_large/,
    )
  assert.ok(transport.requests.every((request) => request.destroyed))
})

test("actual decoding rejects misleading content types, truncated pixels and excessive dimensions", async (t) => {
  const bytes = await image()
  const truncated = bytes.subarray(0, bytes.length - 16)
  assert.equal((await sharp(truncated).metadata()).format, "png")
  const oversized = await sharp({
    create: { width: 4001, height: 4000, channels: 3, background: "white" },
  })
    .png()
    .toBuffer()
  const transport = mockCandidateTransport(t, {
    responses: [
      {
        headers: { "content-type": "image/png" },
        chunks: [Buffer.from("<html>wrong image</html>")],
      },
      { chunks: [truncated] },
      { chunks: [oversized] },
    ],
  })
  for (let i = 0; i < 3; i++)
    await assert.rejects(
      downloadRawImageCandidate("https://images.example/image", execution()),
      /invalid_image/,
    )
  assert.equal(transport.requests.length, 3)
})

test("cancellation during DNS never opens a socket; expired or pre-aborted work never resolves DNS", async (t) => {
  const controller = new AbortController()
  let started!: () => void
  const waiting = new Promise<void>((resolve) => {
    started = resolve
  })
  const transport = mockCandidateTransport(t, {
    responses: [],
    lookup: async () => {
      started()
      return new Promise(() => {})
    },
  })
  const work = downloadRawImageCandidate("https://images.example/image", {
    ...execution(),
    signal: controller.signal,
  })
  const rejected = assert.rejects(work, /lost lease/)
  await waiting
  controller.abort(new Error("lost lease"))
  await rejected
  await assert.rejects(
    downloadRawImageCandidate("https://images.example/image", {
      signal: controller.signal,
      deadlineMs: Date.now() + 1_000,
    }),
    /lost lease/,
  )
  await assert.rejects(
    downloadRawImageCandidate("https://images.example/image", {
      ...execution(),
      deadlineMs: Date.now() - 1,
    }),
    /deadline_exceeded/,
  )
  assert.equal(transport.dnsQueries.length, 1)
  assert.equal(transport.requests.length, 0)
})

test("body cancellation destroys the active request and never stages an asset", async (t) => {
  const transport = mockCandidateTransport(t, {
    responses: [{ chunks: [Buffer.from("pending")], stall: true }],
  })
  const controller = new AbortController()
  const work = stageRawImageCandidate({
    ...execution(),
    signal: controller.signal,
    submissionId,
    expectedRevision: 2,
    artifacts: [
      { kind: "image_candidate", payload: { image_url: "https://images.example/image" } },
    ],
    createStorageClient: () => {
      throw new Error("Storage must not be reached")
    },
  })
  const rejected = assert.rejects(work, /lost lease/)
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.equal(transport.requests.length, 1)
  controller.abort(new Error("lost lease"))
  await rejected
  assert.equal(transport.requests[0].destroyed, true)
})

test("both the current deadline and the 30-second stage ceiling abort pending HTTP", async (t) => {
  const transport = mockCandidateTransport(t, { responses: [{ stall: true }, { stall: true }] })
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] })
  for (const [remaining, expected] of [
    [1_000, 1_000],
    [60_000, 30_000],
  ]) {
    const work = downloadRawImageCandidate("https://images.example/image", {
      ...execution(),
      deadlineMs: Date.now() + remaining,
    })
    const rejected = assert.rejects(work, /deadline_exceeded/)
    await new Promise<void>((resolve) => setImmediate(resolve))
    t.mock.timers.tick(expected)
    await rejected
  }
  assert.ok(transport.requests.every((request) => request.destroyed))
})

test("storage receives the shared lifetime and an aborted upload cannot return a manifest", async (t) => {
  const bytes = await image()
  mockCandidateTransport(t, { responses: [{ chunks: [bytes] }] })
  const controller = new AbortController()
  let uploadStarted!: () => void
  const started = new Promise<void>((resolve) => {
    uploadStarted = resolve
  })
  let storageSignal: AbortSignal | undefined
  offlineCliEnvironment(t)
  t.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    storageSignal = init?.signal ?? undefined
    uploadStarted()
    return new Promise<Response>((_resolve, reject) =>
      storageSignal!.addEventListener("abort", () => reject(storageSignal!.reason), { once: true }),
    )
  })
  const work = stageRawImageCandidate({
    ...execution(),
    signal: controller.signal,
    submissionId,
    expectedRevision: 2,
    artifacts: [
      { kind: "image_candidate", payload: { image_url: "https://images.example/image" } },
    ],
    createStorageClient: (signal) => createSupabaseClientFromEnv({ signal }),
  })
  const rejected = assert.rejects(work, /lost lease/)
  await started
  controller.abort(new Error("lost lease"))
  await rejected
  assert.equal(storageSignal?.aborted, true)
})

test("scoped CLI transport preserves the individual request's cancellation too", async (t) => {
  offlineCliEnvironment(t)
  const scope = new AbortController()
  const individual = new AbortController()
  let received: AbortSignal | undefined
  t.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    received = init?.signal ?? undefined
    return Response.json([])
  })
  const client = createSupabaseClientFromEnv({ signal: scope.signal })
  await client.from("offline_table").select("id").abortSignal(individual.signal)
  assert.ok(received)
  assert.equal(received.aborted, false)
  individual.abort(new Error("individual request cancelled"))
  assert.equal(received.aborted, true)
  assert.equal(scope.signal.aborted, false)
})
