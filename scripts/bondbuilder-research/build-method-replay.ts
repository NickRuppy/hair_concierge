/** Create-only preparation for the bounded v0.5 regression replay. No network or DB writes. */
import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { normalizeBondbuilderInci } from "../../src/lib/bondbuilder-research/production-adapter"
import {
  BOND_DEFAULT_POLICY,
  BOND_OWNER_REGISTRY,
  BOND_REFERENCE_KEYS,
} from "../../src/lib/bondbuilder-research/registry"

const ROOT = path.resolve(__dirname, "../..")
const DEFAULT_RUN = "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3"
const OWNER = "data/research/bondbuilder-inci/v1.0/owner-consolidation-2026-10-02"
const VALIDATION = "data/research/bondbuilder-inci/v1.0/validation-2026-10-02-v0.4"
const METHOD = "docs/research/bondbuilder-inci/v0.5"
const METHOD_FILES = [
  "standard.md",
  "runbook.md",
  "researcher-prompt.md",
  "blind-instructions.md",
] as const
const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex")
const encode = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
const readJson = <T>(file: string) => JSON.parse(readFileSync(path.join(ROOT, file), "utf8")) as T
const relative = (file: string) => path.relative(ROOT, file).split(path.sep).join("/")

type Owner = {
  profile: {
    identity: Record<string, unknown>
    formula: Record<string, unknown>
    application: { direction_source_ids?: string[] }
    sources: Array<Record<string, unknown>>
  }
}
type Validation = {
  records: Array<Record<string, unknown>>
  source_registry: Array<Record<string, unknown>>
}

function sourceId(source: Record<string, unknown>) {
  const id = source.id ?? source.source_id
  if (typeof id !== "string" || !id) throw new Error("Source lacks an ID")
  return id
}

function mergeSources(groups: Array<Array<Record<string, unknown>>>) {
  const sources = new Map<string, Record<string, unknown>>()
  for (const source of groups.flat()) {
    const id = sourceId(source)
    const prior = sources.get(id)
    if (prior && JSON.stringify(prior) !== JSON.stringify(source))
      throw new Error(`Source ID collision with differing capture: ${id}`)
    sources.set(id, source)
  }
  return [...sources.values()]
}

function prepareOwnerSources(owners: ReadonlyArray<readonly [string, Owner]>) {
  const entries = owners.flatMap(([slot_id, owner]) =>
    owner.profile.sources.map((source) => ({
      slot_id,
      source,
      id: sourceId(source),
      bytes: JSON.stringify(source),
    })),
  )
  const byId = new Map<string, typeof entries>()
  for (const entry of entries) byId.set(entry.id, [...(byId.get(entry.id) ?? []), entry])
  const references = new Map<string, Map<string, string>>()
  const captures: Array<Record<string, unknown>> = []
  for (const [id, matches] of byId) {
    const variants = new Map<string, typeof matches>()
    for (const match of matches)
      variants.set(match.bytes, [...(variants.get(match.bytes) ?? []), match])
    for (const variant of variants.values()) {
      const namespaced = variants.size > 1
      const outputId = namespaced ? `${variant[0].slot_id}:${id}` : id
      const capture = structuredClone(variant[0].source)
      capture.id = outputId
      if (namespaced)
        Object.assign(capture, { original_source_id: id, source_namespace: variant[0].slot_id })
      captures.push(capture)
      for (const match of variant) {
        let map = references.get(match.slot_id)
        if (!map) references.set(match.slot_id, (map = new Map()))
        map.set(id, outputId)
      }
    }
  }
  return { captures, references }
}

function remapIds(value: unknown, references: Map<string, string>) {
  return Array.isArray(value)
    ? value.map((id) => (typeof id === "string" ? (references.get(id) ?? id) : id))
    : value
}

function ownerNamedRecord(slot_id: string, owner: Owner, references: Map<string, string>) {
  const identity = owner.profile.identity
  const formula = owner.profile.formula
  return {
    slot_id,
    identity: {
      product_name: identity.product_name,
      brand: identity.brand,
      market: identity.market,
      size: identity.size,
      source_version: identity.source_version,
      gtin: identity.gtin,
      product_id: identity.product_id,
    },
    formula_source_ids: remapIds(formula.source_ids, references),
    direction_source_ids: remapIds(owner.profile.application.direction_source_ids, references),
    formula_conflicts: Array.isArray(formula.conflicts)
      ? formula.conflicts.map((conflict) =>
          conflict && typeof conflict === "object"
            ? {
                ...conflict,
                source_ids: remapIds((conflict as { source_ids?: unknown }).source_ids, references),
              }
            : conflict,
        )
      : formula.conflicts,
    source_preparation_note:
      "Current canonical owner identity/formula capture; no prior assessment or expected outcome is supplied.",
  }
}

