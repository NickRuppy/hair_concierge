import assert from "node:assert/strict"
import test from "node:test"
import { NextResponse } from "next/server"
import { renderToStaticMarkup } from "react-dom/server"

import { createDiscoveryPdfPage } from "../src/app/admin/beratung/[enrollmentId]/pdf/page"
import type { DiscoveryCallIntake, DiscoveryCockpitModel } from "../src/lib/discovery/cockpit"
import type { DiscoveryEnrollment } from "../src/lib/discovery/enrollment"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import type { DiscoveryParticipantVerdict } from "../src/lib/discovery/load-participant-verdicts"
import {
  composeDiscoveryRefinedRoutine,
  type DiscoveryCallDecision,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"
import type { ScanCatalogPresentationRow } from "../src/lib/scan/product-presentation"
import type { ScanPresentedVerdictPayload } from "../src/lib/scan/types"

/**
 * The participant's document, rendered through the real page with faked loaders.
 *
 * What is asserted is what the paper promises: it exists only for a finalised call, it is
 * written to the participant in du-form, every step names either a concrete product with
 * „bleibt"/„neu" or says it is still open, the shelf says what happens to each product the
 * participant brought, and a routine that drifted since „Finalisieren" says so out loud
 * instead of quietly handing over a re-derived plan.
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  shampoo: "30000000-0000-4000-8000-000000000003",
  conditioner: "30000000-0000-4000-8000-000000000004",
  conditionerSwap: "30000000-0000-4000-8000-000000000005",
  secondShampoo: "30000000-0000-4000-8000-000000000006",
  oil: "30000000-0000-4000-8000-000000000007",
  idealLeaveIn: "30000000-0000-4000-8000-00000000000c",
  shampooItem: "50000000-0000-4000-8000-000000000001",
  conditionerItem: "50000000-0000-4000-8000-000000000002",
  secondShampooItem: "50000000-0000-4000-8000-000000000003",
  oilItem: "50000000-0000-4000-8000-000000000004",
  barcodeItem: "50000000-0000-4000-8000-000000000005",
}

const enrollment: DiscoveryEnrollment = {
  enrollmentId: ids.enrollment,
  name: "Lena M.",
  email: "lena@example.test",
  tokenVersion: 1,
  claimedUserId: ids.user,
  claimedAt: "2026-09-19T10:00:00.000Z",
  createdAt: "2026-09-18T10:00:00.000Z",
}

const FINALIZED_AT = "2026-09-22T12:00:00.000Z"

const intake: DiscoveryCallIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "submitted",
  submittedAt: "2026-09-20T18:41:00.000Z",
  callFinalizedAt: FINALIZED_AT,
  finalizedSourceHash: null,
}

// --- the routine the call finalised ------------------------------------------

function step(
  overrides: Partial<DiscoveryIdealStep> & Pick<DiscoveryIdealStep, "decisionKey" | "category">,
): DiscoveryIdealStep {
  return {
    role: "shampoo_everyday",
    section: "basis",
    categoryLabel: "Shampoo",
    roleLabel: "Hauptreinigung",
    roleDescription: "Regelmäßige Reinigung für deine Kopfhaut.",
    frequencyLabel: "3× / Woche",
    preview: null,
    ...overrides,
  }
}

const shampooStep = step({
  decisionKey: "decision:shampoo:shampoo_everyday:gap",
  category: "shampoo",
})

const conditionerStep = step({
  decisionKey: "decision:conditioner:conditioner_rinse_out:gap",
  category: "conditioner",
  role: "conditioner_rinse_out",
  categoryLabel: "Conditioner",
  roleLabel: "Pflege nach der Reinigung",
  roleDescription: "Pflegt und entwirrt die Längen nach der Haarwäsche.",
  frequencyLabel: "nach jeder Wäsche",
})

const leaveInStep = step({
  decisionKey: "decision:leave_in:post_wash_leave_in:gap",
  category: "leave_in",
  role: "post_wash_leave_in",
  categoryLabel: "Leave-in",
  roleLabel: "Pflege ohne Ausspülen",
  roleDescription: "Gibt den Längen Pflege, die im Haar bleibt.",
  frequencyLabel: "nach jeder Wäsche",
  preview: {
    kind: "recommendation",
    category: "leave_in",
    role: "post_wash_leave_in",
    decisionKey: "decision:leave_in:post_wash_leave_in:gap",
    productId: ids.idealLeaveIn,
    productName: "Garnier Fructis Hair Food Leave-in",
    imageUrl: "https://catalog.example/leave-in.jpg",
    verdict: "ideal",
    authorityVersion: "v1",
    factFingerprint: "fp",
    commerce: {
      priceEur: null,
      purchaseLinkStatus: null,
      netContentValue: null,
      netContentUnit: null,
      priceLabel: null,
      netContentLabel: null,
      availabilityLabel: null,
      productUrl: null,
      affiliateDisclosure: null,
    },
    reasoning: { productCriteria: "Leicht.", fit: "Passt.", frequency: "nach jeder Wäsche" },
  },
})

const maskStep = step({
  decisionKey: "decision:mask:intensive_conditioning_mask:gap",
  category: "mask",
  role: "intensive_conditioning_mask",
  categoryLabel: "Maske",
  roleLabel: "Intensivpflege",
  roleDescription: "Gibt den Längen eine intensive, auswaschbare Pflegeeinheit.",
  frequencyLabel: "1× pro Woche",
})

const oilStep = step({
  decisionKey: "decision:oil:dry_finish:gap",
  category: "oil",
  role: "dry_finish",
  categoryLabel: "Haaröl",
  roleLabel: "Finish",
  roleDescription: "Schließt die Routine als Finish für die Längen ab.",
  frequencyLabel: "bei Bedarf",
})

const steps = [shampooStep, conditionerStep, leaveInStep, maskStep, oilStep]

function item(overrides: Partial<DiscoveryIntakeItem> & Pick<DiscoveryIntakeItem, "id">) {
  return {
    category: "shampoo" as const,
    source: "catalog_search" as const,
    brandText: null,
    productNameText: null,
    barcodeIdentifier: null,
    productId: null,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  } satisfies DiscoveryIntakeItem
}

const items: DiscoveryIntakeItem[] = [
  item({
    id: ids.shampooItem,
    productId: ids.shampoo,
    brandText: "Elvital",
    productNameText: "Hyaluron Pure",
  }),
  item({
    id: ids.conditionerItem,
    category: "conditioner",
    productId: ids.conditioner,
    brandText: "Gliss Kur",
    productNameText: "Aqua Revive Spülung",
    createdAt: "2026-09-20T10:01:00.000Z",
  }),
  item({
    id: ids.secondShampooItem,
    productId: ids.secondShampoo,
    brandText: "Balea",
    productNameText: "Repair Shampoo",
    createdAt: "2026-09-20T10:02:00.000Z",
  }),
  item({
    id: ids.oilItem,
    category: "oil",
    productId: ids.oil,
    brandText: "Elvital",
    productNameText: "Öl Magique",
    createdAt: "2026-09-20T10:03:00.000Z",
  }),
  item({
    id: ids.barcodeItem,
    category: "mask",
    source: "barcode_unknown",
    barcodeIdentifier: "4005900123456",
    createdAt: "2026-09-20T10:04:00.000Z",
  }),
]

const decisions: DiscoveryCallDecision[] = [
  {
    decisionKey: shampooStep.decisionKey,
    decision: "keep",
    swapProductId: null,
    intakeItemId: ids.shampooItem,
  },
  {
    decisionKey: conditionerStep.decisionKey,
    decision: "swap",
    swapProductId: ids.conditionerSwap,
    intakeItemId: ids.conditionerItem,
  },
]

const swapProducts: ScanCatalogPresentationRow[] = [
  {
    id: ids.conditionerSwap,
    name: "Guhl Feuchtigkeit & Glanz Spülung",
    brand: "Guhl",
    category: "conditioner",
    imageUrl: null,
    priceEur: null,
    currency: null,
    affiliateLink: null,
    purchaseLinkStatus: null,
    priceCheckedAt: null,
  },
]

const payload: ScanPresentedVerdictPayload = {
  kind: "in_catalog",
  verdict: "supportive",
  verdictLabel: "Passt mit Einschränkung",
  verdictTitle: "Passt mit Einschränkung zu deinem Haar",
  status: "pending",
  subtitle: "2 von 3 Zielbereichen getroffen",
  evaluatedRole: "shampoo_everyday",
  evaluatedRoleLabel: "Hauptreinigung",
  dimensions: [],
  criteria: [],
  coverage: null,
  fitNarrative: {
    productCriteria: "Leichte Reinigung ohne Silikone.",
    fit: "Sitzt richtig bei einem Ansatz, der schnell nachfettet.",
  },
  alternatives: [],
}

const verdicts: DiscoveryParticipantVerdict[] = [
  {
    itemId: ids.shampooItem,
    productId: ids.shampoo,
    status: "verdict",
    product: {
      productId: ids.shampoo,
      name: "Elvital Hyaluron Pure Shampoo",
      brand: "L'Oréal Elvital",
      category: "shampoo",
      categoryLabel: "Shampoo",
      imageUrl: null,
      priceLabel: null,
      purchaseUrl: null,
    },
    payload,
  },
]

function readyModel(): DiscoveryCockpitModel {
  return {
    status: "ready",
    steps,
    verdicts,
    previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
    routine: composeDiscoveryRefinedRoutine({ steps, items, decisions, swapProducts }),
  }
}

/** The hash „Finalisieren" would have stored for exactly this routine. */
const FINALIZED_HASH = readyModel().routine.sourceHash

type Deps = Record<string, unknown>

function pageDeps(overrides: Deps = {}): Deps {
  return {
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }),
    createAdminClient: () => ({}) as never,
    loadEnrollment: async () => enrollment,
    loadIntake: async () => ({ ...intake, finalizedSourceHash: FINALIZED_HASH }),
    loadModel: async () => readyModel(),
    ...overrides,
  }
}

