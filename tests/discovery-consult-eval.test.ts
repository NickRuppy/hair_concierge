import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  evaluateConsultBriefAnswer,
  type ConsultEvalCheck,
} from "../scripts/eval-consult-brief/checks"
import { generateConsultBrief } from "../src/lib/discovery/consult-brief/generate"
import { CONSULT_BOUNDARY_LINE, lintConsultBrief } from "../src/lib/discovery/consult-brief/lint"
import { consultSourceHash } from "../src/lib/discovery/consult-brief/hash"
import {
  CONSULT_BRIEF_PROMPT_VERSION,
  consultBriefSectionsSchema,
} from "../src/lib/discovery/consult-brief/prompt"
import { parseDiscoveryHeatStyling } from "../src/lib/discovery/heat-styling"
import {
  CONSULT_GOLDEN_PROFILES,
  consultGoldenProfile,
  consultGoldenSource,
} from "./fixtures/consult-brief/golden-profiles"

/**
 * The consult brief eval lane's deterministic part (consult-agent T5). The live lane
 * (`npm run test:consult-brief`) calls the real model; here one REAL recorded answer
 * (golden profile `nomi`) pins the parse → schema → lint path without any API call, and the
 * eval's own checks are pinned against mutations of that answer.
 */

type RecordedAnswer = {
  profile: string
  model: string
  promptVersion: string
  sourceHash: string
  raw: string
}

const recorded = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures", "consult-brief", "recorded-nomi.json"), "utf-8"),
) as RecordedAnswer

const nomi = consultGoldenSource(consultGoldenProfile("nomi"))

function mutated(change: (brief: Record<string, unknown>) => void): string {
  const brief = JSON.parse(recorded.raw) as Record<string, unknown>
  change(brief)
  return JSON.stringify(brief)
}

function checks(raw: string, input = nomi.input): ConsultEvalCheck[] {
  return evaluateConsultBriefAnswer(raw, input).findings.map((finding) => finding.check)
}

test("golden profiles assemble through consultBriefSource with valid heat answers", () => {
  for (const profile of CONSULT_GOLDEN_PROFILES) {
    const { input, sourceHash } = consultGoldenSource(profile)
    assert.match(sourceHash, /^[0-9a-f]{64}$/, profile.id)
    assert.ok(input.mainConcern, `${profile.id}: main concern`)
    assert.equal(parseDiscoveryHeatStyling(profile.parts.model.heatStyling).ok, true, profile.id)
  }
  assert.deepEqual(nomi.input.boundaryTriggers, [])
  assert.ok(nomi.input.flags.includes("dry_scalp_dry_flakes"))
  const curly = consultGoldenSource(consultGoldenProfile("curly-breakage")).input
  assert.deepEqual(curly.boundaryTriggers, ["hair_loss_concern", "hair_loss_assessment"])
  assert.equal(curly.mainConcern?.code, "breakage")
})

test("the recorded answer is not stale: same prompt version, same input hash — else re-record", () => {
  // A prompt or input change must fail here until the fixture is re-recorded with the live
  // lane (`npm run test:consult-brief`), so the offline pin never vouches for an old answer.
  assert.equal(recorded.promptVersion, CONSULT_BRIEF_PROMPT_VERSION)
  assert.equal(recorded.sourceHash, consultSourceHash(nomi.input))
  assert.equal(recorded.sourceHash, nomi.sourceHash)
})

test("the recorded real answer passes the generator's parse, schema and lint path", async () => {
  assert.equal(recorded.profile, "nomi")
  const result = await generateConsultBrief(nomi.input, {
    model: recorded.model,
    complete: async () => recorded.raw,
  })
  assert.ok("brief" in result, JSON.stringify(result))
  assert.equal(result.sourceHash, nomi.sourceHash)

  const brief = consultBriefSectionsSchema.parse(JSON.parse(recorded.raw))
  assert.deepEqual(lintConsultBrief(brief, nomi.input), [])
  assert.equal(brief.erwartungen.at(-1), CONSULT_BOUNDARY_LINE)
})

test("the eval's checks find nothing in the recorded answer (JSON mode: a bare object)", () => {
  const result = evaluateConsultBriefAnswer(recorded.raw, nomi.input)
  assert.deepEqual(result.findings, [])
  assert.equal(result.jsonShape, "bare_object")
})

test("the eval's checks catch broken answers", () => {
  assert.deepEqual(checks("```json\n{}\n```"), ["json"])
  assert.ok(checks(mutated((brief) => delete brief.callFragen)).includes("schema"))

  const noBoundary = checks(
    mutated((brief) => {
      brief.erwartungen = (brief.erwartungen as string[]).slice(0, -1)
    }),
  )
  assert.ok(noBoundary.includes("boundary_line"))
  assert.ok(noBoundary.includes("lint"))

  assert.deepEqual(
    checks(
      mutated((brief) => {
        brief.hebel = [{ title: "Zu viel", note: "Punkte außerhalb des Rahmens.", points: 3 }]
      }),
    ),
    ["hebel_shape"],
  )
  assert.deepEqual(
    checks(
      mutated((brief) => {
        brief.hebel = []
      }),
    ),
    ["hebel_shape"],
  )

  // A market brand is the lint's job; an invented brand is the eval's heuristic.
  assert.ok(
    checks(
      mutated((brief) => (brief.diagnose = `${brief.diagnose} Pantene Shampoo hilft.`)),
    ).includes("lint"),
  )
  assert.deepEqual(
    checks(mutated((brief) => (brief.diagnose = `${brief.diagnose} Dazu Zauberglanz Shampoo.`))),
    ["product_outside_input"],
  )

  const english = checks(
    mutated((brief) => {
      brief.diagnose = "She has fine hair and it is not the product that is the problem."
      brief.hebel = [{ title: "Less heat", note: "Use the iron less often.", points: 1 }]
      brief.callFragen = ["How often do you use the iron?"]
      brief.zielLuecken = []
      brief.swapReasons = {}
      brief.erwartungen = [CONSULT_BOUNDARY_LINE]
    }),
  )
  assert.ok(english.includes("language"))
})

test("with a hair-loss trigger, a loss sentence naming a product is flagged", () => {
  const curly = consultGoldenSource(consultGoldenProfile("curly-breakage")).input
  const raw = mutated((brief) => {
    brief.diagnose = `${brief.diagnose} Gegen den Ausfall hilft das Lockenhof Curl Leave-in.`
  })
  assert.ok(checks(raw, curly).includes("hair_loss_product"))
})
