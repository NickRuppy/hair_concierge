import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  inspectOilAuthorityRepair,
  OIL_AUTHORITY_PRODUCT_IDS,
  parseOilAuthorityRepairManifest,
} from "../src/lib/catalog-authority/oil-repair"
import {
  catalogAuthorityRepairReviewFingerprint,
  catalogAuthorityValueFingerprint,
  type CatalogAuthorityRepairManifest,
} from "../src/lib/catalog-authority/repair"
import { assertOilRepairApplyCliGate } from "../scripts/catalog-authority/oil-repair-client"

const MANIFEST_PATH = "data/catalog-enrichment/oil-authority-enrichment-v1/manifest.json"
const MIGRATION_PATH =
  "supabase/migrations/20260901113013_oil_authority_repair_v1_executor_approved.sql"
const AMBIGUITY_FIX_MIGRATION_PATH =
  "supabase/migrations/20260901131456_fix_oil_authority_executor_product_id_ambiguity.sql"
const EXPECTED_FINGERPRINT = "bc2cca3c68ae4eea4dd337fcbbd5f02be5d7ac1d42635a26bd68a74255929b2b"
const OGX_ID = "1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf"
const GARNIER_ID = "c574ee6f-ad22-45c0-b936-57b847d93433"

function manifest(): CatalogAuthorityRepairManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
}

function targetEntry(value: CatalogAuthorityRepairManifest, productId: string) {
  const entry = value.entries.find((candidate) => candidate.productId === productId)
  assert.ok(entry)
  return entry
}

function refreshTargetFingerprint(entry: CatalogAuthorityRepairManifest["entries"][number]) {
  entry.expectedNewFingerprint = catalogAuthorityValueFingerprint(entry.intendedAuthority)
}

test("the exact 15-product Oil bundle is bound to Nick's approved content fingerprint", () => {
  const value = parseOilAuthorityRepairManifest(manifest())
  const inspection = inspectOilAuthorityRepair(value)

  assert.deepEqual(
    value.entries.map((entry) => entry.productId).sort(),
    [...OIL_AUTHORITY_PRODUCT_IDS].sort(),
  )
  assert.equal(value.entries.length, 15)
  assert.equal(
    value.entries.reduce(
      (count, entry) =>
        count +
        ((entry.intendedAuthority.protocols as Array<Record<string, unknown>> | undefined)
          ?.length ?? 0),
      0,
    ),
    18,
  )
  assert.equal(catalogAuthorityRepairReviewFingerprint(value), EXPECTED_FINGERPRINT)
  assert.equal(inspection.contentFingerprint, EXPECTED_FINGERPRINT)
  assert.equal(inspection.writes, false)
  assert.equal(inspection.blockers.includes("approval_pending"), false)
  assert.equal(
    inspection.blockers.filter((blocker) => blocker.startsWith("live_prestate_not_checked:"))
      .length,
    15,
  )
  assert.deepEqual(value.review, {
    state: "approved",
    reviewedBy: "nick",
    reviewedAt: "2026-09-01T11:30:04.000Z",
    reviewedContentFingerprint: EXPECTED_FINGERPRINT,
  })
})

test("OGX and Garnier carry only the explicitly recommended finished-product authority", () => {
  const value = parseOilAuthorityRepairManifest(manifest())
  const ogx = targetEntry(value, OGX_ID).intendedAuthority
  const garnier = targetEntry(value, GARNIER_ID).intendedAuthority

  assert.match(
    String(ogx.identity && (ogx.identity as Record<string, unknown>).affiliateLink),
    /ogx/,
  )
  assert.deepEqual(ogx.productOilSpec, {
    weight: "medium",
    roleSupport: ["leave_on_fibre_conditioning", "pre_heat_protection"],
    providesHeatProtection: true,
  })
  assert.deepEqual(ogx.productOilEligibility, [
    {
      thickness: "normal",
      oilSubtype: "styling-oel",
      oilPurpose: "styling_finish",
      ingredientFlags: ["oils", "silicones"],
    },
  ])
  assert.deepEqual(garnier.productOilSpec, {
    weight: "light",
    roleSupport: ["pre_heat_protection"],
    providesHeatProtection: true,
  })
  assert.deepEqual(garnier.productOilEligibility, [
    {
      thickness: "coarse",
      oilSubtype: "trocken-oel",
      oilPurpose: null,
      ingredientFlags: ["silicones"],
    },
  ])

  const heatIds = value.entries
    .filter(
      (entry) =>
        (entry.intendedAuthority.productOilSpec as Record<string, unknown>)
          .providesHeatProtection === true,
    )
    .map((entry) => entry.productId)
    .sort()
  assert.deepEqual(heatIds, [OGX_ID, GARNIER_ID].sort())
})

test("sheet thickness is immutable and all other oils retain conservative pre-wash purpose", () => {
  const value = parseOilAuthorityRepairManifest(manifest())
  for (const entry of value.entries) {
    const current = entry.expectedCurrentAuthority!
    const target = entry.intendedAuthority
    assert.deepEqual(target.identity, current.identity)
    const identity = target.identity as Record<string, string[]>
    const eligibility = target.productOilEligibility as Array<Record<string, unknown>>
    assert.deepEqual(identity.suitableThicknesses, identity.normalizedThicknesses)
    assert.equal(identity.suitableThicknesses[0], eligibility[0]!.thickness)
    if (entry.productId !== OGX_ID && entry.productId !== GARNIER_ID) {
      assert.equal(eligibility[0]!.oilPurpose, "pre_wash_oiling")
    }
  }
})

