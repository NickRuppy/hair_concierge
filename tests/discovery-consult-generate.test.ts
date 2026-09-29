import assert from "node:assert/strict"
import test from "node:test"

import type { DiscoveryCallSheetBriefSections } from "../src/lib/discovery/call-sheet"
import {
  consultBriefJsonSchemaFormat,
  consultBriefSwapKeys,
  toConsultBriefSections,
} from "../src/lib/discovery/consult-brief/api-schema"
import {
  capHebelPoints,
  CONSULT_BRIEF_DEFAULT_MODEL,
  consultBriefModel,
  generateConsultBrief,
  type ConsultBriefCompletion,
} from "../src/lib/discovery/consult-brief/generate"
import { consultSourceHash } from "../src/lib/discovery/consult-brief/hash"
import type { ConsultInput } from "../src/lib/discovery/consult-brief/input"
import { CONSULT_BOUNDARY_LINE } from "../src/lib/discovery/consult-brief/lint"
import {
  buildConsultBriefPrompt,
  consultBriefSectionsSchema,
} from "../src/lib/discovery/consult-brief/prompt"

/**
 * The generate path behind its interface (consult-agent T2): prompt → completion → strict
 * zod parse onto the call sheet's sections → lint. Every test injects the completion; no
 * test ever reaches the API.
 */

const SHAMPOO_KEY = "shampoo:shampoo_everyday:none"

function input(overrides: Partial<ConsultInput> = {}): ConsultInput {
  return {
    profile: {
      hairTexture: "wavy",
      thickness: "normal",
      scalpType: "balanced",
      chemicalTreatments: ["lightened"],
      elasticity: "snaps",
      scalpConcerns: [],
      concerns: ["breakage"],
    },
    mainConcern: null,
    flags: ["bleached", "breakage_signal"],
    knowledge: [
      {
        id: "ask-detangling",
        category: "question",
        questionFirst: false,
        cautious: true,
        einsicht: "Kämmen ist eine Hauptquelle für Bruch.",
        imCall: "Womit entwirrst du?",
        fragen: ["Nass oder trocken?"],
        mergedFrom: [],
      },
    ],
    products: [
      {
        bucket: "tauschenOderNeu",
        decisionKey: SHAMPOO_KEY,
        intakeItemId: "item-shampoo",
        categoryLabel: "Shampoo",
        name: "Glanzwerk Volumen Shampoo",
        aliases: ["Glanzwerk Volumen Shampoo"],
        brand: "Glanzwerk",
        verdict: "passt_nicht",
        verdictLabel: "Passt nicht",
        decision: null,
        swapTarget: null,
        swapOptions: ["Sanftwerk Mild Shampoo"],
      },
    ],
    checklist: [{ kind: "ask_detangling" }],
    heat: null,
    washFrequency: {
      current: null,
      currentLabel: null,
      ideal: null,
      idealLabel: null,
      changes: false,
    },
    boundaryTriggers: [],
    baselineScore: 4,
    ...overrides,
  }
}

function validSections(): DiscoveryCallSheetBriefSections {
  return {
    diagnose: "Blondiert, reißt beim Zugtest: Die Längen sind vorgeschädigt.",
    hebel: [
      { title: "Schonend entwirren", note: "Breiter Kamm, von den Spitzen her.", points: 1 },
      {
        title: "Milder waschen",
        note: "Das Sanftwerk Mild Shampoo statt des jetzigen.",
        points: 0.5,
      },
      { title: "Längen schützen", note: "Nass nur mit Conditioner kämmen.", points: null },
    ],
    swapReasons: {
      [SHAMPOO_KEY]: "Das jetzige Shampoo passt nicht; das Sanftwerk Mild Shampoo reinigt milder.",
    },
    zielLuecken: [],
    callFragen: [
      "Womit entwirrst du, nass oder trocken?",
      "Wie oft wäschst du gerade?",
      "Wann war die letzte Blondierung?",
    ],
    erwartungen: ["Kämmbarkeit: stabil in 2–4 Wochen.", CONSULT_BOUNDARY_LINE],
  }
}

