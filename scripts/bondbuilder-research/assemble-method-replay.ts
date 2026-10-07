/** Create-only assembly of sealed Stage A observations and Stage B research cores. */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import {
  bondbuilderResearchEnvelopeSchema,
  type BondbuilderResearchProfile,
} from "../../src/lib/bondbuilder-research/contracts"
import { bondbuilderProfileSha256 } from "../../src/lib/bondbuilder-research/production-adapter"
import {
  BOND_CURRENT_METHOD_PINS,
  BOND_OWNER_REGISTRY,
} from "../../src/lib/bondbuilder-research/registry"

const ROOT = path.resolve(__dirname, "../..")
const DEFAULT_RUN = "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3"
const CORE_KEYS = [
  "assessment",
  "technology_reference",
  "application",
  "evidence",
  "explanations_de",
  "fit",
  "holds",
] as const
const SLOT = /^(P0[1-8]|V0[1-4])$/
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const read = <T>(file: string) => JSON.parse(readFileSync(file, "utf8")) as T
const encode = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
type Receipt = { path: string; sha256: string }
type StageARecord = {
  slot_id: string
  observed_ingredients: string[]
  candidate_families: Array<BondbuilderResearchProfile["formula"]["candidate_families"][number]>
  formula_state: BondbuilderResearchProfile["formula"]["status"]
}
type NamedRecord = {
  slot_id: string
  identity: Record<string, unknown>
  formula_source_ids?: string[]
  direction_source_ids?: string[]
  formula_source_id?: string
  selected_direction_source_id?: string
  supporting_source_ids?: string[]
  formula_conflicts?: BondbuilderResearchProfile["formula"]["conflicts"]
  conflicts?: string[]
}
type StageBRecord = {
  slot_id: string
  source_facts: Pick<BondbuilderResearchProfile, (typeof CORE_KEYS)[number]>
  source_ids: string[]
  conflicts: unknown[]
  unknowns: string[]
  limitations: string[]
  identity_status: "resolved" | "unresolved"
  candidate_to_final_trace: string[]
}
type StageB = {
  stage: "B"
  lane_id: "lane-a" | "lane-b"
  input_receipt: Receipt[]
  stage_a_seal: Receipt
  source_registry: Array<Record<string, unknown>>
  records: StageBRecord[]
}

