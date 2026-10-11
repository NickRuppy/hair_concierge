import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "../../../src/lib/personal-plan/compute-stage1"
import { buildDirectAcceptanceIntents } from "../../../src/lib/personal-plan/direct-acceptance/accept"
import { computeStage1ProductExamplePreviews } from "../../../src/lib/personal-plan/product-previews"
import type {
  Stage3AuthorityInput,
  Stage3CategoryProductFacts,
} from "../../../src/lib/personal-plan/products/authority/contracts"
import { evaluateStage3Authority } from "../../../src/lib/personal-plan/products/authority/evaluate"
import {
  buildStage3SelectionProfile,
  type Stage3VisibleHairColor,
} from "../../../src/lib/personal-plan/products/authority/selection-profile"
import { stage3DecisionKey } from "../../../src/lib/personal-plan/products/contracts"
import { rankStage3ComparisonCandidates } from "../../../src/lib/personal-plan/products/fit-comparison"
import { buildScanVerdict } from "../../../src/lib/scan/resolve-verdict"
import type {
  InitialNeedPlanSnapshot,
  PlanProductRole,
  PlanProfile,
} from "../../../src/lib/personal-plan/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"
import {
  DEEP,
  DRY,
  DRY_CATALOG,
  SCALP,
  SCALP_CATALOG,
  deepCatalogWithExpectedTargets,
  s2Input,
} from "./fixtures/s2-catalog-2026-10-09"

/**
 * T2.7: one rule everywhere. For each S2 profile example the plan authority, the comparison
 * ranking, the Stage-1 preview, the scan verdict and the direct-acceptance seen-state agree.
 */

function baseSnapshot(): InitialNeedPlanSnapshot {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-10-11T10:00:00.000Z",
  })
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  return result.snapshot
}

type Example = {
  name: string
  category: "dry_shampoo" | "deep_cleansing_shampoo" | "scalp_care"
  role: PlanProductRole
  profile: (profile: PlanProfile) => PlanProfile
  color: Stage3VisibleHairColor | null
  candidates: Stage3CategoryProductFacts[]
  winner: string
  /** A catalogue product that is not the winner, scanned on the web. */
  scanned: string
}

const examples: Example[] = [
  {
    name: "D2 sensitive scalp, brown",
    category: "dry_shampoo",
    role: "root_refresh_bridge",
    profile: (p) => ({
      ...p,
      scalp: { ...p.scalp, concerns: ["irritated"] },
      goals: [],
      concerns: [],
    }),
    color: "brown",
    candidates: DRY_CATALOG,
    winner: DRY.baleaSensitive.productId,
    scanned: DRY.batisteOriginal.productId,
  },
  {
    name: "D3 volume more (straight, fine), brown",
    category: "dry_shampoo",
    role: "root_refresh_bridge",
    profile: (p) => ({
      ...p,
      hair: { ...p.hair, texture: "straight", thickness: "fine" },
      scalp: { ...p.scalp, concerns: [] },
      goals: ["volume_balance"],
      concerns: [],
    }),
    color: "brown",
    candidates: DRY_CATALOG,
    winner: DRY.got2bVolumen.productId,
    scanned: DRY.batisteOriginal.productId,
  },
  {
    name: "D5 brown, normal scalp, no direction",
    category: "dry_shampoo",
    role: "root_refresh_bridge",
    profile: (p) => ({ ...p, scalp: { ...p.scalp, concerns: [] }, goals: [], concerns: [] }),
    color: "brown",
    candidates: DRY_CATALOG,
    winner: DRY.batisteOriginal.productId,
    scanned: DRY.batisteBlond.productId,
  },
  {
    name: "C1 oily scalp",
    category: "deep_cleansing_shampoo",
    role: "residue_reset",
    profile: (p) => ({ ...p, scalp: { ...p.scalp, oiliness: "oily" } }),
    color: null,
    candidates: deepCatalogWithExpectedTargets(),
    winner: DEEP.gliss.productId,
    scanned: DEEP.isana.productId,
  },
  {
    name: "C3 balanced scalp",
    category: "deep_cleansing_shampoo",
    role: "residue_reset",
    profile: (p) => ({ ...p, scalp: { ...p.scalp, oiliness: "balanced" } }),
    color: null,
    candidates: deepCatalogWithExpectedTargets(),
    winner: DEEP.neqi.productId,
    scanned: DEEP.balea.productId,
  },
  {
    name: "scalp exfoliant",
    category: "scalp_care",
    role: "scalp_exfoliant",
    profile: (p) => p,
    color: null,
    candidates: SCALP_CATALOG,
    winner: SCALP.baleaPeeling.productId,
    scanned: SCALP.isanaPeeling.productId,
  },
]

