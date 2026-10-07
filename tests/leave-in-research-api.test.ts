import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

const mutableEnv = process.env as Record<string, string | undefined>

async function importQueueRoute() {
  return import("../src/app/api/labs/leave-in-research/queue/route")
}

async function importReviewRoute() {
  return import("../src/app/api/labs/leave-in-research/review/route")
}

async function withNodeEnv(value: string, run: () => Promise<void>) {
  const previous = mutableEnv.NODE_ENV
  mutableEnv.NODE_ENV = value
  try {
    await run()
  } finally {
    mutableEnv.NODE_ENV = previous
  }
}

async function withReviewStore(run: (directory: string) => Promise<void>) {
  const directory = mkdtempSync(path.join(tmpdir(), "leave-in-lab-api-"))
  const previousReview = mutableEnv.LEAVE_IN_RESEARCH_LAB_REVIEW_STATE_PATH
  const previousRework = mutableEnv.LEAVE_IN_RESEARCH_LAB_REWORK_QUEUE_PATH
  mutableEnv.LEAVE_IN_RESEARCH_LAB_REVIEW_STATE_PATH = path.join(directory, "lab-review-state.json")
  mutableEnv.LEAVE_IN_RESEARCH_LAB_REWORK_QUEUE_PATH = path.join(directory, "rework-queue.json")
  try {
    await withNodeEnv("development", () => run(directory))
  } finally {
    if (previousReview === undefined) delete mutableEnv.LEAVE_IN_RESEARCH_LAB_REVIEW_STATE_PATH
    else mutableEnv.LEAVE_IN_RESEARCH_LAB_REVIEW_STATE_PATH = previousReview
    if (previousRework === undefined) delete mutableEnv.LEAVE_IN_RESEARCH_LAB_REWORK_QUEUE_PATH
    else mutableEnv.LEAVE_IN_RESEARCH_LAB_REWORK_QUEUE_PATH = previousRework
    rmSync(directory, { recursive: true, force: true })
  }
}

test("Leave-In queue API is closed outside development", async () =>
  withNodeEnv("production", async () => {
    const { GET } = await importQueueRoute()
    const response = await GET(new Request("http://localhost/api/labs/leave-in-research/queue"))
    assert.equal(response.status, 404)
  }))

test("Leave-In review API is closed outside development", async () =>
  withNodeEnv("production", async () => {
    const { handleLeaveInResearchReviewRequest } = await importReviewRoute()
    const response = await handleLeaveInResearchReviewRequest({
      body: { action: "approve_product", itemId: "whatever" },
      environment: { NODE_ENV: "production" },
    })
    assert.equal(response.status, 404)
  }))

test("Leave-In queue API returns the queue and the selected detail in development", async () =>
  withReviewStore(async () => {
    const { GET } = await importQueueRoute()
    const listResponse = await GET(new Request("http://localhost/api/labs/leave-in-research/queue"))
    assert.equal(listResponse.status, 200)
    const list = await listResponse.json()
    const data: import("../src/lib/labs/leave-in-research-access").LeaveInResearchLabData = list
    // Batch 1 (gold-set, 13) + Batch 2 (unseen-test, 6) = 19.
    assert.equal(data.summary.products, 19)
    assert.equal(data.queueItems.length, 19)
    // gold-set: 11 in-category + 2 excluded. unseen-test: 4 in-category
    // (u1, u4, u5, u6) + 2 excluded (u2, u3). See unseen-test-report.md.
    assert.equal(data.summary.inCategory, 15)
    assert.equal(data.summary.excluded, 4)
    assert.equal(data.summary.reviewCounts.needsReview, 19)
    // Approval persistence key: kept at the v1.0-fixture stamp so approvals survive.
    assert.equal(data.meta.standardVersion, "leave-in-inci-v0.4")
    // The visible standard is the effective one (v1.1 = v1.0 + T20 overlay).
    assert.equal(data.meta.effectiveStandard, "leave-in-inci-v1.1 (Standard v1.0 + T20-Overlay)")
    assert.equal(
      data.meta.effectiveStandardOverlay,
      "docs/research/leave-in-inci/v1.1/leave-in-classification-overlay.v1.1.md",
    )
    assert.equal(data.initialDetail.effectiveStandard, data.meta.effectiveStandard)
    assert.equal(data.meta.keyVersion, "reference-key-2026-09-05-r4")
    assert.equal(data.meta.derivedFromRun, "reference-key-2026-09-04-r3")

    const goldSet = data.queueItems.filter((item) => item.batch === "gold-set")
    const unseenTest = data.queueItems.filter((item) => item.batch === "unseen-test")
    assert.equal(goldSet.length, 13)
    assert.equal(unseenTest.length, 6)
    assert.deepEqual(
      goldSet.map((item) => item.slot),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    )
    assert.deepEqual(
      unseenTest.map((item) => item.slot),
      [14, 15, 16, 17, 18, 19],
    )
    assert.equal(goldSet.filter((item) => item.excluded).length, 2)
    assert.equal(unseenTest.filter((item) => item.excluded).length, 2)
    for (const item of unseenTest)
      assert.ok(item.productId.startsWith("unseen-0"), `${item.productId} missing unseen-0N prefix`)
    assert.equal(list.queueItems.length, 19)
    assert.equal(list.detail.productId, list.initialDetail.productId)

    const targetId = list.queueItems[1].productId as string
    const detailResponse = await GET(
      new Request(
        `http://localhost/api/labs/leave-in-research/queue?productId=${encodeURIComponent(targetId)}`,
      ),
    )
    assert.equal(detailResponse.status, 200)
    assert.equal((await detailResponse.json()).detail.productId, targetId)

    const missing = await GET(
      new Request("http://localhost/api/labs/leave-in-research/queue?itemId=unknown"),
    )
    assert.equal(missing.status, 404)
  }))

