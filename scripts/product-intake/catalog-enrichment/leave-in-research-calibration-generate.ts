import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import {
  CATALOG_ENRICHMENT_SCHEMA_VERSION,
  validateCatalogEnrichmentManifest,
} from "@/lib/product-intake/catalog-enrichment"
import {
  LEAVE_IN_CALIBRATION_ADAPTER_VERSION,
  LEAVE_IN_CALIBRATION_BATCH_ID,
  LEAVE_IN_CALIBRATION_PROJECT_ID,
  LEAVE_IN_CALIBRATION_RESEARCH_VERSION,
  LEAVE_IN_CALIBRATION_TARGETS,
  LEAVE_IN_ELIGIBILITY_NATURAL_KEY,
  buildLeaveInCalibrationSnapshot,
  leaveInCalibrationTargetFingerprint,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration"
import { applicationGuidanceProtocolSchema } from "@/lib/routines/personal-plan/application/contracts"
import { parseArgs, flag, printJson } from "../cli"
import { leaveInCalibrationReadAdapter } from "./leave-in-research-calibration-client"
import { LEAVE_IN_CALIBRATION_AUTHORED_PROTOCOLS } from "./leave-in-research-calibration-protocols"

/**
 * Rebuilds plans/leave-in-apply/leave-in-research-enrichment-manifest.json from
 * the frozen projection file plus live catalog rows. Read-only against Supabase:
 * it only SELECTs, so the generated manifest is reproducible and its
 * `target_fingerprint` is always the fingerprint of the rows it was built from.
 */

const PROJECTIONS = "data/research/leave-in-inci/v1.0/calibration-expected-projections.json"
const PACKET = "data/research/leave-in-inci/v1.0/corpus/gold-set/calibration-packet.json"
const DEFAULT_OUT = "plans/leave-in-apply/leave-in-research-enrichment-manifest.json"

/**
 * The batch's review date, not a wall clock. The manifest is fingerprinted and
 * that fingerprint is pinned in the executor migration, so regenerating from the
 * same projection and the same live rows MUST reproduce the same bytes — a
 * `new Date()` here would invalidate the pin on every run. Override with
 * `--generated-at <ISO>` only when deliberately cutting a new batch.
 */
const DEFAULT_GENERATED_AT = "2026-09-14T00:00:00.000Z"

const SOURCE_TYPE_BY_TIER: Record<string, string> = {
  T1: "manufacturer",
  C1: "manufacturer",
  C2: "manufacturer",
  T2: "retailer",
  C3: "retailer",
  "T2/T3": "retailer",
}

/** Per-product notes Nick must read before approving; they surface as validation blockers. */
const REVIEW_BLOCKERS: Record<string, string[]> = {
  "slot-03": [
    'Cantu: the projection removes repair and anti_frizz although cantubeauty.de claims "Repariert geschädigtes Haar"; the research record flags that page\'s INCI as possibly the US variant (identity_status: provisional_formula_conflict).',
  ],
  "slot-05": [
    "EVO: the catalog row's EAN 9349769020791 does not match the research record's frozen GTIN 9349769013144 (150 ml). Identity must be confirmed before this product is applied.",
  ],
  "slot-08": [
    'GLISS: care_direction flips protein → moisture and repair_support_level high → low, and repair leaves care_benefits, for a product named "Express-Repair".',
  ],
  "slot-09": [
    "Redken: provides_heat_protection flips false → true, which newly requires a pre_heat_protection protocol row (authored in authored_protocols, not plannable through this contract).",
  ],
  "slot-10": [
    'Olaplex: repair_support_level drops high → low and repair leaves care/fit benefits, for a product named "Bond Smoother".',
  ],
  "slot-13": [
    "Neqi: no product_application_protocols rows exist today; both required roles are authored in authored_protocols and are not plannable through this contract.",
  ],
}

function storagePathFromImageUrl(imageUrl: unknown): string | null {
  if (typeof imageUrl !== "string") return null
  const marker = "/storage/v1/object/public/"
  const index = imageUrl.indexOf(marker)
  return index === -1 ? null : imageUrl.slice(index + marker.length)
}

function naturalKey(row: Record<string, unknown>) {
  return LEAVE_IN_ELIGIBILITY_NATURAL_KEY.map((column) => String(row[column])).join("|")
}

async function main() {
  const args = parseArgs()
  const outPath = flag(args, "out") ?? DEFAULT_OUT
  const [projectionsRaw, packetRaw] = await Promise.all([
    readFile(resolve(PROJECTIONS), "utf8"),
    readFile(resolve(PACKET), "utf8"),
  ])
  const projections = JSON.parse(projectionsRaw).projections as Record<string, never>
  const packetEntries = JSON.parse(packetRaw).entries as Array<Record<string, unknown>>
  const read = leaveInCalibrationReadAdapter()
  const generatedAt = flag(args, "generated-at") ?? DEFAULT_GENERATED_AT

  const products = []
  for (const target of LEAVE_IN_CALIBRATION_TARGETS) {
    const projection = projections[`${target.slot}.json` as never] as {
      status: string
      requiredProtocolRoles: string[]
      warnings: string[]
      summary: { researchId: string; productName: string }
      productionProjection: {
        suitable_thicknesses: string[]
        category_specs: {
          product_leave_in_specs: Record<string, unknown>
          product_leave_in_fit_specs: Record<string, unknown>
          product_leave_in_eligibility: Array<Record<string, unknown>>
        }
        field_rationales: Record<string, string>
        research_input_sha256: string
        projection_sha256: string
      }
    }
    if (!projection) throw new Error(`missing projection for ${target.slot}`)

    const slotNumber = Number.parseInt(target.slot.replace("slot-", ""), 10)
    const packet = packetEntries.find((entry) => entry.slot === slotNumber)
    if (!packet) throw new Error(`missing calibration packet entry for ${target.slot}`)

    const rows = await read.liveRows(target.product_id)
    if (!rows.product) throw new Error(`missing live product row for ${target.product_id}`)
    const snapshot = buildLeaveInCalibrationSnapshot(target.product_id, rows)
    const targetFingerprint = leaveInCalibrationTargetFingerprint(snapshot)

    const categoryPayload = projection.productionProjection.category_specs
    const projectedEligibility = categoryPayload.product_leave_in_eligibility
    const projectedKeys = new Set(projectedEligibility.map(naturalKey))
    const staleEligibility = rows.eligibility
      .filter((row) => !projectedKeys.has(naturalKey(row)))
      .map((row) => ({
        product_id: target.product_id,
        thickness: String(row.thickness),
        need_bucket: String(row.need_bucket),
        styling_context: String(row.styling_context),
      }))
      .sort((left, right) => naturalKey(left).localeCompare(naturalKey(right)))

    const liveThicknesses = [
      ...((rows.product.suitable_thicknesses as string[] | null) ?? []),
    ].sort()
    const projectedThicknesses = [...projection.productionProjection.suitable_thicknesses].sort()
    const thicknessesChange =
      JSON.stringify(liveThicknesses) !== JSON.stringify(projectedThicknesses)

    // The catalog's own purchase source is always present; packet entries whose
    // exact URL was not preserved (url: null) are dropped rather than invented.
    const sources = [
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
    ]

    const authoredProtocols = LEAVE_IN_CALIBRATION_AUTHORED_PROTOCOLS.filter(
      (protocol) => protocol.product_id === target.product_id,
    )
    for (const protocol of authoredProtocols) {
      const parsed = applicationGuidanceProtocolSchema.safeParse(protocol.row.guidance_payload)
      if (!parsed.success)
        throw new Error(
          `authored protocol ${protocol.row.role} for ${target.slot} fails the guidance contract: ${JSON.stringify(parsed.error.issues)}`,
        )
    }

    const liveProtocolRoles = [...new Set(rows.protocols.map((row) => String(row.role)))].sort()
    const missingProtocolRoles = projection.requiredProtocolRoles.filter(
      (role) => !liveProtocolRoles.includes(role),
    )

    const manifest = {
      schema_version: CATALOG_ENRICHMENT_SCHEMA_VERSION,
      batch_id: LEAVE_IN_CALIBRATION_BATCH_ID,
      product_key: target.product_key,
      category_key: "leave_in",
      lifecycle_classification: "existing_product_enrichment",
      target_product_id: target.product_id,
      target_fingerprint: targetFingerprint,
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
      sources,
      commercial: {
        purchase_url: rows.product.affiliate_link,
        status: "available",
        price_eur: Number(rows.product.price_eur),
        currency: rows.product.currency,
      },
      image: {
        local_asset_path: storagePathFromImageUrl(rows.product.image_url) ?? "",
        change: "none",
        note: "Existing catalog image; this cohort plans no image work.",
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
      planned_operations: [
        ...(thicknessesChange ? [{ type: "update_product", table: "products" }] : []),
        ...(staleEligibility.length > 0
          ? [
              {
                type: "delete",
                table: "product_leave_in_eligibility",
                rows: staleEligibility,
              },
            ]
          : []),
        {
          type: "upsert",
          table: "product_leave_in_specs",
          rows: [{ product_id: target.product_id, ...categoryPayload.product_leave_in_specs }],
        },
        {
          type: "upsert",
          table: "product_leave_in_fit_specs",
          rows: [{ product_id: target.product_id, ...categoryPayload.product_leave_in_fit_specs }],
        },
        {
          type: "upsert",
          table: "product_leave_in_eligibility",
          rows: projectedEligibility.map((row) => ({ product_id: target.product_id, ...row })),
        },
      ],
      /**
       * `update_product` carries no payload in the shared contract (the schema
       * pins it to exactly {type, table}), so the value it stands for lives here
       * and the executor has to read it from this field. Flagged for Nick.
       */
      products_field_updates: thicknessesChange
        ? {
            suitable_thicknesses: {
              current: liveThicknesses,
              projected: projectedThicknesses,
              carried_outside_planned_operations: true,
            },
          }
        : null,
      /**
       * Protocol rows authored from docs/product-application-protocol-templates.md.
       * They are NOT planned_operations: the shared contract validates every
       * planned upsert against validateProductIntakeCategorySpecs, which for
       * leave_in emits only the three spec tables, so a
       * product_application_protocols upsert fails validation. Routing decision
       * for Nick — see plans/leave-in-apply/apply-runbook.md.
       */
      authored_protocols: authoredProtocols.map((protocol) => protocol.row),
      research: {
        adapter_version: LEAVE_IN_CALIBRATION_ADAPTER_VERSION,
        research_model_version: LEAVE_IN_CALIBRATION_RESEARCH_VERSION,
        projection_status: projection.status,
        projection_sha256: projection.productionProjection.projection_sha256,
        research_input_sha256: projection.productionProjection.research_input_sha256,
        projection_warnings: projection.warnings,
        required_protocol_roles: projection.requiredProtocolRoles,
        live_protocol_roles: liveProtocolRoles,
        missing_protocol_roles: missingProtocolRoles,
      },
      current_catalog_target: snapshot,
      validation: {
        state: "ready_for_handoff",
        blockers: [
          ...(REVIEW_BLOCKERS[target.slot] ?? []),
          ...(missingProtocolRoles.length > 0
            ? [
                `${missingProtocolRoles.join(", ")} protocol row(s) are authored but cannot be applied through this contract.`,
              ]
            : []),
        ],
        errors: [],
      },
      review: { state: "pending" },
      disposition: { state: "awaiting_review", may_enter_deliverable_b: false },
    }

    const validation = validateCatalogEnrichmentManifest(manifest, {
      id: target.product_id,
      fingerprint: targetFingerprint,
    })
    if (!validation.ok)
      throw new Error(`${target.product_key} failed validation: ${validation.errors.join("; ")}`)

    products.push(manifest)
  }

  const batch = {
    schema_version: CATALOG_ENRICHMENT_SCHEMA_VERSION,
    batch_id: LEAVE_IN_CALIBRATION_BATCH_ID,
    lifecycle_classification: "existing_product_enrichment",
    project_id: LEAVE_IN_CALIBRATION_PROJECT_ID,
    generated_at: generatedAt,
    generator:
      "scripts/product-intake/catalog-enrichment/leave-in-research-calibration-generate.ts",
    research: {
      adapter_version: LEAVE_IN_CALIBRATION_ADAPTER_VERSION,
      research_model_version: LEAVE_IN_CALIBRATION_RESEARCH_VERSION,
      projection_source: PROJECTIONS,
      packet_source: PACKET,
    },
    notes: [
      "The recommended-only projection REPLACES each product's eligibility set: every live row the projection no longer contains is planned as a delete, and deletes execute before the upserts for the same product.",
      "Protocol rows for Redken (pre_heat_protection) and Neqi (post_wash_leave_in + pre_heat_protection) are newly authored from the TPL-LEAVEIN-* templates and are carried in authored_protocols, not planned_operations — the shared contract rejects product_application_protocols upserts for leave_in. They need Nick's read and a routing decision.",
      "products.suitable_thicknesses changes for 8 of 9 products but the contract's update_product operation carries no payload; the value is carried in products_field_updates and flagged.",
      "Ordering is forced, not preferential: the deferred curated-publication trigger requires Redken's pre_heat_protection protocol (with a V2 pointer) to exist BEFORE this apply, or the whole transaction is rejected at COMMIT. The preflight fails closed on exactly that, and the Postgres harness proves it.",
      "The Stage-5 V2 artifact (data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json) gained the reviewed entry 2b7db7e3-...:pre_heat_protection:pre_heat_damp, because that lane's preflight enforces reverse coverage over every active curated protocol row. Neqi's rows would each need the same entry if they are ever unblocked.",
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
    deletes: products.reduce(
      (total, manifest) =>
        total +
        manifest.planned_operations
          .filter((operation) => operation.type === "delete")
          .reduce(
            (rows, operation) => rows + ((operation as { rows?: unknown[] }).rows?.length ?? 0),
            0,
          ),
      0,
    ),
  })
}

void main()
