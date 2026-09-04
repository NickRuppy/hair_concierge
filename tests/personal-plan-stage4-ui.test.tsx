import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"

import { renderToStaticMarkup } from "react-dom/server"

import { RoutinePage } from "../src/components/routine/personal-plan"
import { routineCadenceLabel } from "../src/components/routine/personal-plan/routine-item-card"
import type {
  PersonalPlanRoutineView,
  RoutinePayloadV1,
} from "../src/lib/personal-plan/routine/contracts"
import type { PortfolioPresentation } from "../src/lib/personal-plan/routine/portfolio-presentation"

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement<Record<string, unknown>>) => boolean,
): ReactElement<Record<string, unknown>> | null {
  if (!React.isValidElement(node)) return null
  const element = node as ReactElement<Record<string, unknown>>
  if (predicate(element)) return element
  // Function components (e.g. `<RoutineRefinementBanner .../>`) are opaque
  // React elements until invoked — their real markup only exists once the
  // component function runs. Expand them here so the search can reach
  // markup nested inside sub-components, not just the caller's own JSX.
  // Components that use hooks throw outside a real render pass (no
  // dispatcher is active here); swallow that and fall through to the plain
  // children traversal below, which is what already worked for those.
  if (typeof element.type === "function") {
    try {
      const rendered = (element.type as (props: unknown) => ReactNode)(element.props)
      const match = findElement(rendered, predicate)
      if (match) return match
    } catch {
      // Not expandable outside a real render (e.g. uses hooks) — fall
      // through to the children traversal.
    }
  }
  for (const child of React.Children.toArray(
    (element.props as { children?: ReactNode }).children,
  )) {
    const match = findElement(child, predicate)
    if (match) return match
  }
  return null
}

const item = (overrides: Record<string, unknown> = {}) => ({
  itemKey: "item:shampoo:shampoo_everyday:owned",
  assignmentKey: "assignment:shampoo:shampoo_everyday:owned",
  category: "shampoo",
  role: "shampoo_everyday",
  purposeKey: "shampoo_everyday",
  roleOrder: 0,
  state: {
    systemAssessment: "basis",
    inclusion: "included",
    availability: "owned",
    fitDecision: "standard",
  },
  product: { kind: "owned", displayName: "Sanftes Shampoo" },
  cadence: { recommended: null, userOverride: "daily_1x", displayKey: "daily_1x" },
  sourceDecisionKeys: [],
  authorityRuleIds: [],
  executable: true,
  ...overrides,
})

const payload = (items: Record<string, unknown>[], sections?: RoutinePayloadV1["sections"]) =>
  ({
    schemaVersion: 1,
    planId: "11111111-1111-4111-8111-111111111111",
    versionId: "routine-v1",
    parentVersionId: null,
    source: {
      refinedVersionId: "22222222-2222-4222-8222-222222222222",
      productPortfolioVersionId: "portfolio-v1",
      sourceFingerprint: "a".repeat(64),
      compilerVersion: "v1",
      authorityVersions: {},
    },
    intent: { schemaVersion: 1, categories: [] },
    sections: sections ?? [
      { key: "basis", itemKeys: items.map((entry) => String(entry.itemKey)) },
      { key: "optional", itemKeys: [] },
    ],
    items,
    createdAt: "2026-08-08T00:00:00.000Z",
  }) as unknown as RoutinePayloadV1

const proposalView = (candidate: RoutinePayloadV1): PersonalPlanRoutineView => ({
  status: "proposal",
  personalPlanId: "plan-1",
  planRevision: 1,
  sourceRevision: 1,
  activeVersion: null,
  pendingProposal: {
    id: "proposal-1",
    candidateVersionId: candidate.versionId,
    sourceRevision: 1,
    delta: { schemaVersion: 1, direct: [], consequential: [], unchangedItemCount: 0 },
    candidate,
  },
})

