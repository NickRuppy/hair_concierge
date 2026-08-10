import assert from "node:assert/strict"
import test from "node:test"

import { renderToStaticMarkup } from "react-dom/server"

import { RoutinePage } from "../src/components/routine/personal-plan"
import { routineCadenceLabel } from "../src/components/routine/personal-plan/routine-item-card"
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

  assert.match(html, /Rhythmus: Etwa alle 2 Wochen/)
  assert.match(html, /Rhythmus: Vor jeder passenden Haarwäsche/)
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
      expected: "Nach jeder passenden Haarwäsche",
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
      expected: "Als Finish nach jeder passenden Haarwäsche",
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
