import assert from "node:assert/strict"
import test from "node:test"

import { JSDOM } from "jsdom"
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
  formatRunsheetWeeklyBand,
  runsheetChecklistLines,
} from "../src/components/discovery/cockpit/runsheet-parts"
import {
  composeRunsheetOutsideRoutine,
  composeRunsheetProducts,
} from "../src/components/discovery/cockpit/runsheet-products"
import {
  DiscoveryRunsheetRoutine,
  runsheetWeek,
  runsheetWeekPlacement,
} from "../src/components/discovery/cockpit/runsheet-routine"
import { ScanVerdictSections } from "../src/components/scan/scan-verdict-sections"
import { parseDiscoveryCallSheet, type DiscoveryCallSheet } from "../src/lib/discovery/call-sheet"
import {
  buildDiscoveryCockpitView,
  discoveryOwnedProductIdentities,
  discoveryResearchOpenItems,
  type DiscoveryCallIntake,
  type DiscoveryCockpitModel,
} from "../src/lib/discovery/cockpit"
import { cockpitVoice } from "../src/lib/discovery/cockpit-copy"
import { discoveryConcernCoverageInput } from "../src/lib/discovery/concern-recipe-view"
import { concernRecipeFor } from "../src/lib/discovery/concern-recipes"
import { consultBriefSource } from "../src/lib/discovery/consult-brief/source"
import type { DiscoveryEnrollment } from "../src/lib/discovery/enrollment"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import type { DiscoveryParticipantVerdict } from "../src/lib/discovery/load-participant-verdicts"
import { buildDiscoveryQuizAnswers } from "../src/lib/discovery/quiz-answers"
import {
  composeDiscoveryRefinedRoutine,
  type DiscoveryCallDecision,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"
import type {
  ScanAlternativePresentation,
  ScanPresentedVerdictPayload,
} from "../src/lib/scan/types"
import {
  SCAN_NOT_NEEDED_REASON_COPY,
  scanNotNeededHeadline,
  scanNotNeededSubtitle,
} from "../src/lib/scan/verdict-labels"

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
const USES_NOTHING = "Aktuell ohne Produkt in diesem Schritt."

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
    decisions?: DiscoveryCallDecision[]
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
      decisions: input.decisions ?? [],
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
      mechanik: "Aufgeraute Längen entstehen meist durch Hitze, Reibung und Vorschädigung.",
      diagnose: "Feines, blondiertes Haar mit aufgerauten Längen.",
      hebel: [
        { title: "Schaden stoppen", note: "Hitzeschutz immer.", points: 1.5, bucket: "umgang" },
        {
          title: "Basics stärken",
          note: "Conditioner nach jeder Wäsche.",
          points: 1.5,
          bucket: "umgang",
        },
        { title: "Gezielt reparieren", note: "Leichte Maske.", points: 1, bucket: "produkt" },
      ],
      swapReasons: {
        [shampooStep.decisionKey]: "Anti-Schuppen trocknet ihre Kopfhaut weiter aus.",
      },
      // Stored pre-v4 field: still round-trips, but is no longer displayed or edited.
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
  assert.ok(entry.includes("Bisheriges Produkt — noch in Recherche"))
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
  assert.ok(entryOf(markup, "Conditioner").includes("Bisheriges Produkt — noch in Recherche"))
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
  // v4 (R27): a stored Ziel-Lücke is no longer displayed anywhere.
  assert.ok(!markup.includes("Form &amp; Halt"))
})

test("a legacy enrollment without a call sheet renders every new section empty", async () => {
  const markup = await renderPage()
  assert.ok(markup.includes("Noch nicht erfasst — Diagnose vor dem Call eintragen."))
  assert.ok(markup.includes("Noch keine Hebel erfasst."))
  // v4: the Gewohnheiten card is dissolved — its checkboxes sit in the Maßnahmen card's
  // Umgang group, next to two bucket-specific add buttons instead of one „Hebel hinzufügen".
  assert.ok(!markup.includes("Noch keine Gewohnheiten erfasst."))
  assert.ok(markup.includes('id="runsheet-mechanik"'))
  assert.ok(markup.includes('id="runsheet-hebel-add-produkt"'))
  assert.ok(markup.includes(">Produkt-Hebel hinzufügen<"))
  assert.ok(markup.includes('id="runsheet-hebel-add-umgang"'))
  assert.ok(markup.includes(">Umgang-Hebel hinzufügen<"))
  assert.ok(!markup.includes('id="runsheet-hebel-add"'))
  assert.ok(markup.includes('id="runsheet-habit-new"'))
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
  assert.ok(markup.includes("Maßnahmen · von 4 auf 8"))
  assert.ok(!markup.includes("Hebel · von"))
  assert.ok(
    markup.includes("Aufgeraute Längen entstehen meist durch Hitze, Reibung und Vorschädigung."),
  )
  assert.ok(markup.includes("Feines, blondiertes Haar mit aufgerauten Längen."))
  assert.ok(markup.includes('value="Schaden stoppen"'))
  // Grouped by bucket: Produkte (Gezielt reparieren) before Umgang mit dem Haar (the rest),
  // with the habit checkboxes inside the Maßnahmen card's Umgang group.
  const produkte = markup.indexOf(">Produkte<")
  const umgang = markup.indexOf(">Umgang mit dem Haar<")
  assert.ok(produkte >= 0 && umgang > produkte)
  const reparieren = markup.indexOf('value="Gezielt reparieren"')
  const schaden = markup.indexOf('value="Schaden stoppen"')
  assert.ok(produkte < reparieren && reparieren < umgang && umgang < schaden)
  const habit = markup.indexOf('id="runsheet-habit-h1"')
  assert.ok(habit > umgang && habit < markup.indexOf(">Für den Call<"))
  assert.ok(markup.indexOf('id="runsheet-mechanik"') < markup.indexOf('id="runsheet-diagnose"'))
  assert.ok(markup.includes("fürs PDF vorgemerkt"))
  assert.ok(!markup.includes("steht auf ihrem PDF"))
  assert.ok(markup.includes("25.10.2026 · Re-Score-Call"))
  assert.ok(markup.includes("Sehr hilfreich."))
  assert.ok(!markup.includes("Baseline-Score abfragen"))
})

// --- consult-agent T4: generate button + stale hint ------------------------------------------

const STALE_HINT = "Eingaben haben sich geändert — Brief neu generieren?"

/** The call sheet as generated from exactly what the page reads (the shared helper's hash). */
function generatedCallSheet(sourceHash: string): DiscoveryCallSheet {
  return {
    ...callSheet,
    consultBrief: {
      ...callSheet.consultBrief!,
      generated_at: "2026-09-28T08:00:00.000Z",
      generated_by: "agent",
      source_hash: sourceHash,
    },
  }
}

function pageHash(): string {
  const cockpitModel = model()
  return consultBriefSource({
    model: cockpitModel,
    view: buildDiscoveryCockpitView(cockpitModel),
    quiz: buildDiscoveryQuizAnswers(null),
    callSheet,
  }).sourceHash
}