test("Leave-In review API rejects an invalid payload", async () =>
  withReviewStore(async () => {
    const { handleLeaveInResearchReviewRequest } = await importReviewRoute()
    const response = await handleLeaveInResearchReviewRequest({
      body: { action: "request_rework", itemId: "x" },
    })
    assert.equal(response.status, 400)
  }))

test("Leave-In review API transitions a property to rework and back to approved", async () =>
  withReviewStore(async (directory) => {
    const { GET } = await importQueueRoute()
    const { handleLeaveInResearchReviewRequest } = await importReviewRoute()
    const list = await (
      await GET(new Request("http://localhost/api/labs/leave-in-research/queue"))
    ).json()
    const target = (list.queueItems as Array<{ productId: string; excluded: boolean }>).find(
      (item) => !item.excluded,
    )!
    const propertyPath = "dimension.weight_residue_potential"

    const rework = await handleLeaveInResearchReviewRequest({
      body: {
        action: "request_rework",
        itemId: target.productId,
        propertyPath,
        comment: "Bitte Gewichtsschwelle erneut begründen.",
      },
    })
    assert.equal(rework.status, 200)
    const reworkBody = await rework.json()
    assert.equal(reworkBody.detail.reviewStatus, "rework_open")
    assert.equal(reworkBody.detail.propertyStatuses[propertyPath], "rework_open")
    assert.equal(reworkBody.detail.canApproveProduct, false)

    const queuePath = path.join(directory, "rework-queue.json")
    assert.ok(existsSync(queuePath))
    const queue = JSON.parse(readFileSync(queuePath, "utf8"))
    assert.equal(
      queue.entries.filter((entry: { status: string }) => entry.status === "open").length,
      1,
    )

    const approve = await handleLeaveInResearchReviewRequest({
      body: { action: "approve_property", itemId: target.productId, propertyPath },
    })
    assert.equal(approve.status, 200)
    const approveBody = await approve.json()
    assert.equal(approveBody.detail.propertyStatuses[propertyPath], "approved")
    assert.equal(approveBody.detail.reviewStatus, "needs_review")
    const resolved = JSON.parse(readFileSync(queuePath, "utf8"))
    assert.equal(
      resolved.entries.filter((entry: { status: string }) => entry.status === "open").length,
      0,
    )

    // product approval bulk-approves the remaining open properties (conditioner-lab semantics)
    const bulk = await handleLeaveInResearchReviewRequest({
      body: { action: "approve_product", itemId: target.productId },
    })
    assert.equal(bulk.status, 200)
    const bulkBody = await bulk.json()
    assert.equal(bulkBody.detail.reviewStatus, "approved")
    assert.ok(
      Object.values(bulkBody.detail.propertyStatuses as Record<string, string>).every(
        (status) => status === "approved",
      ),
    )
  }))

test("Leave-In review API confirms a G0 exclusion and refuses product approval for it", async () =>
  withReviewStore(async () => {
    const { GET } = await importQueueRoute()
    const { handleLeaveInResearchReviewRequest } = await importReviewRoute()
    const list = await (
      await GET(new Request("http://localhost/api/labs/leave-in-research/queue"))
    ).json()
    const excluded = (list.queueItems as Array<{ productId: string; excluded: boolean }>).find(
      (item) => item.excluded,
    )!

    const productApproval = await handleLeaveInResearchReviewRequest({
      body: { action: "approve_product", itemId: excluded.productId },
    })
    assert.equal(productApproval.status, 409)

    const boundary = await handleLeaveInResearchReviewRequest({
      body: { action: "approve_boundary", itemId: excluded.productId },
    })
    assert.equal(boundary.status, 200)
    const body = await boundary.json()
    assert.equal(body.detail.reviewStatus, "excluded")
    assert.equal(body.detail.propertyStatuses.g0, "approved")
    assert.equal(body.detail.canApproveBoundary, false)
    assert.equal(body.data.summary.reviewCounts.excluded, 1)

    const repeat = await handleLeaveInResearchReviewRequest({
      body: { action: "approve_boundary", itemId: excluded.productId },
    })
    assert.equal(repeat.status, 409)
  }))

test("Leave-In review API rejects an unknown product and an unknown property", async () =>
  withReviewStore(async () => {
    const { GET } = await importQueueRoute()
    const { handleLeaveInResearchReviewRequest } = await importReviewRoute()
    const list = await (
      await GET(new Request("http://localhost/api/labs/leave-in-research/queue"))
    ).json()
    const target = list.queueItems[0].productId as string

    assert.equal(
      (
        await handleLeaveInResearchReviewRequest({
          body: { action: "approve_product", itemId: "nope" },
        })
      ).status,
      404,
    )
    assert.equal(
      (
        await handleLeaveInResearchReviewRequest({
          body: { action: "approve_property", itemId: target, propertyPath: "dimension.nope" },
        })
      ).status,
      404,
    )
  }))