async function renderPdf(overrides: Deps = {}): Promise<string> {
  const Page = createDiscoveryPdfPage(pageDeps(overrides))
  const element = await Page({ params: Promise.resolve({ enrollmentId: ids.enrollment }) })
  return renderToStaticMarkup(element)
}

async function redirectTargetOf(overrides: Deps): Promise<string> {
  try {
    await renderPdf(overrides)
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest
    return typeof digest === "string" ? digest : String(error)
  }
  return ""
}

// --- the gates ------------------------------------------------------------------

test("the kill switch and the admin gate hide the document rather than explain it", async () => {
  await assert.rejects(() => renderPdf({ flagEnabled: () => false }))
  await assert.rejects(() =>
    renderPdf({
      requireAdmin: async () => ({
        response: NextResponse.json({ error: "Nicht erlaubt." }, { status: 403 }),
      }),
    }),
  )
  await assert.rejects(() => renderPdf({ loadEnrollment: async () => null }))
})

test("the render gate: only a finalised call has a document", async () => {
  const cockpit = `/admin/beratung/${ids.enrollment}`

  const unfinalized = await redirectTargetOf({
    loadIntake: async () => ({ ...intake, callFinalizedAt: null, finalizedSourceHash: null }),
  })
  assert.ok(unfinalized.startsWith("NEXT_REDIRECT"), unfinalized)
  assert.ok(unfinalized.includes(cockpit), unfinalized)

  // No checklist at all, and a profile that cannot be read right now, land in the same place:
  // the cockpit is the surface that explains why there is nothing to print.
  assert.ok((await redirectTargetOf({ loadIntake: async () => null })).includes(cockpit))
  assert.ok(
    (await redirectTargetOf({ loadModel: async () => ({ status: "no_usable_source" }) })).includes(
      cockpit,
    ),
  )
  assert.ok(
    (
      await redirectTargetOf({ loadModel: async () => ({ status: "temporarily_unavailable" }) })
    ).includes(cockpit),
  )
})

