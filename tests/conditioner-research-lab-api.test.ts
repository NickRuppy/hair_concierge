import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

const mutableEnv = process.env as Record<string, string | undefined>

async function importRoute() {
  return import("../src/app/api/labs/conditioner-research/queue/route")
}

async function importReviewRoute() {
  return import("../src/app/api/labs/conditioner-research/review/route")
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
  const directory = mkdtempSync(path.join(tmpdir(), "conditioner-lab-api-"))
  const previousReviewPath = mutableEnv.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH
  const previousReworkPath = mutableEnv.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH
  mutableEnv.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH = path.join(
    directory,
    "lab-review-state.json",
  )
  mutableEnv.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH = path.join(directory, "rework-queue.json")
  try {
    await withNodeEnv("development", () => run(directory))
  } finally {
    if (previousReviewPath === undefined)
      delete mutableEnv.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH
    else mutableEnv.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH = previousReviewPath
    if (previousReworkPath === undefined)
      delete mutableEnv.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH
    else mutableEnv.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH = previousReworkPath
    rmSync(directory, { recursive: true, force: true })
  }
}

test("Conditioner research queue API is closed outside development", async () =>
  withNodeEnv("production", async () => {
    const { GET } = await importRoute()
    const response = await GET(new Request("http://localhost/api/labs/conditioner-research/queue"))
    assert.equal(response.status, 404)
  }))

test("Conditioner research queue API returns the queue and selected detail in development", async () =>
  withNodeEnv("development", async () => {
    const { GET } = await importRoute()
    const response = await GET(
      new Request(
        "http://localhost/api/labs/conditioner-research/queue?productId=8182ee3f-cfe9-4a31-8b2f-a6a52c7e7abe",
      ),
    )
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.queueItems.length, 12)
    assert.equal("rinseForecasts" in body.summary, false)
    assert.equal(body.summary.sourceConflicts, 0)
    assert.equal(body.detail.productId, "8182ee3f-cfe9-4a31-8b2f-a6a52c7e7abe")
    assert.equal(body.detail.sourceConflict, false)
  }))

test("Conditioner research queue API rejects an unknown product", async () =>
  withNodeEnv("development", async () => {
    const { GET } = await importRoute()
    const response = await GET(
      new Request("http://localhost/api/labs/conditioner-research/queue?itemId=unknown"),
    )
    assert.equal(response.status, 404)
  }))

test("Conditioner research queue API blocks review when stored state is malformed", async () =>
  withReviewStore(async (directory) => {
    writeFileSync(path.join(directory, "lab-review-state.json"), "{not-json", "utf8")
    const { GET } = await importRoute()
    const response = await GET(new Request("http://localhost/api/labs/conditioner-research/queue"))
    assert.equal(response.status, 500)
    assert.match(JSON.stringify(await response.json()), /konnten nicht geladen werden/i)
  }))

test("Conditioner research queue API blocks review when the state path is not a file", async () =>
  withReviewStore(async (directory) => {
    mutableEnv.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH = directory
    const { GET } = await importRoute()
    const response = await GET(new Request("http://localhost/api/labs/conditioner-research/queue"))
    assert.equal(response.status, 500)
    assert.match(JSON.stringify(await response.json()), /konnten nicht geladen werden/i)
  }))