test("renders Basis before Optional and groups multiple roles into one Bedarfsplan category card", () => {
  const routine = payload(
    [
      item({
        itemKey: "shampoo-cleanse",
        purposeKey: "shampoo_everyday",
        role: "shampoo_everyday",
      }),
      item({
        itemKey: "shampoo-treatment",
        assignmentKey: "shampoo-treatment",
        purposeKey: "shampoo_dandruff",
        role: "shampoo_dandruff",
        roleOrder: 1,
        product: { kind: "owned", displayName: "Kopfhautserum" },
      }),
      item({
        itemKey: "mask",
        category: "mask",
        purposeKey: "intensive_conditioning_mask",
        role: "intensive_conditioning_mask",
        state: {
          systemAssessment: "optional",
          inclusion: "included",
          availability: "planned",
          fitDecision: "standard",
        },
        // Contract-valid planned-without-product shape (productId is nullable
        // in the routine payload even though Stage 3 always chooses one).
        product: {
          kind: "planned",
          plannedPurchaseId: "planned:mask",
          productId: null,
          displayName: "Pflegemaske",
        },
        executable: false,
      }),
    ],
    [
      { key: "basis", itemKeys: ["shampoo-cleanse", "shampoo-treatment"] },
      { key: "optional", itemKeys: ["mask"] },
    ],
  )
  const html = renderToStaticMarkup(
    <RoutinePage view={proposalView(routine)} onItemDetail={() => undefined} />,
  )

  assert.ok(html.indexOf("Deine Basis") < html.indexOf("Optional"))
  assert.equal((html.match(/aria-label="Kategorie: Shampoo/g) ?? []).length, 1)
  assert.match(html, /Regelmäßige Reinigung/)
  assert.match(html, /Schuppenpflege/)
  assert.ok(html.indexOf("Sanftes Shampoo") < html.indexOf("Kopfhautserum"))
  assert.equal((html.match(/data-routine-detail-button="true"/g) ?? []).length, 3)
  assert.doesNotMatch(html, />Details</)
  assert.match(
    html,
    /aria-label="Zweck: Regelmäßige Reinigung; Produkt: Sanftes Shampoo; Kategorie: Shampoo; Status: Aktiv; Rhythmus: Täglich"/,
  )
  assert.match(
    html,
    /aria-label="Zweck: Schuppenpflege; Produkt: Kopfhautserum; Kategorie: Shampoo; Status: Aktiv; Rhythmus: Täglich"/,
  )
  assert.match(html, />2 Anwendungen</)
  // A planned item without a concrete product choice reads "Offen", same as
  // availability "none" — a selected catalog product is instantly Aktiv.
  assert.match(html, /Status: Offen/)
})

test("Routine has no journey header — Bottom-Nav carries orientation (Task 2.7)", () => {
  const routine = payload([item()])
  const html = renderToStaticMarkup(<RoutinePage view={proposalView(routine)} />)

  assert.doesNotMatch(html, /data-personal-plan-journey-header/)
  assert.doesNotMatch(html, /role="progressbar"/)
  assert.doesNotMatch(html, /Personal-Plan-Stufen/)
})

test("a basis slot with a planned ref but no chosen product blocks the Anwendung", () => {
  const routine = payload([
    item({
      itemKey: "item:shampoo:planned-open",
      state: {
        systemAssessment: "basis",
        inclusion: "included",
        availability: "planned",
        fitDecision: "standard",
      },
      product: {
        kind: "planned",
        plannedPurchaseId: "planned:open",
        productId: null,
        displayName: "Noch offenes Shampoo",
      },
      executable: false,
    }),
  ])
  const html = renderToStaticMarkup(
    <RoutinePage view={proposalView(routine)} onItemDetail={() => undefined} />,
  )

  assert.match(html, /Status: Offen/)
  assert.match(html, /Mindestens ein Basis-Baustein fehlt noch/)
  assert.doesNotMatch(html, /Anwendung ansehen/)
})

test("a planned item with a chosen catalog product is a full routine member", () => {
  // Faithful payload shape: planned items are never executable in real
  // portfolios (executable = owned catalog product), yet they must read Aktiv.
  const routine = payload([
    item({
      itemKey: "item:shampoo:shampoo_everyday:planned",
      state: {
        systemAssessment: "basis",
        inclusion: "included",
        availability: "planned",
        fitDecision: "standard",
      },
      product: {
        kind: "planned",
        plannedPurchaseId: "planned:decision-1",
        productId: "33333333-3333-4333-8333-333333333333",
        displayName: "Empfohlenes Shampoo",
      },
      executable: false,
    }),
  ])
  const html = renderToStaticMarkup(
    <RoutinePage view={proposalView(routine)} onItemDetail={() => undefined} />,
  )

  assert.match(
    html,
    /aria-label="Zweck: Regelmäßige Reinigung; Produkt: Empfohlenes Shampoo; Kategorie: Shampoo; Status: Aktiv; Rhythmus: Täglich"/,
  )
  assert.doesNotMatch(html, /Nicht einsatzbereit/)
  assert.doesNotMatch(html, /Geplant/)
  assert.doesNotMatch(html, /Status: Offen/)
})

test("uses proposal copy initially and never offers an Anwendung hero button", () => {
  const active = payload([item({ product: { kind: "owned", displayName: "Aktives Shampoo" } })])
  const candidate = payload([
    item({
      product: { kind: "planned", displayName: "Neues Shampoo" },
      state: {
        systemAssessment: "basis",
        inclusion: "included",
        availability: "planned",
        fitDecision: "standard",
      },
    }),
  ])
  const activeWithPending: PersonalPlanRoutineView = {
    ...proposalView(candidate),
    status: "active",
    activeVersion: { id: active.versionId, payload: active },
  }

  assert.doesNotMatch(
    renderToStaticMarkup(<RoutinePage view={proposalView(candidate)} />),
    /Routine bestätigen/,
  )
  const html = renderToStaticMarkup(<RoutinePage view={activeWithPending} />)
  assert.match(html, /Deine Routine/)
  assert.doesNotMatch(html, /Deine Routine steht/)
  assert.match(html, /Aktives Shampoo/)
  assert.doesNotMatch(html, /Neues Shampoo/)
  // Field test 26.08.2026: the Anwendung hero button is gone for good — the
  // Bottom-Nav's Anwendung tab is the only route to that surface now.
  assert.doesNotMatch(html, /Anwendung ansehen/)
  assert.doesNotMatch(html, /href="\/anwendung"/)
  assert.doesNotMatch(
    renderToStaticMarkup(<RoutinePage view={proposalView(candidate)} />),
    /Anwendung ansehen/,
  )
})

test("the edit affordance is a quiet link in the heading row, not a hero button", () => {
  const routine = payload([item()])
  const view: PersonalPlanRoutineView = {
    status: "active",
    personalPlanId: routine.planId,
    planRevision: 1,
    sourceRevision: 1,
    activeVersion: { id: routine.versionId, payload: routine },
    pendingProposal: null,
  }
  const html = renderToStaticMarkup(<RoutinePage view={view} onEdit={() => undefined} />)

  assert.match(html, />Anpassen</)
  // The repo's quiet-affordance idiom (Haarprofil "Angaben ändern"): a plum
  // underlined text control, never a filled/outline button.
  assert.match(html, /<button[^>]*underline[^>]*>Anpassen</)
  assert.doesNotMatch(html, /funnelCta/)
  // It sits in the heading row, directly after the H1 — not in a CTA dock.
  assert.ok(html.indexOf("Deine Routine") < html.indexOf("Anpassen"))
  assert.ok(html.indexOf("Anpassen") < html.indexOf("Deine Basis"))

  let edited = 0
  const tree = RoutinePage({ view, onEdit: () => (edited += 1) })
  const editButton = findElement(
    tree,
    (element) => element.type === "button" && element.props.children === "Anpassen",
  )
  assert.ok(editButton, "expected the Anpassen affordance to render")
  ;(editButton.props.onClick as () => void)()
  assert.equal(edited, 1)

  assert.doesNotMatch(renderToStaticMarkup(<RoutinePage view={view} />), />Anpassen</)
})

test("uses presentation-only catalog image and name facts outside the Routine payload", () => {
  const routine = payload([
    item({
      product: {
        kind: "owned",
        capturedProductId: "captured-shampoo",
        productId: "product-shampoo",
        displayName: "Eingefrorener Produktname",
      },
    }),
  ])
  const view: PersonalPlanRoutineView = {
    ...proposalView(routine),
    status: "active",
    activeVersion: { id: routine.versionId, payload: routine },
    pendingProposal: null,
    productPresentation: {
      catalogProducts: [
        {
          productId: "product-shampoo",
          displayName: "Aktueller Katalogname",
          imageUrl: "https://example.test/shampoo.webp",
          verifiedLeaveOnHeatProtection: false,
        },
      ],
    },
  }

  const html = renderToStaticMarkup(<RoutinePage view={view} />)

  assert.match(html, /Aktueller Katalogname/)
  assert.match(html, /src="https:\/\/example.test\/shampoo.webp"/)
  assert.doesNotMatch(html, /Eingefrorener Produktname/)
  assert.equal(routine.items[0]?.product.displayName, "Eingefrorener Produktname")
})

test("shows verified Oil heat capability in the existing Stage 4 metadata line only", () => {
  const routine = payload([
    item({
      itemKey: "oil-leave-on",
      assignmentKey: "oil-leave-on",
      category: "oil",
      role: "leave_on_fibre_conditioning",
      purposeKey: "leave_on_fibre_conditioning",
      product: {
        kind: "owned",
        capturedProductId: "captured-oil",
        productId: "product-oil",
        displayName: "Haaröl",
      },
    }),
    item({
      itemKey: "oil-finish",
      assignmentKey: "oil-finish",
      category: "oil",
      role: "dry_finish",
      purposeKey: "dry_finish",
      product: {
        kind: "owned",
        capturedProductId: "captured-oil",
        productId: "product-oil",
        displayName: "Haaröl",
      },
    }),
  ])
  const view: PersonalPlanRoutineView = {
    ...proposalView(routine),
    status: "active",
    activeVersion: { id: routine.versionId, payload: routine },
    pendingProposal: null,
    productPresentation: {
      catalogProducts: [
        {
          productId: "product-oil",
          displayName: "Haaröl",
          imageUrl: null,
          verifiedLeaveOnHeatProtection: true,
        },
      ],
    },
  }

  const html = renderToStaticMarkup(<RoutinePage view={view} />)

  assert.equal((html.match(/Hitzeschutz: bestätigt/g) ?? []).length, 2)
  assert.match(
    html,
    /aria-label="Zweck: Pflege ohne Ausspülen; Produkt: Haaröl; Kategorie: Öl; Status: Aktiv; Rhythmus: Täglich; Hitzeschutz: bestätigt"/,
  )
  assert.match(html, /Nach der Wäsche · Hitzeschutz: bestätigt · <span[^>]*>Aktiv/)
  assert.doesNotMatch(html, /Im trockenen Haar · Hitzeschutz: bestätigt/)
})

test("renders active routine as product-led result with separated later additions", () => {
  const routine = payload(
    [
      item({
        itemKey: "basis-shampoo",
        product: {
          kind: "owned",
          capturedProductId: "captured-ogx",
          productId: "product-ogx",
          displayName: "OGX Renewing + Argan Oil of Morocco Shampoo",
        },
        cadence: { recommended: null, userOverride: "weekly_3_4x", displayKey: "weekly_3_4x" },
      }),
      item({
        itemKey: "basis-conditioner",
        assignmentKey: "basis-conditioner",
        category: "conditioner",
        purposeKey: "conditioner_rinse_out",
        role: "conditioner_rinse_out",
        state: {
          systemAssessment: "basis",
          inclusion: "included",
          availability: "owned",
          fitDecision: "informed_override",
        },
        product: {
          kind: "owned",
          capturedProductId: "captured-conditioner",
          productId: "product-conditioner",
          displayName: "Bali Curls Moisturising Conditioner",
        },
        cadence: {
          recommended: { kind: "after_each_eligible_wash" },
          userOverride: null,
          displayKey: "personal_plan.cadence.after_each_eligible_wash",
        },
      }),
      item({
        itemKey: "optional-mask-gap",
        assignmentKey: "optional-mask-gap",
        category: "mask",
        purposeKey: "intensive_conditioning_mask",
        role: "intensive_conditioning_mask",
        state: {
          systemAssessment: "optional",
          inclusion: "included",
          availability: "none",
          fitDecision: "standard",
        },
        product: { kind: "none", displayName: null },
        executable: false,
      }),
    ],
    [
      { key: "basis", itemKeys: ["basis-shampoo", "basis-conditioner"] },
      { key: "optional", itemKeys: ["optional-mask-gap"] },
    ],
  )
  const view: PersonalPlanRoutineView = {
    ...proposalView(routine),
    status: "active",
    activeVersion: { id: routine.versionId, payload: routine },
    pendingProposal: null,
  }

  const html = renderToStaticMarkup(
    <RoutinePage view={view} onEdit={() => undefined} onItemDetail={() => undefined} />,
  )

  assert.match(html, /Routine aktiv/)
  assert.match(html, /Deine Routine/)
  assert.doesNotMatch(html, /Deine Routine ist bereit/)
  assert.match(html, /OGX Renewing \+ Argan Oil of Morocco Shampoo/)
  assert.match(html, /Bali Curls Moisturising Conditioner/)
  assert.doesNotMatch(html, /Regelmäßige Reinigung für deine Kopfhaut/)
  assert.doesNotMatch(html, /Pflegt und entwirrt die Längen nach der Haarwäsche/)
  assert.match(html, /3–4× pro Woche/)
  assert.match(html, /Nach jeder Haarwäsche/)
  assert.match(html, /Haarwäsche/)
  assert.match(html, /Nach Shampoo/)
  assert.doesNotMatch(html, /✓ Passt/)
  assert.match(html, /Bewusste Wahl/)
  assert.doesNotMatch(html, /Anwendungsdetails/)
  assert.doesNotMatch(html, />Details</)
  assert.equal((html.match(/data-routine-detail-button="true"/g) ?? []).length, 3)
  assert.match(html, /Später ergänzen/)
  assert.match(html, /Maske optional/)
  assert.doesNotMatch(html, /Kein Bestandteil deiner aktiven Routine/)
  assert.ok(html.indexOf("Bali Curls Moisturising Conditioner") < html.indexOf("Später ergänzen"))
  assert.doesNotMatch(html, /Anwendung ansehen/)
  assert.match(html, />Anpassen</)
  assert.doesNotMatch(html, /Routine bestätigen/)
  assert.doesNotMatch(html, /Kein Produkt ausgewählt/)
})

test("shows v3 replacement labels and retained owned products without adding them to Routine items", () => {
  const routine = payload([
    item({
      itemKey: "replacement",
      sourceDecisionKeys: ["decision-replace"],
      state: {
        systemAssessment: "basis",
        inclusion: "included",
        availability: "planned",
        fitDecision: "standard",
      },
      // Faithful v3 replacement shape: Stage3PlannedPurchase.productId is a
      // required non-null string, so real replacement items always carry one.
      product: {
        kind: "planned",
        plannedPurchaseId: "planned:decision-replace",
        productId: "44444444-4444-4444-8444-444444444444",
        displayName: "Neues Shampoo",
      },
      executable: false,
    }),
    item({
      itemKey: "override",
      assignmentKey: "override",
      sourceDecisionKeys: ["decision-override"],
      state: {
        systemAssessment: "basis",
        inclusion: "included",
        availability: "owned",
        fitDecision: "informed_override",
      },
      product: { kind: "owned", displayName: "Bewusst behalten" },
    }),
  ])
  const presentation: PortfolioPresentation = {
    schemaVersion: 3,
    plannedPurchaseDecisionKeys: ["decision-replace"],
    retainedOwnedProducts: [
      {
        capturedProductId: "captured-old",
        userProductId: "usage-old",
        productId: "product-old",
        displayName: "Altes Shampoo",
        category: "shampoo",
        role: "shampoo_everyday",
        sourceDecisionKey: "decision-replace",
        planStatus: "not_used",
      },
    ],
  }
  const html = renderToStaticMarkup(
    <RoutinePage view={proposalView(routine)} portfolioPresentation={presentation} />,
  )

  // A selected catalog product is instantly Aktiv, so the v3 decision-keyed
  // "Noch kaufen" replacement label no longer surfaces anywhere.
  assert.match(html, /Zweck: Regelmäßige Reinigung; Produkt: Neues Shampoo;[^"]*Status: Aktiv/)
  assert.doesNotMatch(html, /Noch kaufen/)
  assert.match(html, /Mit Einschränkung/)
  assert.match(html, /Nicht eingeplant \(1\)/)
  assert.match(html, /Altes Shampoo/)
  assert.equal((html.match(/Altes Shampoo/g) ?? []).length, 1)
  assert.match(html, /<details class=/)
  assert.doesNotMatch(html, /<details[^>]* open/)

  const emptyHtml = renderToStaticMarkup(
    <RoutinePage
      view={proposalView(routine)}
      portfolioPresentation={{ ...presentation, retainedOwnedProducts: [] }}
    />,
  )
  assert.doesNotMatch(emptyHtml, /Nicht eingeplant/)
})

test("shows v4 retained inventory as stored, non-executable product context", () => {
  const routine = payload([item()])
  const presentation: PortfolioPresentation = {
    schemaVersion: 4,
    plannedPurchaseDecisionKeys: [],
    retainedOwnedProducts: [],
    retainedInventoryProducts: [
      {
        kind: "catalog_product",
        capturedProductId: "inventory-captured",
        userProductId: "inventory-user-product",
        productId: "inventory-product",
        displayName: "Nicht verwendetes Trockenshampoo",
        category: "dry_shampoo",
        role: null,
        sourceDispositionKey: "inventory:dry-shampoo:1",
        planStatus: "not_used",
        reason: "category_not_in_final_plan",
      },
    ],
  }

  const html = renderToStaticMarkup(
    <RoutinePage
      view={{
        ...proposalView(routine),
        status: "active",
        activeVersion: { id: routine.versionId, payload: routine },
        pendingProposal: null,
      }}
      portfolioPresentation={presentation}
    />,
  )

  assert.match(html, /Nicht eingeplant/)
  assert.match(html, /Nicht verwendetes Trockenshampoo/)
  assert.match(html, /Nicht eingeplant/)
  assert.doesNotMatch(html, /inventory-captured/)
})

test("explains confirmed unnecessary heat protection in the not-planned routine section", () => {
  const routine = payload([item()])
  const presentation: PortfolioPresentation = {
    schemaVersion: 4,
    plannedPurchaseDecisionKeys: [],
    retainedOwnedProducts: [],
    retainedInventoryProducts: [
      {
        kind: "catalog_product",
        capturedProductId: "heat-captured",
        userProductId: "heat-user-product",
        productId: "heat-product",
        displayName: "Hitzeschutz Spray",
        category: "heat_protectant",
        role: null,
        sourceDispositionKey: "inventory:heat_protectant:heat-captured",
        planStatus: "not_used",
        reason: "category_not_in_final_plan",
      },
    ],
  }

  const html = renderToStaticMarkup(
    <RoutinePage view={proposalView(routine)} portfolioPresentation={presentation} />,
  )

  assert.match(html, /Nicht eingeplant \(1\)/)
  assert.match(html, /Kein separater Hitzeschutz nötig/)
  assert.match(html, /Für deine angegebene Routine brauchst du dieses Produkt nicht/)
  assert.match(html, /Meine Produkte/)
})

test("keeps required Basis gaps explicit and renders a named recovery state without payload", () => {
  const routine = payload([
    item({
      itemKey: "basis-gap",
      state: {
        systemAssessment: "basis",
        inclusion: "included",
        availability: "none",
        fitDecision: "standard",
      },
      product: { kind: "none", displayName: null },
      executable: false,
    }),
  ])
  const gapView: PersonalPlanRoutineView = {
    ...proposalView(routine),
    status: "active",
    activeVersion: { id: routine.versionId, payload: routine },
    pendingProposal: null,
  }
  const gapHtml = renderToStaticMarkup(<RoutinePage view={gapView} />)

  assert.match(gapHtml, /Basis-Lücke/)
  assert.match(gapHtml, /Für diesen Basis-Baustein fehlt noch ein Produkt/)
  assert.doesNotMatch(gapHtml, /href="\/anwendung"/)

  const missingPayloadView: PersonalPlanRoutineView = {
    status: "stage4_not_available",
    personalPlanId: "plan-1",
    planRevision: 1,
    sourceRevision: 1,
    activeVersion: null,
    pendingProposal: null,
  }
  const recoveryHtml = renderToStaticMarkup(<RoutinePage view={missingPayloadView} />)
  assert.match(recoveryHtml, /Routine noch nicht verfügbar/)
  assert.match(recoveryHtml, /Produkte prüfen/)
  // T2.3: the non-repair fallback CTA must use the directed products-module
  // entry, not bare "/plan-start" — the D3 guard would otherwise dead-end an
  // accepted+complete owner straight back onto this same recovery view.
  assert.match(recoveryHtml, /href="\/plan-start\?refine=products"/)
  assert.doesNotMatch(recoveryHtml, /href="\/plan-start"/)
  // Fix round 1 (minor): the no-payload/authority-repair recovery branch has
  // no journey header either (Task 2.7 covered only the main render before).
  assert.doesNotMatch(recoveryHtml, /data-personal-plan-journey-header/)
  assert.doesNotMatch(recoveryHtml, /role="progressbar"/)
})

test("states non-executable conditions plainly and keeps editing global", () => {
  const routine = payload([
    item(),
    item({
      itemKey: "excluded",
      state: {
        systemAssessment: "basis",
        inclusion: "excluded",
        availability: "none",
        fitDecision: "standard",
      },
      product: { kind: "none", displayName: null },
      executable: false,
    }),
    item({
      itemKey: "pending",
      state: {
        systemAssessment: "basis",
        inclusion: "included",
        availability: "pending_review",
        fitDecision: "standard",
      },
      product: { kind: "pending_review", displayName: "Unbekanntes Serum" },
      executable: false,
    }),
    item({
      itemKey: "included-override",
      state: {
        systemAssessment: "not_recommended",
        inclusion: "included",
        availability: "owned",
        fitDecision: "informed_override",
      },
      product: { kind: "owned", displayName: "Lieblingsöl" },
      executable: false,
    }),
    item({
      itemKey: "uncovered",
      state: {
        systemAssessment: "optional",
        inclusion: "included",
        availability: "none",
        fitDecision: "standard",
      },
      product: { kind: "none", displayName: null },
      executable: false,
    }),
  ])
  const html = renderToStaticMarkup(
    <RoutinePage view={proposalView(routine)} onEdit={() => undefined} />,
  )

  assert.match(html, /Empfohlen, aber nicht eingeplant/)
  assert.match(html, /Noch in Prüfung/)
  assert.match(html, /Nicht empfohlen · von dir eingeplant/)
  assert.match(html, /Offen/)
  assert.match(html, /Für diesen Basis-Baustein fehlt noch ein Produkt/)
  assert.doesNotMatch(html, /Analyse läuft/)
  assert.doesNotMatch(html, /Optional offen/)
  assert.doesNotMatch(html, /Bewusste Wahl/)
  assert.match(html, />Anpassen</)
  assert.doesNotMatch(html, />Bearbeiten</)
  assert.match(
    html,
    /aria-label="Zweck: Regelmäßige Reinigung; Produkt: Sanftes Shampoo; Kategorie: Shampoo; Status: Aktiv; Rhythmus: Täglich"/,
  )
})

function deferredItem(overrides: Record<string, unknown> = {}) {
  return item({
    state: {
      systemAssessment: "basis",
      inclusion: "excluded",
      availability: "none",
      fitDecision: "standard",
    },
    product: { kind: "none", displayName: null },
    executable: false,
    ...overrides,
  })
}

test("renders a quiet, reason-specific placeholder step per deferral reason (Task 2.2)", () => {
  const routine = payload([
    deferredItem({
      itemKey: "deferred-refinement",
      category: "shampoo",
      role: "shampoo_dandruff",
      purposeKey: "shampoo_dandruff",
      sourceDecisionKeys: ["decision-refinement"],
    }),
    deferredItem({
      itemKey: "deferred-no-product",
      category: "oil",
      role: "pre_wash_fibre_treatment",
      purposeKey: "pre_wash_fibre_treatment",
      sourceDecisionKeys: ["decision-no-product"],
    }),
    deferredItem({
      itemKey: "deferred-preview",
      category: "mask",
      role: "intensive_conditioning_mask",
      purposeKey: "intensive_conditioning_mask",
      sourceDecisionKeys: ["decision-preview"],
    }),
  ])
  const presentation: PortfolioPresentation = {
    schemaVersion: 1,
    plannedPurchaseDecisionKeys: [],
    retainedOwnedProducts: [],
    deferredRoleReasons: {
      "decision-refinement": "refinement_required",
      "decision-no-product": "no_product",
      "decision-preview": "preview_unavailable",
    },
  }

  const html = renderToStaticMarkup(
    <RoutinePage view={proposalView(routine)} portfolioPresentation={presentation} />,
  )

  assert.match(html, /Empfehlung folgt — 2 Min\. im Feinschliff\./)
  assert.match(html, /Für diese Kategorie haben wir noch kein passendes Produkt\./)
  assert.match(html, /Empfehlung wird geprüft\./)
  assert.equal((html.match(/href="\/plan-start\?refine=products"/g) ?? []).length, 1)
  assert.match(html, /aria-label="Kategorie: Shampoo"/)
  assert.match(html, /aria-label="Kategorie: Öl"/)
  assert.match(html, /aria-label="Kategorie: Maske"/)
  // Quiet: no alarm styling, no claim the plan is unusable, no stale generic label.
  assert.doesNotMatch(html, /Für diesen Basis-Baustein fehlt noch ein Produkt/)
  assert.doesNotMatch(html, /Basis-Lücke/)
  assert.doesNotMatch(html, /Empfohlen, aber nicht eingeplant/)
})

test("an excluded item with no matching server deferral reason keeps the generic excluded copy", () => {
  const routine = payload([
    deferredItem({ itemKey: "excluded-no-reason", sourceDecisionKeys: ["decision-unmatched"] }),
  ])
  const presentation: PortfolioPresentation = {
    schemaVersion: 1,
    plannedPurchaseDecisionKeys: [],
    retainedOwnedProducts: [],
    // Present, but keyed for an unrelated decision — must not false-positive match.
    deferredRoleReasons: { "decision-other": "no_product" },
  }

  const html = renderToStaticMarkup(
    <RoutinePage view={proposalView(routine)} portfolioPresentation={presentation} />,
  )

  assert.match(html, /Empfohlen, aber nicht eingeplant/)
  assert.doesNotMatch(html, /Empfehlung folgt/)
  assert.doesNotMatch(html, /kein passendes Produkt/)
  assert.doesNotMatch(html, /Empfehlung wird geprüft/)
})

test("a role a later recompute resolved is no longer excluded, so its placeholder disappears with no extra clearing logic", () => {
  const routine = payload([
    item({
      itemKey: "resolved",
      sourceDecisionKeys: ["decision-refinement"],
      state: {
        systemAssessment: "basis",
        inclusion: "included",
        availability: "owned",
        fitDecision: "standard",
      },
      product: { kind: "owned", displayName: "Jetzt empfohlenes Shampoo" },
    }),
  ])
  // A stale portfolio-presentation read can still carry the old deferral
  // entry for this decision key (e.g. a race with the recompute); the Routine
  // item itself is the source of truth for whether the role is still deferred.
  const presentation: PortfolioPresentation = {
    schemaVersion: 1,
    plannedPurchaseDecisionKeys: [],
    retainedOwnedProducts: [],
    deferredRoleReasons: { "decision-refinement": "refinement_required" },
  }

  const html = renderToStaticMarkup(
    <RoutinePage view={proposalView(routine)} portfolioPresentation={presentation} />,
  )

  assert.doesNotMatch(html, /Empfehlung folgt/)
  assert.match(html, /Jetzt empfohlenes Shampoo/)
  assert.match(html, />Aktiv</)
})

test("the all-deferred shape (zero-recommendation accept) renders only placeholders", () => {
  const routine = payload([
    deferredItem({
      itemKey: "deferred-shampoo",
      category: "shampoo",
      role: "shampoo_everyday",
      sourceDecisionKeys: ["decision-shampoo"],
    }),
    deferredItem({
      itemKey: "deferred-conditioner",
      category: "conditioner",
      role: "conditioner_rinse_out",
      sourceDecisionKeys: ["decision-conditioner"],
    }),
  ])
  const activeView: PersonalPlanRoutineView = {
    status: "active",
    personalPlanId: "plan-1",
    planRevision: 1,
    sourceRevision: 1,
    activeVersion: { id: routine.versionId, payload: routine },
    pendingProposal: null,
  }
  const presentation: PortfolioPresentation = {
    schemaVersion: 1,
    plannedPurchaseDecisionKeys: [],
    retainedOwnedProducts: [],
    deferredRoleReasons: {
      "decision-shampoo": "refinement_required",
      "decision-conditioner": "refinement_required",
    },
  }

  const html = renderToStaticMarkup(
    <RoutinePage view={activeView} portfolioPresentation={presentation} />,
  )

  assert.match(html, /Deine Routine/)
  // 2.8: the zero-recommendation cohort gets the honest subtitle, never a
  // readiness claim over a page of placeholders.
  assert.match(html, /Noch ohne konkrete Produkte\./)
  assert.doesNotMatch(html, /Deine Routine ist bereit/)
  assert.equal((html.match(/<a[^>]*href="\/plan-start\?refine=products"[^>]*>/g) ?? []).length, 2)
  assert.doesNotMatch(html, /Mindestens ein Basis-Baustein fehlt noch/)
  // No Anwendung CTA to dead-end any more (26.08.2026): the page never offers
  // one, the Bottom-Nav tab does.
  assert.doesNotMatch(html, /href="\/anwendung"/)
})

test("translates structured Personal Plan cadence without exposing internal keys", () => {
  const routine = payload([
    item({
      itemKey: "mask",
      assignmentKey: "mask",
      category: "mask",
      role: "intensive_conditioning_mask",
      purposeKey: "intensive_conditioning_mask",
      product: { kind: "owned", displayName: "Pflegemaske" },
      cadence: {
        recommended: {
          kind: "mask_regular_interval",
          role: "intensive_conditioning_mask",
          needStrength: "standard",
          baseInterval: "biweekly_1x",
          placementState: "placed_on_eligible_wash",
        },
        userOverride: null,
        displayKey: "personal_plan.cadence.mask_regular_interval",
      },
    }),
    item({
      itemKey: "oil-pre-wash",
      assignmentKey: "oil-pre-wash",
      category: "oil",
      role: "pre_wash_fibre_treatment",
      purposeKey: "pre_wash_fibre_treatment",
      product: { kind: "owned", displayName: "Arganöl" },
      cadence: {
        recommended: {
          kind: "role_based_wash_linked",
          roleFrequencies: [
            {
              role: "pre_wash_fibre_treatment",
              tier: "basis",
              cadence: "before_every_compatible_wash",
            },
          ],
        },
        userOverride: null,
        displayKey: "personal_plan.cadence.role_based_wash_linked",
      },
    }),
  ])

  const html = renderToStaticMarkup(<RoutinePage view={proposalView(routine)} />)

  assert.match(html, /Etwa alle 2 Wochen · Nach Shampoo/)
  assert.match(html, /Vor jeder Haarwäsche · Vor der Haarwäsche/)
  assert.doesNotMatch(html, /personal_plan\.cadence\.mask_regular_interval/)
  assert.doesNotMatch(html, /personal_plan\.cadence\.role_based_wash_linked/)
})

test("presents every structured cadence kind and keeps a user override authoritative", () => {
  const cadenceCases = [
    {
      role: "shampoo_everyday",
      recommended: { kind: "wet_wash_total", target: "weekly_2x" },
      expected: "2× pro Woche",
    },
    {
      role: "conditioner_rinse_out",
      recommended: { kind: "after_each_eligible_wash" },
      expected: "Nach jeder Haarwäsche",
    },
    {
      role: "pre_heat_protection",
      recommended: { kind: "event_based" },
      expected: "Vor jeder passenden Hitze-Anwendung",
    },
    {
      role: "residue_reset",
      recommended: { kind: "every_nth_wash", every: 4 },
      expected: "Bei jeder vierten Haarwäsche",
    },
    {
      role: "scalp_comfort",
      recommended: { kind: "unscheduled_as_needed" },
      expected: "Bei Bedarf",
    },
    {
      role: "intensive_conditioning_mask",
      recommended: { kind: "mask_regular_interval", baseInterval: "every_3_weeks" },
      expected: "Etwa alle 3 Wochen",
    },
    {
      role: "dry_finish",
      recommended: {
        kind: "role_based_wash_linked",
        roleFrequencies: [{ role: "dry_finish", cadence: "finish_after_every_compatible_wash" }],
      },
      expected: "Als Finish nach jeder Haarwäsche",
    },
    {
      role: "specialized_bond_treatment",
      recommended: { kind: "product_protocol_course" },
      expected: "Nach Herstellerangabe",
    },
    {
      role: "scalp_exfoliant",
      recommended: {
        kind: "role_keyed_product_protocol",
        roleFrequencies: [{ role: "scalp_exfoliant", cadence: "occasional_according_to_product" }],
      },
      expected: "Gelegentlich nach Herstellerangabe",
    },
  ]

  for (const cadenceCase of cadenceCases) {
    const routineItem = item({
      role: cadenceCase.role,
      cadence: {
        recommended: cadenceCase.recommended,
        userOverride: null,
        displayKey: `personal_plan.cadence.${cadenceCase.recommended.kind}`,
      },
    }) as unknown as RoutinePayloadV1["items"][number]
    assert.equal(routineCadenceLabel(routineItem), cadenceCase.expected)
  }

  const overridden = item({
    cadence: {
      recommended: { kind: "mask_regular_interval", baseInterval: "every_3_weeks" },
      userOverride: "daily_1x",
      displayKey: "personal_plan.cadence.mask_regular_interval",
    },
  }) as unknown as RoutinePayloadV1["items"][number]
  assert.equal(routineCadenceLabel(overridden), "Täglich")
})

function activeViewFor(routine: RoutinePayloadV1): PersonalPlanRoutineView {
  return {
    ...proposalView(routine),
    status: "active",
    activeVersion: { id: routine.versionId, payload: routine },
    pendingProposal: null,
  }
}

test("fresh state (products open, 2 von 4): banner renders above the routine blocks", () => {
  const routine = payload([item()])
  const view = activeViewFor(routine)
  let dismissed = 0
  let refined = 0
  const html = renderToStaticMarkup(
    <RoutinePage
      view={view}
      refinementBanner={{ module: "products", completedSteps: 2, totalSteps: 4 }}
      onDismissRefinementBanner={() => {
        dismissed += 1
      }}
      onRefineFromBanner={() => {
        refined += 1
      }}
    />,
  )

  assert.match(html, /Mach deinen Plan genauer\./)
  assert.match(html, />2 von 4</)
  assert.match(html, /Weiter · 2 Min\./)
  assert.ok(html.indexOf("Mach deinen Plan genauer.") < html.indexOf("Deine Basis"))

  const tree = RoutinePage({
    view,
    refinementBanner: { module: "products", completedSteps: 2, totalSteps: 4 },
    onDismissRefinementBanner: () => {
      dismissed += 1
    },
    onRefineFromBanner: () => {
      refined += 1
    },
  })
  const dismissButton = findElement(
    tree,
    (element) => element.props["aria-label"] === "Hinweis schließen",
  )
  assert.ok(dismissButton)
  ;(dismissButton.props.onClick as () => void)()
  assert.equal(dismissed, 1)

  const refineButton = findElement(
    tree,
    (element) =>
      element.type === "button" &&
      Boolean(element.props.children) &&
      JSON.stringify(element.props.children).includes("Weiter"),
  )
  assert.ok(refineButton, "expected the banner CTA button to render")
  ;(refineButton.props.onClick as () => void)()
  assert.equal(refined, 1)
})

test("post-module-1 state (habits open, 3 von 4): banner renders above the routine blocks too", () => {
  const routine = payload([item()])
  const view = activeViewFor(routine)
  const html = renderToStaticMarkup(
    <RoutinePage
      view={view}
      refinementBanner={{ module: "habits", completedSteps: 3, totalSteps: 4 }}
      onDismissRefinementBanner={() => undefined}
      onRefineFromBanner={() => undefined}
    />,
  )

  assert.match(html, /Noch ein Schritt: deine Gewohnheiten\./)
  assert.match(html, />3 von 4</)
  assert.match(html, /Weiter · 3 Min\./)
  // Field test 26.08.2026: below the blocks the second ask scrolled out of
  // view and was never seen, so both modules share the products slot.
  assert.ok(html.indexOf("Noch ein Schritt") < html.indexOf("Deine Basis"))
})

test("dismissed state: refinementBanner absent renders no banner", () => {
  const routine = payload([item()])
  const view = activeViewFor(routine)
  const html = renderToStaticMarkup(<RoutinePage view={view} refinementBanner={null} />)

  assert.doesNotMatch(html, /Mach deinen Plan genauer\./)
  assert.doesNotMatch(html, /Noch ein Schritt: deine Gewohnheiten\./)
  assert.doesNotMatch(html, /Hinweis schließen/)
})

test("all-done state: no refinementBanner prop at all renders no banner", () => {
  const routine = payload([item()])
  const view = activeViewFor(routine)
  const html = renderToStaticMarkup(<RoutinePage view={view} />)

  assert.doesNotMatch(html, /Hinweis schließen/)
  assert.doesNotMatch(html, /von 4/)
})

test("Task 2.6: the plan-updated toast renders with the exact signed-off copy above the routine blocks", () => {
  const routine = payload([item()])
  const view = activeViewFor(routine)
  const html = renderToStaticMarkup(
    <RoutinePage view={view} showPlanUpdatedToast onDismissPlanUpdatedToast={() => undefined} />,
  )

  assert.match(html, /role="status"/)
  assert.match(html, /Plan aktualisiert/)
  assert.ok(html.indexOf("Plan aktualisiert") < html.indexOf("Deine Basis"))
})

test("Task 2.6: the plan-updated toast is absent without the signal", () => {
  const routine = payload([item()])
  const view = activeViewFor(routine)
  const withoutFlag = renderToStaticMarkup(<RoutinePage view={view} />)
  const withFlagFalse = renderToStaticMarkup(
    <RoutinePage
      view={view}
      showPlanUpdatedToast={false}
      onDismissPlanUpdatedToast={() => undefined}
    />,
  )
  // Without a dismiss handler the toast must not render even if the flag is
  // (incorrectly) set — there would be no way to ever clear it.
  const withoutHandler = renderToStaticMarkup(<RoutinePage view={view} showPlanUpdatedToast />)

  for (const html of [withoutFlag, withFlagFalse, withoutHandler]) {
    assert.doesNotMatch(html, /Plan aktualisiert/)
  }
})

test("Task 2.6: the plan-updated toast and the refinement banner can render on the same visit", () => {
  const routine = payload([item()])
  const view = activeViewFor(routine)
  const html = renderToStaticMarkup(
    <RoutinePage
      view={view}
      showPlanUpdatedToast
      onDismissPlanUpdatedToast={() => undefined}
      refinementBanner={{ module: "habits", completedSteps: 3, totalSteps: 4 }}
      onDismissRefinementBanner={() => undefined}
      onRefineFromBanner={() => undefined}
    />,
  )

  assert.match(html, /Plan aktualisiert/)
  assert.match(html, /Noch ein Schritt: deine Gewohnheiten\./)
  // Toast at the very top, banner further down (mockup screen 3): the two
  // never fight for the same slot.
  assert.ok(html.indexOf("Plan aktualisiert") < html.indexOf("Noch ein Schritt"))
})
