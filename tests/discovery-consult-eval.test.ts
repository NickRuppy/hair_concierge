import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  evaluateConsultBriefAnswer,
  type ConsultEvalCheck,
} from "../scripts/eval-consult-brief/checks"
import { toConsultBriefSections } from "../src/lib/discovery/consult-brief/api-schema"
import { generateConsultBrief, withBoundaryLine } from "../src/lib/discovery/consult-brief/generate"
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

  // The stored shape: array → record converted, boundary line appended in code.
  const parsed = consultBriefSectionsSchema.parse(toConsultBriefSections(JSON.parse(recorded.raw)))
  const brief = {
    ...parsed,
    zielLuecken: [],
    erwartungen: withBoundaryLine(parsed.erwartungen),
  }
  assert.deepEqual(lintConsultBrief(brief, nomi.input), [])
  assert.equal(brief.erwartungen.at(-1), CONSULT_BOUNDARY_LINE)
  assert.ok("brief" in result && result.brief.erwartungen.at(-1) === CONSULT_BOUNDARY_LINE)
})

test("the eval's checks find nothing in the recorded answer (JSON mode: a bare object)", () => {
  const result = evaluateConsultBriefAnswer(recorded.raw, nomi.input)
  assert.deepEqual(result.findings, [])
  assert.equal(result.jsonShape, "bare_object")
})

test("the eval's checks catch broken answers", () => {
  assert.deepEqual(checks("```json\n{}\n```"), ["json"])
  assert.ok(checks(mutated((brief) => delete brief.callFragen)).includes("schema"))
  // v4 (R26): mechanik and a bucket on every Hebel are required; zielLuecken is refused.
  assert.ok(checks(mutated((brief) => delete brief.mechanik)).includes("schema"))
  assert.ok(
    checks(
      mutated((brief) => {
        delete (brief.hebel as Array<{ bucket?: string }>)[0]!.bucket
      }),
    ).includes("schema"),
  )
  assert.ok(checks(mutated((brief) => (brief.zielLuecken = []))).includes("schema"))

  // The boundary line is appended in code, so a raw answer without it is not a finding —
  // the evaluated brief still ends with it.
  const noBoundary = evaluateConsultBriefAnswer(
    mutated((brief) => {
      brief.erwartungen = (brief.erwartungen as string[]).slice(0, -1)
    }),
    nomi.input,
  )
  assert.deepEqual(noBoundary.findings, [])
  assert.equal(noBoundary.brief?.erwartungen.at(-1), CONSULT_BOUNDARY_LINE)

  // Fewer than 3 levers is now a schema violation (R23); an out-of-range points value on a
  // valid lever count is the eval's hebel_shape check.
  assert.deepEqual(
    checks(
      mutated((brief) => {
        brief.hebel = [{ title: "Zu wenig", note: "Nur ein Hebel.", points: 1, bucket: "umgang" }]
      }),
    ),
    ["schema"],
  )
  assert.deepEqual(
    checks(
      mutated((brief) => {
        brief.hebel = []
      }),
    ),
    ["schema"],
  )
  assert.deepEqual(
    checks(
      mutated((brief) => {
        const hebel = brief.hebel as Array<{ points: number | null }>
        hebel[0] = { ...hebel[0], points: 0.1 }
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
      brief.mechanik = "Dry ends usually come from heat, friction and too little moisture."
      brief.diagnose = "She has fine hair and it is not the product that is the problem."
      brief.hebel = [
        { title: "Less heat", note: "Use the iron less often.", points: 1, bucket: "umgang" },
        {
          title: "Detangle gently",
          note: "Start at the ends and work upwards.",
          points: 1,
          bucket: "umgang",
        },
        {
          title: "Conditioner",
          note: "Use it after every wash for slip.",
          points: 1,
          bucket: "produkt",
        },
      ]
      brief.callFragen = [
        "How often do you use the iron?",
        "How do you detangle your hair?",
        "Where do you buy your hair care?",
      ]
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

test("a prompt-contract bump makes every stored brief stale (Codex review, v4)", () => {
  const { input } = consultGoldenSource(consultGoldenProfile("nomi"))
  const current = consultSourceHash(input)
  assert.equal(current, consultSourceHash(input, CONSULT_BRIEF_PROMPT_VERSION))
  assert.notEqual(current, consultSourceHash(input, "consult-brief-v3"))
})
