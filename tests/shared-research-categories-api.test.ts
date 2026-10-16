import assert from "node:assert/strict"
import { after, test } from "node:test"
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Exercise the shared transport against native loaders and stores without changing checkout artifacts.
const repo = process.cwd()
const directory = mkdtempSync(join(tmpdir(), "shared-research-categories-api-"))
for (const source of [
  "plans/scan-db-expansion/research/shampoo-v14/pilot",
  "data/research/conditioner-inci/v1.0",
  "data/research/leave-in-inci/v1.0",
  "data/research/leave-in-inci/v1.1",
  "data/research/leave-in-inci/v1.2",
]) {
  cpSync(join(repo, source), join(directory, source), { recursive: true })
}
const environment = {
  node: process.env.NODE_ENV,
  conditioner: process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH,
  conditionerQueue: process.env.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH,
  leaveIn: process.env.LEAVE_IN_RESEARCH_LAB_REVIEW_STATE_PATH,
  leaveInQueue: process.env.LEAVE_IN_RESEARCH_LAB_REWORK_QUEUE_PATH,
}
Object.assign(process.env, {
  NODE_ENV: "development",
  CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH: join(directory, "conditioner-review-state.json"),
  CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH: join(directory, "conditioner-rework-queue.json"),
  LEAVE_IN_RESEARCH_LAB_REVIEW_STATE_PATH: join(directory, "leave-in-review-state.json"),
  LEAVE_IN_RESEARCH_LAB_REWORK_QUEUE_PATH: join(directory, "leave-in-rework-queue.json"),
})
process.chdir(directory)
const routes = Promise.all([
  import("../src/app/api/labs/research/queue/route"),
  import("../src/app/api/labs/research/review/route"),
])

after(() => {
  process.chdir(repo)
  for (const [key, value] of [
    ["NODE_ENV", environment.node],
    ["CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH", environment.conditioner],
    ["CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH", environment.conditionerQueue],
    ["LEAVE_IN_RESEARCH_LAB_REVIEW_STATE_PATH", environment.leaveIn],
    ["LEAVE_IN_RESEARCH_LAB_REWORK_QUEUE_PATH", environment.leaveInQueue],
  ] as const) {
    if (value === undefined) delete process.env[key]
    else (process.env as Record<string, string | undefined>)[key] = value
  }
  rmSync(directory, { recursive: true, force: true })
})

type LabData = import("../src/lib/labs/research/model").ResearchLabData

async function read(
  category: "shampoo" | "conditioner" | "leave-in",
  itemId?: string,
  dataset = category === "shampoo" ? "pilot" : "default",
) {
  const [queue] = await routes
  const search = new URLSearchParams({ category })
  search.set("dataset", dataset)
  if (itemId) search.set("itemId", itemId)
  const response = await queue.GET(
    new Request(`http://localhost/api/labs/research/queue?${search}`),
  )
  assert.equal(response.status, 200)
  return (await response.json()).data as LabData
}

async function submit(data: LabData, actionId: string, comment?: string) {
  const [, review] = await routes
  return review.POST(
    new Request("http://localhost/api/labs/research/review", {
      method: "POST",
      body: JSON.stringify({
        category: data.category,
        dataset: data.dataset,
        itemId: data.detail.id,
        displayFingerprint: data.detail.displayFingerprint,
        actionId,
        ...(comment ? { comment } : {}),
      }),
    }),
  )
}

function action(data: LabData, id: string) {
  const found = [
    ...data.detail.actions,
    ...data.detail.properties.flatMap((property) => property.actions),
  ].find((candidate) => candidate.id === id)
  assert.ok(found, `expected shared action ${id}`)
  return found
}

async function saved(response: Response): Promise<LabData> {
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.saved, true)
  return body.data as LabData
}

