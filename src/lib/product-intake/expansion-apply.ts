import { createHash } from "node:crypto"

import { catalogEnrichmentFingerprint } from "@/lib/product-intake/catalog-enrichment"
import {
  validateProductIntakeApprovalPayload,
  type ProductIntakeTargetSpecOperation,
} from "@/lib/product-intake/category-validators"
import {
  deriveRequiredProtocolRoles,
  validateExpansionManifest,
  type ExpansionCategoryKey,
  type ExpansionTemplateId,
} from "@/lib/product-intake/expansion-manifest"
import {
  buildExpansionProtocolRow,
  type ExpansionProtocolEvidence,
} from "@/lib/product-intake/expansion-apply-templates"

/**
 * Batch publication ADAPTER for the Scan DB Expansion pilot (T5 of
 * plans/2026-09-01-scan-db-expansion-pilot.md).
 *
 * F-02 — this module contains no storage writer. It turns a reviewed expansion
 * manifest into the exact inputs of the canonical publication boundary
 * (`validateProductIntakeApprovalPayload` on the TS side, then
 * `product_intake_approve_reviewed_product` inside
 * `apply_scan_expansion_batch_v1` on the DB side). Anything the boundary would
 * reject is parked here instead of being written (F-04).
 *
 * R3 — nothing in this module can request `is_chaarlie_recommended = true`; the
 * flag is never emitted, and the DB adapter rejects a batch that mentions it.
 */

// ---------------------------------------------------------------------------
// Operator supplement — the facts the manifest deliberately does not carry
// ---------------------------------------------------------------------------

/**
 * Per-product operator input. These are NOT research facts, which is why the T2
 * manifest contract does not carry them:
 *  - `image_url` is produced by the T4b image pipeline (finalized own-bucket asset).
 *  - `affiliate_link` / `purchase_link_status` / `checked_at` come from the
 *    purchase-link check that runs immediately before an apply.
 *  - `evidence_source_texts` is the last-resort fallback in
 *    `resolveEvidenceSourceText` below, for manifests written before
 *    `evidence[].source_text` existed in the T2 contract.
 */
export type ExpansionApplySupplementEntry = {
  image_url: string
  affiliate_link: string
  purchase_link_status: "available" | "unavailable"
  checked_at: string
  price_eur?: number
  /** Keyed `"<fact_key>|<source_url>"` → the quoted source text for that evidence row. */
  evidence_source_texts?: Record<string, string>
  /** TPL-MASK with a non-integer contact time: the reviewed German wait-step copy. */
  mask_wait_copy_de?: string
}

export type ExpansionApplySupplement = {
  batch_id: string
  operator_profile_id: string
  reviewed_head: string
  products: Record<string, ExpansionApplySupplementEntry>
}

/**
 * The quoted text for one evidence row, in descending order of authority:
 *
 *  1. the manifest's own `evidence[].source_text` — the researcher read this
 *     exact source for this exact fact, so nothing downstream may override it;
 *  2. a protocol source on the same URL — the same page, quoted by the same
 *     research pass for the protocol;
 *  3. the operator supplement — a manual fill-in for pre-`source_text` manifests.
 *
 * `undefined` means no quote exists anywhere and the product must be parked:
 * `personal_plan_catalog_fact_evidence.source_text` is NOT NULL and a quote is
 * never invented here.
 */
export function resolveEvidenceSourceText(input: {
  manifestSourceText?: string
  protocolSourceText?: string
  operatorSourceText?: string
}): string | undefined {
  return input.manifestSourceText ?? input.protocolSourceText ?? input.operatorSourceText
}

// ---------------------------------------------------------------------------
// Output contract
// ---------------------------------------------------------------------------

export type ExpansionApplyItem = {
  item_key: string
  kind: "new_product"
  content_fingerprint: string
  category_key: ExpansionCategoryKey
  identifiers: Array<{ type: "ean"; value: string; source_url: string }>
  final_payload: Record<string, unknown>
  spec_operations: ProductIntakeTargetSpecOperation[]
  product_updates: {
    suitable_thicknesses: string[]
    suitable_concerns: string[]
    description?: string
  }
  evidence: Array<{
    fact_key: string
    fact_value: unknown
    source_label: string
    source_url: string
    source_text: string
    source_type: string
    checked_at: string
  }>
}

