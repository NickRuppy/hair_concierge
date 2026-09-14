import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"

const researchRoot = "plans/scan-db-expansion/research/shampoo-v14"
const pilotRoot = join(researchRoot, "pilot")
const manifestPaths = ["01", "02", "03", "04"].map(
  (batch) => `plans/scan-db-expansion/research/shampoo-manifest-${batch}.json`,
)

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function findOutputs(directory, outputs = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) findOutputs(path, outputs)
    else if (path.endsWith("adapter-artifacts-run-2/production-light.json")) outputs.push(path)
  }
  return outputs.sort()
}

const manifests = manifestPaths.map((path) => ({ path, manifest: readJson(path) }))
const products = manifests.flatMap(({ path, manifest }) =>
  manifest.products.map((product, index) => ({ path, manifest, product, index })),
)
const changedManifestPaths = new Set()

const receipt = {
  schema_version: "shampoo-approved-manifest-sync-v1",
  scope: "pilot + wave-01 + wave-02 only",
  products: [],
}

for (const outputPath of findOutputs(pilotRoot)) {
  const productDir = dirname(dirname(outputPath))
  const sourcePacketPath = join(productDir, "source-packet.json")
  const run1Path = join(productDir, "adapter-artifacts-run-1", "production-light.json")
  if (!existsSync(sourcePacketPath) || !existsSync(run1Path)) {
    throw new Error(`Incomplete approved package: ${productDir}`)
  }

  const sourcePacket = readJson(sourcePacketPath)
  const run1 = readJson(run1Path)
  const run2 = readJson(outputPath)
  if (run1.status !== "property_lane_ready" || run2.status !== "property_lane_ready") {
    throw new Error(`Adapter is not property_lane_ready: ${productDir}`)
  }
  if (JSON.stringify(run1.payload) !== JSON.stringify(run2.payload)) {
    throw new Error(`Adapter payloads are not deterministic: ${productDir}`)
  }

  const gtin = sourcePacket.identity?.gtin
  const matches = products.filter(({ product }) =>
    product.final.identifiers.some(
      (identifier) => identifier.type === "ean" && identifier.value === gtin,
    ),
  )
  if (matches.length !== 1) {
    throw new Error(`Expected one manifest match for GTIN ${gtin}, found ${matches.length}`)
  }

  const match = matches[0]
  const final = match.product.final
  changedManifestPaths.add(match.path)
  final.category_specs = run2.payload.category_specs
  final.thickness_eligibility = run2.payload.suitable_thicknesses

  for (const [field, rationale] of Object.entries(run2.payload.field_rationales)) {
    final.field_rationales[field] = rationale.rationale
  }

  const stampedRoles = new Set(
    final.protocols.map((protocol) =>
      protocol.template_id === "TPL-SHAMPOO-DANDRUFF" ? "shampoo_dandruff" : "shampoo_everyday",
    ),
  )
  for (const role of run2.payload.required_protocol_roles) {
    if (stampedRoles.has(role)) continue
    if (
      role === "shampoo_everyday" &&
      final.protocols.some((p) => p.template_id === "TPL-SHAMPOO-DANDRUFF")
    ) {
      const dandruffProtocol = final.protocols.find(
        (protocol) => protocol.template_id === "TPL-SHAMPOO-DANDRUFF",
      )
      final.protocols.push({
        template_id: "TPL-SHAMPOO-TARGETED",
        product_source: dandruffProtocol.product_source,
        deviation: null,
      })
      stampedRoles.add(role)
      continue
    }
    throw new Error(`No approved protocol mapping for ${gtin} role ${role}`)
  }

  let authorityEvidence = final.evidence.find(
    (evidence) => evidence.fact_key === "product.category_specs.authority_facts",
  )
  if (!authorityEvidence) {
    const formulaEvidence = final.evidence.find((evidence) =>
      ["product.formula.inci", "product.claims"].includes(evidence.fact_key),
    )
    if (!formulaEvidence?.source_text) {
      throw new Error(`Missing source-bound formula evidence for GTIN ${gtin}`)
    }
    authorityEvidence = {
      fact_key: "product.category_specs.authority_facts",
      fact_value: null,
      source_label: "Production Light projection from the selected exact formula",
      source_url: formulaEvidence.source_url,
      source_type: formulaEvidence.source_type,
      source_text: formulaEvidence.source_text,
      checked_at: formulaEvidence.checked_at,
    }
    final.evidence.push(authorityEvidence)
  }
  authorityEvidence.fact_value = {
    adapter_status: run2.status,
    production_light_product_id: sourcePacket.product_id,
    category_specs: run2.payload.category_specs,
    suitable_thicknesses: run2.payload.suitable_thicknesses,
    required_protocol_roles: run2.payload.required_protocol_roles,
  }

  receipt.products.push({
    gtin,
    product_id: sourcePacket.product_id,
    manifest: match.path,
    manifest_index: match.index,
    adapter_output: outputPath,
    adapter_output_sha256: sha256(outputPath),
    suitable_thicknesses: run2.payload.suitable_thicknesses,
    required_protocol_roles: run2.payload.required_protocol_roles,
    candidate_image_url: final.product.candidate_image.url,
    candidate_image_source_url: final.product.candidate_image.source_url,
  })
}

if (receipt.products.length !== 14) {
  throw new Error(`Expected 14 approved products, found ${receipt.products.length}`)
}

for (const { path, manifest } of manifests) {
  if (changedManifestPaths.has(path)) writeJson(path, manifest)
}
writeJson(join(researchRoot, "approved-manifest-sync-receipt.json"), receipt)
writeJson(
  join(researchRoot, "approved-image-inputs.json"),
  receipt.products.map((product) => ({
    id: product.product_id,
    source: product.candidate_image_url,
  })),
)

console.log(`Synchronized ${receipt.products.length} approved products.`)
for (const product of receipt.products) {
  console.log(
    `${product.gtin}\t${relative(researchRoot, product.adapter_output)}\t${product.manifest}`,
  )
}