/** What the model returns under the strict API schema: swapReasons as `{ key, reason }[]`. */
function apiAnswer(sections: DiscoveryCallSheetBriefSections = validSections()) {
  return {
    ...sections,
    swapReasons: Object.entries(sections.swapReasons).map(([key, reason]) => ({ key, reason })),
  }
}

/** One output per completion call, in order; the last repeats. */
function completing(...outputs: (string | Error)[]) {
  const calls: Parameters<ConsultBriefCompletion>[0][] = []
  const complete: ConsultBriefCompletion = async (request) => {
    calls.push(request)
    const output = outputs[Math.min(calls.length, outputs.length) - 1]!
    if (output instanceof Error) throw output
    return output
  }
  return { complete, calls }
}

// --- prompt -----------------------------------------------------------------------------------

test("the prompt: German, guardrails as hard rules, the exact sections schema, the input", () => {
  const { system, user } = buildConsultBriefPrompt(input())
  assert.match(system, /Deutsch/)
  assert.match(system, /## G1 — /)
  for (const key of [
    "diagnose",
    "hebel",
    "swapReasons",
    "zielLuecken",
    "callFragen",
    "erwartungen",
  ]) {
    assert.ok(system.includes(`"${key}"`), key)
  }
  assert.match(system, /dritte[rn]? Person/)
  assert.ok(user.includes(SHAMPOO_KEY))
  assert.ok(user.includes("Glanzwerk Volumen Shampoo"))
  assert.ok(user.includes("Womit entwirrst du?"))
  // Evidence grades never reach the prompt (G5).
  assert.doesNotMatch(user, /"evidence"/)
})

test("the prompt names the allowed swapReasons keys and the score cap", () => {
  const { user, system } = buildConsultBriefPrompt(input())
  assert.ok(user.includes(`"${SHAMPOO_KEY}"`))
  assert.match(system, /9/)
})

test("the sections schema is strict: exactly the call sheet's shape", () => {
  assert.equal(consultBriefSectionsSchema.safeParse(validSections()).success, true)
  assert.equal(
    consultBriefSectionsSchema.safeParse({ ...validSections(), extra: "x" }).success,
    false,
  )
  assert.equal(
    consultBriefSectionsSchema.safeParse({ ...validSections(), hebel: [{ title: "x" }] }).success,
    false,
  )
  assert.equal(consultBriefSectionsSchema.safeParse({ sections: validSections() }).success, false)
})

// --- generate ---------------------------------------------------------------------------------

test("a valid answer: brief + source hash, one completion with the configured model and schema", async () => {
  const { complete, calls } = completing(JSON.stringify(apiAnswer()))
  const result = await generateConsultBrief(input(), { complete, model: "test-model" })
  assert.ok("brief" in result, JSON.stringify(result))
  assert.deepEqual(result.brief, validSections())
  assert.equal(result.sourceHash, consultSourceHash(input()))
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.model, "test-model")
  assert.deepEqual(calls[0], {
    ...buildConsultBriefPrompt(input()),
    model: "test-model",
    format: consultBriefJsonSchemaFormat([SHAMPOO_KEY]),
  })
})

test("invalid JSON → error, no brief", async () => {
  const { complete } = completing("Hier ist dein Brief: {")
  const result = await generateConsultBrief(input(), { complete, model: "m" })
  assert.deepEqual(result, { error: { code: "invalid_json" } })
})

test("JSON that misses the schema → error, no brief", async () => {
  const { complete } = completing(JSON.stringify({ diagnose: "x" }))
  const result = await generateConsultBrief(input(), { complete, model: "m" })
  assert.ok("error" in result)
  assert.equal(result.error.code, "invalid_schema")
  assert.equal("brief" in result, false)
})

