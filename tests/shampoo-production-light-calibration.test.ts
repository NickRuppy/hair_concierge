import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import { evaluateStage3Authority } from "../src/lib/personal-plan/products/authority/evaluate"
import {
  projectShampooProductionLight,
  SHAMPOO_PRODUCTION_LIGHT_RESEARCH_METHOD,
} from "../src/lib/shampoo/production-light-adapter"

const fixtureDirectory = path.resolve("tests/fixtures/shampoo-production-light")
const expectedPath = path.resolve(
  "data/research/shampoo-production-light-v1/calibration-v1/expected-projections.json",
)

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"))
}

function resolveJsonPointer(value: unknown, pointer: string): unknown {
  return pointer
    .slice(2)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce<unknown>((current, segment) => {
      if (Array.isArray(current)) return current[Number(segment)]
      if (current && typeof current === "object")
        return (current as Record<string, unknown>)[segment]
      return undefined
    }, value)
}

test("the adapter method pins match the frozen v1.4 authority files", () => {
  const sha256 = (filePath: string) =>
    createHash("sha256")
      .update(readFileSync(path.resolve(filePath)))
      .digest("hex")
  assert.equal(
    SHAMPOO_PRODUCTION_LIGHT_RESEARCH_METHOD.policySha256,
    sha256("docs/research/shampoo-inci/v1.4/classification-standard.md"),
  )
  assert.equal(
    SHAMPOO_PRODUCTION_LIGHT_RESEARCH_METHOD.runbookSha256,
    sha256("docs/research/shampoo-inci/v1.4/new-product-research-runbook.md"),
  )
})

function evaluateProjectedRow(input: {
  productId: string
  productName: string
  suitableThicknesses: string[]
  row: {
    thickness: string
    shampoo_bucket: string
    scalp_route: string
    cleansing_intensity: string
  }
}) {
  const dandruff = input.row.shampoo_bucket === "schuppen"
  const role = dandruff ? "shampoo_dandruff" : "shampoo_everyday"
  const targetByBucket = {
    normal: { scalpRoute: "balanced", everydayConstraint: "standard" },
    "dehydriert-fettig": { scalpRoute: "oily", everydayConstraint: "standard" },
    trocken: { scalpRoute: "balanced", everydayConstraint: "gentle_dry_scalp" },
    irritationen: { scalpRoute: "balanced", everydayConstraint: "irritation_compatible" },
    schuppen: { scalpRoute: "balanced", everydayConstraint: "standard" },
  } as const
  const target = targetByBucket[input.row.shampoo_bucket as keyof typeof targetByBucket]
  assert.ok(target)

  return evaluateStage3Authority({
    category: "shampoo",
    authorityVersion: "personal-plan.shampoo.v4",
    refinedVersionId: "calibration-v1",
    refinedInputHash: "calibration-v1",
    subjectKey: `decision:shampoo:${role}:${input.productId}`,
    role,
    capturedProductId: input.productId,
    subjectIdentity: {
      kind: "catalog_product",
      productId: input.productId,
      displayName: input.productName,
      category: "shampoo",
    },
    categoryDecision: {
      category: "shampoo",
      resolution: "resolved",
      needTier: "basis",
      roles: [role],
      target: {
        category: "shampoo",
        roles: [role],
        scalpRoute: target.scalpRoute,
        everydayConstraint: target.everydayConstraint,
        requiresTargetedDandruffCapability: dandruff,
      },
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    },
    coverage: [],
    hairThickness: input.row.thickness,
    productFacts: {
      productId: input.productId,
      displayName: input.productName,
      category: "shampoo",
      isActive: true,
      lifecycleStatus: "active",
      recommendable: true,
      suitableThicknesses: input.suitableThicknesses,
      knownReaction: false,
      protocols: [
        { role, status: "verified_complete", fingerprint: `protocol-${input.productId}` },
      ],
      factFingerprint: `facts-${input.productId}`,
      spec: {
        thickness: input.row.thickness,
        shampooBucket: input.row.shampoo_bucket,
        scalpRoute: input.row.scalp_route,
        cleansingIntensity: input.row.cleansing_intensity,
        targetFit: "matched",
      },
    },
    recommendationCandidates: [],
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  } as never)
}