function fail(message: string): never {
  throw new Error(`Method assembly refused: ${message}`)
}
function receiptMatches(run: string, receipt: Receipt, requiredPath: string) {
  if (
    receipt.path !== requiredPath ||
    receipt.sha256 !== hash(readFileSync(path.join(run, requiredPath)))
  )
    fail(`invalid receipt for ${requiredPath}`)
}
function verifySeal(run: string, lane: string, stage: "A" | "B") {
  const output = `stage-${stage.toLowerCase()}.json`
  const sealPath = path.join(run, lane, `stage-${stage.toLowerCase()}-seal.json`)
  if (!existsSync(sealPath) || !existsSync(path.join(run, lane, output)))
    fail(`missing ${stage} seal: ${lane}`)
  const seal = read<{ lane_id: string; stage: string; sha256: Record<string, string> }>(sealPath)
  if (seal.lane_id !== lane || seal.stage !== stage) fail(`invalid ${stage} seal: ${lane}`)
  if (seal.sha256[output] !== hash(readFileSync(path.join(run, lane, output))))
    fail(`${stage} seal digest mismatch: ${lane}/${output}`)
}
function sourceIds(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (!value || typeof value !== "object") return found
  for (const [key, child] of Object.entries(value)) {
    if (key.endsWith("source_ids") && Array.isArray(child))
      for (const id of child) if (typeof id === "string") found.add(id)
    sourceIds(child, found)
  }
  return found
}
function exactKeys(value: unknown, keys: readonly string[], label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`invalid ${label}`)
  const actual = Object.keys(value as Record<string, unknown>)
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key)))
    fail(`unexpected ${label} fields`)
}
function bindSources(
  sources: Array<Record<string, unknown>>,
  namedSources: Array<Record<string, unknown>>,
) {
  const legacyAuthority: Record<
    string,
    BondbuilderResearchProfile["sources"][number]["authority"]
  > = {
    local_manufacturer: "manufacturer",
    manufacturer_editorial: "manufacturer",
    manufacturer_professional_document: "manufacturer",
    brand_owner_retailer: "retailer",
    supplier_document: "supplier",
    supplier_statement: "supplier",
    original_creator_statement: "creator",
    user_anecdotes: "other",
  }
  const legacyScope: Record<string, BondbuilderResearchProfile["sources"][number]["scope"]> = {
    S01: "product",
    S02: "product",
    S03: "product",
    S04: "product",
    S05: "product",
    S06: "product",
    S13: "product",
    S07: "technology",
    S08: "technology",
    S09: "practice",
    S10: "practice",
    S11: "practice",
    S12: "system",
  }
  const normalize = (source: Record<string, unknown>) => {
    if (typeof source.id === "string")
      return source as BondbuilderResearchProfile["sources"][number]
    const id = source.source_id
    if (typeof id !== "string" || !legacyScope[id])
      fail("source capture mismatch: unsupported legacy source")
    const access = source.access_level
    if (
      access !== "relevant_full_text_inspected" &&
      access !== "relevant_full_text_inspected_by_root"
    )
      fail(`source capture mismatch: unsupported legacy access ${id}`)
    const isS13ProducerPage =
      id === "S13" &&
      source.url ===
        "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum"
    const authority =
      source.authority_tier === undefined && isS13ProducerPage
        ? "manufacturer"
        : legacyAuthority[String(source.authority_tier)]
    if (!authority || typeof source.url !== "string" || typeof source.accessed_at !== "string")
      fail(`source capture mismatch: invalid legacy source ${id}`)
    const observations = source.observations
    const limitations = Array.isArray(source.limitations) ? source.limitations : source.limits
    if (
      !Array.isArray(observations) ||
      !Array.isArray(limitations) ||
      observations.some((entry) => typeof entry !== "string") ||
      limitations.some((entry) => typeof entry !== "string")
    )
      fail(`source capture mismatch: invalid legacy narrative ${id}`)
    return {
      id,
      url: source.url,
      checked_date: source.accessed_at,
      authority,
      type: `legacy_${String(source.authority_tier ?? "manufacturer")}`,
      scope: legacyScope[id],
      access: "full_text",
      author: null,
      affiliation: typeof source.publisher === "string" ? source.publisher : null,
      commercial_context:
        typeof source.commercial_context === "string" ? source.commercial_context : null,
      observation: observations.join(" "),
      limitations,
    } as BondbuilderResearchProfile["sources"][number]
  }
  const named = new Map(namedSources.map((source) => [source.id ?? source.source_id, source]))
  return sources.map((raw) => {
    const source = normalize(raw)
    const expectedRaw = named.get(source.id)
    if (!expectedRaw) fail(`source capture mismatch: unknown ID ${source.id}`)
    const expected = normalize(expectedRaw)
    const legacyCapture =
      typeof expectedRaw.source_id === "string" && Boolean(legacyScope[source.id])
    for (const key of ["id", "url", "scope", "access", "authority"] as const) {
      if (
        key === "access" &&
        legacyCapture &&
        (source.access === "full_text" || source.access === "inspected_excerpt")
      )
        continue
      if (source[key] !== expected[key]) fail(`source capture mismatch: ${source.id}.${key}`)
    }
    const withoutNamespace = (value: Record<string, unknown>) => {
      const copy = { ...value }
      delete copy.original_source_id
      delete copy.source_namespace
      return copy
    }
    const canonical = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(canonical)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, child]) => [key, canonical(child)]),
            )
          : value
    if (
      /^P\d\d:/.test(source.id) &&
      JSON.stringify(canonical(withoutNamespace(source))) !==
        JSON.stringify(canonical(withoutNamespace(expected)))
    )
      fail(`source capture mismatch: immutable ${source.id}`)
    return withoutNamespace(source) as BondbuilderResearchProfile["sources"][number]
  })
}
const normalizeMarker = (literal: string) =>
  literal
    .toLowerCase()
    .replace(/\s*[-–]\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim()
function markerProjection(stageA: StageARecord) {
  type Family = BondbuilderResearchProfile["formula"]["candidate_families"][number]
  const lexicon: Record<
    string,
    { family: Family; kind: "primary" | "acid_support" | "gluconamide_pair" }
  > = {
    "bis-aminopropyl diglycol dimaleate": { family: "sulfur_targeting_dimaleate", kind: "primary" },
    "sh-oligopeptide-78": { family: "designed_peptide", kind: "primary" },
    "diethylhexyl maleate": { family: "maleate_ester", kind: "primary" },
    "citric acid": { family: "acid_calcium_management", kind: "primary" },
    "sodium citrate": { family: "acid_calcium_management", kind: "acid_support" },
    glycine: { family: "acid_calcium_management", kind: "acid_support" },
    arginine: { family: "acid_calcium_management", kind: "acid_support" },
    betaine: { family: "acid_calcium_management", kind: "acid_support" },
    hydroxypropylgluconamide: { family: "gluconamide_gluconate", kind: "gluconamide_pair" },
    "hydroxypropylammonium gluconate": {
      family: "gluconamide_gluconate",
      kind: "gluconamide_pair",
    },
  }
  const normalized = stageA.observed_ingredients.map(normalizeMarker)
  const hasCitric = normalized.includes("citric acid")
  const hasGluconamidePair =
    normalized.includes("hydroxypropylgluconamide") &&
    normalized.includes("hydroxypropylammonium gluconate")
  const markers: Array<{ literal: string; family: Family }> = []
  const excluded_observations: string[] = []
  for (const [index, literal] of normalized.entries()) {
    const entry = lexicon[literal]
    if (!entry) {
      excluded_observations.push(stageA.observed_ingredients[index])
      continue
    }
    if (entry.kind === "primary") {
      if (!stageA.candidate_families.includes(entry.family))
        fail(`inconsistent primary Stage A marker: ${stageA.observed_ingredients[index]}`)
      markers.push({ literal, family: entry.family })
    } else if (entry.kind === "acid_support") {
      if (stageA.candidate_families.includes(entry.family) && hasCitric)
        markers.push({ literal, family: entry.family })
      else excluded_observations.push(stageA.observed_ingredients[index])
    } else if (stageA.candidate_families.includes(entry.family) && hasGluconamidePair)
      markers.push({ literal, family: entry.family })
    else excluded_observations.push(stageA.observed_ingredients[index])
  }
  return { markers, excluded_observations }
}
function currentPins(run: string) {
  const pins: Record<string, string> = {
    standard_sha256: "standard.md",
    runbook_sha256: "runbook.md",
    prompt_sha256: "researcher-prompt.md",
    blind_guide_sha256: "blind-instructions.md",
  }
  for (const [pin, file] of Object.entries(pins)) {
    const actual = hash(readFileSync(path.join(run, "method", file)))
    if (BOND_CURRENT_METHOD_PINS[pin as keyof typeof BOND_CURRENT_METHOD_PINS] !== actual)
      fail(`current method pin drift: ${pin}`)
  }
  const frozenRegistry = hash(
    readFileSync(path.join(run, "frozen-inputs/src/lib/bondbuilder-research/registry.ts")),
  )
  const manifest = read<{ frozen_copies: Record<string, string> }>(path.join(run, "manifest.json"))
  if (
    frozenRegistry !==
    manifest.frozen_copies["frozen-inputs/src/lib/bondbuilder-research/registry.ts"]
  )
    fail("frozen registry byte drift")
  const registry = hash(JSON.stringify(BOND_OWNER_REGISTRY))
  if (registry !== BOND_CURRENT_METHOD_PINS.reference_registry_sha256)
    fail("current method pin drift: reference_registry_sha256")
}
function resolveIdentity(slot: string, named: NamedRecord, status: "resolved" | "unresolved") {
  const identity = named.identity
  if (slot.startsWith("P")) {
    const owner = BOND_OWNER_REGISTRY.find((entry) => entry.research_key === slot)
    if (!owner) fail(`missing frozen owner: ${slot}`)
    for (const key of ["product_name", "brand", "market", "size", "source_version"] as const)
      if (identity[key] !== owner[key]) fail(`frozen owner identity mismatch: ${slot}.${key}`)
    if (status !== "resolved") fail(`owner identity must be resolved: ${slot}`)
    return {
      ...owner,
      gtin: identity.gtin ?? null,
      product_id: identity.product_id ?? null,
      status,
    }
  }
  const manufacturer = identity.manufacturer
  const name = identity.name
  const sizeMl = identity.size_ml
  if (typeof manufacturer !== "string" || typeof name !== "string")
    fail(`missing named validation identity: ${slot}`)
  if (sizeMl !== null && typeof sizeMl !== "number") fail(`invalid named validation size: ${slot}`)
  return {
    research_key: slot,
    product_name: name,
    brand: manufacturer,
    market: identity.market,
    size: sizeMl === null ? "not source-stated" : `${sizeMl} ml`,
    source_version: identity.source_version,
    gtin: identity.gtin ?? null,
    product_id: identity.product_id ?? null,
    status,
  }
}
function assembleProfile(
  run: string,
  lane: "lane-a" | "lane-b",
  stageA: StageARecord,
  stageB: StageBRecord,
  named: NamedRecord,
  sources: BondbuilderResearchProfile["sources"],
): BondbuilderResearchProfile {
  exactKeys(stageB.source_facts, CORE_KEYS, `${stageB.slot_id}.source_facts`)
  for (const key of CORE_KEYS)
    if (!(key in stageB.source_facts)) fail(`${stageB.slot_id}: missing source_facts.${key}`)
  const identity = resolveIdentity(stageB.slot_id, named, stageB.identity_status)
  if (
    stageB.slot_id === "V04" &&
    identity.size === "not source-stated" &&
    stageB.source_facts.holds.identity.length === 0
  )
    fail("V04 missing size requires a research-supplied identity hold")
  const anonymous = read<{
    rows: Array<{ slot_id: string; raw_inci: string; normalized_ingredients: string[] }>
  }>(path.join(run, "anonymous-packet.json"))
  const formula = anonymous.rows.find((row) => row.slot_id === stageB.slot_id)
  if (!formula) fail(`missing anonymous formula: ${stageB.slot_id}`)
  const formulaIds =
    named.formula_source_ids ?? (named.formula_source_id ? [named.formula_source_id] : [])
  if (!formulaIds.length) fail(`missing formula source IDs: ${stageB.slot_id}`)
  const markers = markerProjection(stageA).markers.map((marker) => ({
    ...marker,
    source_ids: formulaIds,
  }))
  const profile: BondbuilderResearchProfile = {
    version: "bondbuilder-research-profile-v1",
    method: {
      ...BOND_CURRENT_METHOD_PINS,
      run_reference: path.basename(run),
      artifact_reference: `${path.relative(ROOT, run)}/${lane}/assembled/${stageB.slot_id}.json`,
      output_sha256: "0".repeat(64),
    },
    identity: {
      research_key: identity.research_key,
      product_name: identity.product_name,
      brand: identity.brand,
      market: identity.market as string,
      size: identity.size,
      source_version: identity.source_version as string,
      gtin: identity.gtin as string | null,
      product_id: identity.product_id as string | null,
      status: identity.status,
    },
    formula: {
      raw_inci: formula.raw_inci,
      normalized_ingredients: formula.normalized_ingredients,
      raw_sha256: hash(formula.raw_inci),
      normalized_sha256: hash(JSON.stringify(formula.normalized_ingredients)),
      normalization_version: "bondbuilder-inci-normalization-v1",
      status: stageA.formula_state,
      source_ids: formulaIds,
      conflicts: stageB.slot_id.startsWith("P") ? (named.formula_conflicts ?? []) : [],
      markers,
      candidate_families: stageA.candidate_families,
      candidate_to_final_trace: stageB.candidate_to_final_trace,
    },
    ...stageB.source_facts,
    sources,
    review: {
      checked_date: "2026-10-03",
      reviewed_date: null,
      profile_sha256: "0".repeat(64),
      decision_references: [],
    },
  }
  const known = new Set(sources.map((source) => source.id))
  for (const id of sourceIds({ profile, source_ids: stageB.source_ids }))
    if (!known.has(id)) fail(`${stageB.slot_id}: unknown source ${id}`)
  const parsed = bondbuilderResearchEnvelopeSchema.safeParse({
    version: "bondbuilder-research-envelope-v1",
    submission_id: null,
    profile,
  })
  if (!parsed.success)
    fail(
      `${stageB.slot_id}: strict envelope invalid: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    )
  const digest = bondbuilderProfileSha256(profile)
  profile.method.output_sha256 = digest
  profile.review.profile_sha256 = digest
  return profile
}

export function assembleMethodReplay(runArgument?: string) {
  const run = path.resolve(ROOT, runArgument || DEFAULT_RUN)
  currentPins(run)
  const reportPath = path.join(run, "assembly-report.json")
  if (existsSync(reportPath)) fail("assembly target already exists: assembly-report.json")
  const namedPacket = read<{
    records: NamedRecord[]
    source_registry: Array<Record<string, unknown>>
  }>(path.join(run, "named-packet.json"))
  const assembled: Array<{ lane: string; slot_id: string; path: string; sha256: string }> = []
  const planned: Array<{
    lane: "lane-a" | "lane-b"
    profiles: Array<{
      slot_id: string
      profile: BondbuilderResearchProfile
      excluded_observations: string[]
    }>
  }> = []
  for (const lane of ["lane-a", "lane-b"] as const) {
    const file = path.join(run, lane, "stage-b.json")
    if (!existsSync(file)) continue
    const stage = read<StageB>(file)
    if (stage.stage !== "B" || stage.lane_id !== lane || !Array.isArray(stage.records))
      fail(`invalid Stage B envelope: ${lane}`)
    exactKeys(
      stage,
      ["stage", "lane_id", "input_receipt", "stage_a_seal", "source_registry", "records"],
      `Stage B envelope: ${lane}`,
    )
    const receipt = stage.input_receipt.find((entry) => entry.path === "named-packet.json")
    if (!receipt) fail(`missing named packet receipt: ${lane}`)
    receiptMatches(run, receipt, "named-packet.json")
    receiptMatches(run, stage.stage_a_seal, `${lane}/stage-a-seal.json`)
    verifySeal(run, lane, "A")
    verifySeal(run, lane, "B")
    const stageA = read<{ stage: "A"; lane_id: string; records: StageARecord[] }>(
      path.join(run, lane, "stage-a.json"),
    )
    if (stageA.stage !== "A" || stageA.lane_id !== lane) fail(`invalid Stage A envelope: ${lane}`)
    const outputDirectory = path.join(run, lane, "assembled")
    if (existsSync(outputDirectory)) fail(`assembly target already exists: ${lane}/assembled`)
    const profiles: Array<{
      slot_id: string
      profile: BondbuilderResearchProfile
      excluded_observations: string[]
    }> = []
    for (const record of stage.records) {
      exactKeys(
        record,
        [
          "slot_id",
          "source_facts",
          "source_ids",
          "conflicts",
          "unknowns",
          "limitations",
          "identity_status",
          "candidate_to_final_trace",
        ],
        `${lane} Stage B record`,
      )
      if (!SLOT.test(record.slot_id)) fail(`invalid slot: ${record.slot_id}`)
      const a = stageA.records.find((candidate) => candidate.slot_id === record.slot_id)
      const n = namedPacket.records.find((candidate) => candidate.slot_id === record.slot_id)
      if (!a || !n) fail(`missing sealed Stage A or named record: ${record.slot_id}`)
      profiles.push({
        slot_id: record.slot_id,
        profile: assembleProfile(
          run,
          lane,
          a,
          record,
          n,
          bindSources(stage.source_registry, namedPacket.source_registry),
        ),
        excluded_observations: markerProjection(a).excluded_observations,
      })
    }
    planned.push({ lane, profiles })
  }
  if (!planned.length) fail("no Stage B outputs supplied")
  const marker_exclusions: Array<{
    lane: string
    slot_id: string
    observed_ingredients: string[]
  }> = []
  for (const { lane, profiles } of planned) {
    const outputDirectory = path.join(run, lane, "assembled")
    mkdirSync(outputDirectory)
    for (const { slot_id, profile, excluded_observations } of profiles) {
      const target = path.join(outputDirectory, `${slot_id}.json`)
      const envelope = { version: "bondbuilder-research-envelope-v1", submission_id: null, profile }
      writeFileSync(target, encode(envelope), { flag: "wx" })
      assembled.push({
        lane,
        slot_id,
        path: path.relative(run, target),
        sha256: hash(readFileSync(target)),
      })
      if (excluded_observations.length)
        marker_exclusions.push({ lane, slot_id, observed_ingredients: excluded_observations })
    }
  }
  const report = {
    version: "bondbuilder-method-assembly-report-v1",
    run: path.relative(ROOT, run),
    profiles: assembled,
    marker_exclusions,
  }
  writeFileSync(reportPath, encode(report), { flag: "wx" })
  return { run: report.run, profiles: assembled.length, report: path.relative(ROOT, reportPath) }
}

if (process.argv[1]?.endsWith("assemble-method-replay.ts")) {
  const index = process.argv.indexOf("--run")
  if (index !== -1 && !process.argv[index + 1]) throw new Error("--run requires a path")
  console.log(
    JSON.stringify(assembleMethodReplay(index === -1 ? undefined : process.argv[index + 1])),
  )
}
