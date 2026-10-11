import assert from "node:assert/strict"
import test from "node:test"

import { dryShampooTintFit } from "../../../src/lib/personal-plan/products/authority/categories/dry-shampoo"
import type {
  Stage3AuthorityInput,
  Stage3KnownAuthorityEvaluation,
} from "../../../src/lib/personal-plan/products/authority/contracts"
import { evaluateStage3Authority } from "../../../src/lib/personal-plan/products/authority/evaluate"
import { buildStage3SelectionProfile } from "../../../src/lib/personal-plan/products/authority/selection-profile"
import { allocateBudgetPortfolio } from "../../../src/lib/personal-plan/products/budget-policy"
import { compactCriterionSchema } from "../../../src/lib/personal-plan/products/fit-comparison-schema"
import { rankStage3ComparisonCandidates } from "../../../src/lib/personal-plan/products/fit-comparison"
import { buildScanVerdict } from "../../../src/lib/scan/resolve-verdict"
import {
  DEEP,
  DEEP_CATALOG,
  DRY,
  DRY_CATALOG,
  NEQI_ROSEMARY,
  SCALP,
  SCALP_CATALOG,
  deepCatalogWithExpectedTargets,
  s2Input,
} from "./fixtures/s2-catalog-2026-10-09"

function known(input: Stage3AuthorityInput): Stage3KnownAuthorityEvaluation {
  const evaluation = evaluateStage3Authority(input)
  assert.equal(evaluation.status, "known")
  return evaluation as Stage3KnownAuthorityEvaluation
}

function pick(input: Stage3AuthorityInput): string | null {
  return known(input).recommendation?.productId ?? null
}

/** The detached verdict of every candidate, as fit comparison, previews and scan compute it. */
function verdicts(input: Stage3AuthorityInput): Map<string, string> {
  return new Map(
    input.recommendationCandidates.map((candidate) => {
      const evaluation = evaluateStage3Authority({
        ...input,
        capturedProductId: null,
        subjectIdentity: {
          kind: "catalog_product",
          productId: candidate.productId,
          displayName: candidate.displayName,
          category: candidate.category,
        },
        productFacts: candidate as never,
        recommendationCandidates: [],
      })
      return [candidate.productId, evaluation.status === "known" ? evaluation.verdict : "unknown"]
    }),
  )
}

function idealIds(input: Stage3AuthorityInput): string[] {
  return [...verdicts(input)].filter(([, verdict]) => verdict === "ideal").map(([id]) => id)
}

function cappedDefault(input: Stage3AuthorityInput, limitEur: 5 | 15): string | null {
  const ranked = rankStage3ComparisonCandidates(input, undefined, "native")
  const result = allocateBudgetPortfolio({
    budget: { kind: "capped", limitEur, allowExceptions: false },
    roles: [
      {
        roleKey: input.subjectKey,
        ranked: ranked.map((candidate) => ({
          productId: candidate.productId,
          priceEur: candidate.priceEur,
          verdict: candidate.verdict,
          cautionCount: candidate.cautionCount,
          needDistances: {},
        })),
        required: false,
        ownedKept: false,
        preserved: null,
      },
    ],
    mainConcernDimensions: new Set(),
    displayLimit: 3,
  })
  return result.roles[0]?.defaultProductId ?? null
}

const dryInput = (
  selectionProfile: Parameters<typeof s2Input>[0]["selectionProfile"] = {},
  productFacts: (typeof DRY_CATALOG)[number] | null = null,
) =>
  s2Input({
    category: "dry_shampoo",
    role: "root_refresh_bridge",
    candidates: DRY_CATALOG,
    selectionProfile,
    productFacts,
  })

/* ------------------------------------------------------------- dry shampoo */

test("D1 dry shampoo: normal scalp, no direction, colour unknown → Batiste Original; tints supportive", () => {
  const input = dryInput({ scalpOiliness: "oily" })
  assert.equal(pick(input), DRY.batisteOriginal.productId)
  assert.deepEqual(idealIds(input), [
    DRY.batisteOriginal.productId,
    DRY.isanaJedesHaar.productId,
    DRY.baleaSensitive.productId,
    DRY.batisteSensible.productId,
    DRY.baleaSchaum.productId,
    DRY.got2bLiquid.productId,
    DRY.got2bVolumen.productId,
  ])
  const all = verdicts(input)
  for (const tinted of [DRY.batisteBlond, DRY.batisteBruenett, DRY.batisteDunkel]) {
    assert.equal(all.get(tinted.productId), "supportive")
  }
  assert.equal(known(input).recommendation?.authorityRuleId, "dry_shampoo.selection.shared_rank")
})

