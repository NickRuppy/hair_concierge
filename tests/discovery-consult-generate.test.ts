import assert from "node:assert/strict"
import test from "node:test"

import type { DiscoveryCallSheetBriefSections } from "../src/lib/discovery/call-sheet"
import {
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
    hebel: [{ title: "Schonend entwirren", note: "Breiter Kamm, von den Spitzen her.", points: 1 }],
    swapReasons: {
      [SHAMPOO_KEY]: "Das jetzige Shampoo passt nicht; das Sanftwerk Mild Shampoo reinigt milder.",
    },
    zielLuecken: [],
    callFragen: ["Womit entwirrst du, nass oder trocken?"],
    erwartungen: ["Kämmbarkeit: stabil in 2–4 Wochen.", CONSULT_BOUNDARY_LINE],
  }
}

function completing(output: string | Error) {
  const calls: Parameters<ConsultBriefCompletion>[0][] = []
  const complete: ConsultBriefCompletion = async (request) => {
    calls.push(request)
    if (output instanceof Error) throw output
    return output
  }
  return { complete, calls }
}

// --- prompt -----------------------------------------------------------------------------------

test("the prompt: German, guardrails as hard rules, the exact sections schema, the input", () => {
  const { system, user } = buildConsultBriefPrompt(input())
  assert.match(system, /Deutsch/)
  assert.match(system, /## G1 — Verbotene Formulierungen/)
  assert.ok(system.includes(CONSULT_BOUNDARY_LINE))
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

test("a valid answer: brief + source hash, one completion with the configured model", async () => {
  const { complete, calls } = completing(JSON.stringify(validSections()))
  const result = await generateConsultBrief(input(), { complete, model: "test-model" })
  assert.ok("brief" in result, JSON.stringify(result))
  assert.deepEqual(result.brief, validSections())
  assert.equal(result.sourceHash, consultSourceHash(input()))
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.model, "test-model")
  assert.deepEqual(calls[0], { ...buildConsultBriefPrompt(input()), model: "test-model" })
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

test("a lint failure → error with the findings, no brief", async () => {
  const sections = validSections()
  sections.diagnose += " Die Kur repariert die Längen."
  const { complete } = completing(JSON.stringify(sections))
  const result = await generateConsultBrief(input(), { complete, model: "m" })
  assert.ok("error" in result)
  assert.equal(result.error.code, "lint_failed")
  assert.deepEqual(
    result.error.findings?.map((finding) => finding.detail),
    ["repair"],
  )
  assert.equal("brief" in result, false)
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