test("the frozen ten-product calibration projects to every reviewed expected row", () => {
  const manifest = readJson(path.join(fixtureDirectory, "batch-manifest.json")) as {
    products: Array<{
      productId: string
      exactProductName: string
      gtinAliases: string[]
      selectionNotes: string
      input: string
    }>
  }
  const expected = readJson(expectedPath) as {
    products: Array<{
      productId: string
      status: string
      suitable_thicknesses: string[]
      product_shampoo_specs: unknown[]
      required_protocol_roles: string[]
      expectedFitSemantics: Array<{
        thickness: string
        shampoo_bucket: string
        observedIntensity: string
        expectedFitSemantics: "ideal" | "supportive"
      }>
    }>
  }
  assert.equal(manifest.products.length, 10)
  assert.equal(expected.products.length, manifest.products.length)
  assert.equal(new Set(manifest.products.map((product) => product.productId)).size, 10)

  const expectedById = new Map(expected.products.map((product) => [product.productId, product]))
  for (const member of manifest.products) {
    assert.ok(member.selectionNotes.trim())
    const inputPath = path.join(fixtureDirectory, member.input)
    const input = readJson(inputPath) as {
      identity: { productId: string; exactProductName: string; gtinAliases: string[] }
      formula: {
        canonicalInci: string
        inciFingerprintSha256: string
        evidenceRefs: string[]
      }
    }
    assert.equal(input.identity.productId, member.productId)
    assert.equal(input.identity.exactProductName, member.exactProductName)
    assert.deepEqual(input.identity.gtinAliases, member.gtinAliases)
    const archivedInciRef = input.formula.evidenceRefs.find((reference) =>
      reference.endsWith("/formula-source.json#/normalizedInci"),
    )
    assert.ok(archivedInciRef, `${member.productId}: missing archived normalized INCI reference`)
    const [archivedInciPath, archivedInciFragment] = archivedInciRef.split("#", 2)
    assert.ok(archivedInciFragment)
    const archivedInci = resolveJsonPointer(
      readJson(path.resolve(archivedInciPath)),
      `#${archivedInciFragment}`,
    )
    assert.ok(Array.isArray(archivedInci), `${member.productId}: archived INCI must be an array`)
    assert.equal(input.formula.canonicalInci, archivedInci.join(","), member.productId)
    assert.equal(
      input.formula.inciFingerprintSha256,
      createHash("sha256").update(input.formula.canonicalInci).digest("hex"),
      member.productId,
    )

    const outcome = projectShampooProductionLight(input)
    const reviewed = expectedById.get(member.productId)
    assert.ok(reviewed, `Missing expected projection for ${member.productId}`)
    assert.equal(outcome.status, "property_lane_ready", member.productId)
    if (outcome.status !== "property_lane_ready") continue
    assert.deepEqual(
      {
        status: outcome.status,
        suitable_thicknesses: outcome.payload.suitable_thicknesses,
        product_shampoo_specs: outcome.payload.category_specs.product_shampoo_specs,
        required_protocol_roles: outcome.payload.required_protocol_roles,
      },
      {
        status: reviewed.status,
        suitable_thicknesses: reviewed.suitable_thicknesses,
        product_shampoo_specs: reviewed.product_shampoo_specs,
        required_protocol_roles: reviewed.required_protocol_roles,
      },
      member.productId,
    )

    for (const expectation of reviewed.expectedFitSemantics) {
      const row:
        | {
            thickness: string
            shampoo_bucket: string
            scalp_route: string
            cleansing_intensity: string
          }
        | undefined = outcome.payload.category_specs.product_shampoo_specs.find(
        (candidate) =>
          candidate.thickness === expectation.thickness &&
          candidate.shampoo_bucket === expectation.shampoo_bucket,
      )
      assert.ok(row, `${member.productId}: missing fit-semantics row`)
      assert.equal(row.cleansing_intensity, expectation.observedIntensity)
      const authority = evaluateProjectedRow({
        productId: member.productId,
        productName: member.exactProductName,
        suitableThicknesses: outcome.payload.suitable_thicknesses,
        row,
      })
      assert.equal(authority.status, "known", member.productId)
      if (authority.status === "known")
        assert.equal(
          authority.verdict,
          expectation.expectedFitSemantics,
          `${member.productId}:${expectation.thickness}:${expectation.shampoo_bucket}`,
        )
    }
  }
})

test("every local evidence reference used by calibration fixtures resolves to a repository source file", () => {
  const manifest = readJson(path.join(fixtureDirectory, "batch-manifest.json")) as {
    products: Array<{ input: string }>
  }
  let checkedReferences = 0

  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!value || typeof value !== "object") return
    for (const [key, child] of Object.entries(value)) {
      if (
        (key === "evidenceRefs" ||
          key === "formulaEvidenceRefs" ||
          key === "positioningEvidenceRefs") &&
        Array.isArray(child)
      ) {
        for (const reference of child) {
          if (
            typeof reference !== "string" ||
            (!reference.startsWith("data/") && !reference.startsWith("docs/"))
          )
            continue
          checkedReferences += 1
          const [sourcePath, fragment] = reference.split("#", 2)
          const resolvedSource = path.resolve(sourcePath)
          assert.equal(existsSync(resolvedSource), true, reference)
          if (fragment?.startsWith("/") && sourcePath.endsWith(".json")) {
            assert.notEqual(
              resolveJsonPointer(readJson(resolvedSource), `#${fragment}`),
              undefined,
              reference,
            )
          }
        }
      }
      visit(child)
    }
  }

  for (const member of manifest.products) visit(readJson(path.join(fixtureDirectory, member.input)))
  assert.ok(checkedReferences > 0)
})