export type ExpansionApplyExistingItem = {
  item_key: string
  kind: "existing_product_update"
  content_fingerprint: string
  product_id: string
  expected_product: {
    name: string
    brand: string | null
    category_key: string
    is_active: boolean
    lifecycle_status: string
    is_chaarlie_recommended: boolean
  }
  rename?: { from: string; to: string; reason: string }
  identifiers: Array<{ type: "ean"; value: string; source_url: string }>
}

export type ExpansionApplyBatch = {
  schema_version: "scan-db-expansion-batch-v1"
  batch_id: string
  operator_profile_id: string
  items: Array<ExpansionApplyItem | ExpansionApplyExistingItem>
}

export type ExpansionParkedProduct = {
  index: number
  label: string
  item_key: string | null
  gaps: string[]
}

export type ExpansionApplyBuildResult = {
  batch: ExpansionApplyBatch
  /** Raw UTF-8 JSON exactly as it must be handed to the RPC (fingerprinted byte-for-byte). */
  batchJson: string
  batchFingerprint: string
  parked: ExpansionParkedProduct[]
  /** Structural strict-readiness prediction per applied item (F-04). */
  readinessPrediction: Array<{
    item_key: string
    label: string
    predicted: "scan_result_ready" | "blocked"
    blockers: string[]
  }>
}