test("generate button: „Brief erstellen“ for a legacy enrollment, „Neu generieren“ once generated", async () => {
  const legacy = await renderPage()
  assert.match(legacy, /id="runsheet-brief-generate"[^>]*>Brief erstellen</)
  assert.ok(!legacy.includes(STALE_HINT))
  const generated = await renderPage({
    loadCallSheet: async () => generatedCallSheet(pageHash()),
  })
  assert.match(generated, /id="runsheet-brief-generate"[^>]*>Neu generieren</)
  // It sits in Phase 2, before the Diagnose.
  const phase2 = generated.indexOf('id="runsheet-phase-2"')
  const button = generated.indexOf('id="runsheet-brief-generate"')
  assert.ok(phase2 >= 0 && button > phase2 && button < generated.indexOf('id="runsheet-diagnose"'))
})

test("stale hint: only when the stored hash differs from the page's own fingerprint", async () => {
  const fresh = await renderPage({ loadCallSheet: async () => generatedCallSheet(pageHash()) })
  assert.ok(!fresh.includes(STALE_HINT), "same inputs: the brief is current")
  const stale = await renderPage({ loadCallSheet: async () => generatedCallSheet("older-hash") })
  assert.ok(stale.includes(STALE_HINT))
})

test("stale hint: hidden when the page read degraded (quiz lead unread)", async () => {
  const original = console.error
  console.error = () => {}
  try {
    const markup = await renderPage({
      loadCallSheet: async () => generatedCallSheet("older-hash"),
      loadQuizLead: async () => {
        throw new Error("lead read failed")
      },
    })
    assert.ok(!markup.includes(STALE_HINT))
    // The button stays: the route reads for itself.
    assert.match(markup, /id="runsheet-brief-generate"[^>]*>Neu generieren</)
  } finally {
    console.error = original
  }
})

test("brief lists: Call-Fragen and Erwartungen show in Phase 2; Ziel-Lücken are gone (v4)", async () => {
  const withLists: DiscoveryCallSheet = {
    ...generatedCallSheet(pageHash()),
    consultBrief: {
      ...generatedCallSheet(pageHash()).consultBrief!,
      sections: {
        ...callSheet.consultBrief!.sections,
        callFragen: ["Wie oft glättest du?"],
        erwartungen: ["Erste Wirkung nach 4 Wochen", "Im Zweifel ärztlich abklären lassen."],
      },
    },
  }
  const markup = await renderPage({ loadCallSheet: async () => withLists })
  const phase2 = markup.slice(
    markup.indexOf('id="runsheet-phase-2"'),
    markup.indexOf('id="runsheet-brief-save"'),
  )
  assert.ok(phase2.includes(">Für den Call<"))
  // Each list says what it is for (iteration 3, T1).
  assert.ok(
    phase2.includes(
      '>Fragen für den Call</p><p class="text-[12px] text-muted-foreground">Antworten können den Plan ändern — im Call stellen.</p>',
    ),
  )
  assert.ok(
    phase2.includes(
      '>Erwartungen</p><p class="text-[12px] text-muted-foreground">Ehrliche Zeitfenster — so im Call aussprechen.</p>',
    ),
  )
  assert.ok(!phase2.includes("Form &amp; Halt"))
  assert.ok(!phase2.includes("runsheet-zielLuecken"))
  assert.ok(phase2.includes("Wie oft glättest du?"))
  assert.ok(phase2.includes("Im Zweifel ärztlich abklären lassen."))
})

test("R14: a draft intake shows the generate button disabled with its reason", async () => {
  const draft = await renderPage({
    loadIntake: async () => ({ ...intake, state: "draft", submittedAt: null }),
  })
  assert.match(draft, /id="runsheet-brief-generate" type="button" disabled=""/)
  assert.ok(draft.includes("Erst möglich, wenn die Checkliste abgeschickt ist."))
  const submitted = await renderPage()
  assert.ok(!/id="runsheet-brief-generate" type="button" disabled=""/.test(submitted))
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
      // Two save bars plus the R28 complexity choice (locked while the sheet is unread).
      3,
    )
    assert.match(markup, /id="runsheet-brief-save" type="button" disabled=""/)
    assert.match(markup, /id="runsheet-follow-up-save" type="button" disabled=""/)
    // T4: generating is locked too — its expected_state would be a guess.
    assert.match(markup, /id="runsheet-brief-generate" type="button" disabled=""/)
  } finally {
    console.error = original
  }
})

