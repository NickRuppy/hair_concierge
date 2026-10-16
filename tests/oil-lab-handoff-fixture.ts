import {
  oilReviewFingerprint,
  stableOilReviewJson,
} from "../packages/product-intake-core/src/oil-review-binding"
import type { ProductIntakeSubmissionDetail } from "../packages/product-intake-core/src/jobs"
import { createOilStorage } from "../src/lib/oil-research/storage"
import {
  assembleFreshOilResearchEnvelope,
  type LegacyFreshOilResearchDraft,
  type OilResearchEnvelope,
} from "../src/lib/oil-research/contracts"
import { makeCurrentOilEnvelope } from "./fixtures/oil-research/current"
import { makeOilEnvelope, preserveFixtureProfile } from "./fixtures/oil-research/fixture"
import { runProtocolStage } from "../src/lib/product-intake/pipeline/protocol"

export const id = "00000000-0000-4000-8000-000000000111"
export function detailFixture(): ProductIntakeSubmissionDetail {
  const fresh = makeCurrentOilEnvelope()
  return detailForFresh(fresh)
}

/** Frozen v0.8 receipt fixture for parser and SQL compatibility tests only. */
export function legacyDetailFixture(): ProductIntakeSubmissionDetail {
  const historical = makeOilEnvelope()
  historical.profile.provides_heat_protection.value = false
  preserveFixtureProfile(historical)
  const fresh = assembleFreshOilResearchEnvelope({
    ...historical,
    submission_id: id,
    provenance: {
      ...historical.provenance,
      original_method: {
        ...historical.provenance.original_method,
        declared_version: "v0.8",
        unrecorded_note: null,
      },
    },
  } as LegacyFreshOilResearchDraft)
  return detailForFresh(fresh)
}

function detailForFresh(fresh: OilResearchEnvelope): ProductIntakeSubmissionDetail {
  const storage = createOilStorage(fresh)
  const specs: Record<string, unknown> = {
    product_oil_specs: {
      weight: "light",
      role_support: ["dry_finish"],
      provides_heat_protection: false,
    },
    product_oil_eligibility: [
      {
        thickness: "fine",
        oil_subtype: "natuerliches-oel",
        oil_purpose: null,
        ingredient_flags: ["oils"],
      },
    ],
  }
  const sources = [
    { url: "https://example.com/synthetic-oil", title: "Maker", evidence: "One drop to dry ends." },
  ]
  specs.product_application_protocols = runProtocolStage({
    categoryKey: "oil",
    categorySpecs: specs,
    draft: {
      evidence: [
        {
          sourceUrl: sources[0].url,
          sourceText: sources[0].evidence,
          sourceType: "manufacturer",
          checkedAt: "2026-10-13",
        },
      ],
    },
    sources,
  }).rows
  const jobId = id.replace(/111$/, "112"),
    artifactId = id.replace(/111$/, "113")
  const identityArtifactId = id.replace(/111$/, "114")
  // Independently authored intake source context; deliberately not copied from the envelope.
  const formula = {
    raw_inci: "JOJOBA OIL, 1,2-HEXANEDIOL.",
    ingredients: [
      { rank: 1, raw_name: "JOJOBA OIL", canonical_name: "JOJOBA OIL" },
      { rank: 2, raw_name: "1,2-HEXANEDIOL", canonical_name: "1,2-HEXANEDIOL" },
    ],
    source_ids: ["maker"],
    declaration_status: "complete",
    conflicts: [],
  }
  const context = {
    submission_id: id,
    job_id: jobId,
    run_id: "00000000-0000-4000-8000-000000000115",
    resolved_identity_artifact_id: identityArtifactId,
    resolved_identity_artifact: {
      stage: "identity",
      brand_resolution: { canonical_brand: "Fixture", product_line: null },
      gtins: [],
      net_content: null,
    },
    identity: {
      brand: "Fixture",
      product: "Hypothetical oil",
      market: "DE",
      variant: null,
      package: { size_text: "30 ml", size_ml: null, combined_declaration: null },
      identifier: null,
      source_ids: ["maker"],
    },
    formula,
    final_product_identity: {
      canonical_brand: "Fixture",
      product_line: null,
      clean_name: "Hypothetical oil",
      net_content_value: 30,
      net_content_unit: "ml",
    },
  }
  return {
    id,
    category: "oil",
    status: "ready_for_review",
    brand: "Fixture",
    product_name: "Hypothetical oil",
    source: "chat",
    created_at: "2026-10-13",
    updated_at: "2026-10-13",
    decisions: [],
    job: {
      id: jobId,
      submission_id: id,
      status: "waiting_for_review",
      stage: "preview_build",
    } as ProductIntakeSubmissionDetail["job"],
    artifacts: [
      {
        id: identityArtifactId,
        job_id: jobId,
        submission_id: id,
        kind: "identity_candidate",
        status: "resolved",
        payload: {
          stage: "identity",
          brand_resolution: { canonical_brand: "Fixture", product_line: null },
          gtins: [],
          net_content: null,
        },
        confidence: null,
        source_urls: null,
        model: null,
        prompt_version: null,
        created_at: "2026-10-13",
      },
      {
        id: artifactId,
        job_id: jobId,
        submission_id: id,
        kind: "property_synthesis",
        payload: {
          ...storage,
          oil_admission_context: context,
          oil_admission_context_json: stableOilReviewJson(context),
          oil_admission_context_sha256: oilReviewFingerprint(context),
        },
        status: "complete",
        confidence: null,
        source_urls: null,
        model: null,
        prompt_version: null,
        created_at: "2026-10-13",
      },
    ],
    payload: {
      draft: {
        private_customer_data: "SECRET",
        formula: {
          status: "present",
          source: "oil_envelope",
          raw_inci: fresh.formula.raw_inci,
          normalized_ingredients: fresh.formula.ingredients.map(
            (ingredient) => ingredient.canonical_name,
          ),
          fingerprint_sha256: fresh.formula.normalized_sha256,
        },
        oil_authoritative_formula: structuredClone(formula),
        oil_research_binding: {
          artifact_id: artifactId,
          admission_context_sha256: oilReviewFingerprint(context),
          job_id: jobId,
          envelope_sha256: storage.oil_research_envelope_sha256,
          method: fresh.research_method,
          raw_sha256: fresh.formula.raw_sha256,
          normalized_sha256: fresh.formula.normalized_sha256,
        },
      },
      final: {
        product: {
          canonical_brand: "Fixture",
          product_line: null,
          clean_name: "Hypothetical oil",
          category_key: "oil",
          suitable_thicknesses: ["fine"],
          affiliate_link: sources[0].url,
          image_url: "https://example.com/image.jpg",
          price_eur: 10,
          currency: "EUR",
          purchase_link_status: "available",
          purchase_link_checked_at: "2026-10-13T00:00:00Z",
          price_checked_at: "2026-10-13T00:00:00Z",
          net_content_value: 30,
          net_content_unit: "ml",
        },
        identifiers: [],
        category_specs: specs,
        sources,
        field_rationales: Object.fromEntries(
          [
            "product.canonical_brand",
            "product.clean_name",
            "product.category_key",
            "product.affiliate_link",
            "product.image_url",
            "product.price_eur",
            "product.purchase_link_status",
            ...Object.keys(specs).map((key) => `category_specs.${key}`),
          ].map((key) => [key, "Synthetic sourced draft."]),
        ),
        review: { manual_reviewed: false },
      },
    },
  }
}