// --- the document ---------------------------------------------------------------

test("the document is written to the participant, step by step", async () => {
  const markup = await renderPdf()

  // Addressed to her, in her own words — no cockpit chrome anywhere on the paper.
  assert.ok(markup.includes("Deine Routine, Lena M."))
  assert.ok(markup.includes("Chaarlie · Deine Routine für Lena M."))
  assert.ok(markup.includes("22.09.2026"))
  assert.ok(!markup.includes("Ihr Produkt"))
  assert.ok(!markup.includes("Idealroutine"))
  assert.ok(!markup.includes("Finalisieren"))

  // 5 Schritte — 1 bleibt, 2 sind neu, 2 sind noch offen.
  assert.ok(markup.includes("5 Schritte — 1 bleibt, 2 sind neu, 2 sind noch offen."))

  // Kept: her own product, badged „bleibt" (named as the engine names it).
  assert.ok(markup.includes("Elvital Hyaluron Pure Shampoo"))
  assert.ok(markup.includes("dcp-b-keep"))
  // Swapped and the open step with a recommendation: both read „neu".
  assert.ok(markup.includes("Guhl Feuchtigkeit &amp; Glanz Spülung"))
  assert.ok(markup.includes("Garnier Fructis Hair Food Leave-in"))
  assert.ok(markup.includes("dcp-b-new"))
  // The open step without a recommendation, and the undecided one, use the ruled copy.
  assert.equal(markup.split("Noch offen – Empfehlung folgt").length - 1, 2)

  // Every step carries its cadence and its cosmetic why-line.
  assert.ok(markup.includes("3× / Woche"))
  assert.ok(markup.includes("Regelmäßige Reinigung für deine Kopfhaut."))
  assert.ok(markup.includes("Gibt den Längen Pflege, die im Haar bleibt."))

  // Print CSS is the point of this page.
  assert.ok(markup.includes("print-color-adjust: exact"))
  assert.ok(markup.includes("@page { size: A4; margin: 0; }"))
})