test("D2 dry shampoo: sensitive scalp, brown → Balea Kopfhaut Sensitive; normal_only supportive", () => {
  const input = dryInput({ sensitiveScalp: true, visibleHairColor: "brown" })
  assert.equal(pick(input), DRY.baleaSensitive.productId)
  assert.deepEqual(idealIds(input), [
    DRY.baleaSensitive.productId,
    DRY.batisteSensible.productId,
    DRY.baleaSchaum.productId,
  ])
})

test("D3 dry shampoo: volume more, normal scalp, brown → got2b Extra Volumen only ideal", () => {
  const input = dryInput({ volumeDirection: "more", visibleHairColor: "brown" })
  assert.equal(pick(input), DRY.got2bVolumen.productId)
  assert.deepEqual(idealIds(input), [DRY.got2bVolumen.productId])
})

test("D4 dry shampoo: volume more + sensitive → nobody ideal; catalogue order → Balea Kopfhaut Sensitive", () => {
  const input = dryInput({ volumeDirection: "more", sensitiveScalp: true })
  assert.deepEqual(idealIds(input), [])
  assert.equal(pick(input), DRY.baleaSensitive.productId)
  assert.equal(known(input).verdict, "unknown")
})

test("D5 dry shampoo (Q1 = A): brown roots → universal Batiste Original wins; Brünett equal, Blond/dunkel supportive", () => {
  const input = dryInput({ visibleHairColor: "brown" })
  assert.equal(pick(input), DRY.batisteOriginal.productId)
  const all = verdicts(input)
  assert.equal(all.get(DRY.batisteBruenett.productId), "ideal")
  assert.equal(all.get(DRY.batisteBlond.productId), "supportive")
  assert.equal(all.get(DRY.batisteDunkel.productId), "supportive")
})

test("Q1 colour rule lives in one place: universal is a full fit, a matching tint equals it", () => {
  assert.equal(dryShampooTintFit("universal", null), "pass")
  assert.equal(dryShampooTintFit("universal", "dark"), "pass")
  assert.equal(dryShampooTintFit("blonde_light", "light_blonde"), "pass")
  assert.equal(dryShampooTintFit("brown", "brown"), "pass")
  assert.equal(dryShampooTintFit("dark", "dark"), "pass")
  assert.equal(dryShampooTintFit("brown", "light_blonde"), "caution")
  assert.equal(dryShampooTintFit("dark", null), "caution")
})

test("D6 dry shampoo: volume less → Batiste Original; got2b Extra Volumen supportive", () => {
  const input = dryInput({ volumeDirection: "less" })
  assert.equal(pick(input), DRY.batisteOriginal.productId)
  assert.equal(verdicts(input).get(DRY.got2bVolumen.productId), "supportive")
})

test("D7 dry shampoo: owned Batiste Brünett with light-blonde roots → supportive, keep allowed, replacement = D1 winner", () => {
  const input = dryInput({ visibleHairColor: "light_blonde" }, DRY.batisteBruenett)
  const evaluation = known(input)
  assert.equal(evaluation.verdict, "supportive")
  assert.ok(evaluation.allowedActions.includes("keep_owned"))
  const tint = evaluation.criteria.find(
    (criterion) => criterion.criterionId === "dry_shampoo.tint.verified",
  )
  assert.equal(tint?.result, "caution")
  assert.equal(tint?.label, "Farbpassung")
  assert.equal(rankStage3ComparisonCandidates(input)[0]?.productId, DRY.batisteOriginal.productId)
})

test("D8 dry shampoo: D3 + strict Bis 5 € keeps got2b Extra Volumen (3,95 €)", () => {
  const input = dryInput({ volumeDirection: "more", visibleHairColor: "brown" })
  assert.equal(cappedDefault(input, 5), DRY.got2bVolumen.productId)
})

test("dry shampoo: legacy sensitive_refresh counts as standard styling, sensitivity only from the fit", () => {
  const input = dryInput({ volumeDirection: "less", sensitiveScalp: false })
  assert.equal(verdicts(input).get(DRY.baleaSensitive.productId), "ideal")
})

test("dry shampoo: a missing product fact stays unknown, a known reaction is a mismatch", () => {
  const missing = { ...DRY.batisteOriginal, spec: { ...DRY.batisteOriginal.spec, format: null } }
  assert.equal(evaluateStage3Authority(dryInput({}, missing)).status, "unknown")
  const reaction = { ...DRY.batisteOriginal, knownReaction: true }
  assert.equal(known(dryInput({}, reaction)).verdict, "mismatch")
})

test("dry shampoo: the uncovered role keeps its shape (verdict unknown + uncovered caution)", () => {
  const evaluation = known(dryInput({ sensitiveScalp: true }))
  assert.equal(evaluation.verdict, "unknown")
  assert.deepEqual(
    evaluation.criteria.map((criterion) => criterion.criterionId),
    ["dry_shampoo.selection.uncovered_role"],
  )
  assert.deepEqual(evaluation.allowedActions, ["plan_recommendation", "leave_uncovered"])
})