test("a lint failure twice → lint_failed with the SECOND run's findings, no brief", async () => {
  const first = validSections()
  first.diagnose += " Die Kur repariert die Längen."
  const second = validSections()
  second.diagnose += " Die Kur heilt die Längen."
  const { complete, calls } = completing(
    JSON.stringify(apiAnswer(first)),
    JSON.stringify(apiAnswer(second)),
  )
  const result = await generateConsultBrief(input(), { complete, model: "m" })
  assert.ok("error" in result)
  assert.equal(result.error.code, "lint_failed")
  assert.equal(calls.length, 2)
  assert.ok(result.error.findings && result.error.findings.length > 0)
  assert.ok(result.error.findings.every((finding) => finding.detail !== "repair"))
  assert.ok(result.error.findings.some((finding) => /heilt/.test(finding.excerpt)))
  assert.equal("brief" in result, false)
})

test("a lint failure, then a clean retry → the retried brief; the retry carries draft + findings", async () => {
  const dirty = validSections()
  dirty.diagnose += " Die Kur repariert die Längen."
  const dirtyRaw = JSON.stringify(apiAnswer(dirty))
  const { complete, calls } = completing(dirtyRaw, JSON.stringify(apiAnswer()))
  const result = await generateConsultBrief(input(), { complete, model: "m" })
  assert.ok("brief" in result, JSON.stringify(result))
  assert.deepEqual(result.brief, validSections())
  assert.equal(calls.length, 2)
  assert.equal(calls[0]!.correction, undefined)
  const correction = calls[1]!.correction
  assert.ok(correction)
  assert.equal(correction.previousDraft, dirtyRaw)
  assert.match(correction.instruction, /^Der vorige Entwurf verletzt folgende Regeln:/)
  assert.match(correction.instruction, /repariert/)
  assert.match(correction.instruction, /Schreibe den vollständigen Brief korrigiert neu\./)
  // The retry keeps the original prompt, model and schema.
  assert.equal(calls[1]!.system, calls[0]!.system)
  assert.equal(calls[1]!.user, calls[0]!.user)
  assert.deepEqual(calls[1]!.format, calls[0]!.format)
})

test("at most two completions, even when every answer lints dirty", async () => {
  const dirty = validSections()
  dirty.diagnose += " Die Kur repariert die Längen."
  const { complete, calls } = completing(JSON.stringify(apiAnswer(dirty)))
  const result = await generateConsultBrief(input(), { complete, model: "m" })
  assert.ok("error" in result)
  assert.equal(result.error.code, "lint_failed")
  assert.equal(calls.length, 2)
})

test("a schema failure on the retry → that error, no third call", async () => {
  const dirty = validSections()
  dirty.diagnose += " Die Kur repariert die Längen."
  const { complete, calls } = completing(JSON.stringify(apiAnswer(dirty)), "{")
  const result = await generateConsultBrief(input(), { complete, model: "m" })
  assert.deepEqual(result, { error: { code: "invalid_json" } })
  assert.equal(calls.length, 2)
})

test("no retry for JSON, schema or LLM failures on the first call", async () => {
  for (const output of ["{", JSON.stringify({ diagnose: "x" }), new Error("boom")]) {
    const { complete, calls } = completing(output)
    const result = await generateConsultBrief(input(), { complete, model: "m" })
    assert.ok("error" in result)
    assert.equal(calls.length, 1)
  }
})

// --- boundary line ----------------------------------------------------------------------------

test("the boundary line is appended in code as the last erwartungen entry", async () => {
  const sections = validSections()
  sections.erwartungen = ["Kämmbarkeit: stabil in 2–4 Wochen."]
  const { complete, calls } = completing(JSON.stringify(apiAnswer(sections)))
  const result = await generateConsultBrief(input(), { complete, model: "m" })
  assert.ok("brief" in result, JSON.stringify(result))
  assert.deepEqual(result.brief.erwartungen, [
    "Kämmbarkeit: stabil in 2–4 Wochen.",
    CONSULT_BOUNDARY_LINE,
  ])
  assert.equal(calls.length, 1)
})

