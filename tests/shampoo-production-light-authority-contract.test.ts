import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import { evaluateStage3Authority } from "../src/lib/personal-plan/products/authority/evaluate"
import type { Stage3AuthorityInput } from "../src/lib/personal-plan/products/authority/contracts"
import { validateProductIntakeCategorySpecs } from "../src/lib/product-intake/category-validators"
import {
  projectShampooProductionLight,
  SHAMPOO_PRODUCTION_LIGHT_RESEARCH_METHOD,
  type ShampooProductionLightInput,
} from "../src/lib/shampoo/production-light-adapter"

const property = <T extends string>(value: T) => ({
  value,
  confidence: "high" as const,
  rationale: `Reviewed whole-formula evidence supports ${value}.`,
  evidenceRefs: ["formula:canonical", "positioning:manufacturer"],
})

function researchInput(target: "ordinary" | "sensitive"): ShampooProductionLightInput {
  const canonicalInci = "Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine"
  return {
    version: "shampoo-production-light-v1",
    researchMethod: { ...SHAMPOO_PRODUCTION_LIGHT_RESEARCH_METHOD },
    identity: {
      productId: `authority-${target}`,
      market: "DE",
      exactProductName: `Authority ${target} Shampoo`,
      exactPackSize: "250 ml",
      gtinAliases: ["4006381333931"],
      capturedAt: "2026-09-02T10:00:00.000Z",
      confidence: "high",
      conflictStatus: "none",
      sources: [
        {
          url: `https://manufacturer.example/${target}`,
          tier: "manufacturer_de",
          capturedAt: "2026-09-02T10:00:00.000Z",
        },
      ],
    },
    formula: {
      status: "canonical",
      canonicalInci,
      inciFingerprintSha256: createHash("sha256").update(canonicalInci).digest("hex"),
      canonicalSource: "manufacturer_de",
      evidenceRefs: ["formula:canonical"],
      sources: [
        {
          url: `https://manufacturer.example/${target}`,
          tier: "manufacturer_de",
          capturedAt: "2026-09-02T10:00:00.000Z",
        },
      ],
    },
    properties: {
      cleansingStrength: property("moderate"),
      conditioningLevel: property("moderate"),
      weightPotential: property("moderate"),
      focusPrimary: property(target === "sensitive" ? "gentle" : "general"),
      focusSecondary: {
        value: [],
        confidence: "high",
        rationale: "No independently supported secondary focus.",
        evidenceRefs: ["formula:canonical"],
      },
      usageRole: property("regular"),
      scalpComfortTarget: property(target === "sensitive" ? "targeted" : "not_targeted"),
      dandruffSupport: property("not_supported"),
    },
    thicknesses: [
      {
        thickness: "fine",
        fit: "conditional",
        confidence: "high",
        rationale: "May be richer than needed.",
        evidenceRefs: ["formula:canonical"],
      },
      {
        thickness: "normal",
        fit: "ideal",
        confidence: "high",
        rationale: "Balanced whole-formula fit.",
        evidenceRefs: ["formula:canonical"],
      },
      {
        thickness: "coarse",
        fit: "conditional",
        confidence: "high",
        rationale: "May require follow-up care.",
        evidenceRefs: ["formula:canonical"],
      },
    ],
    scalpTargets: {
      primary: {
        target,
        confidence: "high",
        rationale: `Exact positioning and formula support ${target}.`,
        positioningEvidenceRefs: ["positioning:manufacturer"],
        formulaEvidenceRefs: ["formula:canonical"],
      },
    },
    positioning: { explicitResetPositioning: false, evidenceRefs: ["positioning:manufacturer"] },
  }
}

function authorityInput(
  projected: Extract<
    ReturnType<typeof projectShampooProductionLight>,
    { status: "property_lane_ready" }
  >,
  options: { everydayConstraint: "standard" | "irritation_compatible"; omitIntensity?: boolean },
): Stage3AuthorityInput<"shampoo"> {
  const row = projected.payload.category_specs.product_shampoo_specs[0]
  assert.ok(row)
  return {
    category: "shampoo",
    authorityVersion: "personal-plan.shampoo.v4",
    refinedVersionId: "refined-authority-contract",
    refinedInputHash: "input-authority-contract",
    subjectKey: `decision:shampoo:shampoo_everyday:${projected.summary.productId}`,
    role: "shampoo_everyday",
    capturedProductId: projected.summary.productId,
    subjectIdentity: {
      kind: "catalog_product",
      productId: projected.summary.productId,
      displayName: projected.summary.productName,
      category: "shampoo",
    },
    categoryDecision: {
      category: "shampoo",
      resolution: "resolved",
      needTier: "basis",
      roles: ["shampoo_everyday"],
      target: {
        category: "shampoo",
        roles: ["shampoo_everyday"],
        scalpRoute: "balanced",
        everydayConstraint: options.everydayConstraint,
        requiresTargetedDandruffCapability: false,
      },
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    },
    coverage: [],
    hairThickness: row.thickness,
    productFacts: {
      productId: projected.summary.productId,
      displayName: projected.summary.productName,
      category: "shampoo",
      isActive: true,
      lifecycleStatus: "active",
      recommendable: true,
      suitableThicknesses: projected.payload.suitable_thicknesses,
      knownReaction: false,
      protocols: [
        { role: "shampoo_everyday", status: "verified_complete", fingerprint: "protocol-fixture" },
      ],
      factFingerprint: "facts-fixture",
      spec: {
        thickness: row.thickness,
        shampooBucket: row.shampoo_bucket,
        scalpRoute: row.scalp_route,
        cleansingIntensity: options.omitIntensity ? null : row.cleansing_intensity,
        targetFit: "matched",
      },
    },
    recommendationCandidates: [],
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  }
}

function readyProjection(target: "ordinary" | "sensitive") {
  const projected = projectShampooProductionLight(researchInput(target))
  assert.equal(projected.status, "property_lane_ready")
  if (projected.status !== "property_lane_ready") throw new Error("Expected ready projection")
  return projected
}

test("adapter output is ideal when its observed intensity matches the authority target", () => {
  const projected = readyProjection("ordinary")
  const categoryValidation = validateProductIntakeCategorySpecs(
    "shampoo",
    projected.payload.category_specs,
  )
  assert.equal(categoryValidation.ok, true)

  const result = evaluateStage3Authority(
    authorityInput(projected, { everydayConstraint: "standard" }) as never,
  )
  assert.equal(result.status, "known")
  if (result.status === "known") assert.equal(result.verdict, "ideal")
})

test("adapter preserves a sensitive route with off-target observed intensity as supportive", () => {
  const result = evaluateStage3Authority(
    authorityInput(readyProjection("sensitive"), {
      everydayConstraint: "irritation_compatible",
    }) as never,
  )
  assert.equal(result.status, "known")
  if (result.status === "known") {
    assert.equal(result.verdict, "supportive")
    assert.ok(
      result.criteria.some(
        (criterion) =>
          criterion.criterionId === "shampoo.cleansing_intensity" && criterion.result === "caution",
      ),
    )
  }
})

test("the authority remains unknown when cleansing intensity is absent", () => {
  const result = evaluateStage3Authority(
    authorityInput(readyProjection("ordinary"), {
      everydayConstraint: "standard",
      omitIntensity: true,
    }) as never,
  )
  assert.equal(result.status, "unknown")
  if (result.status === "unknown") assert.ok(result.missingFacts.includes("cleansing_intensity"))
})
