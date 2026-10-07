import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { createHash } from "node:crypto"
import { projectBondbuilderProtocol } from "@/lib/bondbuilder-research/protocol-projection"
import { validateBondbuilderResearchProfile } from "@/lib/bondbuilder-research/production-adapter"
import { canonicalJson } from "@/lib/product-intake/catalog-enrichment/stage5-v2-application"

// Build-only: exact reviewed direction overlay, no database lookup or write.
async function main() {
  const directory = resolve(
    "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06",
  )
  const amendment = JSON.parse(await readFile(resolve(directory, "ogx-amendment.json"), "utf8"))
  const baseline = JSON.parse(await readFile(resolve(directory, "ogx-baseline.json"), "utf8"))
  const profile = amendment.profile
  if (
    amendment.product_id !== "2c809d0d-fbce-435a-bbde-aa4270aaf48d" ||
    profile.identity.product_id !== amendment.product_id ||
    profile.identity.research_key !== "P06" ||
    baseline.products[0]?.id !== amendment.product_id ||
    baseline.products[0]?.bundle.spec.research_profile.review.profile_sha256 !==
      amendment.before_profile_sha256 ||
    profile.review.profile_sha256 !== amendment.after_profile_sha256
  )
    throw new Error("OGX reviewed amendment binding mismatch")
  const validation = validateBondbuilderResearchProfile(profile)
  if (!validation.success) throw new Error(validation.errors.join(","))
  const result = projectBondbuilderProtocol(profile, amendment.product_id)
  if (result.status !== "resolved") throw new Error(result.reasons.join(","))
  const source = profile.sources.find(
    (s: { id: string }) => s.id === profile.application.direction_source_ids[0],
  )
  if (source?.url !== amendment.source.url || source?.observation !== amendment.source.observation)
    throw new Error("OGX selected source mismatch")
  const packet = {
    researchKey: "P06",
    productId: amendment.product_id,
    profile,
    spec: {
      application_mode: "bedtime_leave_in",
      treatment_mode: "leave_in",
      usage_protocol: result.usageProtocol,
    },
    protocolV1: result.protocol,
    protocolV2: result.pointer,
    cadence: null,
    eligibleThicknesses: ["fine", "normal", "coarse"],
    source: { source_url: source.url, source_text: source.observation },
    removedProtocolHolds: amendment.removed_protocol_holds.map((h: { field: string }) => h.field),
  }
  const text = JSON.stringify(packet, null, 2) + "\n"
  const path = resolve(directory, "P06.json")
  let existing: string | undefined
  try {
    existing = await readFile(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  if (existing !== undefined && existing !== text)
    throw new Error("OGX frozen artifact differs; new revision required")
  if (existing === undefined) await writeFile(path, text, { flag: "wx" })
  console.log(
    JSON.stringify({
      artifact: "P06.json",
      artifact_sha256: createHash("sha256").update(canonicalJson(packet)).digest("hex"),
      profile_sha256: profile.review.profile_sha256,
    }),
  )
}
void main()