test("checklist: research with GTIN, bleach cadence and detangling asks from her profile", async () => {
  const markup = await renderPage()
  assert.ok(markup.includes(`Recherche abschließen — Gescanntes Produkt · ${GTIN} (Conditioner)`))
  assert.ok(
    markup.includes(
      "Im Call klären: Färbe-/Blondier-Rhythmus · Entwirren (Kamm oder Bürste) · Einkaufsort",
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

test("routine: each day is a table — Schritt | Produkt | Wann | Zweck, one row per step", async () => {
  const markup = await renderPage()
  const phase4 = markup.slice(
    markup.indexOf('id="runsheet-phase-4"'),
    markup.indexOf('id="runsheet-phase-5"'),
  )
  const tables = [...phase4.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((m) => m[1]!)
  assert.ok(tables.length > 0, phase4)
  const week = runsheetWeek(buildDiscoveryCockpitView(model()).steps)
  const expected = [week.washDay, week.offDays].filter((lines) => lines.length > 0)
  assert.equal(tables.length, expected.length)
  for (const [index, table] of tables.entries()) {
    const headers = [...table.matchAll(/<th scope="col"[^>]*>([^<]*)<\/th>/g)].map((m) => m[1])
    assert.deepEqual(headers, ["Schritt", "Produkt", "Wann", "Zweck"])
    const body = table.slice(table.indexOf("<tbody"))
    const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]!)
    const lines = expected[index]!
    assert.equal(rows.length, lines.length)
    for (const [row, line] of rows.map((row, i) => [row, lines[i]!] as const)) {
      // Each row is one step: its category heads the row, its cadence sits in „Wann“.
      assert.match(row, /^<th scope="row"/)
      assert.ok(row.includes(`>${line.categoryLabel}</th>`), row)
      assert.ok(row.includes(line.frequencyLabel), row)
    }
  }
})

test("week view: every product names its status — Entschieden, Vorschlag or Offen (A1)", () => {
  const week = runsheetWeek(buildDiscoveryCockpitView(model()).steps)
  const labels = [...week.washDay, ...week.offDays].flatMap((line) =>
    line.products.map((product) => product.label),
  )
  assert.ok(labels.length > 0)
  for (const label of labels) {
    assert.match(label, /^(Entschieden|Vorschlag|Offen): /, label)
  }
})

test("week placement: a step sits in every column it belongs to (A3)", () => {
  const at = (key: string, hotTool: boolean | null = true, timing: string | null = null) =>
    runsheetWeekPlacement(key, timing, hotTool)
  // Wash-only: shampoo, conditioner, mask, pre-wash oil, bondbuilder, scalp serum (default).
  for (const key of [
    "decision:shampoo:shampoo_everyday:gap",
    "decision:conditioner:conditioner_rinse_out:gap",
    "decision:mask:intensive_conditioning_mask:gap",
    "decision:oil:pre_wash_fibre_treatment:gap",
    "decision:bondbuilder:specialized_bond_treatment:gap",
    "decision:scalp_care:scalp_comfort:gap",
    "decision:leave_in:post_wash_leave_in:gap",
  ]) {
    assert.deepEqual(at(key), { washDay: true, offDays: false }, key)
  }
  // Finishing / leave-on oil: last on a wash day AND on days without washing.
  assert.deepEqual(at("decision:oil:dry_finish:gap"), { washDay: true, offDays: true })
  assert.deepEqual(at("decision:oil:leave_on_fibre_conditioning:gap"), {
    washDay: true,
    offDays: true,
  })
  // Heat steps follow her hot tools; unknown keeps both.
  for (const key of [
    "decision:heat_protectant:pre_heat_protection:gap",
    "decision:leave_in:pre_heat_application:gap",
  ]) {
    assert.deepEqual(at(key, true), { washDay: true, offDays: true }, key)
    assert.deepEqual(at(key, false), { washDay: true, offDays: false }, key)
    assert.deepEqual(at(key, null), { washDay: true, offDays: true }, key)
  }
  // Dry shampoo bridges the days between washes.
  assert.deepEqual(at("decision:dry_shampoo:root_refresh_bridge:gap"), {
    washDay: false,
    offDays: true,
  })
  // Unknown role: the timing label decides, as before.
  assert.deepEqual(at("decision:x:unknown:gap", true, "Nach Shampoo"), {
    washDay: true,
    offDays: false,
  })
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
    imageUrl: null,
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
  assert.ok(entry.includes("Bisheriges Produkt — noch in Recherche"))
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
    imageUrl: null,
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
  const lines = [...markup.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((match) => match[1]!)
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
  // The shared verdict title, in the cockpit's neutral voice (verdict-layer T4).
  assert.ok(entry.includes("Passt nicht zum Haarprofil"))
  assert.ok(!entry.includes("noch in Recherche"))
})

// --- T4 (b): the recipe's „vorhanden" counts what she captured, research included -----------

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

/** The coverage pill of one „Zuerst" chip on the recipe slide. */
function recipePrimaryRow(markup: string, categoryLabel: string): string {
  const block = markup.slice(markup.indexOf(">Zuerst</h3>"))
  const rows = block.slice(0, block.indexOf("</ul>")).split("<li")
  const row = rows.find((entry) => entry.includes(`>${categoryLabel}</span>`))
  assert.ok(row, `no recipe row for ${categoryLabel}`)
  return row
}

test("recipe: her scanned conditioner still in research counts as „vorhanden“", async () => {
  const view = buildDiscoveryCockpitView(model())
  assert.ok(discoveryConcernCoverageInput(view).owned.has("conditioner"))
  const markup = await renderPage({ loadQuizLead: async () => dryLengthsLead })
  const row = recipePrimaryRow(markup, "Conditioner")
  assert.ok(row.includes(">vorhanden</span>"), row)
  assert.ok(!row.includes("nicht vorhanden"), row)
  // Control: without that capture the same row reads „nicht vorhanden".
  const without = await renderPage({
    loadQuizLead: async () => dryLengthsLead,
    loadModel: async () => model({ items: [shampooItem] }),
  })
  assert.ok(recipePrimaryRow(without, "Conditioner").includes("nicht vorhanden"))
})

test("recipe as a slide: talking point, Zuerst and Nicht zuerst visible; the rest folded", async () => {
  const markup = await renderPage({ loadQuizLead: async () => dryLengthsLead })
  const recipe = concernRecipeFor("dry_lengths")!
  const start = markup.indexOf("Hauptproblem: ")
  const card = markup.slice(start, markup.indexOf("</section>", start))
  const foldAt = card.indexOf("<details")
  assert.ok(foldAt > 0, "the recipe has fold-ups")
  const slide = card.slice(0, foldAt)
  const folded = card.slice(foldAt)
  const decode = (text: string) =>
    text.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&")

  // The slide: the sentence Nick reads aloud, the lead categories with their state, the avoid list.
  assert.ok(slide.includes("So sagst du es"))
  assert.ok(decode(slide).includes(recipe.talkingPointDe))
  assert.ok(slide.includes(">Zuerst</h3>"))
  assert.ok(slide.includes(">Conditioner</span>"))
  assert.match(slide, />(nicht )?vorhanden</)
  assert.ok(slide.includes(">Nicht zuerst</h3>"))
  for (const entry of recipe.avoid) assert.ok(decode(slide).includes(entry), entry)
  // No reasons, evidence tags, routine coverage or boundary on the slide.
  assert.ok(!slide.includes("belegt)"))
  assert.ok(!slide.includes("in der Idealroutine"))
  for (const entry of recipe.primary.categories) assert.ok(!decode(slide).includes(entry.why))
  assert.ok(!decode(slide).includes(recipe.boundary!))

  // Everything else stays reachable behind the fold-ups.
  assert.ok(folded.includes("Warum zuerst"))
  assert.ok(folded.includes("belegt)"))
  assert.ok(folded.includes("in der Idealroutine"))
  for (const entry of recipe.primary.categories) assert.ok(decode(folded).includes(entry.why))
  assert.ok(folded.includes("Ohne Produkt"))
  for (const entry of recipe.primary.levers)
    assert.ok(decode(folded).includes(entry.lever), entry.lever)
  assert.ok(folded.includes(">Grenze"))
  assert.ok(decode(folded).includes(recipe.boundary!))
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
  assert.ok(footer.includes("Öl — nicht benutzt. Keine Entscheidung nötig."), footer)
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

test("score helpers: staircase scales onto the gap, German decimals, strict parsing", () => {
  // Sum within the gap to 9: raw points hold, nothing is inflated.
  assert.deepEqual(runsheetScoreSteps(4, [1.5, 1.5, 1]), [4, 5.5, 7, 8])
  // Overshoot: the gap is spread in tenths by largest remainder (R32) — the relative
  // order holds, the target is exactly the cap, and no weighted step flattens to +0
  // while a tenth is left for it.
  assert.deepEqual(runsheetScoreSteps(8, [3, null]), [8, 9, 9])
  assert.deepEqual(runsheetScoreSteps(4, [2, 2, 2]), [4, 5.7, 7.4, 9])
  assert.deepEqual(runsheetScoreSteps(7, [2, 1, 1]), [7, 8, 8.5, 9])
  // Five in-range weights into a gap of 1: plain rounding would flatten the 0.5er —
  // the tenth-apportionment keeps every weighted Hebel visibly moving (Codex F2).
  assert.deepEqual(runsheetScoreSteps(8, [2, 2, 0.5, 2, 2]), [8, 8.3, 8.5, 8.6, 8.8, 9])
  // The code does the arithmetic and caps the display at 9; a baseline at or above
  // stays truthful and the ladder stays flat.
  assert.deepEqual(runsheetScoreSteps(9, [1, 1]), [9, 9, 9])
  assert.deepEqual(runsheetScoreSteps(10, [1]), [10, 10])
  // No weights at all: nothing to spread.
  assert.deepEqual(runsheetScoreSteps(5, [null, null]), [5, 5, 5])
  // Negative edits never count (Codex F1): the ladder neither pierces the cap between
  // steps nor sinks a flat baseline — and the save refuses the value outright.
  assert.deepEqual(runsheetScoreSteps(8, [3, -1]), [8, 9, 9])
  assert.deepEqual(runsheetScoreSteps(10, [-1]), [10, 10])
  assert.equal(parseRunsheetPoints("-1"), null)
  assert.equal(formatRunsheetScore(5.5), "5,5")
  assert.equal(formatRunsheetScore(8), "8")
  assert.equal(parseRunsheetPoints("1,5"), 1.5)
  assert.equal(parseRunsheetPoints(""), null)
  assert.equal(parseRunsheetPoints("viel"), null)
  assert.equal(parseRunsheetBaseline("4"), 4)
  assert.equal(parseRunsheetBaseline("11"), null)
  assert.equal(parseRunsheetBaseline("4,5"), 4.5)
  assert.equal(parseRunsheetBaseline("7.5"), 7.5)
  assert.equal(parseRunsheetBaseline("4,25"), null)
  assert.equal(parseRunsheetBaseline("0,5"), null)
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
    complexity: null,
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
  assert.deepEqual(junk.consultBrief?.sections.hebel, [
    { title: "", note: "", points: null, bucket: null },
  ])
  assert.equal(junk.consultBrief?.sections.mechanik, "")
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
      "Im Call klären: Einkaufsort",
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
  // No price anywhere — the locked-in section's zero sum aside (its own tests cover it).
  const section = lockedInOf(markup)
  assert.ok(!markup.replace(section, "").includes("€"))
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
  // Since 2026-09-30 the stored price always shows (an outdated price beats a
  // price-less card; the recurring price audit keeps it honest) — the catalog's
  // `price_checked_at` no longer gates the label.
  const priceOf = (priceCheckedAt: string | null | undefined) => {
    const base = model({ steps: [shampooStep, withPrice], items: [shampooItem] })
    const view = buildDiscoveryCockpitView({
      ...base,
      productIdentities: new Map([
        [
          priced.c,
          {
            name: "Balea Feuchtigkeitsspülung",
            brand: "Balea",
            productLine: null,
            ...(priceCheckedAt === undefined ? {} : { priceCheckedAt }),
          },
        ],
      ]),
    })
    const conditioner = view.steps.find((step) => step.category === "conditioner")
    assert.equal(
      conditioner?.swapOptions[0]?.priceLabel,
      conditioner?.idealRecommendation?.priceLabel,
    )
    return conditioner?.idealRecommendation?.priceLabel
  }
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  assert.equal(priceOf(daysAgo(1)), "2,45\u00a0€")
  // Stale, never checked, unparsable, or no check date at all → the price still shows.
  assert.equal(priceOf(daysAgo(90)), "2,45\u00a0€")
  assert.equal(priceOf(null), "2,45\u00a0€")
  assert.equal(priceOf("not a date"), "2,45\u00a0€")
  assert.equal(priceOf(undefined), "2,45\u00a0€")
  const withoutIdentity = buildDiscoveryCockpitView(
    model({ steps: [shampooStep, withPrice], items: [shampooItem] }),
  )
  assert.equal(
    withoutIdentity.steps.find((step) => step.category === "conditioner")?.idealRecommendation
      ?.priceLabel,
    "2,45\u00a0€",
  )
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

// --- verdict-layer T3: frequency-delta chips ------------------------------------------------

const catalogConditioner: DiscoveryIntakeItem = {
  id: "50000000-0000-4000-8000-0000000000c1",
  category: "conditioner",
  source: "catalog_search",
  brandText: "Balea",
  productNameText: "Pflegespülung",
  barcodeIdentifier: null,
  productId: "30000000-0000-4000-8000-0000000000c1",
  productSubmissionId: null,
  createdAt: "2026-09-20T10:06:00.000Z",
  frequency: "weekly_1x",
}

/** The real Idealroutine cadences: shampoo target 1×/Woche, conditioner after every wash. */
function frequencyModel(
  input: {
    shampoo?: DiscoveryIntakeItem["frequency"]
    conditioner?: DiscoveryIntakeItem["frequency"]
  } = {},
): DiscoveryCockpitModel {
  return model({
    steps: [
      { ...shampooStep, frequencyLabel: "1×/Woche" },
      { ...conditionerStep, frequencyLabel: "nach jeder Haarwäsche" },
    ],
    items: [
      { ...shampooItem, frequency: input.shampoo ?? "weekly_2x" },
      { ...catalogConditioner, frequency: input.conditioner ?? "weekly_1x" },
    ],
  })
}

/** The chip's own separator — other runsheet copy says „Ziel" too („Ziel heute: …"). */
const CHIP_MARK = " · Ziel "

function phase4Of(markup: string): string {
  return markup.slice(
    markup.indexOf('id="runsheet-phase-4"'),
    markup.indexOf('id="runsheet-phase-5"'),
  )
}

test("frequency chips: none for cadences the Idealroutine never prints (fixture labels)", async () => {
  const markup = await renderPage()
  assert.ok(!markup.includes(CHIP_MARK), "no frequency chip without a real cadence")
})

test("frequency chips: Phase 3 entries show zu oft / zu selten against her wash anchor", async () => {
  const markup = await renderPage({ loadModel: async () => frequencyModel() })
  assert.ok(entryOf(markup, "Shampoo").includes("2×/Wo · Ziel 1×/Wo — zu oft"))
  // „nach jeder Haarwäsche" at her 2×/week wash, conditioner 1×/week.
  assert.ok(entryOf(markup, "Conditioner").includes("1×/Wo · Ziel 2×/Wo — zu selten"))
})

test("frequency chips: Phase 4 week lines carry the same chips", async () => {
  const phase4 = phase4Of(await renderPage({ loadModel: async () => frequencyModel() }))
  assert.ok(phase4.includes("2×/Wo · Ziel 1×/Wo — zu oft"), phase4)
  assert.ok(phase4.includes("1×/Wo · Ziel 2×/Wo — zu selten"), phase4)
})

test("frequency chips: a matching frequency reads „passt“", async () => {
  const markup = await renderPage({
    loadModel: async () => frequencyModel({ conditioner: "weekly_2x" }),
  })
  assert.ok(entryOf(markup, "Conditioner").includes("2×/Wo · Ziel 2×/Wo — passt"))
})

test("frequency chips: „Weiß ich nicht“ — no chip for the product, no wash anchor for the rest", async () => {
  const markup = await renderPage({
    loadModel: async () => frequencyModel({ shampoo: "unknown" }),
  })
  assert.ok(!markup.includes(CHIP_MARK), "no chip without her frequency or wash anchor")
})

test("frequency chips: a product whose frequency was never asked gets none", async () => {
  const markup = await renderPage({
    loadModel: async () =>
      model({
        steps: [{ ...shampooStep, frequencyLabel: "1×/Woche" }],
        items: [{ ...shampooItem, frequency: undefined }],
      }),
  })
  assert.ok(!markup.includes(CHIP_MARK))
})

// --- the „Wie oft" row: her answer next to the Idealplan's rhythm, on every product ----

/** An entry's visible text, as a parser reads it (React's text separators drop out). */
function entryTextOf(markup: string, categoryLabel: string): string {
  return JSDOM.fragment(entryOf(markup, categoryLabel)).textContent ?? ""
}

test("frequency row: every product of hers shows her answer next to the Idealplan's rhythm", async () => {
  const markup = await renderPage({ loadModel: async () => frequencyModel() })
  const shampoo = entryTextOf(markup, "Shampoo")
  assert.ok(shampoo.includes("Angabe: 2× pro Woche"), shampoo)
  assert.ok(shampoo.includes("Idealplan: 1×/Woche"), shampoo)
  // The verdict stays the step chip, inside the row.
  assert.ok(shampoo.includes("2×/Wo · Ziel 1×/Wo — zu oft"), shampoo)
  const conditioner = entryTextOf(markup, "Conditioner")
  assert.ok(conditioner.includes("Angabe: 1× pro Woche"), conditioner)
  assert.ok(conditioner.includes("Idealplan: nach jeder Haarwäsche"), conditioner)
  assert.ok(!markup.includes("nicht vergleichbar"))
})

test("frequency row: a rhythm without a band shows both sides and „nicht vergleichbar“", async () => {
  const markup = await renderPage({
    loadModel: async () =>
      model({
        steps: [{ ...shampooStep, frequencyLabel: "nach Bedarf" }],
        items: [{ ...shampooItem, frequency: "daily_1x" }],
      }),
  })
  const shampoo = entryTextOf(markup, "Shampoo")
  assert.ok(shampoo.includes("Angabe: Täglich"), shampoo)
  assert.ok(shampoo.includes("Idealplan: nach Bedarf"), shampoo)
  assert.ok(shampoo.includes("nicht vergleichbar"), shampoo)
  assert.ok(!markup.includes(CHIP_MARK))
})

test("frequency row: „Weiß ich nicht“ and never asked are named, with no verdict", async () => {
  const unknown = entryTextOf(
    await renderPage({ loadModel: async () => frequencyModel({ shampoo: "unknown" }) }),
    "Shampoo",
  )
  assert.ok(unknown.includes("Angabe: Weiß ich nicht"), unknown)
  assert.ok(!unknown.includes("nicht vergleichbar"), unknown)
  const neverAsked = entryTextOf(
    await renderPage({
      loadModel: async () =>
        model({
          steps: [{ ...shampooStep, frequencyLabel: "1×/Woche" }],
          items: [{ ...shampooItem, frequency: undefined }],
        }),
    }),
    "Shampoo",
  )
  assert.ok(neverAsked.includes("Angabe: keine Angabe"), neverAsked)
  assert.ok(neverAsked.includes("Idealplan: 1×/Woche"), neverAsked)
  assert.ok(!neverAsked.includes("nicht vergleichbar"), neverAsked)
})

test("frequency chips: weekly bands read compactly", () => {
  const cases: Array<[{ min: number | null; max: number | null }, string]> = [
    [{ min: 1, max: 1 }, "1×/Wo"],
    [{ min: 3, max: 4 }, "3–4×/Wo"],
    [{ min: 1, max: 4 / 3 }, "1–1,3×/Wo"],
    [{ min: 0.5, max: 0.5 }, "alle 2 Wo"],
    [{ min: 0.25, max: 0.5 }, "alle 2–4 Wo"],
    [{ min: 0.75, max: 1 }, "0,8–1×/Wo"],
    [{ min: 0, max: 0.249 }, "seltener als alle 4 Wo"],
    [{ min: 2, max: null }, "ab 2×/Wo"],
  ]
  for (const [band, text] of cases) assert.equal(formatRunsheetWeeklyBand(band), text)
})

// --- fix round 1: one chip per step on the summed frequency; the engine's wash range -----

const secondShampoo: DiscoveryIntakeItem = {
  ...shampooItem,
  id: "50000000-0000-4000-8000-0000000000c2",
  brandText: "Balea",
  productNameText: "Milde Pflege",
  productId: "30000000-0000-4000-8000-0000000000c2",
  createdAt: "2026-09-20T10:07:00.000Z",
  frequency: "weekly_1x",
}

function twoShampoos(second: DiscoveryIntakeItem["frequency"]): DiscoveryCockpitModel {
  return model({
    steps: [{ ...shampooStep, frequencyLabel: "2×/Woche" }],
    items: [
      { ...shampooItem, frequency: "weekly_1x" },
      { ...secondShampoo, frequency: second },
    ],
  })
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

test("frequency chips: two 1×/week shampoos vs 2×/week → ONE „passt“ chip per phase", async () => {
  const markup = await renderPage({ loadModel: async () => twoShampoos("weekly_1x") })
  const phase3 = markup.slice(
    markup.indexOf(">Behalten</h3>"),
    markup.indexOf('id="runsheet-phase-4"'),
  )
  assert.equal(occurrences(phase3, CHIP_MARK), 1, phase3)
  assert.ok(phase3.includes("2×/Wo · Ziel 2×/Wo — passt"))
  const phase4 = phase4Of(markup)
  assert.equal(occurrences(phase4, CHIP_MARK), 1, phase4)
  assert.ok(phase4.includes("2×/Wo · Ziel 2×/Wo — passt"))
})

test("frequency chips: 1×/week + „Weiß ich nicht“ in one step → no chip (a partial sum understates)", async () => {
  const markup = await renderPage({ loadModel: async () => twoShampoos("unknown") })
  assert.ok(!markup.includes(CHIP_MARK))
})

test("frequency chips: the shampoo band is the engine's allowed range, not the target bucket", async () => {
  const markup = await renderPage({
    loadModel: async () =>
      model({
        steps: [
          {
            ...shampooStep,
            frequencyLabel: "3-4×/Woche",
            depth: {
              ...shampooStep.depth!,
              washAllowedRange: { min: "weekly_2x", max: "weekly_5_6x" },
            },
          },
        ],
        items: [{ ...shampooItem, frequency: "weekly_2x" }],
      }),
  })
  assert.ok(entryOf(markup, "Shampoo").includes("2×/Wo · Ziel 2–6×/Wo — passt"))
  assert.ok(phase4Of(markup).includes("2×/Wo · Ziel 2–6×/Wo — passt"))
})

// --- fix round 2: Phase 3 and Phase 4 sum the SAME products (kept/undecided only) -----------

const SHAMPOO_KEY = shampooStep.decisionKey

function shampooDecision(
  intakeItemId: string,
  decision: DiscoveryCallDecision["decision"],
): DiscoveryCallDecision {
  return {
    decisionKey: SHAMPOO_KEY,
    decision,
    swapProductId: decision === "swap" ? ids.alternative : null,
    intakeItemId,
  }
}

function phase3Of(markup: string): string {
  return markup.slice(markup.indexOf(">Behalten</h3>"), markup.indexOf('id="runsheet-phase-4"'))
}

async function twoShampoosDecided(decisions: DiscoveryCallDecision[]): Promise<string> {
  return renderPage({
    loadModel: async () =>
      model({
        steps: [{ ...shampooStep, frequencyLabel: "2×/Woche" }],
        items: [
          { ...shampooItem, frequency: "weekly_1x" },
          { ...secondShampoo, frequency: "weekly_1x" },
        ],
        decisions,
      }),
  })
}

test("frequency chips: undecided 1× + DROPPED 1× vs 2×/week → both phases „zu selten“, chips agree", async () => {
  const markup = await twoShampoosDecided([shampooDecision(secondShampoo.id, "drop")])
  const expected = "1×/Wo · Ziel 2×/Wo — zu selten"
  const phase3 = phase3Of(markup)
  const phase4 = phase4Of(markup)
  assert.equal(occurrences(phase3, CHIP_MARK), 1, phase3)
  assert.ok(phase3.includes(expected), phase3)
  assert.equal(occurrences(phase4, CHIP_MARK), 1, phase4)
  assert.ok(phase4.includes(expected), phase4)
})

test("frequency chips: kept + SWAPPED in one step → the swapped product is out of the sum in both phases", async () => {
  const markup = await twoShampoosDecided([
    shampooDecision(shampooItem.id, "keep"),
    shampooDecision(secondShampoo.id, "swap"),
  ])
  const expected = "1×/Wo · Ziel 2×/Wo — zu selten"
  assert.ok(phase3Of(markup).includes(expected), phase3Of(markup))
  assert.ok(phase4Of(markup).includes(expected), phase4Of(markup))
  assert.equal(occurrences(phase3Of(markup), CHIP_MARK), 1)
  assert.equal(occurrences(phase4Of(markup), CHIP_MARK), 1)
})

test("frequency chips: two KEPT 1× shampoos vs 2×/week stay one „passt“ per phase", async () => {
  const markup = await twoShampoosDecided([
    shampooDecision(shampooItem.id, "keep"),
    shampooDecision(secondShampoo.id, "keep"),
  ])
  const expected = "2×/Wo · Ziel 2×/Wo — passt"
  assert.equal(occurrences(phase3Of(markup), CHIP_MARK), 1)
  assert.ok(phase3Of(markup).includes(expected))
  assert.equal(occurrences(phase4Of(markup), CHIP_MARK), 1)
  assert.ok(phase4Of(markup).includes(expected))
})

// --- verdict-layer T4 (O4): the cockpit speaks about her, never to her ---------------------

/** Second-person forms as whole words, any case. */
const SECOND_PERSON_WORD =
  /(^|[^\p{L}])(du|dein|deine|deinem|deinen|deiner|deines|dir|dich)(?=[^\p{L}]|$)/iu

/** Third-person pronouns about the participant (sie, ihr…) — the cockpit is pronoun-free. */
const THIRD_PERSON_WORD = /(^|[^\p{L}])(sie|ihr|ihre|ihrem|ihren|ihrer|ihres)(?=[^\p{L}]|$)/iu

const DRY_SCALP_FIT =
  "Deine Kopfhaut ist eher trocken. Deshalb eine milde Reinigung, die ihr nicht zusätzlich Fett entzieht."
const DANDRUFF_TAIL = " Außerdem soll das Shampoo gezielt gegen Schuppen arbeiten."

/** Nomi with the engine's real second-person sentences on her shampoo step and verdict. */
function nomiSecondPerson(): DiscoveryCockpitModel {
  const step: DiscoveryIdealStep = {
    ...shampooStep,
    roleDescription: "Regelmäßige Reinigung für deine Kopfhaut.",
    depth: {
      purpose: "Reinigt passend zu deiner Kopfhaut und deiner Haaranalyse.",
      targetType: "Ausgleichend reinigend",
      productCriteria: "Ausgeglichen reinigen, ohne unnötig stark zu entfetten.",
      fit: `${DRY_SCALP_FIT}${DANDRUFF_TAIL}`,
      timingLabel: "Haarwäsche",
    },
  }
  const verdict = verdicts[0]!
  const secondPersonVerdict: DiscoveryParticipantVerdict = {
    ...verdict,
    payload: {
      ...payload,
      fitNarrative: {
        fit: `${DRY_SCALP_FIT}${DANDRUFF_TAIL}`,
        productCriteria: "Ausgeglichen reinigen, ohne unnötig stark zu entfetten.",
      },
      criteria: [
        {
          criterionId: "shampoo.scalp_route",
          label: "Kopfhaut",
          result: "fail",
          explanation:
            "Keine Produktvariante deckt deine Haardicke und Pflegerichtung gemeinsam ab.",
        },
      ],
    },
  } as DiscoveryParticipantVerdict
  return model({ steps: [step, conditionerStep], verdicts: [secondPersonVerdict] })
}

/**
 * The page's readable text: text nodes plus the attributes a reader meets (aria-label,
 * placeholder), entities decoded, one line per node.
 */
function readableLines(markup: string): string[] {
  const decode = (text: string) =>
    // `&amp;` last, so an encoded entity name is never unescaped twice.
    text
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
  const attributes = [...markup.matchAll(/(?:aria-label|placeholder)="([^"]*)"/g)].map(
    (match) => match[1]!,
  )
  const text = markup.replace(/<[^>]+>/g, "\n").split("\n")
  return [...text, ...attributes].map((line) => decode(line).trim()).filter(Boolean)
}

/**
 * The explicit exceptions (brief T4): spoken or quoted text stays in her voice. The German
 * quotes („…") the page may carry are a NAMED list (fix wave): a new quoted string fails
 * the test until it is reviewed and added here — no quote is exempt just for being quoted.
 * Plus the verbatim blocks without quotes: the referral message she forwards, the „So sagst
 * du es" talking point, and the quiz's own questions in „Quiz-Antworten".
 */
const QUOTED_EXCEPTIONS = [
  // Phase 1 script card: the question Nick asks at the end of the intro.
  "Passt das so für dich?",
  // Concern recipe: the word Nick explains (a term, not a sentence to her).
  "Wassermangel",
  // Phase 4 closing question.
  "Alles klar so? Passt das in deine Woche?",
  // Phase 6 referral question.
  "Kennst du zwei, drei Leute, die auch nicht ganz glücklich mit ihren Haaren sind? Wir machen die Calls gerade kostenlos — magst du ihnen kurz diese Nachricht weiterleiten?",
]

/** Every „…" string on the page, in page order, without duplicates. */
function quotedStrings(lines: readonly string[]): string[] {
  return [
    ...new Set(lines.flatMap((line) => [...line.matchAll(/„([^“]*)“/g)].map((match) => match[1]!))),
  ]
}

function outsideQuotedExceptions(lines: readonly string[], verbatim: readonly string[]): string[] {
  return lines
    .map((line) =>
      QUOTED_EXCEPTIONS.reduce((text, quote) => text.split(`„${quote}“`).join("«quote»"), line),
    )
    .filter((line) => !verbatim.includes(line))
}

test("voice: no du/dein in the cockpit's own display outside the quoted exceptions", async () => {
  const markup = await renderPage({
    loadModel: async () => nomiSecondPerson(),
    loadQuizLead: async () => dryLengthsLead,
    loadCallSheet: async () => callSheet,
  })
  const quiz = buildDiscoveryQuizAnswers(dryLengthsLead)
  assert.equal(quiz.status, "ready")
  const verbatim = [
    DISCOVERY_REFERRAL_MESSAGE,
    concernRecipeFor("dry_lengths")!.talkingPointDe,
    "So sagst du es",
    ...(quiz.status === "ready"
      ? quiz.groups.flatMap((group) => group.rows.map((row) => row.question))
      : []),
  ]
  // The quoted strings on the page are exactly the named, reviewed list.
  assert.deepEqual(quotedStrings(readableLines(markup)), QUOTED_EXCEPTIONS)
  const offenders = outsideQuotedExceptions(readableLines(markup), verbatim).filter((line) =>
    SECOND_PERSON_WORD.test(line),
  )
  assert.deepEqual(offenders, [])
  // Pronoun-free cockpit copy (Nick's ruling 2026-09-29). The consult brief's own lines are
  // LLM content written about her in the third person on purpose — not cockpit copy.
  const briefLines = ["Anti-Schuppen trocknet ihre Kopfhaut weiter aus."]
  const thirdPerson = outsideQuotedExceptions(readableLines(markup), [
    ...verbatim,
    ...briefLines,
  ]).filter((line) => THIRD_PERSON_WORD.test(line))
  assert.deepEqual(thirdPerson, [])

  // The fixture really carried second-person sentences: their neutral variants are on screen.
  assert.ok(markup.includes("Passt nicht zum Haarprofil"))
  assert.ok(
    markup.includes(
      `Die Kopfhaut ist eher trocken. Deshalb eine milde Reinigung ohne zusätzlichen Fettentzug.${DANDRUFF_TAIL}`,
    ),
  )
  assert.ok(markup.includes("Reinigt passend zu Kopfhaut und Haaranalyse."))
  assert.ok(markup.includes("Regelmäßige Reinigung für die Kopfhaut."))
  assert.ok(
    markup.includes("Keine Produktvariante deckt Haardicke und Pflegerichtung gemeinsam ab."),
  )
  // …and the exceptions really rendered, so the test exercised them.
  assert.ok(markup.includes("So sagst du es"))
  assert.ok(markup.includes("Passt das in deine Woche?"))
  assert.ok(markup.includes(DISCOVERY_REFERRAL_MESSAGE))
})

test("voice: the participant's verdict sections render unchanged without the cockpit voice", () => {
  const notNeeded = {
    kind: "not_needed" as const,
    mode: "not_needed" as const,
    status: "neutral" as const,
    headline: scanNotNeededHeadline("dry_shampoo"),
    subtitle: scanNotNeededSubtitle("dry_shampoo"),
    reasons: [SCAN_NOT_NEEDED_REASON_COPY["dry_shampoo.inclusion.none"]!],
    dimensions: [],
    coveredBy: [{ label: "Shampoo", detail: "Frische zwischen den Haarwäschen" }],
    product: {
      productId: "p-1",
      name: "Batiste Original",
      brand: "Batiste",
      category: "dry_shampoo" as const,
      categoryLabel: "Trockenshampoo",
      imageUrl: null,
      priceLabel: null,
      purchaseUrl: null,
    },
  }
  const participant = renderToStaticMarkup(<ScanVerdictSections result={notNeeded} />)
  assert.ok(participant.includes("Du brauchst aktuell kein Trockenshampoo"))
  assert.ok(participant.includes("Kein Trockenshampoo in deinem Bedarf"))
  assert.ok(participant.includes("Warum du kein Trockenshampoo brauchst"))
  assert.ok(
    participant.includes("Ändert sich dein Haar oder deine Routine, prüfen wir das für dich neu."),
  )
  assert.ok(participant.includes("Das übernimmt bei dir:"))

  const cockpit = renderToStaticMarkup(
    <ScanVerdictSections result={notNeeded} voice={cockpitVoice} />,
  )
  assert.ok(cockpit.includes("Aktuell kein Trockenshampoo nötig"))
  assert.ok(cockpit.includes("Kein Trockenshampoo im Bedarf"))
  assert.ok(cockpit.includes("Warum kein Trockenshampoo nötig ist"))
  assert.ok(
    cockpit.includes("Der Ansatz fettet nicht so schnell nach, dass eine Überbrückung nötig wäre."),
  )
  assert.ok(cockpit.includes("Ändern sich Haar oder Routine, prüfen wir das neu."))
  assert.ok(cockpit.includes("Das übernimmt bereits:"))
  const offenders = readableLines(cockpit).filter(
    (line) => SECOND_PERSON_WORD.test(line) || THIRD_PERSON_WORD.test(line),
  )
  assert.deepEqual(offenders, [])
})

// --- fix wave (P2): cross-step wash anchor is a range over her in-week shampoos ------------

function twoShampoosAndConditioner(conditioner: DiscoveryIntakeItem["frequency"]) {
  return model({
    steps: [
      { ...shampooStep, frequencyLabel: "2×/Woche" },
      { ...conditionerStep, frequencyLabel: "nach jeder Haarwäsche" },
    ],
    items: [
      { ...shampooItem, frequency: "weekly_1x" },
      { ...secondShampoo, frequency: "weekly_1x" },
      { ...catalogConditioner, frequency: conditioner },
    ],
  })
}

test("frequency chips: two 1× shampoos + 1× conditioner „nach jeder Haarwäsche“ → no conditioner chip", async () => {
  const markup = await renderPage({ loadModel: async () => twoShampoosAndConditioner("weekly_1x") })
  assert.ok(!entryOf(markup, "Conditioner").includes(CHIP_MARK), entryOf(markup, "Conditioner"))
  // The shampoo step itself (a fixed band) still gets its chip — once per phase.
  assert.equal(occurrences(phase3Of(markup), CHIP_MARK), 1)
  assert.equal(occurrences(phase4Of(markup), CHIP_MARK), 1)
})

test("frequency chips: two 1× shampoos + 3–4× conditioner → both ends say „zu oft“, chip shown", async () => {
  const markup = await renderPage({
    loadModel: async () => twoShampoosAndConditioner("weekly_3_4x"),
  })
  const expected = "3–4×/Wo · Ziel 1–2×/Wo — zu oft"
  assert.ok(entryOf(markup, "Conditioner").includes(expected), entryOf(markup, "Conditioner"))
  assert.ok(phase4Of(markup).includes(expected))
})

// --- produktphase-lockin T2: „Für den Plan festgehalten" ----------------------------------

/** The locked-in section's markup; "" when the page renders none. */
function lockedInOf(markup: string): string {
  const start = markup.indexOf('id="runsheet-locked-in"')
  return start < 0 ? "" : markup.slice(start, markup.indexOf("</section>", start))
}

function modelWithDecisions(decisions: DiscoveryCallDecision[]) {
  return model({ verdicts: pricedVerdicts, decisions })
}

test("locked-in: sits in Phase 3 right after „Tauschen oder neu“, before Phase 4", async () => {
  const markup = await renderPage()
  const swapBucket = markup.indexOf(">Tauschen oder neu</h3>")
  const section = markup.indexOf('id="runsheet-locked-in"')
  const phase4 = markup.indexOf('id="runsheet-phase-4"')
  assert.ok(swapBucket >= 0 && section > swapBucket, `section at ${section}`)
  assert.ok(phase4 < 0 || section < phase4)
  assert.ok(section > markup.indexOf('id="runsheet-phase-3"'))
  assert.ok(lockedInOf(markup).includes(">Für den Plan festgehalten</h3>"))
})

test("locked-in: nothing decided — four empty groups in order, zero sum, both entries open", async () => {
  const section = lockedInOf(await renderPage())
  const groups = ["Neu kaufen", "Behalten", "Weglassen", "Bewusst ohne Produkt"]
  const positions = groups.map((group) => section.indexOf(`>${group}</p>`))
  for (const [index, position] of positions.entries()) assert.ok(position >= 0, groups[index])
  assert.deepEqual(
    [...positions].sort((a, b) => a - b),
    positions,
  )
  assert.equal(occurrences(section, "Noch nichts festgehalten."), 4)
  // Pronoun-free labels (Nick, 2026-09-29): no third-person voice left in the section.
  assert.ok(!/\b(sie|ihr|ihre|ihren)\b/i.test(section.replace(/<[^>]*>/g, " ")), section)
  assert.ok(section.includes(">Summe neu</span>"))
  assert.ok(section.includes("0,00 €"))
  assert.ok(section.includes("2 Schritte noch nicht entschieden."))
  assert.ok(!section.includes("bereit für Phase 4"))
})

test("locked-in: stored decisions — the swap is bought with its price, the empty step goes without", async () => {
  const markup = await renderPage({
    loadModel: async () =>
      modelWithDecisions([
        {
          decisionKey: shampooStep.decisionKey,
          intakeItemId: ids.shampooItem,
          decision: "swap",
          swapProductId: priced.a,
        },
        {
          decisionKey: conditionerStep.decisionKey,
          intakeItemId: null,
          decision: "keep",
          swapProductId: null,
        },
      ]),
  })
  const section = lockedInOf(markup)
  const buy = section.slice(section.indexOf(">Neu kaufen<"), section.indexOf(">Behalten<"))
  assert.ok(buy.includes("Alpha Shampoo"), buy)
  assert.ok(buy.includes(">Shampoo</span>"))
  assert.ok(buy.includes("9,95 €"))
  const skip = section.slice(
    section.indexOf(">Bewusst ohne Produkt<"),
    section.indexOf(">Summe neu<"),
  )
  assert.ok(skip.includes(">Conditioner</span>"), skip)
  // A1: a deliberately empty step is decided — never worded „offen".
  assert.ok(skip.includes("kein Produkt nötig"))
  assert.ok(!skip.includes("offen"))
  const keep = section.slice(section.indexOf(">Behalten<"), section.indexOf(">Weglassen<"))
  assert.ok(keep.includes("Noch nichts festgehalten."))
  assert.ok(section.includes('id="runsheet-locked-in-total" class="ml-auto tabular-nums">9,95 €<'))
  assert.ok(section.includes("Alle Schritte entschieden — bereit für Phase 4."))
})

test("locked-in: a kept product of hers lands under „Behalten“", async () => {
  const markup = await renderPage({
    loadModel: async () =>
      modelWithDecisions([
        {
          decisionKey: shampooStep.decisionKey,
          intakeItemId: ids.shampooItem,
          decision: "keep",
          swapProductId: null,
        },
      ]),
  })
  const section = lockedInOf(markup)
  const keep = section.slice(section.indexOf(">Behalten<"), section.indexOf(">Weglassen<"))
  assert.ok(keep.includes("Sebamed"), keep)
  assert.ok(section.includes("1 Schritt noch nicht entschieden."))
})

test("locked-in: a dropped product of hers lands under „Weglassen“ by name, not „Bewusst ohne Produkt“", async () => {
  const markup = await renderPage({
    loadModel: async () =>
      modelWithDecisions([
        {
          decisionKey: shampooStep.decisionKey,
          intakeItemId: ids.shampooItem,
          decision: "drop",
          swapProductId: null,
        },
      ]),
  })
  const section = lockedInOf(markup)
  const discard = section.slice(
    section.indexOf(">Weglassen<"),
    section.indexOf(">Bewusst ohne Produkt<"),
  )
  assert.ok(discard.includes("Sebamed"), discard)
  assert.ok(discard.includes(">Shampoo</span>"), discard)
  const skip = section.slice(
    section.indexOf(">Bewusst ohne Produkt<"),
    section.indexOf(">Summe neu<"),
  )
  assert.ok(!skip.includes("Sebamed"), skip)
  assert.ok(skip.includes("Noch nichts festgehalten."), skip)
})

test("locked-in: a product without a price — no price on the row, the sum reads „ab …“", async () => {
  const markup = await renderPage({
    loadModel: async () =>
      modelWithDecisions([
        {
          decisionKey: shampooStep.decisionKey,
          intakeItemId: ids.shampooItem,
          decision: "swap",
          swapProductId: priced.b,
        },
      ]),
  })
  const section = lockedInOf(markup)
  const buy = section.slice(section.indexOf(">Neu kaufen<"), section.indexOf(">Behalten<"))
  assert.ok(buy.includes("Beta Shampoo"), buy)
  assert.ok(!buy.includes("€"))
  // Every buy price unknown: no fake zero lower bound (Codex F2).
  assert.ok(section.includes(">Preis noch offen<"))
})

test("locked-in: no copy button (R29), plum section in the cockpit's own voice", async () => {
  const section = lockedInOf(await renderPage())
  assert.ok(!section.includes("runsheet-locked-in-copy"))
  assert.ok(!section.includes("Liste kopieren"))
  assert.ok(!section.includes("<button"))
  // Plum marks the section; no coral CTA left in it.
  assert.equal(occurrences(section, "--brand-coral"), 0)
  assert.ok(section.includes("text-[var(--brand-plum)]"))
  assert.ok(!SECOND_PERSON_WORD.test(readableLines(section).join("\n")))
})