async function shampooScenario() {
  let data = await read("shampoo")
  assert.equal(data.queue.length, 5)
  assert.equal((await read("shampoo", undefined, "wave-01")).queue.length, 5)
  assert.equal((await read("shampoo", undefined, "wave-02")).queue.length, 4)
  assert.equal(data.detail.properties.filter((property) => property.group === undefined).length, 8)
  assert.equal(action(data, "complete").enabled, false)

  const beforeFormulaApproval = data
  data = await saved(await submit(data, action(data, "approve:formula").id))
  assert.equal(
    data.detail.properties.find((property) => property.id === "formula")!.status,
    "approved",
  )

  const stale = await submit(beforeFormulaApproval, "approve:cleansingStrength")
  assert.equal(stale.status, 409)

  for (const property of data.detail.properties.filter((entry) => entry.group === undefined)) {
    data = await read("shampoo", data.detail.id)
    data = await saved(await submit(data, action(data, `approve:${property.id}`).id))
  }
  data = await read("shampoo", data.detail.id)
  data = await saved(await submit(data, action(data, "approve:projection").id))
  assert.equal(action(data, "complete").enabled, true)
  data = await saved(await submit(data, action(data, "complete").id))
  assert.equal(data.detail.status, "approved")
  assert.ok(
    existsSync(
      join(directory, "plans/scan-db-expansion/research/shampoo-v14/pilot/review-state.json"),
    ),
  )
}

async function conditionerScenario() {
  let data = await read("conditioner")
  assert.equal(data.queue.length, 12)
  assert.equal(data.detail.properties.length, 9)
  for (const property of data.detail.properties) {
    assert.equal(property.confidence, null)
    assert.deepEqual(
      property.lanes.map((lane) => lane.id),
      ["K", "G"],
    )
    assert.equal(
      property.lanes.every((lane) => lane.comparable === false),
      true,
    )
  }

  const property = data.detail.properties[0]!
  const reworkAction = property.actions.find((candidate) => candidate.kind === "rework")
  assert.ok(reworkAction)
  const beforeRework = data
  data = await saved(await submit(data, reworkAction.id, "Bitte die Feldbegründung erneut prüfen."))
  assert.equal((await submit(beforeRework, `approve:${property.id}`)).status, 409)
  assert.equal(data.detail.status, "rework")
  assert.ok(existsSync(join(directory, "conditioner-rework-queue.json")))
  assert.match(
    readFileSync(join(directory, "conditioner-rework-queue.json"), "utf8"),
    /"status": "open"/,
  )

  const reopened = data.detail.properties.find((entry) => entry.id === property.id)!
  const approveAction = reopened.actions.find((candidate) => candidate.kind === "approve")
  assert.ok(approveAction)
  data = await saved(await submit(data, approveAction.id))
  assert.equal(data.detail.properties.find((entry) => entry.id === property.id)!.status, "approved")
  assert.match(
    readFileSync(join(directory, "conditioner-rework-queue.json"), "utf8"),
    /"status": "resolved"/,
  )
  assert.ok(existsSync(join(directory, "conditioner-review-state.json")))
}

async function leaveInScenario() {
  let data = await read("leave-in")
  assert.equal(data.queue.length, 19)
  assert.match(data.standard, /v1\.2/)
  const versionEvidence = data.detail.evidence.find(
    (entry) => entry.title === "Formelversion und Freigabebindung",
  )!
  const versions = versionEvidence.original as Record<string, unknown>
  assert.equal(versions.approvalStandardKey, "leave-in-inci-v0.4")
  assert.equal(versions.effectiveStandard, data.standard)

  const property = data.detail.properties[0]!
  assert.deepEqual(
    property.lanes.map((lane) => lane.id),
    ["R"],
  )
  const beforeApproval = data
  data = await saved(await submit(data, action(data, `approve:${property.id}`).id))
  const stillOpen = data.detail.properties.find((entry) => entry.status !== "approved")!
  assert.equal((await submit(beforeApproval, `approve:${stillOpen.id}`)).status, 409)
  assert.equal(data.detail.properties.find((entry) => entry.id === property.id)!.status, "approved")
  const persisted = readFileSync(join(directory, "leave-in-review-state.json"), "utf8")
  assert.match(persisted, /"standardVersion": "leave-in-inci-v0.4"/)
}

test("shared category API preserves native category contracts through isolated copied artifacts", async () => {
  await shampooScenario()
  await conditionerScenario()
  await leaveInScenario()
})