function validationNamedRecord(record: Record<string, unknown>) {
  return {
    slot_id: record.slot_id,
    identity: record.identity,
    formula_source_id: record.formula_source_id,
    selected_direction_source_id: record.selected_direction_source_id,
    supporting_source_ids: record.supporting_source_ids,
    conflicts: record.conflicts,
    source_preparation_note:
      "Frozen source capture only; no prior assessment or expected outcome is supplied.",
  }
}

export function buildMethodReplay(runArgument?: string) {
  const run = path.resolve(ROOT, runArgument || DEFAULT_RUN)
  if (existsSync(run)) throw new Error(`Refusing existing run path: ${relative(run)}`)
  const owners = Array.from({ length: 8 }, (_, index) => {
    const key = `P${String(index + 1).padStart(2, "0")}`
    return [key, readJson<Owner>(`${OWNER}/${key}.json`)] as const
  })
  const anonymousValidation = readJson<{ records: Array<Record<string, unknown>> }>(
    `${VALIDATION}/anonymous.json`,
  )
  const namedValidation = readJson<Validation>(`${VALIDATION}/named-evidence.json`)
  const amendment = readJson<Record<string, unknown>>(`${VALIDATION}/source-amendment-01.json`)
  const amendmentSources = amendment.source_registry
  if (!Array.isArray(amendmentSources)) throw new Error("source-amendment-01 lacks source_registry")
  // Historical S13 includes a researcher verdict in its metadata, not producer
  // evidence. Preserve history but do not disclose that verdict in future packets.
  const sourceMetadataExclusions: Array<{
    source_id: string
    field: string
    value: string
    reason: string
  }> = []
  const preparedAmendmentSources = (amendmentSources as Array<Record<string, unknown>>).map(
    (source) => {
      if (source.source_id !== "S13" || !Array.isArray(source.limits)) return source
      return {
        ...source,
        limits: source.limits.filter((limit: unknown) => {
          if (typeof limit !== "string" || !limit.includes("category_review and trust null"))
            return true
          sourceMetadataExclusions.push({
            source_id: "S13",
            field: "limits",
            value: limit,
            reason: "Prior research verdict, not a producer observation.",
          })
          return false
        }),
      }
    },
  )
  const ownerSources = prepareOwnerSources(owners)

  const anonymousRows = [
    ...owners.map(([slot_id, owner]) => ({
      slot_id,
      raw_inci: owner.profile.formula.raw_inci,
      normalized_ingredients: owner.profile.formula.normalized_ingredients,
      formula_input_cautions: [
        "Canonical selected formula only; derive candidate markers in Stage A.",
        ...(Array.isArray(owner.profile.formula.conflicts) && owner.profile.formula.conflicts.length
          ? ["Differing source captures exist; do not merge them into this selected formula."]
          : []),
      ],
    })),
    ...anonymousValidation.records.map((row) => ({
      slot_id: row.slot_id,
      raw_inci: row.raw_inci,
      normalized_ingredients: normalizeBondbuilderInci(String(row.raw_inci)),
      formula_input_cautions: row.input_flags,
    })),
  ]
  if (anonymousRows.length !== 12 || new Set(anonymousRows.map((row) => row.slot_id)).size !== 12)
    throw new Error("Regression cohort must contain exactly twelve unique rows")

  const sources = mergeSources([
    ownerSources.captures,
    namedValidation.source_registry,
    preparedAmendmentSources,
  ])
  const anonymous = {
    packet_version: "bondbuilder-method-replay-anonymous-v0.5",
    purpose:
      "bounded regression replay; not an unseen holdout, method lock, efficacy claim, or activation",
    rows: anonymousRows,
  }
  const named = {
    packet_version: "bondbuilder-method-replay-named-v0.5",
    purpose:
      "source preparation for bounded regression replay; not prior assessment/property values or expected outcomes",
    source_preparation_provenance: {
      owner_envelopes: owners.map(([slot_id]) => `${OWNER}/${slot_id}.json`),
      validation_named_capture: `${VALIDATION}/named-evidence.json`,
      amendment: `${VALIDATION}/source-amendment-01.json`,
      amendment_included:
        "S13 correction is included as a separate source capture; original frozen validation files remain unchanged.",
      excluded_researcher_metadata: sourceMetadataExclusions,
    },
    records: [
      ...owners.map(([slot_id, owner]) =>
        ownerNamedRecord(slot_id, owner, ownerSources.references.get(slot_id) ?? new Map()),
      ),
      ...namedValidation.records.map(validationNamedRecord),
    ],
    source_registry: sources,
    policy_packet: {
      owner_registry: BOND_OWNER_REGISTRY.map((owner) => ({
        research_key: owner.research_key,
        product_name: owner.product_name,
        brand: owner.brand,
        market: owner.market,
        size: owner.size,
        source_version: owner.source_version,
        source_url: owner.source_url,
        raw_sha256: owner.raw_sha256,
        normalized_sha256: owner.normalized_sha256,
        technology_family: owner.technology_family,
        claim_trust_level: owner.claim_trust_level,
        trust_basis: owner.trust_basis,
        policy_reference: owner.policy_reference,
      })),
      default_policy: BOND_DEFAULT_POLICY,
      technology_reference_keys: BOND_REFERENCE_KEYS,
    },
  }

  mkdirSync(run, { recursive: false })
  mkdirSync(path.join(run, "method"))
  mkdirSync(path.join(run, "frozen-inputs"))
  for (const file of METHOD_FILES)
    cpSync(path.join(ROOT, METHOD, file), path.join(run, "method", file), { errorOnExist: true })
  const frozen = [
    "src/lib/bondbuilder-research/contracts.ts",
    "src/lib/bondbuilder-research/registry.ts",
    "src/lib/product-intake/bondbuilder-research-prompt-contract.ts",
    `${VALIDATION}/anonymous.json`,
    `${VALIDATION}/named-evidence.json`,
    `${VALIDATION}/source-amendment-01.json`,
    ...owners.map(([slot_id]) => `${OWNER}/${slot_id}.json`),
  ]
  for (const file of frozen) {
    const target = path.join(run, "frozen-inputs", file)
    mkdirSync(path.dirname(target), { recursive: true })
    cpSync(path.join(ROOT, file), target, { errorOnExist: true })
  }
  writeFileSync(path.join(run, "anonymous-packet.json"), encode(anonymous), { flag: "wx" })
  writeFileSync(path.join(run, "named-packet.json"), encode(named), { flag: "wx" })
  const lineage = [...METHOD_FILES.map((file) => `${METHOD}/${file}`), ...frozen]
  const frozenCopies = [
    ...METHOD_FILES.map((file) => `method/${file}`),
    ...frozen.map((file) => `frozen-inputs/${file}`),
  ]
  const manifest = {
    packet_version: "bondbuilder-method-replay-manifest-v0.5",
    prepared_date: "2026-10-03",
    purpose:
      "bounded regression replay only; not an unseen holdout, method lock, efficacy claim, catalog approval, or activation",
    source_lineage: Object.fromEntries(
      lineage.map((file) => [file, sha256(readFileSync(path.join(ROOT, file)))]),
    ),
    frozen_copies: Object.fromEntries(
      frozenCopies.map((file) => [file, sha256(readFileSync(path.join(run, file)))]),
    ),
    generated_files: Object.fromEntries(
      ["anonymous-packet.json", "named-packet.json"].map((file) => [
        file,
        sha256(readFileSync(path.join(run, file))),
      ]),
    ),
    row_count: anonymousRows.length,
    source_count: sources.length,
    lane_outputs:
      "Not prepared. Stage A and Stage B outputs and seals must be supplied by the two independent lanes before --complete can pass.",
  }
  writeFileSync(path.join(run, "manifest.json"), encode(manifest), { flag: "wx" })
  return { run: relative(run), rows: anonymousRows.length, sources: sources.length }
}

if (process.argv[1]?.endsWith("build-method-replay.ts")) {
  const index = process.argv.indexOf("--run")
  if (index !== -1 && !process.argv[index + 1]) throw new Error("--run requires a path")
  console.log(JSON.stringify(buildMethodReplay(index === -1 ? undefined : process.argv[index + 1])))
}