function withImages(candidates: Stage3CategoryProductFacts[]): Stage3CategoryProductFacts[] {
  return candidates.map((candidate) => ({
    ...candidate,
    presentationImageUrl: `https://example.com/${candidate.productId}.webp`,
  }))
}

function setup(example: Example) {
  const base = baseSnapshot()
  const authorityInput = s2Input({
    category: example.category,
    role: example.role,
    candidates: withImages(example.candidates) as never,
  }) as Stage3AuthorityInput
  const snapshot: InitialNeedPlanSnapshot = {
    ...base,
    profile: example.profile(base.profile),
    decisions: [authorityInput.categoryDecision],
    renderedOrder: [example.category],
    coverage: [],
  }
  const selectionProfile = buildStage3SelectionProfile(snapshot, example.color)
  return {
    snapshot,
    input: {
      ...authorityInput,
      subjectKey: stage3DecisionKey(example.category, example.role, null),
      selectionProfile,
    } as Stage3AuthorityInput,
  }
}

for (const example of examples) {
  test(`${example.name}: plan, comparison, preview, scan and acceptance agree on the winner`, async () => {
    const { snapshot, input } = setup(example)

    // (a) the authority pick (Stage 3 plan)
    const evaluation = evaluateStage3Authority(input)
    assert.equal(evaluation.status, "known")
    if (evaluation.status !== "known") return
    assert.equal(evaluation.recommendation?.productId, example.winner)

    // (b) the comparison ranking head
    assert.equal(rankStage3ComparisonCandidates(input)[0]?.productId, example.winner)

    // (c) the Stage-1 preview (fake loader) with the same root colour
    const previews = await computeStage1ProductExamplePreviews({
      personalPlanId: "plan-s2",
      sourceNeedVersionId: "need-s2",
      snapshot,
      loadCandidates: async () => input.recommendationCandidates,
      visibleHairColor: example.color,
    })
    const preview = previews.previews[0]
    assert.equal(preview?.kind, "recommendation")
    if (preview?.kind !== "recommendation") return
    assert.equal(preview.productId, example.winner)

    // (d) the web scan of a non-winner offers the winner first
    const scanned = input.recommendationCandidates.find(
      (candidate) => candidate.productId === example.scanned,
    )!
    const verdict = buildScanVerdict({
      category: example.category,
      decision: input.categoryDecision,
      productFacts: scanned,
      recommendationCandidates: input.recommendationCandidates,
      coverage: [],
      hairThickness: "normal",
      selectionProfile: buildStage3SelectionProfile(snapshot, example.color),
      heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
      refinedVersionId: "refined-s2",
      refinedInputHash: snapshot.inputHash,
    })
    assert.equal(verdict.kind, "in_catalog")
    if (verdict.kind !== "in_catalog") return
    assert.equal(verdict.alternatives[0]?.productId, example.winner)

    // (e) direct acceptance: the gateway evaluation (same slice builder, same colour loader)
    // accepts the previewed product without `seen_state_stale`.
    const intents = buildDirectAcceptanceIntents(
      [evaluation],
      [
        {
          decisionKey: preview.decisionKey,
          productId: preview.productId,
          factFingerprint: preview.factFingerprint,
        },
      ],
      new Set([preview.decisionKey]),
    )
    assert.deepEqual(
      intents.map((intent) => intent.action),
      ["plan_recommendation"],
    )
  })
}

test("a root colour that differs between preview and acceptance would change a tinted verdict (parity guard)", () => {
  const example = examples[2]!
  const { snapshot, input } = setup(example)
  const bruenett = input.recommendationCandidates.find(
    (candidate) => candidate.productId === DRY.batisteBruenett.productId,
  )!
  const verdictFor = (color: Stage3VisibleHairColor | null) => {
    const evaluation = evaluateStage3Authority({
      ...input,
      selectionProfile: buildStage3SelectionProfile(snapshot, color),
      capturedProductId: null,
      subjectIdentity: {
        kind: "catalog_product",
        productId: bruenett.productId,
        displayName: bruenett.displayName,
        category: "dry_shampoo",
      },
      productFacts: bruenett as never,
      recommendationCandidates: [],
    })
    return evaluation.status === "known" ? evaluation.verdict : evaluation.status
  }
  assert.equal(verdictFor("brown"), "ideal")
  assert.equal(verdictFor(null), "supportive")
})