test("dry shampoo compact rows: identity, sensitivity, tint, styling, protocol", () => {
  assert.deepEqual(compactCriterionSchema("dry_shampoo", "root_refresh_bridge"), [
    { criterionId: "dry_shampoo.identity.active", label: "Aktive Produktidentität" },
    { criterionId: "dry_shampoo.sensitivity.verified", label: "Kopfhautverträglichkeit" },
    { criterionId: "dry_shampoo.tint.verified", label: "Farbpassung" },
    { criterionId: "dry_shampoo.styling.direction", label: "Volumen" },
    { criterionId: "dry_shampoo.protocol.verified", label: "Verifizierte Anwendung" },
  ])
})

/* ----------------------------------------------------------- deep cleansing */

const deepInput = (
  scalpOiliness: "oily" | "balanced" | "dry" | null,
  candidates = deepCatalogWithExpectedTargets(),
  productFacts: (typeof DEEP_CATALOG)[number] | null = null,
  role: "residue_reset" | "mineral_reset" = "residue_reset",
) =>
  s2Input({
    category: "deep_cleansing_shampoo",
    role,
    candidates,
    selectionProfile: { scalpOiliness },
    productFacts,
  })

test("C1 deep cleansing: oily scalp → Gliss (engine target oily)", () => {
  assert.equal(pick(deepInput("oily")), DEEP.gliss.productId)
  assert.equal(
    known(deepInput("oily")).recommendation?.authorityRuleId,
    "deep_cleansing.stage3.validated_reset_role",
  )
})

test("C2 deep cleansing: dry scalp → NEQI", () => {
  assert.equal(pick(deepInput("dry")), DEEP.neqi.productId)
})

test("C3 deep cleansing: balanced scalp → no match, catalogue order → NEQI", () => {
  assert.equal(pick(deepInput("balanced")), DEEP.neqi.productId)
})

test("C4 deep cleansing: all targets null (before the backfill) → NEQI for every scalp type (inert)", () => {
  for (const scalp of ["oily", "balanced", "dry", null] as const) {
    assert.equal(pick(deepInput(scalp, DEEP_CATALOG)), DEEP.neqi.productId)
  }
})

test("C5 deep cleansing: oily + strict Bis 5 € → Swiss-O-Par (first affordable in fit order)", () => {
  const input = deepInput("oily")
  assert.equal(
    rankStage3ComparisonCandidates(input, undefined, "native")[0]?.productId,
    DEEP.gliss.productId,
  )
  assert.equal(cappedDefault(input, 5), DEEP.swissOPar.productId)
})

test("C6 deep cleansing: owned ISANA, oily → ideal keep_owned; the scalp row stays unconfirmed", () => {
  const isana = deepCatalogWithExpectedTargets().find(
    (facts) => facts.productId === DEEP.isana.productId,
  )!
  const evaluation = known(deepInput("oily", deepCatalogWithExpectedTargets(), isana))
  assert.equal(evaluation.verdict, "ideal")
  assert.deepEqual(evaluation.allowedActions, ["keep_owned"])
  assert.equal(
    evaluation.criteria.some(
      (criterion) => criterion.criterionId === "deep_cleansing.scalp_target",
    ),
    false,
  )
})

test("deep cleansing: a matching scalp target passes the Kopfhauttyp row", () => {
  const gliss = deepCatalogWithExpectedTargets().find(
    (facts) => facts.productId === DEEP.gliss.productId,
  )!
  const evaluation = known(deepInput("oily", deepCatalogWithExpectedTargets(), gliss))
  const row = evaluation.criteria.find(
    (criterion) => criterion.criterionId === "deep_cleansing.scalp_target",
  )
  assert.equal(row?.result, "pass")
  assert.equal(row?.label, "Kopfhauttyp")
  assert.equal(evaluation.verdict, "ideal")
})

test("deep cleansing: mineral_reset still picks Swiss-O-Par only, no scalp row", () => {
  const input = deepInput("oily", deepCatalogWithExpectedTargets(), null, "mineral_reset")
  assert.equal(pick(input), DEEP.swissOPar.productId)
  assert.deepEqual(
    compactCriterionSchema("deep_cleansing_shampoo", "mineral_reset").map((row) => row.criterionId),
    ["deep_cleansing.reset_role", "deep_cleansing.protocol"],
  )
  assert.deepEqual(compactCriterionSchema("deep_cleansing_shampoo", "residue_reset"), [
    { criterionId: "deep_cleansing.reset_role", label: "Reset-Rolle" },
    { criterionId: "deep_cleansing.protocol", label: "Anwendungsprotokoll" },
    { criterionId: "deep_cleansing.scalp_target", label: "Kopfhauttyp" },
  ])
})

/* --------------------------------------------------------------- scalp care */

