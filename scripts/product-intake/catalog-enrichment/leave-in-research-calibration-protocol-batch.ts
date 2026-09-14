import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { buildStage5ProtocolApplyBatch } from "@/lib/product-intake/catalog-enrichment/stage5-protocols"
import { parseArgs, flag, printJson } from "../cli"
import { LEAVE_IN_CALIBRATION_AUTHORED_PROTOCOLS } from "./leave-in-research-calibration-protocols"
import {
  loadProtocolResearchManifestFile,
  validateProtocolResearchManifest,
} from "./stage5-protocol-research"

/**
 * Emits the three authored Leave-In calibration protocol rows in the Stage-5
 * protocol-research shape, as a REVIEW ARTIFACT under plans/leave-in-apply/.
 *
 * It deliberately does NOT drop the file into the lane's own input directory,
 * because neither Stage-5 extension point accepts this batch as-is — verified
 * empirically, both ways:
 *
 *  - `data/catalog-enrichment/personal-plan-stage5-v1/protocol-research/` is
 *    baseline-pinned: `stage5-v2-generate.ts:246` compares the directory's exact
 *    file set + sha256 against `application-pointer-baseline-2026-08-12.json`
 *    and throws `application_pointer_baseline_source_fingerprint_mismatch`. A new
 *    file there breaks `npm run personal-plan:application-audit` (confirmed: the
 *    audit passes on a clean tree and fails with the file present).
 *  - `data/catalog-enrichment/personal-plan-stage5-v2/protocol-amendments/`
 *    requires a per-item `expected_disposition` that the preflight matches
 *    against a live `personal_plan_product_search_dispositions` row. Redken has
 *    no such row — that lane exists to supersede a parked product, not to add a
 *    protocol to a never-parked one.
 *
 * Re-baselining the artifact, or giving Redken a disposition row, are both
 * reviewed lane-wide operations that belong to Nick; changing the lane's code is
 * out of scope. See the runbook's step 4 for the decision and the options.
 *
 * The shape is still validated through the lane's own
 * `validateProtocolResearchManifest`, so whichever route Nick picks starts from a
 * manifest the lane already accepts. This script writes files only — it never
 * touches the database.
 */

export const LEAVE_IN_CALIBRATION_PROTOCOL_BATCH_ID = "S5-14-leave-in-calibration" as const

const MANIFEST_FILE = `plans/leave-in-apply/${LEAVE_IN_CALIBRATION_PROTOCOL_BATCH_ID}.json`
const REVIEW_FILE = "plans/leave-in-apply/stage5-protocol-batch.json"

const PRODUCT_NAMES: Record<string, string> = {
  "42a2fe20-bd7e-49a3-a880-8ae89015a5c9": "Neqi Diamond Glass Ultimate Styling Spray",
  "2b7db7e3-2058-4178-8a03-7d05f4a1d447": "Redken Extreme Anti-Snap",
}

/**
 * Neqi's catalog row is `origin = 'user_submitted'`, and the Stage-5 protocol
 * preflight refuses any product whose origin is not `curated`
 * (`product_origin_mismatch`). Rather than editing the lane or quietly dropping
 * the rows, they are carried in the lane's own `blocked_identity_or_commercial`
 * status: the manifest still names them, the apply batch excludes them, and the
 * reason is explicit. Their authored copy stays in the enrichment manifest's
 * `authored_protocols` and in the runbook. Unblocking is Nick's call — see the
 * runbook's step 2.
 *
 * Redken is `curated` and passes, which matters because its row is the hard
 * dependency of the enrichment apply (the deferred curated-publication trigger).
 */
const BLOCKED_PRODUCTS: Record<string, string> = {
  "42a2fe20-bd7e-49a3-a880-8ae89015a5c9":
    "Katalog-origin ist user_submitted; die Stage-5-Protokoll-Lane akzeptiert nur curated Produkte (product_origin_mismatch). Die ausformulierten Protokollzeilen liegen in plans/leave-in-apply/leave-in-research-enrichment-manifest.json unter authored_protocols.",
}

function researchManifest() {
  return {
    schema_version: "personal-plan-stage5-protocol-research-v1",
    batch_id: LEAVE_IN_CALIBRATION_PROTOCOL_BATCH_ID,
    category_key: "leave_in",
    products: LEAVE_IN_CALIBRATION_AUTHORED_PROTOCOLS.map(({ row }) => {
      const evidence = (
        row.guidance_payload as { evidence: Array<{ sourceUrl: string; checkedAt: string }> }
      ).evidence
      const blocked = BLOCKED_PRODUCTS[row.product_id]
      const sources = [
        {
          label: row.source_label,
          url: row.source_url,
          text: row.source_text,
          source_type: "manufacturer" as const,
          checked_at: evidence[0]!.checkedAt,
        },
      ]
      if (blocked) {
        return {
          product_id: row.product_id,
          product_name: PRODUCT_NAMES[row.product_id] ?? row.product_id,
          role: row.role,
          research_status: "blocked_identity_or_commercial" as const,
          sources,
          cadence: null,
          guidance_payload: null,
          blockers: [blocked],
        }
      }
      return {
        product_id: row.product_id,
        product_name: PRODUCT_NAMES[row.product_id] ?? row.product_id,
        role: row.role,
        research_status: "verified" as const,
        sources,
        cadence: null,
        // The V1 payload is what this lane writes; `guidance_payload_v2` is not a
        // column the Stage-5 protocol executor sets, so it is deliberately not
        // carried here (see the runbook's step 2b).
        guidance_payload: row.guidance_payload,
        blockers: [],
      }
    }),
  }
}

async function main() {
  const args = parseArgs()
  const lanePath = flag(args, "manifest-file") ?? MANIFEST_FILE
  const reviewPath = flag(args, "review-file") ?? REVIEW_FILE

  const manifest = validateProtocolResearchManifest(researchManifest())
  await writeFile(resolve(lanePath), `${JSON.stringify(manifest, null, 2)}\n`, "utf8")

  // Re-read through the lane's own loader so the emitted file is proven to be
  // exactly what `products:intake:stage5-protocol:preflight` would load once the
  // routing question in the runbook's step 4 is settled.
  const reloaded = await loadProtocolResearchManifestFile(resolve(lanePath))
  const built = buildStage5ProtocolApplyBatch(reloaded)
  await writeFile(
    resolve(reviewPath),
    `${JSON.stringify({ fingerprint: built.fingerprint, batch: built.batch }, null, 2)}\n`,
    "utf8",
  )

  printJson({
    mode: "generate",
    writes: false,
    batch_id: built.batch.batch_id,
    manifest_file: lanePath,
    review_file: reviewPath,
    protocols: built.batch.protocols.length,
    fingerprint: built.fingerprint,
    roles: built.batch.protocols.map((protocol) => `${protocol.product_id}:${protocol.role}`),
  })
}

void main()