test("fact provenance excludes protocol-only internal authority and protocols are product-scoped", () => {
  const value = parseOilAuthorityRepairManifest(manifest())
  for (const entry of value.entries) {
    const target = entry.intendedAuthority
    const facts = target.factEvidence as Array<Record<string, unknown>>
    const protocols = target.protocols as Array<Record<string, unknown>>
    assert.ok(facts.some((fact) => fact.sourceType === "internal_verified"))
    assert.equal(
      facts.some((fact) => fact.sourceType === "internal_authority"),
      false,
    )
    for (const protocol of protocols) {
      const guidance = protocol.guidancePayload as Record<string, unknown>
      const scope = guidance.scope as Record<string, unknown>
      assert.deepEqual(scope, { kind: "product", category: "oil", productId: entry.productId })
    }
  }
})

test("structural mutations fail before a proposal could be approved", () => {
  const identityMutation = manifest()
  const identityEntry = targetEntry(identityMutation, OGX_ID)
  ;(identityEntry.intendedAuthority.identity as Record<string, unknown>).name =
    "A different product"
  refreshTargetFingerprint(identityEntry)
  assert.throws(
    () => parseOilAuthorityRepairManifest(identityMutation),
    /oil_authority_repair_identity_mutation/,
  )

  const purposeMutation = manifest()
  const purposeEntry = targetEntry(purposeMutation, GARNIER_ID)
  ;(
    purposeEntry.intendedAuthority.productOilEligibility as Array<Record<string, unknown>>
  )[0]!.oilPurpose = "light_finish"
  refreshTargetFingerprint(purposeEntry)
  assert.throws(
    () => parseOilAuthorityRepairManifest(purposeMutation),
    /oil_authority_repair_garnier_heat_only_contract/,
  )

  const protocolMutation = manifest()
  const protocolEntry = targetEntry(protocolMutation, OGX_ID)
  ;(protocolEntry.intendedAuthority.protocols as unknown[]).pop()
  refreshTargetFingerprint(protocolEntry)
  assert.throws(
    () => parseOilAuthorityRepairManifest(protocolMutation),
    /oil_authority_repair_protocol_role_mismatch/,
  )
})

test("the SQL executor pins the approved fingerprint and retains explicit null safety", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8")
  assert.match(
    sql,
    new RegExp(`v_approved_manifest_fingerprint constant text := '${EXPECTED_FINGERPRINT}'`),
  )
  const nullGate = sql.indexOf("IF v_approved_manifest_fingerprint IS NULL THEN")
  const comparisonGate = sql.indexOf(
    "p_expected_manifest_fingerprint IS DISTINCT FROM v_approved_manifest_fingerprint",
  )
  assert.ok(nullGate >= 0 && comparisonGate > nullGate)
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /FOR UPDATE/)
  assert.match(sql, /live prestate drift/)
  assert.match(sql, /applied target drift/)
  assert.match(sql, /INSERT INTO public\.product_oil_specs/)
  assert.match(sql, /UPDATE public\.product_oil_eligibility/)
  assert.match(sql, /INSERT INTO public\.product_application_protocols/)
  assert.match(sql, /INSERT INTO public\.personal_plan_catalog_fact_evidence/)
  assert.match(sql, /INSERT INTO public\.catalog_enrichment_applied_items/)
  assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.doesNotMatch(sql, /UPDATE public\.products/)
  assert.doesNotMatch(sql, /product_identifiers/)
  assert.doesNotMatch(sql, /catalog_product_dispositions/)
})

test("the SQL executor fix resolves output-column ambiguity without widening its scope", () => {
  const sql = readFileSync(AMBIGUITY_FIX_MIGRATION_PATH, "utf8")
  const conflictDirective = sql.indexOf("#variable_conflict use_column")
  const declaration = sql.indexOf("DECLARE")
  const protocolUpsert = sql.indexOf(
    "ON CONFLICT (product_id, category, role, application_family) DO UPDATE SET",
  )

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.apply_catalog_authority_oil_repair_v1/)
  assert.match(
    sql,
    new RegExp(`v_approved_manifest_fingerprint constant text := '${EXPECTED_FINGERPRINT}'`),
  )
  assert.ok(conflictDirective >= 0 && declaration > conflictDirective)
  assert.ok(protocolUpsert > declaration)
  assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.doesNotMatch(sql, /UPDATE public\.products/)
  assert.doesNotMatch(sql, /product_identifiers/)
  assert.doesNotMatch(sql, /catalog_product_dispositions/)
})

test("the historical Oil authority CLI remains available for inspection but cannot apply", () => {
  assert.doesNotThrow(() =>
    assertOilRepairApplyCliGate({
      apply: false,
    }),
  )
  assert.throws(
    () => assertOilRepairApplyCliGate({ apply: true }),
    /oil_repair_apply_retired_use_oil_heat_capability_migration/,
  )
})