const scalpInput = (
  role: "scalp_comfort" | "scalp_exfoliant" | "density_claim_tonic" | "scalp_flake_oil_adjunct",
  candidates = SCALP_CATALOG,
) => s2Input({ category: "scalp_care", role, candidates })

test("scalp care: comfort → Balea Serum Sensitive (catalogue order ties, price decides)", () => {
  assert.equal(pick(scalpInput("scalp_comfort")), SCALP.baleaSerum.productId)
})

test("scalp care: exfoliant → Balea Peeling (2,95 €), no longer Isana by UUID order", () => {
  assert.equal(pick(scalpInput("scalp_exfoliant")), SCALP.baleaPeeling.productId)
})

test("scalp care: flake/oil adjunct → Gliss Klärendes Serum", () => {
  assert.equal(pick(scalpInput("scalp_flake_oil_adjunct")), SCALP.glissSerum.productId)
})

test("scalp care: density → L'Oréal; with the Neqi Rosemary Oil published → Neqi (Q2 = A by price)", () => {
  assert.equal(pick(scalpInput("density_claim_tonic")), SCALP.loreal.productId)
  assert.equal(
    pick(scalpInput("density_claim_tonic", [...SCALP_CATALOG, NEQI_ROSEMARY])),
    NEQI_ROSEMARY.productId,
  )
  // Q2 = B is data only: a curated sort_order keeps L'Oréal first.
  const curated = [
    { ...SCALP.loreal, catalogSortOrder: 1 },
    { ...SCALP.theOrdinary, catalogSortOrder: 2 },
    { ...NEQI_ROSEMARY, catalogSortOrder: 3 },
  ]
  assert.equal(pick(scalpInput("density_claim_tonic", curated)), SCALP.loreal.productId)
})

test("scalp care: null sort orders fall back to price; a null price ranks last", () => {
  const candidates = [
    { ...SCALP.baleaPeeling, catalogSortOrder: null, priceEur: null },
    { ...SCALP.isanaPeeling, catalogSortOrder: null },
  ]
  assert.equal(pick(scalpInput("scalp_exfoliant", candidates)), SCALP.isanaPeeling.productId)
})

test("scalp care: the authority pick equals the comparison ranking head", () => {
  for (const role of ["scalp_comfort", "scalp_exfoliant", "density_claim_tonic"] as const) {
    const input = scalpInput(role)
    assert.equal(rankStage3ComparisonCandidates(input)[0]?.productId, pick(input))
  }
})

/* ------------------------------------------------------- scan criteria counts */

function scanSubtitle(input: Stage3AuthorityInput, scannedId: string): string | null {
  const scanned = input.recommendationCandidates.find(
    (candidate) => candidate.productId === scannedId,
  )!
  const payload = buildScanVerdict({
    category: input.category,
    decision: input.categoryDecision,
    productFacts: scanned,
    recommendationCandidates: input.recommendationCandidates,
    coverage: [],
    hairThickness: "normal",
    selectionProfile: input.selectionProfile,
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
    refinedVersionId: "refined-s2",
    refinedInputHash: "input-s2",
  })
  return payload.kind === "in_catalog" ? payload.subtitle : null
}

test("scan subtitle counts the S2 rows: dry shampoo 5 rows, deep cleansing 3 (residue)", () => {
  const volume = dryInput({ volumeDirection: "more", visibleHairColor: "brown" })
  assert.equal(scanSubtitle(volume, DRY.batisteOriginal.productId), "4 von 5 Kriterien erfüllt")
  assert.equal(scanSubtitle(volume, DRY.got2bVolumen.productId), "5 von 5 Kriterien erfüllt")
  const oily = deepInput("oily")
  assert.equal(scanSubtitle(oily, DEEP.gliss.productId), "3 von 3 Kriterien erfüllt")
  // R4: an ideal general deep cleanser reads „2 von 3" (honest: the scalp row is unconfirmed).
  assert.equal(scanSubtitle(oily, DEEP.isana.productId), "2 von 3 Kriterien erfüllt")
})

/* F1 (Codex review): winners from partial persisted profiles */

test("partial profile winners: missing texture + volume goal keeps Batiste Original; a lone low-volume concern → got2b", () => {
  const fromProfile = (profile: Record<string, unknown>) =>
    s2Input({
      category: "dry_shampoo",
      role: "root_refresh_bridge",
      candidates: DRY_CATALOG,
      selectionProfile: buildStage3SelectionProfile({ profile } as never, null),
    })
  assert.equal(
    pick(fromProfile({ hair: { thickness: "fine" }, goals: ["volume_balance"], concerns: [] })),
    DRY.batisteOriginal.productId,
  )
  assert.equal(
    pick(fromProfile({ concerns: ["low_volume_or_weighed_down"] })),
    DRY.got2bVolumen.productId,
  )
})
