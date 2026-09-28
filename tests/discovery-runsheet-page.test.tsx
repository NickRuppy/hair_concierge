import assert from "node:assert/strict"
import test from "node:test"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { createDiscoveryCockpitPage } from "../src/app/admin/beratung/[enrollmentId]/page"
import { DISCOVERY_REFERRAL_MESSAGE } from "../src/components/discovery/cockpit/discovery-call-cockpit"
import {
  parseRunsheetBaseline,
  parseRunsheetPoints,
  runsheetScoreSteps,
} from "../src/components/discovery/cockpit/runsheet-brief"
import {
  formatRunsheetDueOn,
  runsheetDueOn,
} from "../src/components/discovery/cockpit/runsheet-follow-up"
import {
  formatRunsheetScore,
  runsheetChecklistLines,
} from "../src/components/discovery/cockpit/runsheet-parts"
import { composeRunsheetProducts } from "../src/components/discovery/cockpit/runsheet-products"
import { parseDiscoveryCallSheet, type DiscoveryCallSheet } from "../src/lib/discovery/call-sheet"
import {
  buildDiscoveryCockpitView,
  discoveryOwnedProductIdentities,
  discoveryResearchOpenItems,
  type DiscoveryCallIntake,
  type DiscoveryCockpitModel,
} from "../src/lib/discovery/cockpit"
import type { DiscoveryEnrollment } from "../src/lib/discovery/enrollment"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import type { DiscoveryParticipantVerdict } from "../src/lib/discovery/load-participant-verdicts"
import {
  composeDiscoveryRefinedRoutine,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"
import type { ScanPresentedVerdictPayload } from "../src/lib/scan/types"

/**
 * The consult runsheet (T3): the cockpit page in six phases, rendered through its real
 * components with faked loaders. The Nomi constellation: her shampoo carries a verdict, her
 * scanned conditioner is still in research, and the Idealroutine has an empty conditioner
 * step — the page must never say she uses nothing for it.
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  owned: "30000000-0000-4000-8000-000000000003",
  alternative: "30000000-0000-4000-8000-00000000000a",
  shampooItem: "50000000-0000-4000-8000-000000000005",
  scannedItem: "50000000-0000-4000-8000-000000000006",
}

const GTIN = "0850018802659"
const USES_NOTHING = "Sie benutzt für diesen Schritt aktuell nichts."

const enrollment: DiscoveryEnrollment = {
  enrollmentId: ids.enrollment,
  name: "Nomi",
  email: "nomi@example.test",
  tokenVersion: 1,
  claimedUserId: ids.user,
  claimedAt: "2026-09-19T10:00:00.000Z",
  createdAt: "2026-09-18T10:00:00.000Z",
}

const intake: DiscoveryCallIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "submitted",
  submittedAt: "2026-09-25T18:41:00.000Z",
  callFinalizedAt: null,
  finalizedSourceHash: null,
}

const shampooStep: DiscoveryIdealStep = {
  decisionKey: "decision:shampoo:shampoo_everyday:gap",
  category: "shampoo",
  role: "shampoo_everyday",
  section: "basis",
  categoryLabel: "Shampoo",
  roleLabel: "Hauptreinigung",
  roleDescription: "Kopfhaut waschen, Längen nur durchspülen",
  frequencyLabel: "2× / Woche",
  preview: null,
  depth: {
    purpose: "Reinigt die Kopfhaut.",
    targetType: null,
    productCriteria: null,
    fit: null,
    timingLabel: "Haarwäsche",
  },
}

const conditionerStep: DiscoveryIdealStep = {
  decisionKey: "decision:conditioner:conditioner_rinse_out:gap",
  category: "conditioner",
  role: "conditioner_rinse_out",
  section: "basis",
  categoryLabel: "Conditioner",
  roleLabel: "Pflege nach der Wäsche",
  roleDescription: "In die Längen, kurz einwirken lassen",
  frequencyLabel: "nach jeder Wäsche",
  preview: null,
  depth: {
    purpose: null,
    targetType: null,
    productCriteria: null,
    fit: null,
    timingLabel: "Nach Shampoo",
  },
}

const shampooItem: DiscoveryIntakeItem = {
  id: ids.shampooItem,
  category: "shampoo",
  source: "catalog_search",
  brandText: "Sebamed",
  productNameText: "Anti Schuppen",
  barcodeIdentifier: null,
  productId: ids.owned,
  productSubmissionId: null,
  createdAt: "2026-09-20T10:00:00.000Z",
  frequency: "weekly_2x",
}

const scannedConditioner: DiscoveryIntakeItem = {
  id: ids.scannedItem,
  category: "conditioner",
  source: "barcode_unknown",
  brandText: null,
  productNameText: null,
  barcodeIdentifier: GTIN,
  productId: null,
  productSubmissionId: null,
  createdAt: "2026-09-20T10:05:00.000Z",
}

const payload: ScanPresentedVerdictPayload = {
  kind: "in_catalog",
  verdict: "mismatch",
  verdictLabel: "Passt nicht",
  verdictTitle: "Passt nicht zu deinem Haar",
  status: "pending",
  subtitle: "1 von 3 Zielbereichen getroffen",
  evaluatedRole: "shampoo_everyday",
  evaluatedRoleLabel: "Hauptreinigung",
  dimensions: [],
  criteria: [],
  coverage: null,
  fitNarrative: null,
  alternatives: [
    {
      productId: ids.alternative,
      displayName: "Sebamed Urea 5% Shampoo",
      imageUrl: null,
      priceLabel: null,
      netContentLabel: null,
      verdict: "ideal",
      verdictLabel: "Passt",
      brand: "Sebamed",
      purchaseUrl: null,
    },
  ],
}

const verdicts: DiscoveryParticipantVerdict[] = [
  {
    itemId: ids.shampooItem,
    productId: ids.owned,
    status: "verdict",
    product: {
      productId: ids.owned,
      name: "Sebamed Anti Schuppen",
      brand: "Sebamed",
      category: "shampoo",
      categoryLabel: "Shampoo",
      imageUrl: null,
      priceLabel: null,
      purchaseUrl: null,
    },
    payload,
  },
]

function model(): DiscoveryCockpitModel {
  const items = [shampooItem, scannedConditioner]
  return {
    status: "ready",
    steps: [shampooStep, conditionerStep],
    verdicts,
    previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
    routine: composeDiscoveryRefinedRoutine({
      steps: [shampooStep, conditionerStep],
      items,
      decisions: [],
      swapProducts: [],
      ownedProducts: discoveryOwnedProductIdentities(verdicts),
    }),
    recommendationProducts: [],
    recommendationBrandsAvailable: true,
    research: {
      items,
      state: { submissions: new Map(), latestJobs: new Map(), eligible: new Set() },
    },
    concernProfileFacts: {
      hair_texture: "straight",
      thickness: "fine",
      scalp_type: "dry",
      chemical_treatment: ["lightened"],
      damaged: true,
      heat_styling: true,
    },
    hairElasticity: "snaps",
  }
}

const callSheet: DiscoveryCallSheet = parseDiscoveryCallSheet({
  baseline_score: 4,
  rescores: [],
  touchpoints: [{ kind: "rescore_call", due_on: "2026-10-25", done_at: null }],
  consult_brief: {
    sections: {
      diagnose: "Feines, blondiertes Haar mit aufgerauten Längen.",
      hebel: [
        { title: "Schaden stoppen", note: "Hitzeschutz immer.", points: 1.5 },
        { title: "Basics stärken", note: "Conditioner nach jeder Wäsche.", points: 1.5 },
        { title: "Gezielt reparieren", note: "Leichte Maske.", points: 1 },
      ],
      swapReasons: {
        [shampooStep.decisionKey]: "Anti-Schuppen trocknet ihre Kopfhaut weiter aus.",
      },
      zielLuecken: ["Ziel „Form & Halt“: offen ansprechen."],
      callFragen: [],
      erwartungen: [],
    },
    generated_at: null,
    generated_by: "manual",
    source_hash: null,
  },
  habit_commitments: [{ id: "h1", label: "Hitzeschutz immer", committed: true }],
  feedback: "Sehr hilfreich.",
})

async function renderPage(overrides: Record<string, unknown> = {}): Promise<string> {
  const Page = createDiscoveryCockpitPage({
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }),
    createAdminClient: () => ({}) as never,
    loadEnrollment: async () => enrollment,
    loadIntake: async () => intake,
    loadModel: async () => model(),
    loadQuizLead: async () => null,
    loadPreflight: async () => ({ status: "ready" }),
    loadCallSheet: async () => null,
    ...overrides,
  })
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} }
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router as never}>
      {await Page({ params: Promise.resolve({ enrollmentId: ids.enrollment }) })}
    </AppRouterContext.Provider>,
  )
}

/** The markup of the bucket entry whose header carries this category chip. */
function entryOf(markup: string, categoryLabel: string): string {
  // The buckets start at „Behalten" (after the Klären banner and her product list).
  const phase3 = markup.slice(markup.indexOf(">Behalten</h3>"))
  const start = phase3.indexOf(`text-[var(--brand-plum)]">${categoryLabel}</span>`)
  assert.ok(start >= 0, `no entry for ${categoryLabel}`)
  return phase3.slice(start, phase3.indexOf("Entscheidung", start))
}

// --- the page ---------------------------------------------------------------------------

test("the runsheet renders its six phases in order", async () => {
  const markup = await renderPage()
  const positions = [
    "Vor dem Call",
    ">Eröffnen<",
    ">Problem<",
    ">Produkte<",
    ">Routine<",
    ">Feedback &amp; nächste Schritte<",
    ">Abschluss<",
  ].map((marker) => markup.indexOf(marker))
  assert.ok(
    positions.every((at) => at >= 0),
    `missing phase: ${positions}`,
  )
  assert.deepEqual(
    positions,
    [...positions].sort((left, right) => left - right),
  )
})

test("join rule: her conditioner in research fills the empty conditioner step — never „benutzt nichts“", async () => {
  const markup = await renderPage()
  // The Klären banner names it, with the barcode, before the call.
  assert.ok(markup.includes("Klären"))
  assert.ok(markup.includes(`Gescanntes Produkt · ${GTIN}`))
  const entry = entryOf(markup, "Conditioner")
  assert.ok(entry.includes("Ihr Produkt — noch in Recherche"))
  assert.ok(entry.includes(GTIN))
  assert.ok(!entry.includes("Kein Produkt angegeben"))
  assert.ok(!markup.includes(USES_NOTHING))
  assert.ok(!markup.includes("Lücke in der Idealroutine"))
  // The week names it too instead of an open step.
  const phase4 = markup.slice(markup.indexOf('id="runsheet-phase-4"'))
  assert.ok(phase4.includes(`Gescanntes Produkt · ${GTIN} — noch in Recherche`))
})

test("join rule is display only: the research gate still holds and still blocks finalising", async () => {
  const view = buildDiscoveryCockpitView(model())
  const before = structuredClone(view.unassigned)
  const display = composeRunsheetProducts({ steps: view.steps, unassigned: view.unassigned })
  assert.deepEqual(view.unassigned, before)
  assert.deepEqual(
    discoveryResearchOpenItems(view).map((entry) => entry.itemId),
    [ids.scannedItem],
  )
  const joined = display.tauschenOderNeu.find((entry) => entry.step.category === "conditioner")
  assert.ok(joined?.research)
  const markup = await renderPage()
  assert.ok(markup.includes("Erst Recherche abschließen — 1 Produkt noch in Recherche."))
})

test("without research the empty step still reads as a gap — the join only fires on research", () => {
  const view = buildDiscoveryCockpitView(model())
  const display = composeRunsheetProducts({ steps: view.steps, unassigned: [] })
  const conditioner = display.tauschenOderNeu.find((entry) => entry.step.category === "conditioner")
  assert.equal(conditioner?.research, null)
  // No recommendation to offer: filed as an open step, so its choice stays reachable.
  assert.equal(conditioner?.kind, "offen")
})

test("buckets: her mismatched shampoo is a proposed swap, with category anchor, verdict and reasoning", async () => {
  const markup = await renderPage({ loadCallSheet: async () => callSheet })
  const entry = entryOf(markup, "Shampoo")
  assert.ok(entry.includes("Passt nicht"))
  assert.ok(entry.includes("Vorschlag: Tauschen"))
  assert.ok(entry.includes("Anti-Schuppen trocknet ihre Kopfhaut weiter aus."))
  assert.ok(markup.includes("Tauschen zu Sebamed Urea 5% Shampoo"))
  assert.ok(markup.includes("Nichts zum Behalten vorgeschlagen."))
  assert.ok(markup.includes("Ziel „Form &amp; Halt“: offen ansprechen."))
})

test("a legacy enrollment without a call sheet renders every new section empty", async () => {
  const markup = await renderPage()
  assert.ok(markup.includes("Noch nicht erfasst — Diagnose vor dem Call eintragen."))
  assert.ok(markup.includes("Noch keine Hebel erfasst."))
  assert.ok(markup.includes("Noch keine Gewohnheiten erfasst."))
  assert.ok(markup.includes("Noch keine Touchpoints vereinbart."))
  assert.ok(!markup.includes("Mit Plan"))
  assert.ok(markup.includes("Baseline-Score abfragen (1–10) und oben eintragen"))
})

test("a call sheet fills the score tile, the staircase and the follow-ups", async () => {
  const markup = await renderPage({ loadCallSheet: async () => callSheet })
  assert.ok(markup.includes("Mit Plan"))
  assert.ok(markup.includes("Hebel · von 4 auf 8"))
  assert.ok(markup.includes("Feines, blondiertes Haar mit aufgerauten Längen."))
  assert.ok(markup.includes('value="Schaden stoppen"'))
  assert.ok(markup.includes("steht auf ihrem PDF"))
  assert.ok(markup.includes("25.10.2026 · Re-Score-Call"))
  assert.ok(markup.includes("Sehr hilfreich."))
  assert.ok(!markup.includes("Baseline-Score abfragen"))
})

test("a failing call-sheet read leaves the runsheet empty instead of failing the call", async () => {
  const original = console.error
  console.error = () => {}
  try {
    const markup = await renderPage({
      loadCallSheet: async () => {
        throw new Error("relation does not exist")
      },
    })
    assert.ok(markup.includes("Noch keine Hebel erfasst."))
    assert.ok(markup.includes("Finalisieren"))
  } finally {
    console.error = original
  }
})

test("checklist: research with GTIN, bleach cadence and detangling asks from her profile", async () => {
  const markup = await renderPage()
  assert.ok(markup.includes(`Recherche abschließen — Gescanntes Produkt · ${GTIN} (Conditioner)`))
  assert.ok(
    markup.includes(
      "Im Call klären: Färbe-/Blondier-Rhythmus · Kamm oder Bürste, wie sie entwirrt · wo sie einkauft",
    ),
  )
  // R17: the same asks sit as „kurz fragen" chips in the Hebel card.
  assert.ok(markup.includes("kurz fragen: Färbe-/Blondier-Rhythmus"))
})

test("routine: wash day and in-between days, today's wash frequency, no price row", async () => {
  const markup = await renderPage()
  const phase4 = markup.slice(
    markup.indexOf('id="runsheet-phase-4"'),
    markup.indexOf('id="runsheet-phase-5"'),
  )
  assert.ok(phase4.includes("Waschtag"))
  assert.ok(phase4.includes("Tage ohne Wäsche"))
  assert.ok(phase4.includes("Sebamed"))
  assert.ok(phase4.includes("heute 2× pro Woche"))
  assert.ok(!phase4.includes("€"))
})

test("closing: the approved referral text, the copy button, and the unchanged finalize bar", async () => {
  const markup = await renderPage()
  assert.equal(
    DISCOVERY_REFERRAL_MESSAGE,
    "Hey! Ich hatte gerade eine kostenlose Haar-Beratung bei Chaarlie — 30 Minuten, und danach hatte ich einen kompletten Plan mit Produkten, die wirklich zu meinem Haar passen. Falls du auch nicht ganz zufrieden bist: chaarlie.de/lp/call",
  )
  assert.ok(markup.includes(DISCOVERY_REFERRAL_MESSAGE))
  assert.ok(markup.includes("Nachricht kopieren"))
  const phase6 = markup.slice(markup.indexOf('id="runsheet-phase-6"'))
  assert.ok(phase6.includes("Finalisieren"))
  assert.ok(phase6.includes("PDF: gesperrt"))
  assert.ok(phase6.includes("noch nicht finalisiert"))
})

// --- pure helpers -------------------------------------------------------------------------

test("score helpers: staircase capped at 10, German decimals, strict parsing", () => {
  assert.deepEqual(runsheetScoreSteps(4, [1.5, 1.5, 1]), [4, 5.5, 7, 8])
  assert.deepEqual(runsheetScoreSteps(8, [3, null]), [8, 10, 10])
  assert.equal(formatRunsheetScore(5.5), "5,5")
  assert.equal(formatRunsheetScore(8), "8")
  assert.equal(parseRunsheetPoints("1,5"), 1.5)
  assert.equal(parseRunsheetPoints(""), null)
  assert.equal(parseRunsheetPoints("viel"), null)
  assert.equal(parseRunsheetBaseline("4"), 4)
  assert.equal(parseRunsheetBaseline("11"), null)
  assert.equal(parseRunsheetBaseline("4,5"), null)
})

test("touchpoint dates: +2/+4 weeks as ISO dates, shown as German dates", () => {
  assert.equal(runsheetDueOn(new Date(2026, 8, 27), 2), "2026-10-11")
  assert.equal(runsheetDueOn(new Date(2026, 11, 20), 4), "2027-01-17")
  assert.equal(formatRunsheetDueOn("2026-10-11"), "11.10.2026")
})

test("call sheet parser: legacy/garbage rows degrade to empty, never throw", () => {
  const empty = parseDiscoveryCallSheet({
    baseline_score: null,
    rescores: [],
    touchpoints: [],
    consult_brief: null,
    habit_commitments: [],
    feedback: null,
  })
  assert.deepEqual(empty, {
    baselineScore: null,
    rescores: [],
    touchpoints: [],
    consultBrief: null,
    habitCommitments: [],
    feedback: null,
  })
  const junk = parseDiscoveryCallSheet({
    baseline_score: 12,
    touchpoints: [
      { kind: "sms", due_on: "2026-10-11" },
      { kind: "text_checkin", due_on: "bald" },
    ],
    consult_brief: { sections: { hebel: [{ title: 3, points: "viel" }], swapReasons: { a: 1 } } },
    habit_commitments: "nope",
  })
  assert.equal(junk.baselineScore, null)
  assert.deepEqual(junk.touchpoints, [])
  assert.deepEqual(junk.consultBrief?.sections.hebel, [{ title: "", note: "", points: null }])
  assert.deepEqual(junk.consultBrief?.sections.swapReasons, {})
  assert.deepEqual(junk.habitCommitments, [])
})

test("checklist lines: one research line per product, the asks on one line", () => {
  const lines = runsheetChecklistLines([
    {
      id: "research_open:x",
      kind: "research_open",
      intakeItemId: "x",
      label: "Balea Spülung",
      category: "conditioner",
      gtin: "4001",
    },
    { id: "score_missing", kind: "score_missing" },
    { id: "ask_where_she_shops", kind: "ask_where_she_shops" },
  ])
  assert.deepEqual(
    lines.map((line) => line.label),
    [
      "Recherche abschließen — Balea Spülung · 4001 (Conditioner)",
      "Baseline-Score abfragen (1–10) und oben eintragen",
      "Consult-Brief prüfen (Diagnose, Hebel, Begründungen)",
      "Im Call klären: wo sie einkauft",
    ],
  )
})
