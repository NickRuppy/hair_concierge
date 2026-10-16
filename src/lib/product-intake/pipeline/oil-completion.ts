import { createHash, randomUUID } from "node:crypto"
import {
  oilReviewFingerprint,
  stableOilReviewJson,
  type JsonRecord,
} from "@chaarlie/product-intake-core"
import { resolveOilStorage } from "@/lib/oil-research/storage"
import {
  assertOilFinalProductIdentity,
  OIL_RESEARCH_UUID_PATTERN,
} from "@/lib/product-intake/oil-research-adapter"
import { normalizeRecord } from "./shared"

type CompletionArtifact = { kind: string; status?: string; payload: JsonRecord }
// Only this server-owned map can allocate IDs; JSON/model fields are never read.
// Reusing the same prepared output keeps exact-completion retries idempotent.
const issuedIds = new WeakMap<object, string>()
function idFor(artifact: object): string {
  let id = issuedIds.get(artifact)
  if (!id) {
    id = randomUUID()
    issuedIds.set(artifact, id)
  }
  return id
}

/** Bind Oil pointers before the atomic RPC inserts the exact allocated IDs. */
export function prepareOilResearchCompletion(input: {
  job: { id: string; submission_id: string }
  researchedPayload?: JsonRecord | null
  artifacts: CompletionArtifact[]
}): Map<CompletionArtifact, string> {
  const current = input.artifacts.filter(
    (a) => a.kind === "property_synthesis" && a.payload.oil_storage_version != null,
  )
  if (current.length > 1)
    throw new Error("Exactly one current oil research artifact may be persisted per run")
  const oil = current[0]
  const ids = new Map<CompletionArtifact, string>()
  if (!oil) return ids
  const envelope = resolveOilStorage(oil.payload, { requireCurrent: true })
  const context = normalizeRecord(oil.payload.oil_admission_context)
  const identities = input.artifacts.filter(
    (a) =>
      a.kind === "identity_candidate" && a.status === "resolved" && a.payload.stage === "identity",
  )
  const contextJson = oil.payload.oil_admission_context_json
  if (
    envelope.submission_id !== input.job.submission_id ||
    !context ||
    context.submission_id !== input.job.submission_id ||
    context.job_id !== input.job.id ||
    !OIL_RESEARCH_UUID_PATTERN.test(input.job.id) ||
    !OIL_RESEARCH_UUID_PATTERN.test(String(context.run_id)) ||
    identities.length !== 1 ||
    typeof contextJson !== "string" ||
    contextJson !== stableOilReviewJson(context) ||
    createHash("sha256").update(contextJson, "utf8").digest("hex") !==
      oil.payload.oil_admission_context_sha256 ||
    oilReviewFingerprint(context.resolved_identity_artifact) !==
      oilReviewFingerprint(identities[0]!.payload)
  ) {
    throw new Error("Oil persistence requires the exact current job and resolved identity receipt")
  }
  const final = normalizeRecord(input.researchedPayload?.final)
  const product = normalizeRecord(final?.product)
  if (!product) throw new Error("Oil final product identity is required at persistence")
  assertOilFinalProductIdentity(product, envelope.identity)
  const identity = Object.fromEntries(
    ["canonical_brand", "product_line", "clean_name", "net_content_value", "net_content_unit"].map(
      (key) => [key, product[key] ?? null],
    ),
  )
  if (oilReviewFingerprint(identity) !== oilReviewFingerprint(context.final_product_identity))
    throw new Error("Oil final product identity changed after admission")
  const draft = normalizeRecord(input.researchedPayload?.draft)
  if (!draft) throw new Error("Current oil research requires a persisted draft")
  const identityId = idFor(identities[0]!)
  const oilId = idFor(oil)
  ids.set(identities[0]!, identityId)
  ids.set(oil, oilId)
  context.resolved_identity_artifact_id = identityId
  const bytes = stableOilReviewJson(context)
  oil.payload.oil_admission_context_json = bytes
  oil.payload.oil_admission_context_sha256 = createHash("sha256")
    .update(bytes, "utf8")
    .digest("hex")
  const engine = normalizeRecord(oil.payload.engine)
  if (engine) engine.input_hash = oil.payload.oil_admission_context_sha256
  draft.oil_research_binding = {
    artifact_id: oilId,
    job_id: input.job.id,
    run_id: context.run_id,
    envelope_sha256: oil.payload.oil_research_envelope_sha256,
    method: envelope.research_method,
    raw_sha256: envelope.formula.raw_sha256,
    normalized_sha256: envelope.formula.normalized_sha256,
    admission_context_sha256: oil.payload.oil_admission_context_sha256,
  }
  return ids
}