test("Conditioner review API persists targeted rework and resolves it after property approval", async () =>
  withReviewStore(async (directory) => {
    const { handleConditionerResearchReviewRequest } = await importReviewRoute()
    const invalid = await handleConditionerResearchReviewRequest({
      body: {
        action: "request_rework",
        itemId: "952a4834-e451-4dc3-ba19-ebb8927eb5e4",
        propertyPath: "weight_potential",
        comment: "",
      },
      environment: { NODE_ENV: "development" },
    })
    assert.equal(invalid.status, 400)

    const requested = await handleConditionerResearchReviewRequest({
      body: {
        action: "request_rework",
        itemId: "952a4834-e451-4dc3-ba19-ebb8927eb5e4",
        propertyPath: "weight_potential",
        comment: "Bitte Gewichtslogik erneut gegen die exakte Formel prüfen.",
      },
      environment: { NODE_ENV: "development" },
    })
    assert.equal(requested.status, 200)
    const requestedBody = await requested.json()
    assert.equal(requestedBody.detail.reviewStatus, "rework_open")
    assert.equal(requestedBody.detail.propertyStatuses.weight_potential, "rework_open")
    assert.equal(requestedBody.detail.canApproveProduct, false)
    assert.match(readFileSync(path.join(directory, "rework-queue.json"), "utf8"), /Gewichtslogik/)

    const blockedProductApproval = await handleConditionerResearchReviewRequest({
      body: {
        action: "approve_product",
        itemId: "952a4834-e451-4dc3-ba19-ebb8927eb5e4",
      },
      environment: { NODE_ENV: "development" },
    })
    assert.equal(blockedProductApproval.status, 409)
    const blockedProductApprovalBody = await blockedProductApproval.json()
    assert.match(JSON.stringify(blockedProductApprovalBody), /Rework/i)
    assert.match(
      readFileSync(path.join(directory, "rework-queue.json"), "utf8"),
      /"status": "open"/,
    )

    const approved = await handleConditionerResearchReviewRequest({
      body: {
        action: "approve_property",
        itemId: "952a4834-e451-4dc3-ba19-ebb8927eb5e4",
        propertyPath: "weight_potential",
      },
      environment: { NODE_ENV: "development" },
    })
    assert.equal(approved.status, 200)
    const approvedBody = await approved.json()
    assert.equal(approvedBody.detail.propertyStatuses.weight_potential, "approved")
    assert.match(
      readFileSync(path.join(directory, "rework-queue.json"), "utf8"),
      /"status": "resolved"/,
    )
  }))

test("Conditioner review API atomically approves all nine comparative fields and confirms G0 separately", async () =>
  withReviewStore(async () => {
    const { handleConditionerResearchReviewRequest } = await importReviewRoute()
    const approved = await handleConditionerResearchReviewRequest({
      body: {
        action: "approve_product",
        itemId: "8182ee3f-cfe9-4a31-8b2f-a6a52c7e7abe",
      },
      environment: { NODE_ENV: "development" },
    })
    assert.equal(approved.status, 200)
    const approvedBody = await approved.json()
    assert.equal(approvedBody.detail.reviewStatus, "approved")
    assert.equal(Object.values(approvedBody.detail.propertyStatuses).length, 9)
    assert.equal("usage_role" in approvedBody.detail.propertyStatuses, false)
    assert.equal("scalp_application_fit" in approvedBody.detail.propertyStatuses, false)
    assert.equal(
      Object.values(approvedBody.detail.propertyStatuses).every((status) => status === "approved"),
      true,
    )
    assert.equal(approvedBody.data.summary.reviewCounts.approved, 1)

    const stalePropertyApproval = await handleConditionerResearchReviewRequest({
      body: {
        action: "approve_property",
        itemId: "8182ee3f-cfe9-4a31-8b2f-a6a52c7e7abe",
        propertyPath: "damage_fit",
      },
      environment: { NODE_ENV: "development" },
    })
    assert.equal(stalePropertyApproval.status, 409)
    assert.match(JSON.stringify(await stalePropertyApproval.json()), /bereits freigegeben/i)

    const duplicateProductApproval = await handleConditionerResearchReviewRequest({
      body: {
        action: "approve_product",
        itemId: "8182ee3f-cfe9-4a31-8b2f-a6a52c7e7abe",
      },
      environment: { NODE_ENV: "development" },
    })
    assert.equal(duplicateProductApproval.status, 409)
    assert.match(JSON.stringify(await duplicateProductApproval.json()), /bereits freigegeben/i)

    const blockedProfile = await handleConditionerResearchReviewRequest({
      body: {
        action: "approve_product",
        itemId: "7539ab79-f4f6-49d7-9269-08034ef4de96",
      },
      environment: { NODE_ENV: "development" },
    })
    assert.equal(blockedProfile.status, 409)

    const boundary = await handleConditionerResearchReviewRequest({
      body: {
        action: "approve_boundary",
        itemId: "7539ab79-f4f6-49d7-9269-08034ef4de96",
      },
      environment: { NODE_ENV: "development" },
    })
    assert.equal(boundary.status, 200)
    const boundaryBody = await boundary.json()
    assert.equal(boundaryBody.detail.reviewStatus, "excluded")
    assert.equal(boundaryBody.data.summary.reviewCounts.excluded, 1)
  }))

