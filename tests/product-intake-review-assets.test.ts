import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { createServer } from "node:http"
import test, { type TestContext } from "node:test"
import { createClient } from "@supabase/supabase-js"
import sharp from "sharp"
import {
  uploadProductReviewAsset,
  signProductReviewAsset,
} from "../src/lib/product-intake/review-assets"

async function storageFixture(t: TestContext) {
  const objects = new Map<string, Buffer>()
  const requests: Array<{ method: string; path: string; upsert?: string; body: Buffer }> = []
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const body = Buffer.concat(chunks)
    const path = new URL(req.url!, "http://fixture").pathname
    requests.push({ method: req.method!, path, upsert: req.headers["x-upsert"] as string, body })
    const json = (value: unknown, status = 200) => {
      res.writeHead(status, { "content-type": "application/json" })
      res.end(JSON.stringify(value))
    }
    if (path.startsWith("/storage/v1/object/sign/"))
      return json({ signedURL: "/object/sign/private?token=test" })
    const key = path.replace(/^\/storage\/v1\/object\/(?:authenticated\/)?/, "")
    if (req.method === "POST") {
      if (objects.has(key))
        return json({ statusCode: "409", error: "Duplicate", message: "exists" }, 409)
      objects.set(key, body)
      return json({ Key: key })
    }
    if (req.method === "GET" && objects.has(key)) {
      res.end(objects.get(key))
      return
    }
    return json({ message: "missing", statusCode: "404" }, 404)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(() => {
    server.closeAllConnections()
    return new Promise<void>((resolve) => server.close(() => resolve()))
  })
  const port = (server.address() as { port: number }).port
  const client = createClient(`http://127.0.0.1:${port}`, "offline-service-role", {
    auth: { persistSession: false },
  })
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 4, background: "red" } })
    .png()
    .toBuffer()
  return { client, bytes, objects, requests, submissionId: randomUUID() }
}

test("private uploads preserve exact bytes and verify identical objects without overwriting", async (t) => {
  const f = await storageFixture(t)
  const params = {
    client: f.client,
    bytes: f.bytes,
    submissionId: f.submissionId,
    payloadRevision: 2,
    kind: "final" as const,
  }
  const first = await uploadProductReviewAsset(params)
  const second = await uploadProductReviewAsset({ ...params, kind: "neutral" })
  assert.equal(first.sha256, createHash("sha256").update(f.bytes).digest("hex"))
  assert.equal(first.storage_key, `${f.submissionId}/2/${first.sha256}`)
  assert.equal(first.media_type, "image/png")
  assert.equal(second.storage_key, first.storage_key)
  assert.equal(f.objects.size, 1)
  assert.deepEqual([...f.objects.values()][0], f.bytes)
  assert.ok(f.requests.filter((r) => r.method === "POST").every((r) => r.upsert === "false"))
  assert.equal(f.requests.filter((r) => r.method === "GET").length, 1)
})

test("conflicting duplicate bytes and invalid identities never produce a manifest", async (t) => {
  const f = await storageFixture(t)
  const params = {
    client: f.client,
    bytes: f.bytes,
    submissionId: f.submissionId,
    payloadRevision: 1,
    kind: "raw" as const,
  }
  const first = await uploadProductReviewAsset(params)
  f.objects.set(`product-intake-review/${first.storage_key}`, Buffer.from("corrupt"))
  await assert.rejects(uploadProductReviewAsset(params), /review_asset_bytes_conflict/)
  const count = f.requests.length
  await assert.rejects(
    uploadProductReviewAsset({ ...params, submissionId: "../other" }),
    /invalid_review_asset_identity/,
  )
  await assert.rejects(
    uploadProductReviewAsset({ ...params, payloadRevision: 0 }),
    /invalid_review_asset_identity/,
  )
  await assert.rejects(
    uploadProductReviewAsset({ ...params, bytes: Buffer.from("<html>not an image</html>") }),
  )
  assert.equal(f.requests.length, count)
})

test("signing binds exact committed identity and revision before calling Storage", async (t) => {
  const f = await storageFixture(t)
  const input = await uploadProductReviewAsset({ ...f, payloadRevision: 3, kind: "magenta" })
  const asset = {
    ...input,
    id: randomUUID(),
    submission_id: f.submissionId,
    payload_revision: 3,
    job_id: randomUUID(),
    created_at: new Date().toISOString(),
  }
  const params = { client: f.client, asset, submissionId: f.submissionId, payloadRevision: 3 }
  await assert.rejects(
    signProductReviewAsset({ ...params, payloadRevision: 4 }),
    /stale_or_invalid_review_asset/,
  )
  await assert.rejects(
    signProductReviewAsset({ ...params, asset: { ...asset, storage_key: "../other" } }),
    /stale_or_invalid_review_asset/,
  )
  const url = await signProductReviewAsset(params)
  assert.ok(url.startsWith("http://127.0.0.1:"))
  const signatures = f.requests.filter((r) => r.path.includes("/sign/"))
  assert.equal(signatures.length, 1)
  assert.deepEqual(JSON.parse(signatures[0].body.toString()), { expiresIn: 300 })
})