test("the shelf says what happens to every product she brought", async () => {
  const markup = await renderPdf()

  assert.ok(markup.includes("Deine bisherigen Produkte"))
  assert.ok(markup.includes("3 Produkte geprüft — 1 bleibt, 1 wird ersetzt, 1 ist noch offen."))
  assert.ok(markup.includes("Bleibt in deiner Routine."))
  assert.ok(markup.includes("Wird ersetzt durch Guhl Feuchtigkeit &amp; Glanz Spülung."))
  assert.ok(markup.includes("Gliss Kur Aqua Revive Spülung"))
  assert.ok(markup.includes("Elvital Öl Magique"))
  assert.ok(markup.includes("Dazu melden wir uns noch."))

  // A product with no step in the Idealroutine leaves the routine, and says so plainly.
  assert.ok(markup.includes("Brauchst du nicht mehr"))
  assert.ok(markup.includes("Balea Repair Shampoo"))

  // A scanned product we could not identify keeps its code instead of inventing a name — and
  // it is NOT filed under „brauchst du nicht mehr", because nothing is known about it yet.
  assert.ok(markup.includes("Dazu melden wir uns noch</h2>"))
  assert.ok(markup.includes("Gescanntes Produkt · 4005900123456"))
})

// --- drift ----------------------------------------------------------------------

test("a routine that moved since the finalisation says so, and never re-derives in silence", async () => {
  const drifted = await renderPdf({
    loadIntake: async () => ({ ...intake, finalizedSourceHash: "hash-from-another-day" }),
  })
  assert.ok(drifted.includes("Stand hat sich geändert"))
  assert.ok(drifted.includes("zeigt den aktuellen Stand, nicht den finalisierten"))
  assert.ok(drifted.includes("Vor dem Versenden im Cockpit prüfen und neu finalisieren."))
  // Internal warning: it belongs to Nick's screen, never to the participant's paper.
  assert.ok(drifted.includes("print:hidden"))
  // The document itself still renders — the warning is beside it, not instead of it.
  assert.ok(drifted.includes("Deine Routine, Lena M."))

  const matching = await renderPdf()
  assert.ok(!matching.includes("Stand hat sich geändert"))

  // A finalised call with no stored hash at all is drift, not a silent pass.
  const unstamped = await renderPdf({
    loadIntake: async () => ({ ...intake, finalizedSourceHash: null }),
  })
  assert.ok(unstamped.includes("Stand hat sich geändert"))
})