test("Conditioner review API derives a sibling rework queue from a custom review-state path", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "conditioner-lab-api-derived-queue-"))
  const previousReviewPath = mutableEnv.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH
  const previousReworkPath = mutableEnv.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH
  mutableEnv.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH = path.join(
    directory,
    "lab-review-state.json",
  )
  delete mutableEnv.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH
  try {
    await withNodeEnv("development", async () => {
      const { handleConditionerResearchReviewRequest } = await importReviewRoute()
      const response = await handleConditionerResearchReviewRequest({
        body: {
          action: "request_rework",
          itemId: "952a4834-e451-4dc3-ba19-ebb8927eb5e4",
          propertyPath: "weight_potential",
          comment: "Persist this handoff beside the custom review state.",
        },
        environment: { NODE_ENV: "development" },
      })
      assert.equal(response.status, 200)
      assert.match(
        readFileSync(path.join(directory, "rework-queue.json"), "utf8"),
        /Persist this handoff/,
      )
    })
  } finally {
    if (previousReviewPath === undefined)
      delete mutableEnv.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH
    else mutableEnv.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH = previousReviewPath
    if (previousReworkPath === undefined)
      delete mutableEnv.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH
    else mutableEnv.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH = previousReworkPath
    rmSync(directory, { recursive: true, force: true })
  }
})

test("Conditioner review API returns a persistence error without reporting optimistic success", async () =>
  withReviewStore(async (directory) => {
    const blockingFile = path.join(directory, "not-a-directory")
    writeFileSync(blockingFile, "blocks nested persistence", "utf8")
    mutableEnv.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH = path.join(
      blockingFile,
      "lab-review-state.json",
    )
    const { handleConditionerResearchReviewRequest } = await importReviewRoute()
    const response = await handleConditionerResearchReviewRequest({
      body: {
        action: "approve_property",
        itemId: "952a4834-e451-4dc3-ba19-ebb8927eb5e4",
        propertyPath: "weight_potential",
      },
      environment: { NODE_ENV: "development" },
    })
    assert.equal(response.status, 500)
    assert.match(JSON.stringify(await response.json()), /nicht dauerhaft gespeichert/)
  }))

test("Conditioner review API rolls back review state when the rework handoff cannot persist", async () =>
  withReviewStore(async (directory) => {
    const reviewPath = path.join(directory, "lab-review-state.json")
    const reworkPath = path.join(directory, "rework-queue.json")
    writeFileSync(reworkPath, "{ malformed", "utf8")
    const { handleConditionerResearchReviewRequest } = await importReviewRoute()
    const response = await handleConditionerResearchReviewRequest({
      body: {
        action: "request_rework",
        itemId: "952a4834-e451-4dc3-ba19-ebb8927eb5e4",
        propertyPath: "weight_potential",
        comment: "Bitte Gewichtslogik erneut prüfen.",
      },
      environment: { NODE_ENV: "development" },
    })
    assert.equal(response.status, 500)
    assert.equal(existsSync(reviewPath), false)
    assert.equal(readFileSync(reworkPath, "utf8"), "{ malformed")
  }))

test("Conditioner review API restores existing decisions when a later handoff cannot persist", async () =>
  withReviewStore(async (directory) => {
    const reviewPath = path.join(directory, "lab-review-state.json")
    const reworkPath = path.join(directory, "rework-queue.json")
    const { handleConditionerResearchReviewRequest } = await importReviewRoute()
    const firstDecision = await handleConditionerResearchReviewRequest({
      body: {
        action: "approve_property",
        itemId: "952a4834-e451-4dc3-ba19-ebb8927eb5e4",
        propertyPath: "conditioning_level",
      },
      environment: { NODE_ENV: "development" },
    })
    assert.equal(firstDecision.status, 200)
    const savedBeforeFailure = readFileSync(reviewPath, "utf8")
    writeFileSync(reworkPath, "{ malformed", "utf8")

    const failedDecision = await handleConditionerResearchReviewRequest({
      body: {
        action: "request_rework",
        itemId: "952a4834-e451-4dc3-ba19-ebb8927eb5e4",
        propertyPath: "weight_potential",
        comment: "Bitte Gewichtslogik erneut prüfen.",
      },
      environment: { NODE_ENV: "development" },
    })
    assert.equal(failedDecision.status, 500)
    assert.equal(readFileSync(reviewPath, "utf8"), savedBeforeFailure)
    assert.equal(readFileSync(reworkPath, "utf8"), "{ malformed")
  }))
