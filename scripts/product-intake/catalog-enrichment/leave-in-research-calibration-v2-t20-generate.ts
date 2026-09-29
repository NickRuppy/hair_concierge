import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import {
  CATALOG_ENRICHMENT_SCHEMA_VERSION,
  validateCatalogEnrichmentManifest,
} from "@/lib/product-intake/catalog-enrichment"
import {
  LEAVE_IN_CALIBRATION_PROJECT_ID,
  buildLeaveInCalibrationSnapshot,
  leaveInCalibrationTargetFingerprint,
  type LeaveInEligibilityKey,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration"
import {
  LEAVE_IN_CALIBRATION_V2_T20_ADAPTER_VERSION,
  LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID,
  LEAVE_IN_CALIBRATION_V2_T20_MANIFEST,
  LEAVE_IN_CALIBRATION_V2_T20_PROJECTIONS,
  LEAVE_IN_CALIBRATION_V2_T20_RESEARCH_VERSION,
  LEAVE_IN_CALIBRATION_V2_T20_TARGETS,
  leaveInV2T20Delta,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration-v2-t20"
import { parseArgs, flag, printJson } from "../cli"
import { leaveInCalibrationReadAdapter } from "./leave-in-research-calibration-client"

/**
 * Builds the v2-t20 manifest batch from the v1.1 golden projection plus LIVE
 * catalog rows. Read-only against Supabase (SELECT only): each manifest's
 * `target_fingerprint` is the fingerprint of the rows it was read from, i.e.
 * batch v1's applied state.
 *
 * Fails closed: a product whose projection would move anything beyond
 * care_direction / care_benefits / functional_benefits, or touch fit,
 * eligibility or thicknesses, aborts the generation.
 */

const PACKET = "data/research/leave-in-inci/v1.0/corpus/gold-set/calibration-packet.json"
const T20_RECORDS =
  "data/research/leave-in-inci/v1.1/corpus/t20-rederived/t20-care-direction-records.json"
/** The batch's review date, not a wall clock — regeneration must reproduce the bytes. */
const DEFAULT_GENERATED_AT = "2026-09-29T00:00:00.000Z"

const SOURCE_TYPE_BY_TIER: Record<string, string> = {
  T1: "manufacturer",
  C1: "manufacturer",
  C2: "manufacturer",
  T2: "retailer",
  C3: "retailer",
  "T2/T3": "retailer",
}

/** Per-product notes Nick must read before approving. */
const REVIEW_BLOCKERS: Record<string, string[]> = {
  "slot-05": [
    "EVO: AD-3a revision only (functional_benefits loses moisture_softness). The batch-v1 EAN note (catalog 9349769020791 vs research GTIN 9349769013144) still stands.",
  ],
  "slot-08": [
    "GLISS: care_direction moisture → balanced carries T20 confidence `low` with review trigger `moisture_leg_subordinate` (film lead by one rank, Dimethicone r3 vs apricot kernel oil r4).",
  ],
  "slot-09": [
    "Redken: AD-3a revision only (functional_benefits loses moisture_softness; it is `protein`). Not in the original expected list — confirmed as part of ruling 3.",
  ],
  "slot-13": [
    "Neqi: care_direction moisture → balanced carries T20 confidence `low` with review trigger `glycol_only_leg` (the read rests on demoting Dipropylene/Pentylene Glycol r2/r6 above Polysilicone-29 r7).",
  ],
}

function storagePathFromImageUrl(imageUrl: unknown): string | null {
  if (typeof imageUrl !== "string") return null
  const marker = "/storage/v1/object/public/"
  const index = imageUrl.indexOf(marker)
  return index === -1 ? null : imageUrl.slice(index + marker.length)
}

async function main() {
  const args = parseArgs()
  const outPath = flag(args, "out") ?? LEAVE_IN_CALIBRATION_V2_T20_MANIFEST
  const generatedAt = flag(args, "generated-at") ?? DEFAULT_GENERATED_AT
  const [projectionsRaw, packetRaw, recordsRaw] = await Promise.all([
    readFile(resolve(LEAVE_IN_CALIBRATION_V2_T20_PROJECTIONS), "utf8"),
    readFile(resolve(PACKET), "utf8"),
    readFile(resolve(T20_RECORDS), "utf8"),
  ])
  const projections = JSON.parse(projectionsRaw).projections as Record<string, never>
  const packetEntries = JSON.parse(packetRaw).entries as Array<Record<string, unknown>>
  const t20Records = JSON.parse(recordsRaw).records as Array<{
    slot: number | string
    care_direction: { value: string; confidence: string; review_triggers: string[] }
  }>
  const read = leaveInCalibrationReadAdapter()

  const products = []
  for (const target of LEAVE_IN_CALIBRATION_V2_T20_TARGETS) {
    const projection = projections[`${target.slot}.json` as never] as {
      status: string
      requiredProtocolRoles: string[]
      warnings: string[]
      summary: { researchId: string }
      productionProjection: {
        research_model_version: string
        suitable_thicknesses: string[]
        category_specs: {
          product_leave_in_specs: Record<string, unknown>
          product_leave_in_fit_specs: Record<string, unknown>
          product_leave_in_eligibility: LeaveInEligibilityKey[]
        }
        field_rationales: Record<string, string>
        research_input_sha256: string
        projection_sha256: string
      }
    }
    if (!projection || projection.status !== "projection_ready")
      throw new Error(`missing or non-ready projection for ${target.slot}`)
    if (
      projection.productionProjection.research_model_version !==
      LEAVE_IN_CALIBRATION_V2_T20_RESEARCH_VERSION
    )
      throw new Error(
        `${target.slot}: projection is not ${LEAVE_IN_CALIBRATION_V2_T20_RESEARCH_VERSION}`,
      )

    const slotNumber = Number.parseInt(target.slot.replace("slot-", ""), 10)
    const packet = packetEntries.find((entry) => entry.slot === slotNumber)
    if (!packet) throw new Error(`missing calibration packet entry for ${target.slot}`)
    const t20 = t20Records.find((record) => record.slot === slotNumber)
    if (!t20) throw new Error(`missing T20 record for ${target.slot}`)

    const rows = await read.liveRows(target.product_id)
    if (!rows.product) throw new Error(`missing live product row for ${target.product_id}`)
    const snapshot = buildLeaveInCalibrationSnapshot(target.product_id, rows)
    const categoryPayload = projection.productionProjection.category_specs
    const projectedThicknesses = [...projection.productionProjection.suitable_thicknesses].sort()

    const delta = leaveInV2T20Delta({
      snapshot,
      projectedSpecs: categoryPayload.product_leave_in_specs,
      projectedFit: categoryPayload.product_leave_in_fit_specs,
      projectedEligibility: categoryPayload.product_leave_in_eligibility,
      projectedThicknesses,
    })
    if (delta.invariant_violations.length > 0)
      throw new Error(`${target.slot}: ${delta.invariant_violations.join("; ")}`)

    const liveProtocolRoles = [...new Set(rows.protocols.map((row) => String(row.role)))].sort()
    const liveSpecs = snapshot.product_leave_in_specs ?? {}
    const manifest = {
      schema_version: CATALOG_ENRICHMENT_SCHEMA_VERSION,
      batch_id: LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID,
      product_key: target.product_key,
      category_key: "leave_in",
      lifecycle_classification: "existing_product_enrichment",
      target_product_id: target.product_id,
      target_fingerprint: leaveInCalibrationTargetFingerprint(snapshot),
      identity: {
        slot: target.slot,
        research_id: projection.summary.researchId,
        exact_product_name: packet.exact_product_name,
        brand: packet.brand,
        gtin: packet.gtin,
        catalog_name: rows.product.name,
        catalog_brand: rows.product.brand,
      },
      duplicate_check: { checked_at: generatedAt, candidates: [] },
      sources: [
        {
          label: "Chaarlie-Katalog Kaufquelle",
          type: "retailer",
          url: String(rows.product.affiliate_link),
        },
        ...((packet.source_urls as Array<Record<string, unknown>>) ?? [])
          .filter((source) => typeof source.url === "string")
          .map((source) => ({
            label: String(source.domain),
            type: SOURCE_TYPE_BY_TIER[String(source.tier)] ?? "retailer",
            url: String(source.url),
          })),
      ],
      commercial: {
        purchase_url: rows.product.affiliate_link,
        status: "available",
        price_eur: Number(rows.product.price_eur),
        currency: rows.product.currency,
      },
      image: {
        local_asset_path: storagePathFromImageUrl(rows.product.image_url) ?? "",
        change: "none",
        note: "Existing catalog image; this batch plans no image work.",
      },
      product_payload: {
        final: {
          product: {
            canonical_brand: rows.product.brand,
            clean_name: rows.product.name,
            category_key: "leave_in",
            suitable_thicknesses: projectedThicknesses,
          },
          category_specs: categoryPayload,
          field_rationales: projection.productionProjection.field_rationales,
        },
      },
      category_payload: categoryPayload,
      // One spec upsert and nothing else: T20/AD-3a move only spec columns, and
      // the fit row, the eligibility set and the thicknesses are identical.
      planned_operations: [
        {
          type: "upsert",
          table: "product_leave_in_specs",
          rows: [{ product_id: target.product_id, ...categoryPayload.product_leave_in_specs }],
        },
      ],
      products_field_updates: null,
      t20_delta: {
        changed_spec_columns: delta.changed_spec_columns,
        before: Object.fromEntries(
          delta.changed_spec_columns.map((column) => [column, liveSpecs[column] ?? null]),
        ),
        after: Object.fromEntries(
          delta.changed_spec_columns.map((column) => [
            column,
            categoryPayload.product_leave_in_specs[column] ?? null,
          ]),
        ),
        unchanged: [
          "product_leave_in_fit_specs",
          "product_leave_in_eligibility",
          "products.suitable_thicknesses",
        ],
        t20_care_direction: t20.care_direction,
      },
      research: {
        adapter_version: LEAVE_IN_CALIBRATION_V2_T20_ADAPTER_VERSION,
        research_model_version: LEAVE_IN_CALIBRATION_V2_T20_RESEARCH_VERSION,
        projection_status: projection.status,
        projection_sha256: projection.productionProjection.projection_sha256,
        research_input_sha256: projection.productionProjection.research_input_sha256,
        projection_warnings: projection.warnings,
        required_protocol_roles: projection.requiredProtocolRoles,
        live_protocol_roles: liveProtocolRoles,
      },
      current_catalog_target: snapshot,
      validation: {
        state: "ready_for_handoff",
        blockers: REVIEW_BLOCKERS[target.slot] ?? [],
        errors: [],
      },
      review: { state: "pending" },
      disposition: { state: "awaiting_review", may_enter_deliverable_b: false },
    }

    const validation = validateCatalogEnrichmentManifest(manifest, {
      id: target.product_id,
      fingerprint: manifest.target_fingerprint,
    })
    if (!validation.ok)
      throw new Error(`${target.product_key} failed validation: ${validation.errors.join("; ")}`)
    products.push(manifest)
  }

  const batch = {
    schema_version: CATALOG_ENRICHMENT_SCHEMA_VERSION,
    batch_id: LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID,
    lifecycle_classification: "existing_product_enrichment",
    project_id: LEAVE_IN_CALIBRATION_PROJECT_ID,
    generated_at: generatedAt,
    generator:
      "scripts/product-intake/catalog-enrichment/leave-in-research-calibration-v2-t20-generate.ts",
    research: {
      adapter_version: LEAVE_IN_CALIBRATION_V2_T20_ADAPTER_VERSION,
      research_model_version: LEAVE_IN_CALIBRATION_V2_T20_RESEARCH_VERSION,
      projection_source: LEAVE_IN_CALIBRATION_V2_T20_PROJECTIONS,
      t20_records: T20_RECORDS,
      delta_doc: "plans/leave-in-moisture-balanced/t20-catalog-delta.md",
    },
    notes: [
      "Standard v1.1 (T20) + AD-3a revision delta on top of batch leave-in-research-calibration-v1. Five products; the other four calibration products have no field change.",
      "Each manifest plans exactly one product_leave_in_specs upsert. Only care_direction, care_benefits and functional_benefits differ from the pinned live row; fit specs, eligibility rows and suitable_thicknesses are identical and the executor asserts that.",
      "No eligibility delete and no eligibility write: every flipped product keeps anti_frizz, so every moisture_anti_frizz row stays.",
      "target_fingerprint pins batch v1's applied state as read live (SELECT only).",
      "This file authorizes nothing. Apply happens later, behind an explicit --apply --confirm step Nick runs.",
    ],
    products,
  }

  await writeFile(resolve(outPath), `${JSON.stringify(batch, null, 2)}\n`, "utf8")
  printJson({
    mode: "generate",
    writes: false,
    out: outPath,
    products: products.length,
    changed: products.map((manifest) => ({
      product_key: manifest.product_key,
      changed_spec_columns: manifest.t20_delta.changed_spec_columns,
    })),
  })
}

void main()
