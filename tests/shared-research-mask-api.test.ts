import assert from "node:assert/strict"
import { after, test } from "node:test"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

// Real copied research + native stores: neither frozen inputs nor reviews in the checkout change.
const repo = process.cwd()
const directory = mkdtempSync(join(tmpdir(), "shared-mask-api-"))
const artifacts = join(directory, "data/research/mask-inci/v1.0")
mkdirSync(dirname(artifacts), { recursive: true })
cpSync(join(repo, "data/research/mask-inci/v1.0"), artifacts, { recursive: true })
const environment = {
  node: process.env.NODE_ENV,
  state: process.env.MASK_RESEARCH_LAB_REVIEW_STATE_PATH,
}
Object.assign(process.env, {
  NODE_ENV: "development",
  MASK_RESEARCH_LAB_REVIEW_STATE_PATH: join(directory, "state.json"),
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
    ["MASK_RESEARCH_LAB_REVIEW_STATE_PATH", environment.state],
  ] as const) {
    if (value === undefined) delete process.env[key]
    else (process.env as Record<string, string | undefined>)[key] = value
  }
  rmSync(directory, { recursive: true, force: true })
})

async function read(itemId = "01-hask-argan-oil-sachet") {
  const [queue] = await routes
  const response = await queue.GET(
    new Request(`http://localhost/api/labs/research/queue?category=mask&itemId=${itemId}`),
  )
  assert.equal(response.status, 200)
  return (await response.json()).data as import("../src/lib/labs/research/model").ResearchLabData
}
async function submit(data: Awaited<ReturnType<typeof read>>, actionId: string, comment?: string) {
  const [, review] = await routes
  return review.POST(
    new Request("http://localhost/api/labs/research/review", {
      method: "POST",
      body: JSON.stringify({
        category: "mask",
        dataset: "default",
        itemId: data.detail.id,
        displayFingerprint: data.detail.displayFingerprint,
        actionId,
        ...(comment ? { comment } : {}),
      }),
    }),
  )
}

test("Mask shared API presents actual two-lane confidence and reviewed ingredient reasoning", async () => {
  const data = await read()
  assert.equal(data.queue.length, 13)
  const weight = data.detail.properties.find(
    (property) => property.id === "profile.weightPotential",
  )!
  assert.deepEqual(
    weight.lanes.map(({ value, confidence }) => [value, confidence]),
    [
      ["Hoch", "moderate"],
      ["Hoch", "high"],
    ],
  )
  assert.match(weight.reasoning!, /Lanolin.*Cetearyl Alcohol/)
  const conditioning = data.detail.properties.find(
    (property) => property.id === "profile.conditioningLevel",
  )!
  assert.match(conditioning.reasoning!, /Cetrimonium Chloride, Quaternium-18/)
  assert.equal(
    data.detail.properties.some((property) => property.id === "profile.hairThicknessFit"),
    false,
  )
  assert.ok(weight.annotations.some((annotation) => annotation.includes("Haardicke")))
  const secondary = data.detail.properties.find(
    (property) => property.id === "profile.secondaryFocus",
  )!
  assert.deepEqual(
    secondary.lanes.map((lane) => lane.value),
    ["Keiner", "Keiner"],
  )
  const otherVersion = await read("02-gliss-7sekunden-express-repair")
  assert.ok(
    otherVersion.detail.notices.some((notice) => notice.includes("Methodenversionen verschieden")),
  )
  assert.equal(otherVersion.detail.properties[0].lanes[1].comparable, false)
})

test("changed blind evidence invalidates a displayed review; fresh native rework persists and blocks bulk completion", async () => {
  const before = await read()
  const file = join(artifacts, "blind-lane-v1/01-hask-argan-oil-sachet.json")
  const original = readFileSync(file, "utf8")
  try {
    const changed = JSON.parse(original)
    changed.profile.weightPotential.confidence = "low"
    writeFileSync(file, JSON.stringify(changed))
    assert.equal((await submit(before, "approve:profile.weightPotential")).status, 409)
    assert.equal(existsSync(join(directory, "state.json")), false)
    const fresh = await read()
    assert.equal(
      fresh.detail.properties.find((property) => property.id === "profile.weightPotential")!
        .lanes[1].confidence,
      "low",
    )
    const response = await submit(
      fresh,
      "rework:profile.weightPotential",
      "Bitte die abweichende Konfidenz prüfen.",
    )
    assert.equal(response.status, 200)
    assert.equal((await response.json()).saved, true)
    const persisted = await read()
    assert.equal(persisted.detail.status, "rework")
    assert.equal(
      persisted.detail.actions.find((action) => action.id === "complete")!.enabled,
      false,
    )
    assert.match(readFileSync(join(directory, "state.json"), "utf8"), /abweichende Konfidenz/)
    assert.equal((await submit(persisted, "complete")).status, 409)
    assert.equal((await submit(persisted, "approve:profile.weightPotential")).status, 200)
  } finally {
    writeFileSync(file, original)
  }
})

test("missing or incorrectly bound blind evidence stays unavailable while reference reasoning survives", async () => {
  const file = join(artifacts, "blind-lane-v1/01-hask-argan-oil-sachet.json")
  renameSync(file, `${file}.held`)
  try {
    const data = await read()
    const property = data.detail.properties.find(
      (entry) => entry.id === "profile.conditioningLevel",
    )!
    assert.match(property.reasoning!, /Cetrimonium Chloride, Quaternium-18/)
    assert.equal(property.lanes[1].value, null)
    assert.equal(property.lanes[1].comparable, false)
  } finally {
    renameSync(`${file}.held`, file)
  }
  const packet = join(artifacts, "blind-packets/01-hask-argan-oil-sachet.json")
  const original = readFileSync(packet, "utf8")
  try {
    const changed = JSON.parse(original)
    changed.rawInci = "AQUA"
    writeFileSync(packet, JSON.stringify(changed))
    const data = await read()
    assert.equal(data.detail.properties[0].lanes[1].value, null)
    assert.ok(data.detail.notices.some((notice) => notice.includes("Formelbindung")))
  } finally {
    writeFileSync(packet, original)
  }
})

test("bulk completion and excluded boundary use native persistence, while production access denies reads and writes", async () => {
  const data = await read()
  assert.equal((await submit(data, "complete")).status, 200)
  const saved = await read()
  assert.equal(saved.detail.status, "approved")
  assert.ok(saved.detail.properties.every((property) => property.status === "approved"))
  const boundary = await read("13-olaplex-no3-hair-perfector")
  assert.equal(boundary.detail.actions[0].id, "boundary")
  assert.equal((await submit(boundary, "complete")).status, 409)
  assert.equal((await submit(boundary, "boundary")).status, 200)
  assert.equal((await read(boundary.detail.id)).detail.status, "excluded")
  ;(process.env as Record<string, string | undefined>).NODE_ENV = "production"
  try {
    const [queue] = await routes
    assert.equal(
      (await queue.GET(new Request("http://localhost/api/labs/research/queue"))).status,
      404,
    )
    assert.equal((await submit(saved, "complete")).status, 404)
    const page = await import("../src/app/labs/research/page")
    await assert.rejects(
      page.default({ searchParams: Promise.resolve({}) }),
      (error: unknown) => (error as { digest?: string }).digest === "NEXT_HTTP_ERROR_FALLBACK;404",
    )
  } finally {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = "development"
  }
})