export type ExpansionApplyBuildInput = {
  manifest: unknown
  supplement: ExpansionApplySupplement
  /**
   * Product identity snapshot used for the duplicate/identity guards, either read
   * live (read-only) or supplied from a snapshot file.
   */
  existingProducts?: Array<{
    id: string
    name: string
    brand: string | null
    category_key: string | null
    is_active: boolean
    lifecycle_status: string | null
    is_chaarlie_recommended: boolean
  }>
  existingIdentifiers?: Array<{ product_id: string; canonical_gtin14: string | null }>
  dispositionProductIds?: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mirrors the boundary's own check in 20260815074148_product_image_thumbnails.sql. */
const CHAARLIE_PRODUCT_IMAGE_PREFIX_PATTERN =
  /^https:\/\/pqdkhefxsxkyeqelqegq\.supabase\.co\/storage\/v1\/object\/public\/product-images\/.+/

export function expansionItemKey(brand: string, name: string): string {
  const slug = `${brand} ${name}`
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug.length > 60 ? slug.slice(0, 60).replace(/-+$/, "") : slug
}

/** Canonical GTIN-14 for the batch-local duplicate/ownership guards. */
export function canonicalGtin14(value: string): string | null {
  const digits = value.replace(/\D/g, "")
  if (![8, 12, 13, 14].includes(digits.length)) return null
  const padded = digits.padStart(14, "0")
  const body = padded.slice(0, 13)
  const check = Number(padded[13])
  const sum = body
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check ? padded : null
}

function normalizeIdentity(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
}

function mapEvidenceSourceType(
  value: string,
): "manufacturer" | "retailer" | "professional_authority" {
  return value === "manufacturer" || value === "professional_authority" ? value : "retailer"
}

function waitCopyForSeconds(seconds: number): string | null {
  if (!Number.isInteger(seconds) || seconds <= 0 || seconds % 60 !== 0) return null
  const minutes = seconds / 60
  return minutes === 1 ? "1 Minute einwirken lassen." : `${minutes} Minuten einwirken lassen.`
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/**
 * Turns a reviewed manifest + operator supplement into the exact RPC batch.
 * Every product that cannot be published completely is parked, never trimmed.
 */
export function buildExpansionApplyBatch(
  input: ExpansionApplyBuildInput,
): ExpansionApplyBuildResult {
  const validation = validateExpansionManifest(input.manifest)
  const manifest = input.manifest as {
    batch_id?: string
    generated_at?: string
    products?: Array<Record<string, unknown>>
    existing_product_updates?: Array<Record<string, unknown>>
  }

  const parked: ExpansionParkedProduct[] = []
  const items: Array<ExpansionApplyItem | ExpansionApplyExistingItem> = []
  const readinessPrediction: ExpansionApplyBuildResult["readinessPrediction"] = []
  const seenGtins = new Map<string, string>()
  const seenItemKeys = new Set<string>()

  const identifierOwners = new Map<string, string>()
  for (const row of input.existingIdentifiers ?? []) {
    if (row.canonical_gtin14) identifierOwners.set(row.canonical_gtin14, row.product_id)
  }
  const existingIdentities = new Set(
    (input.existingProducts ?? [])
      .filter((product) => product.is_active)
      .map((product) => `${product.category_key ?? ""}|${normalizeIdentity(product.name)}`),
  )
  const dispositions = new Set(input.dispositionProductIds ?? [])

  ;(manifest.products ?? []).forEach((rawProduct, index) => {
    const report = validation.products[index]
    const label = report?.label ?? `products[${index}]`
    const gaps: string[] = []

    if (!report || report.status === "fail") {
      parked.push({
        index,
        label,
        item_key: null,
        gaps: [`manifest_validation_failed: ${report?.violations.join("; ") ?? "unknown"}`],
      })
      return
    }

    const final = (rawProduct as { final: Record<string, unknown> }).final
    const product = final.product as {
      name: string
      brand: string
      category_key: ExpansionCategoryKey
      price_eur?: number
      net_content_value?: number
      net_content_unit?: string
      description?: string
    }
    const itemKey = expansionItemKey(product.brand, product.name)
    if (seenItemKeys.has(itemKey)) gaps.push(`duplicate_item_key: ${itemKey}`)
    seenItemKeys.add(itemKey)

    const supplement = input.supplement.products[itemKey]
    if (!supplement) {
      parked.push({
        index,
        label,
        item_key: itemKey,
        gaps: ["missing_operator_supplement (finalized image, purchase link, checked_at)"],
      })
      return
    }
    // The publication boundary only accepts an own-bucket canonical image
    // (20260815074148_product_image_thumbnails.sql), so "finalized image" is
    // enforceable rather than advisory: no T4b asset, no apply.
    if (!CHAARLIE_PRODUCT_IMAGE_PREFIX_PATTERN.test(supplement.image_url)) {
      gaps.push("missing_finalized_image (image_url is not a Chaarlie product-images asset)")
    }

    // Identity guards (F-09 / duplicate detection).
    const identityKey = `${product.category_key}|${normalizeIdentity(`${product.brand} ${product.name}`)}`
    if (existingIdentities.has(identityKey)) {
      gaps.push("identity_collision: an active product with this brand+name already exists")
    }

    const identifiers: ExpansionApplyItem["identifiers"] = []
    for (const identifier of (final.identifiers ?? []) as Array<{
      type: "ean"
      value: string
      source_urls: string[]
      excluded_from_apply?: boolean
      cross_source_agreement: boolean
    }>) {
      if (identifier.excluded_from_apply === true || identifier.cross_source_agreement === false) {
        continue
      }
      const canonical = canonicalGtin14(identifier.value)
      if (!canonical) {
        gaps.push(`invalid_gtin: ${identifier.value}`)
        continue
      }
      const duplicateOwner = seenGtins.get(canonical)
      if (duplicateOwner) {
        gaps.push(`duplicate_canonical_gtin_in_batch: ${canonical} (also ${duplicateOwner})`)
        continue
      }
      const liveOwner = identifierOwners.get(canonical)
      if (liveOwner) {
        gaps.push(`canonical_gtin_already_owned: ${canonical} → product ${liveOwner}`)
        continue
      }
      seenGtins.set(canonical, itemKey)
      identifiers.push({
        type: "ean",
        value: identifier.value,
        source_url: identifier.source_urls[0]!,
      })
    }
    if (identifiers.length === 0) gaps.push("no_applicable_identifier")

    // Stamp the reviewed protocol templates with this product's own sources.
    const protocolRows: Array<Record<string, unknown>> = []
    const manifestProtocols = (final.protocols ?? []) as Array<{
      template_id: ExpansionTemplateId
      product_source: { label: string; url: string; text: string }
      deviation: { reason: string; packaging_text: string } | null
      contact_time?: { seconds: number | null; source_text: string }
      usable_on_dry_hair?: boolean
    }>
    const checkedAt = supplement.checked_at.slice(0, 10)
    for (const manifestProtocol of manifestProtocols) {
      if (manifestProtocol.deviation) {
        gaps.push(
          `deviation_requires_review: ${manifestProtocol.template_id} — ${manifestProtocol.deviation.reason.slice(0, 120)}`,
        )
        continue
      }
      const evidence: ExpansionProtocolEvidence[] = [
        {
          sourceUrl: manifestProtocol.product_source.url,
          sourceType: /manufacturer/i.test(manifestProtocol.product_source.label)
            ? "manufacturer"
            : "retailer",
          checkedAt,
        },
      ]
      let waitCopyDe = supplement.mask_wait_copy_de
      const contactTimeSeconds = manifestProtocol.contact_time?.seconds ?? null
      if (manifestProtocol.template_id === "TPL-MASK" && !waitCopyDe) {
        waitCopyDe =
          contactTimeSeconds === null
            ? undefined
            : (waitCopyForSeconds(contactTimeSeconds) ?? undefined)
      }
      try {
        const row = buildExpansionProtocolRow(manifestProtocol.template_id, {
          productId: "__PRODUCT_ID__",
          evidence,
          contactTimeSeconds,
          waitCopyDe,
          usableOnDryHair: manifestProtocol.usable_on_dry_hair,
        })
        protocolRows.push({
          ...row,
          source_label: manifestProtocol.product_source.label,
          source_url: manifestProtocol.product_source.url,
          source_text: manifestProtocol.product_source.text,
        })
      } catch (error) {
        gaps.push(
          `protocol_stamp_failed: ${manifestProtocol.template_id} — ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }

    const categorySpecs = { ...(final.category_specs as Record<string, unknown>) }
    const requiredRoles = deriveRequiredProtocolRoles(product.category_key, categorySpecs)
    const stampedRoles = new Set(protocolRows.map((row) => String(row.role)))
    for (const role of requiredRoles) {
      if (!stampedRoles.has(role)) gaps.push(`missing_protocol_for_derived_role: ${role}`)
    }

    // Evidence rows: `source_text` is NOT NULL in the DB. The manifest's own
    // quote wins; a protocol source on the same URL and the operator supplement
    // are fallbacks for manifests written before the field existed. Never
    // invent one — a row with no quote anywhere parks the product.
    const evidenceRows: ExpansionApplyItem["evidence"] = []
    for (const evidence of (final.evidence ?? []) as Array<{
      fact_key: string
      fact_value: unknown
      source_label: string
      source_url: string
      source_type: string
      source_text?: string
      checked_at: string
    }>) {
      const sourceText = resolveEvidenceSourceText({
        manifestSourceText: evidence.source_text,
        protocolSourceText: manifestProtocols.find(
          (protocol) => protocol.product_source.url === evidence.source_url,
        )?.product_source.text,
        operatorSourceText:
          supplement.evidence_source_texts?.[`${evidence.fact_key}|${evidence.source_url}`],
      })
      if (!sourceText) {
        gaps.push(`evidence_source_text_missing: ${evidence.fact_key} @ ${evidence.source_url}`)
        continue
      }
      evidenceRows.push({
        fact_key: evidence.fact_key,
        fact_value: evidence.fact_value,
        source_label: evidence.source_label,
        source_url: evidence.source_url,
        source_text: sourceText,
        source_type: mapEvidenceSourceType(evidence.source_type),
        checked_at: evidence.checked_at,
      })
    }
    if (evidenceRows.length === 0) gaps.push("no_publishable_fact_evidence")

    // Build the canonical boundary payload and run the SAME validator the live
    // review app runs. Anything it rejects is parked, never sent.
    const finalPayload = {
      product: {
        canonical_brand: product.brand,
        product_line: null,
        clean_name: product.name,
        category_key: product.category_key,
        suitable_thicknesses: final.thickness_eligibility as string[],
        affiliate_link: supplement.affiliate_link,
        image_url: supplement.image_url,
        price_eur: supplement.price_eur ?? product.price_eur ?? 0,
        currency: "EUR" as const,
        purchase_link_status: supplement.purchase_link_status,
        purchase_link_checked_at: supplement.checked_at,
        price_checked_at: supplement.checked_at,
        ...(product.net_content_value != null
          ? {
              net_content_value: product.net_content_value,
              net_content_unit: product.net_content_unit,
            }
          : {}),
      },
      identifiers: identifiers.map((identifier) => ({
        type: identifier.type,
        value: identifier.value,
        source: "scan-db-expansion",
      })),
      category_specs: { ...categorySpecs, product_application_protocols: protocolRows },
      sources: manifestProtocols.map((protocol) => ({
        url: protocol.product_source.url,
        title: protocol.product_source.label,
        evidence: protocol.product_source.text,
      })),
      field_rationales: buildFieldRationales(
        final.field_rationales as Record<string, string>,
        categorySpecs,
      ),
      review: {
        manual_reviewed: true as const,
        reviewed_by: "nick",
        reviewed_at: supplement.checked_at,
      },
    }

    const approval = validateProductIntakeApprovalPayload({ final: finalPayload })
    if (!approval.ok) {
      gaps.push(`publication_boundary_rejected: ${approval.missingFields.join("; ")}`)
    }
    if (gaps.length > 0 || !approval.ok) {
      parked.push({ index, label, item_key: itemKey, gaps })
      return
    }

    const item: ExpansionApplyItem = {
      item_key: itemKey,
      kind: "new_product",
      content_fingerprint: "",
      category_key: product.category_key,
      identifiers,
      final_payload: approval.normalizedPayload.final as unknown as Record<string, unknown>,
      spec_operations: approval.targetSpecOperations,
      product_updates: {
        suitable_thicknesses: final.thickness_eligibility as string[],
        suitable_concerns: final.concern_eligibility as string[],
        ...(product.description ? { description: product.description } : {}),
      },
      evidence: evidenceRows,
    }
    item.content_fingerprint = catalogEnrichmentFingerprint({
      ...item,
      content_fingerprint: undefined,
    })
    items.push(item)

    readinessPrediction.push({
      item_key: itemKey,
      label,
      predicted: "scan_result_ready",
      blockers: [],
    })
  })
  ;(manifest.existing_product_updates ?? []).forEach((rawUpdate, index) => {
    const report = validation.existingProductUpdates[index]
    const label = report?.label ?? `existing_product_updates[${index}]`
    if (!report || report.status === "fail") {
      parked.push({
        index,
        label,
        item_key: null,
        gaps: [`manifest_validation_failed: ${report?.violations.join("; ") ?? "unknown"}`],
      })
      return
    }
    const update = rawUpdate as {
      product_id: string
      rename?: { from: string; to: string; reason: string }
      add_identifiers?: Array<{
        type: "ean"
        value: string
        source_urls: string[]
        excluded_from_apply?: boolean
        cross_source_agreement: boolean
      }>
    }
    const live = (input.existingProducts ?? []).find(
      (candidate) => candidate.id === update.product_id,
    )
    const gaps: string[] = []
    if (!live) gaps.push("existing_product_not_found_in_snapshot")
    if (live && update.rename && live.name !== update.rename.from) {
      gaps.push(`rename_precondition_failed: live name is "${live.name}"`)
    }
    // A product carrying a live search disposition has been taken OUT of the
    // Personal-Plan search on purpose (quarantine, wrong category, ambiguous
    // identity). Renaming it or attaching a barcode to it is a catalog-authority
    // change on a quarantined row, so it is parked for Nick rather than applied.
    // The executor refuses it independently; this is the readable half.
    if (dispositions.has(update.product_id)) {
      gaps.push(`existing_product_has_disposition: ${update.product_id}`)
    }

    const identifiers: ExpansionApplyExistingItem["identifiers"] = []
    for (const identifier of update.add_identifiers ?? []) {
      if (identifier.excluded_from_apply === true || identifier.cross_source_agreement === false) {
        continue
      }
      const canonical = canonicalGtin14(identifier.value)
      if (!canonical) {
        gaps.push(`invalid_gtin: ${identifier.value}`)
        continue
      }
      const liveOwner = identifierOwners.get(canonical)
      if (liveOwner && liveOwner !== update.product_id) {
        gaps.push(`canonical_gtin_already_owned: ${canonical} → product ${liveOwner}`)
        continue
      }
      const duplicateOwner = seenGtins.get(canonical)
      if (duplicateOwner) {
        gaps.push(`duplicate_canonical_gtin_in_batch: ${canonical} (also ${duplicateOwner})`)
        continue
      }
      seenGtins.set(canonical, `existing:${update.product_id}`)
      identifiers.push({
        type: "ean",
        value: identifier.value,
        source_url: identifier.source_urls[0]!,
      })
    }

    const itemKey = `existing:${update.product_id}`
    if (gaps.length > 0 || !live) {
      parked.push({ index, label, item_key: itemKey, gaps })
      return
    }

    const item: ExpansionApplyExistingItem = {
      item_key: itemKey,
      kind: "existing_product_update",
      content_fingerprint: "",
      product_id: update.product_id,
      expected_product: {
        name: live.name,
        brand: live.brand,
        category_key: live.category_key ?? "",
        is_active: live.is_active,
        lifecycle_status: live.lifecycle_status ?? "",
        is_chaarlie_recommended: live.is_chaarlie_recommended,
      },
      ...(update.rename ? { rename: update.rename } : {}),
      identifiers,
    }
    item.content_fingerprint = catalogEnrichmentFingerprint({
      ...item,
      content_fingerprint: undefined,
    })
    items.push(item)
  })

  const batch: ExpansionApplyBatch = {
    schema_version: "scan-db-expansion-batch-v1",
    batch_id: input.supplement.batch_id,
    operator_profile_id: input.supplement.operator_profile_id,
    items,
  }
  const batchJson = JSON.stringify(batch)
  return {
    batch,
    batchJson,
    batchFingerprint: createHash("sha256").update(batchJson, "utf8").digest("hex"),
    parked,
    readinessPrediction,
  }
}

/**
 * The boundary requires a rationale for every reviewed product field and for
 * every `category_specs` table. The manifest carries research rationales keyed by
 * dotted spec paths; operator-supplied fields cite their own provenance rather
 * than borrowing a research rationale.
 */
function buildFieldRationales(
  manifestRationales: Record<string, string>,
  categorySpecs: Record<string, unknown>,
): Record<string, string> {
  const rationales: Record<string, string> = { ...manifestRationales }
  rationales["product.canonical_brand"] =
    manifestRationales["product.name"] ?? "Markenname laut Herstellerseite/Handelsseite."
  rationales["product.clean_name"] =
    manifestRationales["product.name"] ?? "Produktname laut Herstellerseite/Handelsseite."
  rationales["product.category_key"] =
    manifestRationales["product.category_key"] ?? "Kategorie laut Produktart und Anwendungshinweis."
  rationales["product.affiliate_link"] =
    "Händler-Produktseite aus dem Purchase-Link-Check vor dem Apply."
  rationales["product.image_url"] = "Finalisiertes Chaarlie-Packshot aus der Bildpipeline (T4b)."
  rationales["product.price_eur"] =
    manifestRationales["product.price_eur"] ?? "Preis laut Händler-Produktseite zum Prüfzeitpunkt."
  rationales["product.purchase_link_status"] =
    "Verfügbarkeit laut Purchase-Link-Check vor dem Apply."
  for (const key of Object.keys(categorySpecs)) {
    if (!rationales[`category_specs.${key}`]) {
      const nested = Object.entries(manifestRationales)
        .filter(([rationaleKey]) => rationaleKey.startsWith(`category_specs.${key}.`))
        .map(([rationaleKey, value]) => `${rationaleKey.split(".").pop()}: ${value}`)
      rationales[`category_specs.${key}`] =
        nested.length > 0 ? nested.join(" | ") : "Aus den geprüften Kategoriefakten des Manifests."
    }
  }
  rationales["category_specs.product_application_protocols"] =
    "Gestempelte, von Nick freigegebene Protokoll-Templates (T3) mit produkteigener Quelle (F-06)."
  return rationales
}
