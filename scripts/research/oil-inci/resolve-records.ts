import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { orderedFormulaDigest } from "../../../src/lib/oil-research/contracts"
import { projectOilForProduction } from "../../../src/lib/oil-research/production-adapter"
import { assertNoSymlinksOnExistingPath, publishDirectoryAtomically } from "./artifact-io"
import { array, object, readAuthority, string } from "./export-historical"
import { verifyResolvedRecords } from "./verify-resolved-records"

const INPUT_PATH =
  "plans/oil-inci/research/record-resolution-2026-10-13/resolution-authorities-input.json"
const PREDECESSOR_DIRECTORY = "data/research/oil-inci/v1.0/adapter-replay-v0.2"
const RUN_ID = "oil-record-resolution-v0.1"
const VERSION = "oil-record-resolution-replay-v0.1"

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type RecordValue = Record<string, Json>
type Patch = { path: string; from: Json; to: Json; field?: string }
type ResolutionRecord = RecordValue & {
  case_id: string
  product_key: string
  predecessor: { path: string; sha256: string }
  profile_patches: Patch[]
  trace_patches: Patch[]
  source_additions: Array<RecordValue>
  expected_normalized_sha256: string
}

export type ResolutionBuildReport = {
  version: typeof VERSION
  totals: {
    records: number
    ready: number
    refused: number
    corrected: number
    owner_provisional: number
  }
  output: string
  verification: unknown
}

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function asRecord(value: unknown, description: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Expected ${description} object`)
  return value as RecordValue
}

function pointer(
  root: Json,
  value: string,
): { parent: RecordValue | Json[]; key: string | number; value: Json } {
  if (!value.startsWith("/") && value !== "") throw new Error(`Unsafe JSON pointer: ${value}`)
  if (value === "") throw new Error("Root-level patch is not permitted")
  const parts = value
    .slice(1)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
  let current: Json = root
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(part) || current[Number(part)] === undefined)
        throw new Error(`Unresolved JSON pointer: ${value}`)
      current = current[Number(part)]
    } else if (current && typeof current === "object" && part in current) current = current[part]
    else throw new Error(`Unresolved JSON pointer: ${value}`)
  }
  const last = parts.at(-1)!
  if (Array.isArray(current)) {
    if (!/^(0|[1-9][0-9]*)$/.test(last) || current[Number(last)] === undefined)
      throw new Error(`Unresolved JSON pointer: ${value}`)
    return { parent: current, key: Number(last), value: current[Number(last)] }
  }
  if (!current || typeof current !== "object" || !(last in current))
    throw new Error(`Unresolved JSON pointer: ${value}`)
  return { parent: current, key: last, value: current[last] }
}

function valueAt(root: Json, value: string): Json {
  if (value === "") return root
  return pointer(root, value).value
}

function applyPatches(target: RecordValue, patches: Patch[], label: string): void {
  for (const patch of patches) {
    const selected = pointer(target, patch.path)
    assert.deepEqual(selected.value, patch.from, `${label} before-value mismatch at ${patch.path}`)
    if (Array.isArray(selected.parent)) selected.parent[selected.key as number] = clone(patch.to)
    else selected.parent[selected.key as string] = clone(patch.to)
  }
}

function requireRootRelative(root: string, absolute: string): string {
  const relative = path.relative(root, absolute).split(path.sep).join("/")
  if (!/^data\/research\//.test(relative) || relative.includes("..") || path.isAbsolute(relative))
    throw new Error("Resolved replay output must be under data/research")
  return relative
}

function validateRef(root: string, ref: RecordValue): Json {
  const location = string(ref.path)
  const expectedHash = string(ref.sha256)
  const bytes = readAuthority(root, location, expectedHash).bytes
  if (ref.json_pointer === undefined && ref.expected_record === undefined) return null
  const document = JSON.parse(bytes) as Json
  const selected = valueAt(document, typeof ref.json_pointer === "string" ? ref.json_pointer : "")
  if (ref.expected_record !== undefined)
    assert.deepEqual(selected, ref.expected_record, `Frozen authority differs: ${location}`)
  return selected
}

function validateFrozenInput(root: string): {
  input: RecordValue
  records: ResolutionRecord[]
} {
  const bytes = readAuthority(root, INPUT_PATH).bytes
  const input = asRecord(JSON.parse(bytes), "resolution authority input")
  if (input.version !== "oil-record-resolution-authorities-v0.1" || input.run_id !== RUN_ID)
    throw new Error("Unexpected resolution authority version")
  const records = array(input.records).map(
    (entry) => asRecord(entry, "resolution record") as ResolutionRecord,
  )
  assert.deepEqual(
    records.map((record) => record.case_id),
    ["O04", "O18", "O19", "H04"],
  )
  for (const record of records) {
    for (const ref of [...array(record.evidence ?? []), ...array(record.source_additions ?? [])])
      validateRef(root, asRecord(ref, "evidence reference"))
    if (record.owner_decision)
      validateRef(root, asRecord(record.owner_decision, "owner decision reference"))
  }
  return { input, records }
}

function sourceWrapper(source: RecordValue) {
  const sourceId = source.id ?? source.source_id
  if (typeof sourceId !== "string" || typeof source.url !== "string")
    throw new Error("Recovered source must retain id and URL")
  return { source_id: sourceId, url: source.url, url_note: null, original: source, directions: [] }
}

function updatedAuthority(
  field: string,
  authorityPath: string,
  authorityHash: string,
  caseId: string,
  authorityIndex: number,
): RecordValue {
  return {
    path: authorityPath,
    sha256: authorityHash,
    record_key: caseId,
    json_pointer: `/records/${authorityIndex}`,
    reason: `Source-preserving ${field} resolution for ${caseId}; complete predecessor is retained in the predecessor receipt.`,
  }
}

function replacementAuthorityFields(record: ResolutionRecord): string[] {
  return [
    ...new Set(
      record.profile_patches
        .map((patch) => patch.field)
        .filter((field): field is string => Boolean(field)),
    ),
  ]
}

function buildCorrectedEnvelope(
  root: string,
  record: ResolutionRecord,
  authorityPath: string,
  authorityHash: string,
  authorityIndex: number,
  tracePath: string,
  traceHash: string,
  traceIndex: number,
  fitPath: string,
  fitHash: string,
  fitIndex: number,
  profilePath: string,
  profileHash: string,
  profileIndex: number,
): RecordValue {
  const predecessorBytes = readAuthority(
    root,
    record.predecessor.path,
    record.predecessor.sha256,
  ).bytes
  const predecessor = asRecord(JSON.parse(predecessorBytes), "predecessor envelope")
  const originalProfile = clone(asRecord(predecessor.profile, "predecessor profile"))
  if (
    originalProfile.case_id !== record.case_id ||
    originalProfile.product_key !== record.product_key
  )
    throw new Error(`Predecessor identity mismatch: ${record.case_id}`)
  assert.equal(
    asRecord(originalProfile.weight, "predecessor weight").value,
    record.expected_old_weight,
  )
  assert.equal(originalProfile.persistence_potential, record.expected_persistence)

  const profile = clone(originalProfile)
  applyPatches(profile, record.profile_patches, `${record.case_id} profile`)
  const oldAuthorities = clone(asRecord(profile.field_authority, "field authority"))
  for (const field of replacementAuthorityFields(record)) {
    if (!oldAuthorities[field]) throw new Error(`Missing field authority ${field}`)
    oldAuthorities[field] = updatedAuthority(
      field,
      authorityPath,
      authorityHash,
      record.case_id,
      authorityIndex,
    )
  }
  profile.field_authority = oldAuthorities
  profile.persistence_trace_reference = {
    path: tracePath,
    sha256: traceHash,
    record_key: record.case_id,
    json_pointer: `/records/${traceIndex}/trace`,
    reason: "Source-preserving successor trace",
  }
  if (record.owner_weight_adjudication) {
    const owner = validateRef(root, asRecord(record.owner_decision, "owner decision"))
    assert.deepEqual(owner, record.owner_weight_adjudication, "Owner adjudication source drift")
    profile.owner_weight_adjudication = clone(record.owner_weight_adjudication)
  }

  const formula = clone(asRecord(predecessor.formula, "predecessor formula"))
  formula.ingredients = clone(asRecord(profile.formula, "profile formula").ingredients)
  formula.normalized_sha256 = orderedFormulaDigest(
    array(formula.ingredients).map((value) => asRecord(value, "ingredient")) as Array<{
      rank: number
      canonical_name: string
    }>,
  )
  if (formula.normalized_sha256 !== record.expected_normalized_sha256)
    throw new Error(`Unexpected normalized formula digest: ${record.case_id}`)
  const receipt = array(formula.normalization_receipt).map((value) =>
    clone(asRecord(value, "normalization receipt")),
  )
  for (const patch of record.profile_patches.filter((patch) =>
    patch.path.startsWith("/formula/ingredients/"),
  )) {
    const receiptPath = patch.path.replace("/formula/ingredients/", "/normalization_receipt/")
    applyPatches(
      { normalization_receipt: receipt } as RecordValue,
      [{ ...patch, path: receiptPath }],
      `${record.case_id} normalization receipt`,
    )
  }
  formula.normalization_receipt = receipt

  const trace = clone(asRecord(predecessor.persistence_trace, "predecessor trace"))
  applyPatches(trace, record.trace_patches, `${record.case_id} trace`)
  const traceOriginal = clone(asRecord(trace.original, "trace original"))
  applyPatches(traceOriginal, record.trace_patches, `${record.case_id} trace original`)
  trace.original = traceOriginal

  const fits = array(predecessor.scenario_fit).map((entry) =>
    clone(asRecord(entry, "scenario fit")),
  )
  if (record.thickness) {
    if (fits.length !== 1 || fits[0].role !== "dry_finish")
      throw new Error(`${record.case_id} has unexpected scenario fit shape`)
    const thickness = clone(asRecord(record.thickness, "H04 thickness"))
    fits[0].thickness = thickness
    const original = asRecord(fits[0].original, "scenario fit original")
    original.thickness = clone(thickness)
    original.weight = asRecord(profile.weight, "profile weight").value
    original.weight_confidence = asRecord(profile.weight, "profile weight").confidence
    original.estimate = asRecord(profile.weight, "profile weight").estimate
    original.alternative_weight = asRecord(profile.weight, "profile weight").nearest_alternative
    original.alternative_thickness = clone(
      asRecord(record.alternative_thickness, "H04 alternate thickness"),
    )
  }
  for (const fit of fits)
    fit.weight_authority = clone(asRecord(profile.field_authority, "field authority").weight)
  for (const fit of fits)
    asRecord(fit.original, "scenario fit original").weight_authority = clone(fit.weight_authority)

  const sources = array(predecessor.sources).map((entry) => clone(asRecord(entry, "source")))
  for (const sourceRef of record.source_additions) {
    const source = validateRef(root, sourceRef)
    const wrapper = sourceWrapper(asRecord(source, "recovered source"))
    if (sources.some((entry) => entry.source_id === wrapper.source_id))
      throw new Error(`Recovered source ID already exists: ${wrapper.source_id}`)
    sources.push(wrapper)
  }

  const provenance = clone(asRecord(predecessor.provenance, "predecessor provenance"))
  provenance.import_kind = "historical"
  provenance.original_method = {
    run_id: RUN_ID,
    path: profilePath,
    sha256: profileHash,
    declared_version: "record-resolution-v0.1",
    unrecorded_note: null,
  }
  provenance.original_record = clone(profile)
  provenance.original_record_sha256 = sha(JSON.stringify(profile))
  provenance.field_authorities = clone(asRecord(profile.field_authority, "field authority"))
  const dependencies = array(provenance.dependencies).map((entry) =>
    clone(asRecord(entry, "dependency")),
  )
  dependencies.push({
    kind: "predecessor_envelope",
    path: record.predecessor.path,
    sha256: record.predecessor.sha256,
  })
  for (const [kind, target, hash] of [
    ["resolution_authority", authorityPath, authorityHash],
    ["resolved_profile", profilePath, profileHash],
    ["resolved_trace", tracePath, traceHash],
    ["resolved_scenario_fit", fitPath, fitHash],
  ] as const)
    dependencies.push({ kind, path: target, sha256: hash })
  for (const ref of [...array(record.evidence ?? []), ...array(record.source_additions ?? [])]) {
    const value = asRecord(ref, "evidence reference")
    dependencies.push({
      kind: "resolution_evidence",
      path: string(value.path),
      sha256: string(value.sha256),
    })
  }
  if (record.owner_decision)
    dependencies.push({
      kind: "owner_decision",
      path: string(asRecord(record.owner_decision, "owner decision").path),
      sha256: string(asRecord(record.owner_decision, "owner decision").sha256),
    })
  provenance.dependencies = dependencies
  const oldReceipts = array(provenance.mapping_receipts).map((entry) =>
    clone(asRecord(entry, "mapping receipt")),
  )
  const historicalAuthorities = asRecord(
    oldReceipts.find((receipt) => receipt.kind === "field_authority_resolutions"),
    "historical authority receipt",
  )
  const resolutions = array(historicalAuthorities.records).map((entry) => {
    const prior = clone(asRecord(entry, "historical authority resolution"))
    const field = string(prior.field)
    if (!replacementAuthorityFields(record).includes(field)) return prior
    const authority = asRecord(profile.field_authority, "field authority")[field]
    if (!authority) throw new Error(`Missing replacement authority for ${field}`)
    return {
      ...prior,
      ...clone(asRecord(authority, "replacement authority")),
      original_method: {
        run_id: RUN_ID,
        declared_version: "oil-record-resolution-authorities-v0.1",
        note: "Source-preserving correction or exact-product owner estimate; predecessor method remains in the predecessor receipt.",
      },
      resolved_record_sha256: sha(JSON.stringify(record)),
    }
  })
  const historicalFit = asRecord(
    oldReceipts.find((receipt) => receipt.kind === "scenario_fit_resolution"),
    "historical scenario-fit receipt",
  )
  provenance.mapping_receipts = [
    {
      kind: "predecessor_envelope",
      path: record.predecessor.path,
      sha256: record.predecessor.sha256,
      exact_utf8: predecessorBytes,
    },
    { ...historicalAuthorities, records: resolutions as Json[] },
    {
      kind: "persistence_trace_resolution",
      path: tracePath,
      sha256: traceHash,
      record_key: record.case_id,
      json_pointer: `/records/${traceIndex}/trace`,
      reason: "Source-preserving successor trace",
      resolved_record_sha256: sha(JSON.stringify(traceOriginal)),
    },
    {
      kind: "current_profile_resolution",
      path: profilePath,
      sha256: profileHash,
      record_key: record.case_id,
      json_pointer: `/records/${profileIndex}/profile`,
      resolved_record_sha256: sha(JSON.stringify(profile)),
    },
    {
      ...historicalFit,
      path: fitPath,
      sha256: fitHash,
      json_pointer: `/records/${fitIndex}/scenario_fit`,
      rows: fits.length,
    },
    ...record.source_additions.map((source) => ({
      kind: "source_recovery",
      path: string(source.path),
      sha256: string(source.sha256),
      json_pointer: string(source.json_pointer),
      source_id: string(asRecord(source.expected_record, "recovered source").id),
      purpose: source.purpose,
      directions: [],
    })),
    ...oldReceipts.filter((receipt) =>
      ["source_context", "declaration_admission"].includes(String(receipt.kind)),
    ),
  ]

  return {
    ...clone(predecessor),
    formula,
    profile,
    sources,
    persistence_trace: trace,
    scenario_fit: fits,
    provenance,
  }
}

function sidecar(version: string, records: Array<RecordValue>) {
  return { version, run_id: RUN_ID, records }
}

function write(stage: string, relative: string, content: string): void {
  const destination = path.join(stage, relative)
  mkdirSync(path.dirname(destination), { recursive: true })
  writeFileSync(destination, content, { flag: "wx" })
}

export function exportResolvedRecords(root: string, output: string): ResolutionBuildReport {
  const absoluteOutput = path.resolve(output)
  const logicalOutput = requireRootRelative(path.resolve(root), absoluteOutput)
  assertNoSymlinksOnExistingPath(absoluteOutput)
  const { input, records } = validateFrozenInput(root)
  const authorityText = readAuthority(root, INPUT_PATH).bytes
  const authorityHash = sha(authorityText)
  const authorityPath = `${logicalOutput}/resolution-authorities.json`
  const tracePath = `${logicalOutput}/persistence-traces.json`
  const fitPath = `${logicalOutput}/scenario-fit.json`
  const profilePath = `${logicalOutput}/profiles.json`

  const rawPrevious = records.map((record) => ({
    record,
    bytes: readAuthority(root, record.predecessor.path, record.predecessor.sha256).bytes,
    envelope: asRecord(
      JSON.parse(readAuthority(root, record.predecessor.path, record.predecessor.sha256).bytes),
      "predecessor envelope",
    ),
  }))
  const traceContainer = sidecar(
    "oil-record-resolution-persistence-traces-v0.1",
    rawPrevious.map(({ record, envelope }) => ({
      case_id: record.case_id,
      product_key: record.product_key,
      trace: clone(
        asRecord(asRecord(envelope.persistence_trace, "trace").original, "original trace"),
      ),
    })),
  )
  for (let i = 0; i < traceContainer.records.length; i++) {
    const record = records[i]
    const trace = asRecord(asRecord(traceContainer.records[i], "trace row").trace, "trace")
    applyPatches(trace, record.trace_patches, `${record.case_id} trace sidecar`)
  }
  const traceText = json(traceContainer)
  const traceHash = sha(traceText)
  const fitContainer = sidecar(
    "oil-record-resolution-scenario-fit-v0.1",
    rawPrevious.map(({ record, envelope }) => ({
      case_id: record.case_id,
      product_key: record.product_key,
      scenario_fit: array(envelope.scenario_fit).map((fit) =>
        clone(asRecord(fit, "scenario fit").original),
      ) as Json[],
    })),
  )
  // The sole owner-approved fit adjustment is prepared against the frozen source before envelopes.
  const h04Fit = asRecord(
    fitContainer.records.find((row) => row.case_id === "H04"),
    "H04 fit row",
  )
  const h04Record = records.find((record) => record.case_id === "H04")!
  const h04Fits = array(h04Fit.scenario_fit).map((fit) => asRecord(fit, "H04 scenario fit"))
  assert.equal(h04Fits.length, 1)
  h04Fits[0].thickness = clone(asRecord(h04Record.thickness, "H04 thickness"))
  h04Fits[0].weight = "medium"
  h04Fits[0].weight_confidence = "low"
  h04Fits[0].estimate = true
  h04Fits[0].alternative_weight = "rich"
  h04Fits[0].alternative_thickness = clone(
    asRecord(h04Record.alternative_thickness, "H04 alternate thickness"),
  )
  // Profiles need trace references, whose hash is now stable. Their authority refs are stable too.
  const profileRows = rawPrevious.map(({ record, envelope }) => {
    const profile = clone(asRecord(envelope.profile, "profile"))
    applyPatches(profile, record.profile_patches, `${record.case_id} profile sidecar`)
    const authorities = asRecord(profile.field_authority, "field authority")
    for (const field of replacementAuthorityFields(record))
      authorities[field] = updatedAuthority(
        field,
        authorityPath,
        authorityHash,
        record.case_id,
        records.indexOf(record),
      )
    profile.persistence_trace_reference = {
      path: tracePath,
      sha256: traceHash,
      record_key: record.case_id,
      json_pointer: `/records/${records.indexOf(record)}/trace`,
      reason: "Source-preserving successor trace",
    }
    if (record.owner_weight_adjudication) {
      const owner = validateRef(root, asRecord(record.owner_decision, "owner decision"))
      assert.deepEqual(owner, record.owner_weight_adjudication, "Owner adjudication source drift")
      profile.owner_weight_adjudication = clone(record.owner_weight_adjudication)
    }
    return { case_id: record.case_id, product_key: record.product_key, profile }
  })
  // The H04 fit has to carry the same new weight authority as its current profile.
  const h04Profile = asRecord(
    profileRows.find((row) => row.case_id === "H04")!.profile,
    "H04 profile",
  )
  h04Fits[0].weight_authority = clone(
    asRecord(h04Profile.field_authority, "H04 field authority").weight,
  )
  const fitText = json(fitContainer)
  const fitHash = sha(fitText)
  const profileText = json(sidecar("oil-record-resolution-profiles-v0.1", profileRows))
  const profileHash = sha(profileText)
  const envelopeByKey = new Map<string, RecordValue>()
  for (let index = 0; index < records.length; index++) {
    const record = records[index]
    const envelope = buildCorrectedEnvelope(
      root,
      record,
      authorityPath,
      authorityHash,
      index,
      tracePath,
      traceHash,
      index,
      fitPath,
      fitHash,
      index,
      profilePath,
      profileHash,
      index,
    )
    const rowProfile = asRecord(profileRows[index].profile, "sidecar profile")
    assert.deepEqual(envelope.profile, rowProfile, `${record.case_id} profile sidecar drift`)
    assert.deepEqual(
      asRecord(envelope.persistence_trace, "trace").original,
      asRecord(asRecord(traceContainer.records[index], "trace row").trace, "trace sidecar"),
      `${record.case_id} trace sidecar drift`,
    )
    assert.deepEqual(
      array(envelope.scenario_fit).map((fit) => asRecord(fit, "scenario fit").original),
      array(asRecord(fitContainer.records[index], "fit row").scenario_fit),
      `${record.case_id} fit sidecar drift`,
    )
    const projected = projectOilForProduction(envelope as never)
    if (projected.status !== "property_projection_ready")
      throw new Error(`${record.case_id} is not projection-ready: ${projected.issues.join("; ")}`)
    envelopeByKey.set(record.product_key, envelope)
  }

  let verification: unknown
  publishDirectoryAtomically(absoluteOutput, (stage) => {
    write(stage, "resolution-authorities.json", authorityText)
    write(stage, "persistence-traces.json", traceText)
    write(stage, "scenario-fit.json", fitText)
    write(stage, "profiles.json", profileText)
    const oldManifest = asRecord(
      JSON.parse(readAuthority(root, `${PREDECESSOR_DIRECTORY}/manifest.json`).bytes),
      "predecessor manifest",
    )
    const files: RecordValue[] = []
    const manifestRecords: RecordValue[] = []
    for (const old of array(oldManifest.files).map((entry) =>
      asRecord(entry, "predecessor manifest row"),
    )) {
      const oldBytes = readAuthority(
        root,
        `${PREDECESSOR_DIRECTORY}/${string(old.path)}`,
        string(old.sha256),
      ).bytes
      const oldEnvelope = asRecord(JSON.parse(oldBytes), "predecessor envelope")
      const productKey = string(old.product_key)
      const corrected = envelopeByKey.get(productKey)
      const relative = string(old.path)
      const text = corrected ? json(corrected) : oldBytes
      write(stage, relative, text)
      const profile = asRecord(asRecord(corrected ?? oldEnvelope, "envelope").profile, "profile")
      const resolution = records.find((record) => record.product_key === productKey)
      files.push({ path: relative, sha256: sha(text) })
      manifestRecords.push({
        case_id: string(profile.case_id),
        product_key: productKey,
        envelope_path: relative,
        sha256: sha(text),
        status: "ready",
        corrected: Boolean(corrected),
        ...(resolution?.owner_weight_adjudication
          ? {
              adjudication_kind: "owner_provisional_weight",
              estimate: true,
              confidence: "low",
              nearest_alternative: "rich",
              caveat:
                "Leading carrier/preparation identities and measured hair-weight performance remain undisclosed.",
              authority: {
                path: authorityPath,
                sha256: authorityHash,
                json_pointer: `/records/${records.indexOf(resolution)}`,
              },
            }
          : {}),
      })
    }
    const sidecarFiles = [
      ["resolution-authorities.json", authorityText],
      ["profiles.json", profileText],
      ["persistence-traces.json", traceText],
      ["scenario-fit.json", fitText],
    ] as const
    for (const [relative, text] of sidecarFiles) files.push({ path: relative, sha256: sha(text) })
    const manifest = {
      version: VERSION,
      run_id: RUN_ID,
      predecessor_manifest: object(input.predecessor_manifest),
      files,
      records: manifestRecords,
      totals: { records: 37, ready: 37, refused: 0, corrected: 4, owner_provisional: 1 },
    }
    write(stage, "manifest.json", json(manifest))
    const verified = verifyResolvedRecords(root, stage, { logicalDirectory: absoluteOutput })
    if (!verified.ok)
      throw new Error(`Resolved replay verification failed: ${verified.errors.join("; ")}`)
    verification = verified
    write(stage, "verification.json", json(verified))
    write(
      stage,
      "README.md",
      "# Oil record resolution v0.1\n\n37 projection-ready successor envelopes. O04/O18/O19 are representation/source corrections. H04 carries Nick's exact-product provisional medium estimate; its leading carriers remain unresolved, so projection readiness is neither sensory proof nor activation readiness.\n",
    )
  })
  if (!verification)
    throw new Error("Resolved replay publication did not produce a verification report")
  return {
    version: VERSION,
    totals: { records: 37, ready: 37, refused: 0, corrected: 4, owner_provisional: 1 },
    output: logicalOutput,
    verification,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const values = new Map<string, string>()
  let malformed = false
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if ((flag !== "--output" && flag !== "--root") || !value || values.has(flag)) malformed = true
    else values.set(flag, value)
  }
  const output = values.get("--output")
  const root = values.get("--root") ?? process.cwd()
  if (malformed || !output || args.length !== values.size * 2) {
    console.error(
      "Usage: resolve-records.ts --output <new-or-empty-directory> [--root <repository-root>]",
    )
    process.exitCode = 2
  } else {
    try {
      const report = exportResolvedRecords(root, output)
      console.log(JSON.stringify(report.totals))
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 2
    }
  }
}
