import assert from "node:assert/strict"
import test from "node:test"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { createDiscoveryCockpitPage } from "../src/app/admin/beratung/[enrollmentId]/page"
import {
  DISCOVERY_REFERRAL_MESSAGE,
  DiscoveryCallCockpit,
  StepDecision,
} from "../src/components/discovery/cockpit/discovery-call-cockpit"
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
import {
  composeRunsheetOutsideRoutine,
  composeRunsheetProducts,
} from "../src/components/discovery/cockpit/runsheet-products"
import { DiscoveryRunsheetRoutine } from "../src/components/discovery/cockpit/runsheet-routine"
import { parseDiscoveryCallSheet, type DiscoveryCallSheet } from "../src/lib/discovery/call-sheet"
import {
  buildDiscoveryCockpitView,
  discoveryOwnedProductIdentities,
  discoveryResearchOpenItems,
  type DiscoveryCallIntake,
  type DiscoveryCockpitModel,
} from "../src/lib/discovery/cockpit"
import { discoveryConcernCoverageInput } from "../src/lib/discovery/concern-recipe-view"
import type { DiscoveryEnrollment } from "../src/lib/discovery/enrollment"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import type { DiscoveryParticipantVerdict } from "../src/lib/discovery/load-participant-verdicts"
import {
  composeDiscoveryRefinedRoutine,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"
import type {
  ScanAlternativePresentation,
  ScanPresentedVerdictPayload,
} from "../src/lib/scan/types"

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

function model(
  input: {
    steps?: DiscoveryIdealStep[]
    items?: DiscoveryIntakeItem[]
    verdicts?: DiscoveryParticipantVerdict[]
  } = {},
): DiscoveryCockpitModel {
  const steps = input.steps ?? [shampooStep, conditionerStep]
  const items = input.items ?? [shampooItem, scannedConditioner]
  const stepVerdicts = input.verdicts ?? verdicts
  return {
    status: "ready",
    steps,
    verdicts: stepVerdicts,
    previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
    routine: composeDiscoveryRefinedRoutine({
      steps,
      items,
      decisions: [],
      swapProducts: [],
      ownedProducts: discoveryOwnedProductIdentities(stepVerdicts),
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

/** The „Nicht in der Idealroutine" footer's markup; "" when the page renders none. */
function footerOf(markup: string): string {
  const start = markup.indexOf(">Nicht in der Idealroutine</h2>")
  return start < 0 ? "" : markup.slice(start, markup.indexOf("</section>", start))
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
  // F1/F4: the SAME render shows the item inside its category and still blocks finalising —
  // the gate reads the untouched projection, never the display join.
  assert.ok(entryOf(markup, "Conditioner").includes("Ihr Produkt — noch in Recherche"))
  assert.ok(markup.includes("Erst Recherche abschließen — 1 Produkt noch in Recherche."))
  // It lives in the Klären banner, never in „Nicht in der Idealroutine" (T4 c).
  assert.ok(!footerOf(markup).includes(GTIN))
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
  // T5: a legacy enrollment saves (upsert) — its save bars are not locked.
  assert.ok(markup.includes('id="runsheet-brief-save"'))
  assert.ok(markup.includes('id="runsheet-follow-up-save"'))
  assert.ok(!markup.includes("Call-Sheet nicht geladen"))
})

test("a call sheet fills the score tile, the staircase and the follow-ups", async () => {
  const markup = await renderPage({ loadCallSheet: async () => callSheet })
  assert.ok(markup.includes("Mit Plan"))
  assert.ok(markup.includes("Hebel · von 4 auf 8"))
  assert.ok(markup.includes("Feines, blondiertes Haar mit aufgerauten Längen."))
  assert.ok(markup.includes('value="Schaden stoppen"'))
  assert.ok(markup.includes("für ihr PDF vorgemerkt"))
  assert.ok(!markup.includes("steht auf ihrem PDF"))
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
    // T5: unread is not „none yet" — both save bars are locked, so the empty form cannot
    // overwrite the stored row.
    assert.equal(
      markup.split("Call-Sheet nicht geladen — Seite neu laden, dann speichern.").length - 1,
      2,
    )
    assert.match(markup, /id="runsheet-brief-save" type="button" disabled=""/)
    assert.match(markup, /id="runsheet-follow-up-save" type="button" disabled=""/)
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

// --- join-rule guard cases ------------------------------------------------------------------

/** The view's scanned-conditioner research entry, re-labelled/re-homed for a guard case. */
function researchEntry(
  overrides: Partial<ReturnType<typeof buildDiscoveryCockpitView>["unassigned"][number]>,
) {
  const view = buildDiscoveryCockpitView(model())
  const base = view.unassigned.find((entry) => entry.itemId === ids.scannedItem)
  assert.ok(base, "fixture: scanned conditioner is unassigned research")
  return { ...base, ...overrides }
}

test("join rule (a): an empty step WITH an Idealplan recommendation (`neu`) shows her product in research", () => {
  const view = buildDiscoveryCockpitView(model())
  const recommendation = {
    productId: "30000000-0000-4000-8000-00000000000c",
    name: "Balea Feuchtigkeitsspülung",
    brand: "Balea",
    label: "Balea Feuchtigkeitsspülung",
    verdictLabel: "Passt",
    priceLabel: null,
    origin: "ideal_recommendation" as const,
    propertyRows: null,
  }
  const steps = view.steps.map((step) =>
    step.category === "conditioner"
      ? {
          ...step,
          outcome: "ideal" as const,
          idealRecommendation: recommendation,
          recommendationLabel: recommendation.label,
          swapOptions: [recommendation],
        }
      : step,
  )
  const display = composeRunsheetProducts({ steps, unassigned: view.unassigned })
  const conditioner = display.tauschenOderNeu.filter(
    (entry) => entry.step.category === "conditioner",
  )
  assert.equal(conditioner.length, 1)
  assert.equal(conditioner[0]!.kind, "neu")
  assert.deepEqual(conditioner[0]!.research, {
    label: `Gescanntes Produkt · ${GTIN}`,
    gtin: null, // already in the label — never twice
  })
  // Rendered: the slot names her product, never „Kein Produkt"/„benutzt nichts"; the
  // „Neu:" choice stays live.
  const router = { refresh() {}, push() {}, replace() {}, prefetch() {}, back() {}, forward() {} }
  const markup = renderToStaticMarkup(
    <AppRouterContext.Provider value={router as never}>
      <DiscoveryCallCockpit
        enrollmentId={ids.enrollment}
        steps={steps}
        unassigned={view.unassigned}
        submitted
        initialFinalizedAt={null}
      />
    </AppRouterContext.Provider>,
  )
  const entry = entryOf(markup, "Conditioner")
  assert.ok(entry.includes("Ihr Produkt — noch in Recherche"))
  assert.ok(!entry.includes("Kein Produkt angegeben"))
  assert.ok(!markup.includes(USES_NOTHING))
  assert.ok(markup.includes("Neu: Balea Feuchtigkeitsspülung"))
})

test("join rule (b): two products of one category in research — the first fills the slot, both stay in Klären", () => {
  const view = buildDiscoveryCockpitView(model())
  const second = researchEntry({
    itemId: "50000000-0000-4000-8000-000000000009",
    label: "Balea Spülung (Freitext)",
  })
  const display = composeRunsheetProducts({
    steps: view.steps,
    unassigned: [...view.unassigned, second],
  })
  assert.deepEqual(
    display.klaeren.map((entry) => entry.intakeItemId),
    [ids.scannedItem, second.itemId],
  )
  const slots = display.tauschenOderNeu.filter((entry) => entry.step.category === "conditioner")
  assert.equal(slots.length, 1, "one slot per empty step, not one per research item")
  assert.equal(slots[0]!.research?.label, `Gescanntes Produkt · ${GTIN}`)
})

/** Nomi's view with a SECOND empty conditioner step, both carrying an Idealplan proposal. */
function twoEmptyConditionerSteps() {
  const view = buildDiscoveryCockpitView(model())
  const recommendation = {
    productId: "30000000-0000-4000-8000-00000000000c",
    name: "Balea Feuchtigkeitsspülung",
    brand: "Balea",
    label: "Balea Feuchtigkeitsspülung",
    verdictLabel: "Passt",
    priceLabel: null,
    origin: "ideal_recommendation" as const,
    propertyRows: null,
  }
  const proposed = (step: (typeof view.steps)[number]) => ({
    ...step,
    outcome: "ideal" as const,
    idealRecommendation: recommendation,
    recommendationLabel: recommendation.label,
    swapOptions: [recommendation],
  })
  const conditioner = view.steps.find((step) => step.category === "conditioner")
  assert.ok(conditioner && conditioner.intakeItemId === null, "fixture: empty conditioner step")
  const second = {
    ...proposed(conditioner),
    decisionKey: "decision:conditioner:conditioner_weekly:gap",
    roleLabel: "Zweiter Conditioner",
  }
  const steps = view.steps.flatMap((step) =>
    step.category === "conditioner" ? [proposed(step), second] : [step],
  )
  return { view, steps, first: conditioner.decisionKey, second: second.decisionKey }
}

test("join rule (d): one product in research fills ONE slot — the first empty step of its category", () => {
  const { view, steps, first, second } = twoEmptyConditionerSteps()
  const display = composeRunsheetProducts({ steps, unassigned: view.unassigned })
  const conditioner = display.tauschenOderNeu.filter(
    (entry) => entry.step.category === "conditioner",
  )
  assert.deepEqual(
    conditioner.map((entry) => entry.step.decisionKey),
    [first, second],
  )
  assert.deepEqual(conditioner[0]!.research, { label: `Gescanntes Produkt · ${GTIN}`, gtin: null })
  assert.equal(conditioner[1]!.research, null, "a second empty step gets no research slot")
})

test("Phase 4 never proposes a product for a line whose Phase-3 slot is in research", () => {
  const { view, steps, first, second } = twoEmptyConditionerSteps()
  // As the page builds it: the research label per step, from the Phase-3 join.
  const researchLabels: Record<string, string> = {}
  for (const entry of composeRunsheetProducts({ steps, unassigned: view.unassigned })
    .tauschenOderNeu) {
    if (entry.research) researchLabels[entry.step.decisionKey] ??= entry.research.label
  }
  assert.deepEqual(Object.keys(researchLabels), [first])
  const markup = renderToStaticMarkup(
    <DiscoveryRunsheetRoutine
      view={{ ...view, steps }}
      washFrequencyLabel={null}
      researchLabels={researchLabels}
    />,
  )
  const lines = [...markup.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1]!)
  const researchLine = lines.find((line) => line.includes(`Gescanntes Produkt · ${GTIN}`))
  assert.ok(researchLine, "the research line is in the week")
  assert.ok(researchLine.includes("noch in Recherche"))
  assert.ok(!researchLine.includes("Vorschlag"), researchLine)
  // Exactly one line names her product; the second empty step keeps its own proposal.
  assert.equal(lines.filter((line) => line.includes("noch in Recherche")).length, 1)
  assert.equal(lines.filter((line) => line.includes("Vorschlag: Balea")).length, 1)
})

test("join rule (c): research in a category whose step is BOUND to her product joins nothing", () => {
  const view = buildDiscoveryCockpitView(model())
  const shampooResearch = researchEntry({
    itemId: "50000000-0000-4000-8000-00000000000a",
    category: "shampoo",
    label: "Zweites Shampoo (Freitext)",
  })
  const unassigned = [...view.unassigned, shampooResearch]
  const display = composeRunsheetProducts({ steps: view.steps, unassigned })
  const shampooEntries = [...display.behalten, ...display.tauschenOderNeu].filter(
    (entry) => entry.step.category === "shampoo",
  )
  assert.equal(shampooEntries.length, 1)
  assert.equal(shampooEntries[0]!.kind, "owned")
  assert.equal(shampooEntries[0]!.research, null)
  assert.ok(display.klaeren.some((entry) => entry.intakeItemId === shampooResearch.itemId))
  // Rendered: her owned shampoo keeps its verdict.
  const router = { refresh() {}, push() {}, replace() {}, prefetch() {}, back() {}, forward() {} }
  const markup = renderToStaticMarkup(
    <AppRouterContext.Provider value={router as never}>
      <DiscoveryCallCockpit
        enrollmentId={ids.enrollment}
        steps={view.steps}
        unassigned={unassigned}
        submitted
        initialFinalizedAt={null}
      />
    </AppRouterContext.Provider>,
  )
  const entry = entryOf(markup, "Shampoo")
  assert.ok(entry.includes("Passt nicht zu deinem Haar"))
  assert.ok(!entry.includes("noch in Recherche"))
})

// --- T4 (b): the recipe's „hat sie" counts what she captured, research included -----------

/** A personal-plan quiz lead with „Trockene Längen" as her main problem (primary: Conditioner). */
const dryLengthsLead = {
  id: "60000000-0000-4000-8000-000000000002",
  quiz_kind: "personal_plan",
  quiz_answers: {
    kind: "personal_plan",
    version: 3,
    answers: {
      texture: "straight",
      thickness: "fine",
      currentConcerns: ["dry_lengths"],
      primaryConcern: "dry_lengths",
    },
  },
}

/** The coverage pills of one „Damit anfangen" row of the recipe. */
function recipePrimaryRow(markup: string, categoryLabel: string): string {
  const block = markup.slice(markup.indexOf(">Damit anfangen</h3>"))
  const rows = block.slice(0, block.indexOf("</ul>")).split("<li")
  const row = rows.find((entry) => entry.includes(`>${categoryLabel}</span>`))
  assert.ok(row, `no recipe row for ${categoryLabel}`)
  return row
}

test("recipe: her scanned conditioner still in research counts as „hat sie“", async () => {
  const view = buildDiscoveryCockpitView(model())
  assert.ok(discoveryConcernCoverageInput(view).owned.has("conditioner"))
  const markup = await renderPage({ loadQuizLead: async () => dryLengthsLead })
  const row = recipePrimaryRow(markup, "Conditioner")
  assert.ok(row.includes(">hat sie</span>"), row)
  assert.ok(!row.includes("hat sie nicht"), row)
  // Control: without that capture the same row reads „hat sie nicht".
  const without = await renderPage({
    loadQuizLead: async () => dryLengthsLead,
    loadModel: async () => model({ items: [shampooItem] }),
  })
  assert.ok(recipePrimaryRow(without, "Conditioner").includes("hat sie nicht"))
})

test("recipe habits pre-fill with ids from their wording, never their position", async () => {
  const markup = await renderPage({ loadQuizLead: async () => dryLengthsLead })
  const habitIds = [...markup.matchAll(/id="(runsheet-habit-[^"]+)"/g)].map((match) => match[1]!)
  const recipeIds = habitIds.filter((id) => id.startsWith("runsheet-habit-recipe--"))
  assert.ok(recipeIds.length > 0, habitIds.join(", "))
  for (const id of recipeIds) assert.doesNotMatch(id, /--\d+$/, id)
  assert.equal(new Set(habitIds).size, habitIds.length)
})

// --- T4 (c): „Nicht in der Idealroutine" never contradicts the page above -----------------

function emptyStep(
  category: DiscoveryIdealStep["category"],
  role: DiscoveryIdealStep["role"],
  categoryLabel: string,
): DiscoveryIdealStep {
  return {
    ...conditionerStep,
    decisionKey: `decision:${category}:${role}:gap`,
    category,
    role,
    categoryLabel,
    roleLabel: categoryLabel,
  }
}

function declinedItem(category: DiscoveryIntakeItem["category"], n: number): DiscoveryIntakeItem {
  return {
    id: `50000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`,
    category,
    source: "none",
    brandText: null,
    productNameText: null,
    barcodeIdentifier: null,
    productId: null,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:10:00.000Z",
  }
}

/** Nomi, fuller: Leave-in/Bondbuilder/Kopfhautpflege/Hitzeschutz are steps she has nothing for. */
function nomiFull(): DiscoveryCockpitModel {
  return model({
    steps: [
      shampooStep,
      conditionerStep,
      emptyStep("leave_in", "post_wash_leave_in", "Leave-in"),
      emptyStep("bondbuilder", "specialized_bond_treatment", "Bondbuilder"),
      emptyStep("scalp_care", "scalp_comfort", "Kopfhautpflege"),
      emptyStep("heat_protectant", "pre_heat_protection", "Hitzeschutz"),
    ],
    items: [
      shampooItem,
      scannedConditioner,
      // „benutze ich nicht" for three step categories and for oil, which has no step.
      declinedItem("leave_in", 1),
      declinedItem("bondbuilder", 2),
      declinedItem("heat_protectant", 3),
      declinedItem("oil", 4),
    ],
  })
}

test("footer: never names a category that is a step above — only the genuinely unused ones", async () => {
  const markup = await renderPage({ loadModel: async () => nomiFull() })
  const footer = footerOf(markup)
  assert.ok(footer, "the footer renders")
  for (const label of ["Leave-in", "Bondbuilder", "Kopfhautpflege", "Hitzeschutz", "Conditioner"]) {
    assert.ok(!footer.includes(label), `footer names ${label}: ${footer}`)
  }
  assert.ok(footer.includes("Öl — benutzt sie nicht. Keine Entscheidung nötig."), footer)
  // Her product in research lives in the Klären banner only.
  assert.ok(!footer.includes("Noch in Recherche"))
  assert.ok(!footer.includes(GTIN))
  // The unanswered categories without a step are still asked about.
  assert.ok(footer.includes("Nicht angegeben:"), footer)
  assert.ok(footer.includes("— im Call fragen."))
})

test("footer: products the buckets or Klären already show are not listed a second time", () => {
  const categoryOpen = researchEntry({
    itemId: "50000000-0000-4000-8000-0000000000b1",
    category: null,
    reason: "category_unknown",
    label: "Balea Wunderpflege",
  })
  const noStep = researchEntry({
    itemId: "50000000-0000-4000-8000-0000000000b2",
    category: "mask",
    reason: "no_ideal_step",
    label: "Garnier Maske",
  })
  const styling = researchEntry({
    itemId: "50000000-0000-4000-8000-0000000000b3",
    category: null,
    reason: "styling_not_evaluated",
    label: "Taft Spray",
  })
  const view = buildDiscoveryCockpitView(model())
  const outside = composeRunsheetOutsideRoutine({
    steps: view.steps,
    unassigned: [...view.unassigned, categoryOpen, noStep, styling],
    // mask has a no-step product (Weglassen), conditioner has a step and research, oil is
    // genuinely unused.
    declinedCategories: ["conditioner", "mask", "oil"],
    unansweredCategories: ["shampoo", "mask", "leave_in"],
    submitted: true,
  })
  assert.deepEqual(outside, { declined: ["oil"], unanswered: ["leave_in"] })
  // Before submitting, unanswered categories are simply not done yet.
  assert.deepEqual(
    composeRunsheetOutsideRoutine({
      steps: view.steps,
      unassigned: view.unassigned,
      declinedCategories: [],
      unansweredCategories: ["leave_in"],
      submitted: false,
    }),
    { declined: [], unanswered: [] },
  )
})

test("footer: nothing genuinely unused — no footer at all", async () => {
  // A draft has no „Nicht angegeben" yet and she declined nothing: no empty frame.
  const markup = await renderPage({
    loadIntake: async () => ({ ...intake, state: "draft", submittedAt: null }),
  })
  assert.equal(footerOf(markup), "")
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

// --- verdict-layer T2 (R19): prices on the alternatives, sortable by fit or price -----------

const priced = {
  a: "30000000-0000-4000-8000-0000000000a1",
  b: "30000000-0000-4000-8000-0000000000b1",
  c: "30000000-0000-4000-8000-0000000000c1",
}

function alternative(productId: string, displayName: string, priceLabel: string | null) {
  return {
    productId,
    displayName,
    imageUrl: null,
    priceLabel,
    netContentLabel: null,
    verdict: "ideal" as const,
    verdictLabel: "Passt",
    brand: null,
    purchaseUrl: null,
  }
}

/** Her shampoo's verdict with these alternatives, in the engine's (fit) order. */
function verdictsWith(alternatives: ScanAlternativePresentation[]) {
  if (payload.kind !== "in_catalog") throw new Error("fixture")
  return [
    { ...verdicts[0]!, payload: { ...payload, alternatives } },
  ] as DiscoveryParticipantVerdict[]
}

const pricedVerdicts = verdictsWith([
  alternative(priced.a, "Alpha Shampoo", "9,95\u00a0€"),
  alternative(priced.b, "Beta Shampoo", null),
  alternative(priced.c, "Gamma Shampoo", "3,45\u00a0€"),
])

/** Each option's `<label>` markup in the shampoo entry's decision column, in render order. */
function shampooChoices(markup: string): string[] {
  const entry = markup.slice(markup.indexOf(">Behalten</h3>"))
  const decision = entry.slice(entry.indexOf(">Entscheidung<"))
  const next = decision.indexOf(">Entscheidung<", 1)
  return (next < 0 ? decision : decision.slice(0, next))
    .split("<label")
    .slice(1)
    .filter((choice) => choice.includes("Tauschen zu"))
}

test("prices: an alternative with a price shows it, one without shows no price line", async () => {
  const markup = await renderPage({ loadModel: async () => model({ verdicts: pricedVerdicts }) })
  const choices = shampooChoices(markup)
  const alpha = choices.find((choice) => choice.includes("Alpha Shampoo"))
  const beta = choices.find((choice) => choice.includes("Beta Shampoo"))
  assert.ok(alpha?.includes("9,95\u00a0€"))
  assert.ok(beta, "no Beta choice")
  assert.ok(!beta.includes("€"))
  // No retailer line: the catalog carries no retailer field.
  assert.ok(!beta.includes("text-[12px] leading-5 text-muted-foreground"))
})

test("prices: the default order is the engine's (fit) order — unchanged, „Fit“ active", async () => {
  const markup = await renderPage({ loadModel: async () => model({ verdicts: pricedVerdicts }) })
  const order = shampooChoices(markup).map((choice) =>
    ["Alpha", "Beta", "Gamma"].find((name) => choice.includes(`${name} Shampoo`)),
  )
  assert.deepEqual(order, ["Alpha", "Beta", "Gamma"])
  const key = `${shampooStep.decisionKey}:${ids.shampooItem}`
  assert.ok(markup.includes(`id="swap-sort-${key}-fit" type="button" aria-pressed="true"`))
  assert.ok(markup.includes(`id="swap-sort-${key}-price" type="button" aria-pressed="false"`))
})

test("prices: no toggle where there is nothing to sort (one option, or none priced)", async () => {
  const unpriced = verdictsWith([
    alternative(priced.a, "Alpha Shampoo", null),
    alternative(priced.b, "Beta Shampoo", null),
  ])
  for (const stepVerdicts of [verdicts, unpriced]) {
    const markup = await renderPage({ loadModel: async () => model({ verdicts: stepVerdicts }) })
    assert.ok(!markup.includes('id="swap-sort-'))
  }
})

test("prices: legacy data without price fields renders without a price line or an error", async () => {
  const { priceLabel: _dropped, ...legacyAlternative } = alternative(
    priced.a,
    "Alpha Shampoo",
    null,
  )
  void _dropped
  const legacyVerdicts = verdictsWith([legacyAlternative as never])
  const legacyConditioner: DiscoveryIdealStep = {
    ...conditionerStep,
    preview: {
      kind: "recommendation",
      category: "conditioner",
      role: "conditioner_rinse_out",
      decisionKey: conditionerStep.decisionKey,
      productId: priced.c,
      productName: "Balea Feuchtigkeitsspülung",
      imageUrl: null,
      verdict: "ideal",
      authorityVersion: "v1",
      factFingerprint: "fp",
      reasoning: { productCriteria: "Leicht.", fit: "Passt.", frequency: "nach jeder Wäsche" },
    } as never,
  }
  const legacyModel = model({
    steps: [shampooStep, legacyConditioner],
    items: [shampooItem],
    verdicts: legacyVerdicts,
  })
  const view = buildDiscoveryCockpitView(legacyModel)
  assert.deepEqual(
    view.steps.map((step) => step.swapOptions.map((option) => option.priceLabel)),
    [[null], [null]],
  )
  const markup = await renderPage({ loadModel: async () => legacyModel })
  assert.ok(markup.includes("Alpha Shampoo"))
  assert.ok(markup.includes("Neu: Balea Feuchtigkeitsspülung"))
  assert.ok(!markup.includes("€"))
})

test("prices: the read model carries the Idealplan recommendation's price onto its option", () => {
  const withPrice: DiscoveryIdealStep = {
    ...conditionerStep,
    preview: {
      kind: "recommendation",
      category: "conditioner",
      role: "conditioner_rinse_out",
      decisionKey: conditionerStep.decisionKey,
      productId: priced.c,
      productName: "Balea Feuchtigkeitsspülung",
      imageUrl: "https://catalog.example/conditioner.jpg",
      verdict: "ideal",
      authorityVersion: "v1",
      factFingerprint: "fp",
      commerce: {
        priceEur: 2.45,
        purchaseLinkStatus: "available",
        netContentValue: null,
        netContentUnit: null,
        priceLabel: "2,45\u00a0€",
        netContentLabel: null,
        availabilityLabel: null,
        productUrl: null,
        affiliateDisclosure: null,
      },
      reasoning: { productCriteria: "Leicht.", fit: "Passt.", frequency: "nach jeder Wäsche" },
    },
  }
  const view = buildDiscoveryCockpitView(
    model({ steps: [shampooStep, withPrice], items: [shampooItem] }),
  )
  const conditioner = view.steps.find((step) => step.category === "conditioner")
  assert.equal(conditioner?.swapOptions[0]?.priceLabel, "2,45\u00a0€")
  assert.equal(conditioner?.idealRecommendation?.priceLabel, "2,45\u00a0€")
})

/** StepDecision under a hand-rolled `useState` (no jsdom here — see discovery-call-sheet-save). */
function stepDecisionHarness(props: React.ComponentProps<typeof StepDecision>) {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown }
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const values: unknown[] = []
  let cursor = 0
  const dispatcher = {
    useState<T>(initial: T): [T, (next: T) => void] {
      const index = cursor++
      if (values.length <= index) values[index] = initial
      return [values[index] as T, (next) => (values[index] = next)]
    },
  }
  return function renderOnce(): React.ReactElement {
    const previous = internals.H
    internals.H = dispatcher
    try {
      cursor = 0
      return StepDecision(props) as React.ReactElement
    } finally {
      internals.H = previous
    }
  }
}

type AnyElement = React.ReactElement<Record<string, any>>

function flatten(node: React.ReactNode): AnyElement[] {
  if (Array.isArray(node)) return node.flatMap(flatten)
  if (!React.isValidElement(node)) return []
  const element = node as AnyElement
  return [element, ...React.Children.toArray(element.props.children).flatMap(flatten)]
}

test("sort toggle: „Preis“ reorders ascending, priceless last; „Fit“ restores the engine order", () => {
  const view = buildDiscoveryCockpitView(model({ verdicts: pricedVerdicts }))
  const step = view.steps.find((entry) => entry.category === "shampoo")!
  const render = stepDecisionHarness({
    step,
    name: "k",
    value: "",
    dropAllowed: true,
    takenSwapIds: [],
    disabled: false,
    onChoose: () => {},
  })
  const optionOrder = (tree: React.ReactElement) =>
    flatten(tree)
      .filter((element) => element.props.name === "k" && element.props.value !== "keep")
      .map((element) => element.props.value)
  const button = (tree: React.ReactElement, id: string) =>
    flatten(tree).find((element) => element.props.id === `swap-sort-k-${id}`)!

  let tree = render()
  assert.deepEqual(optionOrder(tree), [priced.a, priced.b, priced.c])
  button(tree, "price").props.onClick()
  tree = render()
  assert.deepEqual(optionOrder(tree), [priced.c, priced.a, priced.b])
  assert.equal(button(tree, "price").props["aria-pressed"], true)
  assert.match(button(tree, "price").props.className, /brand-plum/)
  assert.doesNotMatch(button(tree, "price").props.className, /coral/)
  button(tree, "fit").props.onClick()
  tree = render()
  assert.deepEqual(optionOrder(tree), [priced.a, priced.b, priced.c])
  // Display only: the view's own list is never reordered.
  assert.deepEqual(
    step.swapOptions.map((option) => option.productId),
    [priced.a, priced.b, priced.c],
  )
})
