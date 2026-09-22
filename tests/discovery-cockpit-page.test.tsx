import assert from "node:assert/strict"
import test from "node:test"
import { NextResponse } from "next/server"
import { renderToStaticMarkup } from "react-dom/server"

import { createDiscoveryCockpitListPage } from "../src/app/admin/beratung/page"
import { createDiscoveryCockpitPage } from "../src/app/admin/beratung/[enrollmentId]/page"
import type { DiscoveryCallIntake, DiscoveryCockpitModel } from "../src/lib/discovery/cockpit"
import type { DiscoveryEnrollment } from "../src/lib/discovery/enrollment"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import type { DiscoveryParticipantVerdict } from "../src/lib/discovery/load-participant-verdicts"
import { composeDiscoveryRefinedRoutine } from "../src/lib/discovery/refined-routine"
import type { ScanPresentedVerdictPayload } from "../src/lib/scan/types"

/**
 * The cockpit pages, rendered through their real components with faked loaders.
 *
 * What is asserted is the call's own promises: the Idealroutine reads as a script, the
 * participant's product carries the engine's verdict, every step offers exactly one
 * decision, the collapsed blocks name what needs no decision, and the two gates hide the
 * page rather than explaining it.
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  owned: "30000000-0000-4000-8000-000000000003",
  alternative: "30000000-0000-4000-8000-00000000000a",
  ideal: "30000000-0000-4000-8000-00000000000c",
  item: "50000000-0000-4000-8000-000000000005",
  barcodeItem: "50000000-0000-4000-8000-000000000006",
  declinedItem: "50000000-0000-4000-8000-000000000007",
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

const intake: DiscoveryCallIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "submitted",
  submittedAt: "2026-09-20T18:41:00.000Z",
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
  frequencyLabel: "3× / Woche",
  preview: null,
}

const leaveInStep: DiscoveryIdealStep = {
  decisionKey: "decision:leave_in:post_wash_leave_in:gap",
  category: "leave_in",
  role: "post_wash_leave_in",
  section: "basis",
  categoryLabel: "Leave-in",
  roleLabel: "Pflege im feuchten Haar",
  roleDescription: "Ins handtuchfeuchte Haar",
  frequencyLabel: "nach jeder Wäsche",
  preview: {
    kind: "recommendation",
    category: "leave_in",
    role: "post_wash_leave_in",
    decisionKey: "decision:leave_in:post_wash_leave_in:gap",
    productId: ids.ideal,
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
}

const items = [
  {
    id: ids.item,
    category: "shampoo" as const,
    source: "catalog_search" as const,
    brandText: "Elvital",
    productNameText: "Hyaluron Pure",
    barcodeIdentifier: null,
    productId: ids.owned,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
  },
  {
    id: ids.barcodeItem,
    category: "mask" as const,
    source: "barcode_unknown" as const,
    brandText: null,
    productNameText: null,
    barcodeIdentifier: "4005900123456",
    productId: null,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:05:00.000Z",
  },
  {
    id: ids.declinedItem,
    category: "oil" as const,
    source: "none" as const,
    brandText: null,
    productNameText: null,
    barcodeIdentifier: null,
    productId: null,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:06:00.000Z",
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
  alternatives: [
    {
      productId: ids.alternative,
      displayName: "Guhl Leichte Frische Shampoo",
      imageUrl: null,
      priceLabel: null,
      netContentLabel: null,
      verdict: "ideal",
      verdictLabel: "Passt",
      brand: "Guhl",
      purchaseUrl: null,
    },
  ],
}

const verdicts: DiscoveryParticipantVerdict[] = [
  {
    itemId: ids.item,
    productId: ids.owned,
    status: "verdict",
    product: {
      productId: ids.owned,
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
    steps: [shampooStep, leaveInStep],
    verdicts,
    previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
    routine: composeDiscoveryRefinedRoutine({
      steps: [shampooStep, leaveInStep],
      items,
      decisions: [],
      swapProducts: [],
    }),
  }
}

type Deps = Record<string, unknown>

function pageDeps(overrides: Deps = {}): Deps {
  return {
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }),
    createAdminClient: () => ({}) as never,
    loadEnrollment: async () => enrollment,
    loadIntake: async () => intake,
    loadModel: async () => readyModel(),
    loadPreflight: async () => ({ status: "ready" }),
    ...overrides,
  }
}

async function renderCockpit(overrides: Deps = {}): Promise<string> {
  const Page = createDiscoveryCockpitPage(pageDeps(overrides))
  const element = await Page({ params: Promise.resolve({ enrollmentId: ids.enrollment }) })
  return renderToStaticMarkup(element)
}

// --- the gate -------------------------------------------------------------------

test("the kill switch and the admin gate both hide the cockpit", async () => {
  await assert.rejects(() => renderCockpit({ flagEnabled: () => false }))
  await assert.rejects(() =>
    renderCockpit({
      requireAdmin: async () => ({
        response: NextResponse.json({ error: "Nicht erlaubt." }, { status: 403 }),
      }),
    }),
  )
  await assert.rejects(() => renderCockpit({ loadEnrollment: async () => null }))
})

// --- the call surface -----------------------------------------------------------

test("the cockpit reads as the call: routine, verdict, one decision per step", async () => {
  const markup = await renderCockpit()

  // Participant header and intake state.
  assert.ok(markup.includes("Lena M."))
  assert.ok(markup.includes("lena@example.test"))
  assert.ok(markup.includes("submitted · 20.09.2026 18:41 UTC"))

  // The Idealroutine block, written to be read aloud.
  assert.ok(markup.includes("Idealroutine"))
  assert.ok(markup.includes("Kopfhaut waschen, Längen nur durchspülen"))
  assert.ok(markup.includes("3× / Woche"))
  assert.ok(markup.includes("Ins handtuchfeuchte Haar"))

  // The participant's product, with the engine's own verdict copy.
  assert.ok(markup.includes("Ihr Produkt"))
  assert.ok(markup.includes("Elvital Hyaluron Pure Shampoo"))
  assert.ok(markup.includes("Passt mit Einschränkung zu deinem Haar"))
  assert.ok(markup.includes("Sitzt richtig bei einem Ansatz, der schnell nachfettet."))

  // One decision per step: keep plus the displayed alternative.
  assert.ok(markup.includes("Behalten"))
  assert.ok(markup.includes("Tauschen zu Guhl Leichte Frische Shampoo"))
  // The open step reads „Ohne Produkt weiter" + the Idealplan's own pick as „Neu:".
  assert.ok(markup.includes("Ohne Produkt weiter"))
  assert.ok(markup.includes("Neu: Garnier Fructis Hair Food Leave-in"))
  assert.ok(markup.includes("Lücke in der Idealroutine"))

  // Exactly one radio group per step, and nothing pre-selected before the call.
  const radios = markup.match(/type="radio"/g) ?? []
  assert.equal(radios.length, 4)
  assert.ok(!markup.includes('checked=""'))

  // Finalize, with its state hint.
  assert.ok(markup.includes("Finalisieren"))
  assert.ok(markup.includes("noch nicht finalisiert"))
  assert.ok(markup.includes("PDF: gesperrt"))
})

test("what needs no decision collapses to one grey line each", async () => {
  const markup = await renderCockpit()
  assert.ok(markup.includes("Nicht in der Idealroutine"))
  // „benutze ich nicht" — one line, no decision UI.
  assert.ok(markup.includes("Öl — benutzt sie nicht. Keine Entscheidung nötig."))
  // The unresolved barcode row keeps its code instead of inventing a name.
  assert.ok(markup.includes("Noch in Recherche: Gescanntes Produkt · 4005900123456"))
})

test("a finalised call renders as finalised", async () => {
  const markup = await renderCockpit({
    loadIntake: async () => ({
      ...intake,
      callFinalizedAt: "2026-09-22T12:00:00.000Z",
      finalizedSourceHash: "hash-1",
    }),
  })
  assert.ok(markup.includes("Finalisierung aufheben"))
  assert.ok(markup.includes("finalisiert am 22.09.2026 12:00 UTC"))
  assert.ok(markup.includes("PDF: frei"))
  // Frozen: every radio is disabled until the finalisation is lifted.
  assert.equal((markup.match(/disabled=""/g) ?? []).length, 4)
})

test("the preflight banner names the answers that are still missing", async () => {
  const markup = await renderCockpit({
    loadPreflight: async () => ({
      status: "missing_source_facts",
      questions: ["Wie fühlt sich deine Kopfhaut meistens an?"],
    }),
  })
  assert.ok(markup.includes("Intake unvollständig"))
  assert.ok(markup.includes("Wie fühlt sich deine Kopfhaut meistens an?"))

  const clean = await renderCockpit()
  assert.ok(!clean.includes("Intake unvollständig"))
})

test("an intake that does not exist yet, and a profile that cannot be read, say so", async () => {
  const noIntake = await renderCockpit({ loadIntake: async () => null })
  assert.ok(noIntake.includes("Checkliste noch nicht geöffnet"))
  assert.ok(!noIntake.includes("Finalisieren"))

  const noSource = await renderCockpit({ loadModel: async () => ({ status: "no_usable_source" }) })
  assert.ok(noSource.includes("noch kein nutzbares Haarprofil"))

  const unavailable = await renderCockpit({
    loadModel: async () => ({ status: "temporarily_unavailable" }),
  })
  assert.ok(unavailable.includes("lässt sich gerade nicht lesen"))
})

// --- the list -------------------------------------------------------------------

test("the list joins every enrollment with the state of its checklist", async () => {
  const Page = createDiscoveryCockpitListPage({
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }),
    createAdminClient: () => ({}) as never,
    listEnrollments: async () => [
      {
        id: ids.enrollment,
        display_name: "Lena M.",
        normalized_email: "lena@example.test",
        token_version: 1,
        claimed_at: "2026-09-19T10:00:00.000Z",
        revoked_at: null,
        created_at: "2026-09-18T10:00:00.000Z",
      },
      {
        id: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a2f",
        display_name: "Mira K.",
        normalized_email: "mira@example.test",
        token_version: 1,
        claimed_at: null,
        revoked_at: null,
        created_at: "2026-09-17T10:00:00.000Z",
      },
    ],
    listIntakes: async () => [intake],
  })
  const markup = renderToStaticMarkup(await Page())

  assert.ok(markup.includes("Lena M."))
  assert.ok(markup.includes("eingelöst"))
  assert.ok(markup.includes("20.09.2026 18:41 UTC"))
  assert.ok(markup.includes(`/admin/beratung/${ids.enrollment}`))
  // The uninvited-yet participant has no intake at all.
  assert.ok(markup.includes("Mira K."))
  assert.ok(markup.includes("eingeladen"))
  assert.ok(markup.includes("nicht begonnen"))
})

test("the list is hidden behind the same two gates", async () => {
  const off = createDiscoveryCockpitListPage({
    flagEnabled: () => false,
    requireAdmin: async () => ({ userId: "admin-1" }),
  })
  await assert.rejects(() => off())

  const refused = createDiscoveryCockpitListPage({
    flagEnabled: () => true,
    requireAdmin: async () => ({
      response: NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }),
    }),
  })
  await assert.rejects(() => refused())
})