test("the boundary line is not doubled when the model already wrote it (trim-compare)", async () => {
  const sections = validSections()
  sections.erwartungen = [`  ${CONSULT_BOUNDARY_LINE} `, "Kämmbarkeit: stabil in 2–4 Wochen."]
  const { complete } = completing(JSON.stringify(apiAnswer(sections)))
  const result = await generateConsultBrief(input(), { complete, model: "m" })
  assert.ok("brief" in result, JSON.stringify(result))
  assert.deepEqual(result.brief.erwartungen, [
    "Kämmbarkeit: stabil in 2–4 Wochen.",
    CONSULT_BOUNDARY_LINE,
  ])
})

// --- API schema -------------------------------------------------------------------------------

test("the API schema: strict, every property required, hebel/callFragen 3–5, points nullable", () => {
  const format = consultBriefJsonSchemaFormat([SHAMPOO_KEY])
  assert.equal(format.type, "json_schema")
  assert.equal(format.strict, true)
  const schema = format.schema as {
    additionalProperties: boolean
    required: string[]
    properties: Record<string, Record<string, unknown>>
  }
  assert.equal(schema.additionalProperties, false)
  assert.deepEqual(schema.required.toSorted(), Object.keys(schema.properties).toSorted())
  assert.equal(schema.properties.hebel!.minItems, 3)
  assert.equal(schema.properties.hebel!.maxItems, 5)
  assert.equal(schema.properties.callFragen!.minItems, 3)
  assert.equal(schema.properties.callFragen!.maxItems, 5)
  const hebelItem = schema.properties.hebel!.items as {
    required: string[]
    additionalProperties: boolean
    properties: { points: { type: string[] } }
  }
  assert.deepEqual(hebelItem.required, ["title", "note", "points"])
  assert.equal(hebelItem.additionalProperties, false)
  assert.deepEqual(hebelItem.properties.points.type, ["number", "null"])
  const swap = schema.properties.swapReasons as {
    type: string
    maxItems: number
    items: { required: string[]; properties: { key: { enum?: string[] } } }
  }
  assert.equal(swap.type, "array")
  assert.equal(swap.maxItems, 1)
  assert.deepEqual(swap.items.required, ["key", "reason"])
  assert.deepEqual(swap.items.properties.key.enum, [SHAMPOO_KEY])
})

test("the API schema with no allowed swap keys: no empty enum, the array capped at zero", () => {
  const format = consultBriefJsonSchemaFormat([])
  const swap = (format.schema as { properties: { swapReasons: Record<string, unknown> } })
    .properties.swapReasons as { maxItems: number; items: { properties: { key: object } } }
  assert.equal(swap.maxItems, 0)
  assert.deepEqual(swap.items.properties.key, { type: "string" })
  assert.equal(JSON.stringify(format).includes('"enum":[]'), false)
})

test("no swap keys end to end: an empty swapReasons array becomes an empty record", async () => {
  const noSwaps = input({ products: [] })
  const sections = validSections()
  sections.swapReasons = {}
  sections.hebel[1] = {
    title: "Milder waschen",
    note: "Seltener und sanfter waschen.",
    points: 0.5,
  }
  const { complete, calls } = completing(JSON.stringify(apiAnswer(sections)))
  const result = await generateConsultBrief(noSwaps, { complete, model: "m" })
  assert.ok("brief" in result, JSON.stringify(result))
  assert.deepEqual(result.brief.swapReasons, {})
  assert.deepEqual(calls[0]!.format, consultBriefJsonSchemaFormat([]))
})

