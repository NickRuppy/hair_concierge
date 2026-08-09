import assert from "node:assert/strict"
import test from "node:test"

import { renderToStaticMarkup } from "react-dom/server"

import { RoutinePage } from "../src/components/routine/personal-plan"
import type {
  PersonalPlanRoutineView,
  RoutinePayloadV1,
} from "../src/lib/personal-plan/routine/contracts"

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

test("renders Basis before Optional and preserves adjacent cards for the same category", () => {
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
        product: { kind: "planned", displayName: "Pflegemaske" },
      }),
    ],
    [
      { key: "basis", itemKeys: ["shampoo-cleanse", "shampoo-treatment"] },
      { key: "optional", itemKeys: ["mask"] },
    ],
  )
  const html = renderToStaticMarkup(<RoutinePage view={proposalView(routine)} />)

  assert.ok(html.indexOf("Deine Basis") < html.indexOf("Optional"))
  assert.equal((html.match(/Zweck: Regelmäßige Reinigung; Kategorie: Shampoo/g) ?? []).length, 1)
  assert.equal((html.match(/Zweck: Schuppenpflege; Kategorie: Shampoo/g) ?? []).length, 1)
  assert.ok(html.indexOf("Sanftes Shampoo") < html.indexOf("Kopfhautserum"))
  assert.match(html, /Geplant/)
})

test("uses proposal copy initially, and exposes Anwendung only when the Stage 5 frontier is reachable", () => {
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

  assert.match(
    renderToStaticMarkup(<RoutinePage view={proposalView(candidate)} />),
    /Deine Routine steht/,
  )
  const html = renderToStaticMarkup(
    <RoutinePage view={activeWithPending} stage5Reachable={false} />,
  )
  assert.match(html, /Deine Routine/)
  assert.doesNotMatch(html, /Deine Routine steht/)
  assert.match(html, /Aktives Shampoo/)
  assert.doesNotMatch(html, /Neues Shampoo/)
  assert.doesNotMatch(html, /Anwendungsplan ansehen/)
  const stage5Html = renderToStaticMarkup(<RoutinePage view={activeWithPending} stage5Reachable />)
  assert.match(stage5Html, /href="\/anwendung"/)
  assert.match(stage5Html, /Anwendungsplan ansehen/)
  assert.doesNotMatch(
    renderToStaticMarkup(<RoutinePage view={proposalView(candidate)} />),
    /Anwendungsplan ansehen/,
  )
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
  assert.match(html, /Noch nicht abgedeckt/)
  assert.match(html, /Routine bearbeiten/)
  assert.doesNotMatch(html, />Bearbeiten</)
  assert.match(
    html,
    /aria-label="Zweck: Regelmäßige Reinigung; Kategorie: Shampoo; Produkt: Sanftes Shampoo; Status: Aktiv; Rhythmus: Täglich"/,
  )
})