test("the swap keys match the ones the prompt names", () => {
  const keys = consultBriefSwapKeys(input())
  assert.deepEqual(keys, [SHAMPOO_KEY])
  const { user } = buildConsultBriefPrompt(input())
  for (const key of keys) assert.ok(user.includes(`"${key}"`), key)
  assert.deepEqual(consultBriefSwapKeys(input({ products: [] })), [])
})

test("array → record: the stored shape; duplicates and malformed pass through unconverted", () => {
  assert.deepEqual(
    toConsultBriefSections({
      diagnose: "x",
      swapReasons: [
        { key: "a", reason: "eins" },
        { key: "b", reason: "zwei" },
      ],
    }),
    { diagnose: "x", swapReasons: { a: "eins", b: "zwei" } },
  )
  // A duplicated key would silently eat another step's slot under maxItems (Codex F3):
  // it stays unconverted, so the storage schema rejects it as invalid_schema.
  const duplicated = {
    swapReasons: [
      { key: "a", reason: "eins" },
      { key: "a", reason: "doppelt" },
    ],
  }
  assert.equal(toConsultBriefSections(duplicated), duplicated)
  assert.equal(
    consultBriefSectionsSchema.safeParse(toConsultBriefSections(duplicated)).success,
    false,
  )
  const malformed = { swapReasons: [{ key: 1, reason: "x" }] }
  assert.equal(toConsultBriefSections(malformed), malformed)
  assert.equal(
    consultBriefSectionsSchema.safeParse(toConsultBriefSections(malformed)).success,
    false,
  )
  // The old record shape is no longer the API contract, but still stores as-is.
  const record = { swapReasons: { a: "eins" } }
  assert.equal(toConsultBriefSections(record), record)
})

test("an LLM failure → error, no brief, nothing thrown", async () => {
  const { complete } = completing(Object.assign(new Error("boom"), { status: 500 }))
  const result = await generateConsultBrief(input(), { complete, model: "m" })
  assert.deepEqual(result, { error: { code: "llm_failed" } })
})

test("an empty answer → error", async () => {
  const { complete } = completing("")
  const result = await generateConsultBrief(input(), { complete, model: "m" })
  assert.deepEqual(result, { error: { code: "invalid_json" } })
})

test("the model: env override, else the strongest configured default", () => {
  assert.equal(consultBriefModel({ CONSULT_BRIEF_MODEL: " gpt-x " }), "gpt-x")
  assert.equal(consultBriefModel({}), CONSULT_BRIEF_DEFAULT_MODEL)
  assert.equal(consultBriefModel({ CONSULT_BRIEF_MODEL: "  " }), CONSULT_BRIEF_DEFAULT_MODEL)
})

test("capHebelPoints: the G3 cap is enforced in code, least important levers first", () => {
  const hebel = [
    { title: "Eins", note: "x", points: 2 },
    { title: "Zwei", note: "x", points: 1.5 },
    { title: "Drei", note: "x", points: 1 },
  ]
  // Baseline 6 → budget 3: the last lever loses its number, the sum drops to 3.5→ still over?
  // 2 + 1.5 = 3.5 > 3, so lever two goes to null as well; the top lever keeps its figure.
  assert.deepEqual(
    capHebelPoints(hebel, 6).map((entry) => entry.points),
    [2, null, null],
  )
  // Within budget: untouched (and the same array shape).
  assert.deepEqual(
    capHebelPoints(hebel, 4).map((entry) => entry.points),
    [2, 1.5, 1],
  )
  // No baseline: nothing to enforce against.
  assert.deepEqual(
    capHebelPoints(hebel, null).map((entry) => entry.points),
    [2, 1.5, 1],
  )
  // Null points are skipped, not counted.
  assert.deepEqual(
    capHebelPoints(
      [
        { title: "Eins", note: "x", points: 2 },
        { title: "Zwei", note: "x", points: null },
        { title: "Drei", note: "x", points: 1.5 },
      ],
      6,
    ).map((entry) => entry.points),
    [2, null, null],
  )
})
