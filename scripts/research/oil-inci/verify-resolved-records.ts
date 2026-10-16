import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { OilResearchEnvelopeSchema } from "../../../src/lib/oil-research/contracts"
import { projectOilForProduction } from "../../../src/lib/oil-research/production-adapter"
import { assertNoSymlinksOnExistingPath } from "./artifact-io"
import { HistoricalReader, array, object, string } from "./export-historical"

const INPUT =
  "plans/oil-inci/research/record-resolution-2026-10-13/resolution-authorities-input.json"
const RUN = "oil-record-resolution-v0.1"
const CASES = ["O04", "O18", "O19", "H04"]
const sha = (bytes: string) => createHash("sha256").update(bytes).digest("hex")
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
type Row = Record<string, unknown>
export type ResolutionVerificationReport = {
  version: "oil-record-resolution-verification-v0.1"
  ok: boolean
  totals: {
    records: number
    ready: number
    refused: number
    corrected: number
    owner_provisional: number
  }
  errors: string[]
}

function pointer(document: unknown, selector: unknown): unknown {
  assert.equal(typeof selector, "string", "Missing JSON pointer")
  if (selector === "") return document
  assert.match(selector as string, /^\//, "Invalid JSON pointer")
  return (selector as string)
    .slice(1)
    .split("/")
    .reduce<unknown>((value, token) => {
      assert.ok(!/~(?![01])/u.test(token), "Malformed JSON pointer escape")
      const key = token.replace(/~1/g, "/").replace(/~0/g, "~")
      assert.ok(
        value && typeof value === "object" && Object.hasOwn(value, key),
        `Missing JSON pointer: ${selector}`,
      )
      return (value as Row)[key]
    }, document)
}

function relativePath(value: string): void {
  assert.ok(
    !path.isAbsolute(value) &&
      !value.includes("\\") &&
      !value.split("/").some((p) => p === "." || p === ".." || !p),
    "Untrusted path",
  )
}

/** This reader only remaps an exact logical artifact directory during atomic staging. */
class ResolutionReader {
  readonly actual: string
  readonly logical: string
  readonly historical: HistoricalReader
  constructor(
    readonly root: string,
    directory: string,
    logicalDirectory?: string,
  ) {
    assertNoSymlinksOnExistingPath(root)
    this.actual = path.resolve(directory)
    assertNoSymlinksOnExistingPath(this.actual)
    const actualRelative = path.relative(path.resolve(root), this.actual).split(path.sep).join("/")
    relativePath(actualRelative)
    assert.match(actualRelative, /^data\/research\//, "Stage must be confined to research data")
    const logical = path.resolve(logicalDirectory ?? directory)
    assertNoSymlinksOnExistingPath(logical)
    this.logical = path.relative(path.resolve(root), logical).split(path.sep).join("/")
    relativePath(this.logical)
    assert.match(this.logical, /^data\/research\//, "Replay must be confined to research data")
    this.historical = new HistoricalReader(root)
  }
  local(relative: string, expected?: unknown): string {
    relativePath(relative)
    const full = path.join(this.actual, relative)
    assertNoSymlinksOnExistingPath(full)
    const bytes = readFileSync(full, "utf8")
    if (expected !== undefined)
      assert.equal(sha(bytes), expected, `Artifact hash mismatch: ${relative}`)
    return bytes
  }
  read(reference: Row): string {
    const location = string(reference.path)
    relativePath(location)
    const bytes = location.startsWith(`${this.logical}/`)
      ? this.local(location.slice(this.logical.length + 1), reference.sha256)
      : this.historical.read(location, string(reference.sha256)).bytes
    assert.equal(sha(bytes), reference.sha256, `Reference hash mismatch: ${location}`)
    return bytes
  }
  resolve(reference: Row): unknown {
    const bytes = this.read(reference)
    if (reference.json_pointer !== undefined)
      return pointer(JSON.parse(bytes) as unknown, reference.json_pointer)
    return this.historical.resolve(reference).record
  }
}

function patch(target: Row, item: Row): void {
  const selector = string(item.path)
  assert.deepEqual(pointer(target, selector), item.from, `Patch precondition: ${selector}`)
  const slash = selector.lastIndexOf("/")
  const parent = pointer(target, selector.slice(0, slash)) as Row
  parent[selector.slice(slash + 1)] = clone(item.to)
}

function approvedDecision(decision: Row, original: Row): void {
  const id = string(decision.case_id)
  assert.equal(object(original.profile).case_id, id)
  assert.deepEqual(decision.identity, object(original.profile).identity, `${id}: identity binding`)
  assert.equal(object(object(original.profile).weight).value, decision.expected_old_weight)
  assert.equal(object(original.profile).persistence_potential, "moderate")
  assert.equal(decision.expected_persistence, "moderate")
  const expectedPaths: Record<string, string[]> = {
    O04: [
      "/formula/ingredients/0/canonical_name",
      "/penetration_potential/evidence/0/canonical_name",
    ],
    O18: ["/formula/ingredients/9/raw_name"],
    O19: ["/formula/ingredients/3/canonical_name"],
    H04: ["/weight"],
  }
  assert.deepEqual(
    array(decision.profile_patches).map((p) => object(p).path),
    expectedPaths[id],
    "Unauthorized profile patch",
  )
  assert.deepEqual(
    array(decision.trace_patches).map((p) => object(p).path),
    id === "O04"
      ? ["/evidence/0/canonical_name"]
      : id === "O19"
        ? ["/evidence/3/canonical_name"]
        : [],
    "Unauthorized trace patch",
  )
  const patches = array(decision.profile_patches).map(object)
  assert.deepEqual(
    patches.map((p) => p.field),
    id === "O04" ? ["formula", "penetration_potential"] : id === "H04" ? ["weight"] : ["formula"],
    "Unauthorized field authority change",
  )
  if (id === "O04") {
    assert.ok(
      patches.every((p) => p.from === "COCOS NUCIFERA OIL" && p.to === "COCOS NUCIFERA FRUIT OIL"),
    )
    assert.equal(array(decision.source_additions).length, 1)
    assert.equal(
      object(object(array(decision.source_additions)[0]).expected_record).id,
      "E01-retailer-de",
    )
  } else {
    assert.deepEqual(decision.source_additions, [])
    if (id === "O18")
      assert.equal(
        patches[0].to,
        "Helianthus annuus seed oil (Sunflower plant oil, tocopherol carrier oil)",
      )
    if (id === "O19") assert.equal(patches[0].to, "COCOS NUCIFERA OIL")
  }
  assert.equal(decision.kind, id === "H04" ? "owner_weight_estimate" : "representation_correction")
  if (id === "H04") {
    const owner = object(decision.owner_weight_adjudication)
    assert.equal(owner.decision_id, "OE-H04-WEIGHT-2026-10-13")
    assert.equal(owner.case_id, "H04")
    assert.equal(owner.product_key, "oil-holdout-h04")
    assert.equal(owner.user_acknowledgement, "Use provisional medium (recommended)")
    assert.equal(owner.decision, "medium")
    assert.equal(owner.estimate, true)
    assert.equal(owner.confidence, "low")
    assert.equal(owner.nearest_alternative, "rich")
    assert.equal(owner.blind_classification, false)
    assert.equal(owner.activation, false)
    assert.equal(object(patches[0].to).value, "medium")
    assert.equal(object(patches[0].to).estimate, true)
    assert.equal(object(patches[0].to).confidence, "low")
    assert.equal(object(patches[0].to).nearest_alternative, "rich")
    assert.deepEqual(object(patches[0].to).evidence, object(patches[0].from).evidence)
    for (const field of ["reason", "counter_signal", "unresolved"])
      assert.equal(
        object(patches[0].to)[field],
        owner[field],
        `Owner weight rationale mismatch: ${field}`,
      )
    assert.deepEqual(decision.thickness, {
      fine: {
        value: "conditional",
        reason: "greater_load_or_flattening_concern",
        condition:
          "Controlled application within the exact published directions and site; no invented numeric dose.",
      },
      normal: { value: "suitable", reason: "thickness_weight_preference", condition: null },
      coarse: { value: "suitable", reason: "thickness_weight_preference", condition: null },
    })
    assert.deepEqual(decision.alternative_thickness, {
      fine: "conditional",
      normal: "conditional",
      coarse: "suitable",
    })
  }
}

function checkReference(
  reader: ResolutionReader,
  reference: unknown,
  file: string,
  index: number,
  suffix: string,
  caseId: string,
  expected: unknown,
): Row {
  const ref = object(reference)
  assert.equal(ref.path, `${reader.logical}/${file}`)
  assert.equal(ref.record_key, caseId)
  assert.equal(ref.json_pointer, `/records/${index}${suffix}`)
  string(ref.reason)
  assert.deepEqual(reader.resolve(ref), expected, `Resolved authority record: ${caseId}/${file}`)
  return ref
}

function verifyCorrected(
  reader: ResolutionReader,
  envelope: Row,
  original: Row,
  originalBytes: string,
  decision: Row,
  index: number,
  manifestRow: Row,
  sidecars: Map<string, unknown>,
): void {
  const id = string(decision.case_id)
  approvedDecision(decision, original)
  const profile = object(envelope.profile)
  const oldProfile = object(original.profile)
  const fields = object(profile.field_authority)
  const expectedProfile = clone(oldProfile)
  for (const item of array(decision.profile_patches).map(object)) patch(expectedProfile, item)
  if (id === "H04") expectedProfile.owner_weight_adjudication = decision.owner_weight_adjudication
  const changedFields = new Set(array(decision.profile_patches).map((p) => string(object(p).field)))
  assert.deepEqual(
    Object.keys(fields),
    Object.keys(object(oldProfile.field_authority)),
    "Field authority membership",
  )
  for (const [field, reference] of Object.entries(fields)) {
    if (changedFields.has(field)) {
      checkReference(reader, reference, "resolution-authorities.json", index, "", id, decision)
      object(expectedProfile.field_authority)[field] = reference
    } else
      assert.deepEqual(
        reference,
        object(oldProfile.field_authority)[field],
        `${id}: untouched ${field} authority`,
      )
  }
  const expectedTrace = clone(object(object(original.persistence_trace).original))
  for (const item of array(decision.trace_patches).map(object)) patch(expectedTrace, item)
  checkReference(
    reader,
    profile.persistence_trace_reference,
    "persistence-traces.json",
    index,
    "/trace",
    id,
    expectedTrace,
  )
  expectedProfile.persistence_trace_reference = profile.persistence_trace_reference
  assert.deepEqual(profile, expectedProfile, `${id}: unauthorized profile delta`)
  assert.deepEqual(sidecars.get("profiles.json"), profile, `${id}: profile sidecar`)
  assert.deepEqual(sidecars.get("persistence-traces.json"), expectedTrace, `${id}: trace sidecar`)

  const expectedFormula = clone(object(original.formula))
  expectedFormula.ingredients = object(profile.formula).ingredients
  expectedFormula.normalized_sha256 = decision.expected_normalized_sha256
  array(expectedFormula.normalization_receipt).forEach((item, rank) => {
    const expectedRank = object(array(object(profile.formula).ingredients)[rank])
    object(item).raw_name = expectedRank.raw_name
    object(item).canonical_name = expectedRank.canonical_name
  })
  assert.deepEqual(envelope.formula, expectedFormula, `${id}: formula wrapper delta`)
  const expectedTraceWrapper = clone(object(original.persistence_trace))
  expectedTraceWrapper.original = expectedTrace
  expectedTraceWrapper.evidence = expectedTrace.evidence
  assert.deepEqual(
    envelope.persistence_trace,
    expectedTraceWrapper,
    `${id}: persistence changed outside exact evidence correction`,
  )

  const expectedFits = clone(array(original.scenario_fit).map(object))
  if (id === "H04") {
    assert.equal(expectedFits.length, 1)
    assert.equal(expectedFits[0].role, "dry_finish")
    const fit = expectedFits[0]
    fit.thickness = decision.thickness
    fit.weight_authority = fields.weight
    const saved = object(fit.original)
    saved.weight = "medium"
    saved.weight_authority = fields.weight
    saved.weight_confidence = "low"
    saved.estimate = true
    saved.thickness = decision.thickness
    saved.alternative_weight = "rich"
    saved.alternative_thickness = decision.alternative_thickness
  }
  assert.deepEqual(envelope.scenario_fit, expectedFits, `${id}: unauthorized scenario fit delta`)
  assert.deepEqual(
    sidecars.get("scenario-fit.json"),
    expectedFits.map((f) => f.original),
    `${id}: fit sidecar`,
  )
  const expectedSources = clone(array(original.sources))
  for (const addition of array(decision.source_additions).map(object)) {
    const source = object(addition.expected_record)
    assert.equal(addition.purpose, "identity_corroboration_only")
    expectedSources.push({
      source_id: source.id,
      url: source.url,
      url_note: null,
      original: source,
      directions: [],
    })
  }
  assert.deepEqual(envelope.sources, expectedSources, `${id}: source/direction preservation`)
  for (const key of Object.keys(original).filter(
    (k) =>
      ![
        "formula",
        "profile",
        "sources",
        "persistence_trace",
        "scenario_fit",
        "provenance",
      ].includes(k),
  ))
    assert.deepEqual(envelope[key], original[key], `${id}: envelope ${key} changed`)

  const provenance = object(envelope.provenance)
  assert.deepEqual(provenance.original_record, profile)
  assert.equal(
    provenance.original_record_sha256,
    sha(JSON.stringify(profile)),
    "Natural-order current profile digest",
  )
  assert.deepEqual(provenance.field_authorities, fields)
  const method = object(provenance.original_method)
  assert.equal(
    provenance.import_kind,
    "historical",
    "Successor must preserve historical attribution",
  )
  assert.equal(method.run_id, RUN)
  assert.equal(method.declared_version, "record-resolution-v0.1")
  assert.equal(method.unrecorded_note, null)
  assert.equal(method.path, `${reader.logical}/profiles.json`)
  reader.read(method)
  const receipts = array(provenance.mapping_receipts).map(object)
  assert.equal(
    new Set(receipts.map((r) => r.kind)).size,
    receipts.length,
    "Duplicate mapping receipt kind",
  )
  const receipt = (kind: string) => {
    const value = receipts.find((r) => r.kind === kind)
    assert.ok(value, `${id}: missing ${kind} receipt`)
    return value
  }
  const profileReceipt = receipt("current_profile_resolution")
  assert.equal(profileReceipt.path, method.path)
  assert.equal(profileReceipt.sha256, method.sha256)
  assert.equal(profileReceipt.record_key, id)
  assert.equal(profileReceipt.json_pointer, `/records/${index}/profile`)
  assert.deepEqual(reader.resolve(profileReceipt), profile)
  assert.equal(profileReceipt.resolved_record_sha256, sha(JSON.stringify(profile)))
  const predecessor = receipt("predecessor_envelope")
  assert.equal(predecessor.path, object(decision.predecessor).path)
  assert.equal(predecessor.sha256, object(decision.predecessor).sha256)
  assert.equal(predecessor.exact_utf8, originalBytes, "Exact predecessor bytes")
  assert.equal(sha(string(predecessor.exact_utf8)), predecessor.sha256)
  const expectedReceiptKinds = [
    "predecessor_envelope",
    "field_authority_resolutions",
    "persistence_trace_resolution",
    "current_profile_resolution",
    "scenario_fit_resolution",
    "source_context",
    "declaration_admission",
    ...(id === "O04" ? ["source_recovery"] : []),
  ]
  assert.deepEqual(
    receipts.map((r) => r.kind).sort(),
    expectedReceiptKinds.sort(),
    "Mapping receipt membership",
  )
  if (id === "O04") {
    const addition = object(array(decision.source_additions)[0])
    assert.deepEqual(
      receipt("source_recovery"),
      {
        kind: "source_recovery",
        path: addition.path,
        sha256: addition.sha256,
        json_pointer: addition.json_pointer,
        source_id: "E01-retailer-de",
        purpose: "identity_corroboration_only",
        directions: [],
      },
      "Exact identity-only source recovery receipt",
    )
  }
  const oldReceipts = array(object(original.provenance).mapping_receipts).map(object)
  for (const saved of oldReceipts.filter(
    (r) =>
      ![
        "field_authority_resolutions",
        "persistence_trace_resolution",
        "scenario_fit_resolution",
      ].includes(string(r.kind)),
  ))
    assert.deepEqual(
      receipt(string(saved.kind)),
      saved,
      `${id}: original ${saved.kind} receipt preservation`,
    )
  const authorityRows = array(receipt("field_authority_resolutions").records).map(object)
  assert.equal(authorityRows.length, Object.keys(fields).length)
  assert.equal(new Set(authorityRows.map((r) => r.field)).size, authorityRows.length)
  for (const row of authorityRows) {
    const field = string(row.field)
    const ref = object(fields[field])
    for (const [key, value] of Object.entries(ref))
      assert.deepEqual(row[key], value, `${id}: authority receipt ${field}/${key}`)
    assert.equal(
      row.resolved_record_sha256,
      sha(JSON.stringify(reader.resolve(ref))),
      `${id}: authority record digest ${field}`,
    )
    if (changedFields.has(field)) {
      assert.equal(object(row.original_method).run_id, RUN, "Current authority method attribution")
      assert.equal(
        object(row.original_method).declared_version,
        "oil-record-resolution-authorities-v0.1",
      )
    }
    if (!changedFields.has(field)) {
      const oldRows = array(
        object(oldReceipts.find((r) => r.kind === "field_authority_resolutions")).records,
      ).map(object)
      assert.deepEqual(
        row,
        oldRows.find((r) => r.field === field),
        `${id}: untouched authority receipt ${field}`,
      )
    }
  }
  const traceReceipt = receipt("persistence_trace_resolution")
  for (const [key, value] of Object.entries(object(profile.persistence_trace_reference)))
    assert.deepEqual(traceReceipt[key], value)
  assert.equal(traceReceipt.resolved_record_sha256, sha(JSON.stringify(expectedTrace)))
  const fitReceipt = receipt("scenario_fit_resolution")
  assert.equal(fitReceipt.path, `${reader.logical}/scenario-fit.json`)
  assert.equal(fitReceipt.json_pointer, `/records/${index}/scenario_fit`)
  assert.deepEqual(
    reader.resolve(fitReceipt),
    expectedFits.map((f) => f.original),
  )
  assert.equal(fitReceipt.rows, expectedFits.length)
  assert.deepEqual(
    fitReceipt.policy_versions,
    object(oldReceipts.find((r) => r.kind === "scenario_fit_resolution")).policy_versions,
  )
  const dependencies = array(provenance.dependencies).map(object)
  for (const dep of array(object(original.provenance).dependencies))
    assert.ok(
      dependencies.some((d) => JSON.stringify(d) === JSON.stringify(dep)),
      `${id}: lost historical dependency`,
    )
  for (const dep of dependencies) reader.read(dep)
  for (const file of [
    "resolution-authorities.json",
    "profiles.json",
    "persistence-traces.json",
    "scenario-fit.json",
  ])
    assert.ok(
      dependencies.some((dep) => dep.path === `${reader.logical}/${file}`),
      `${id}: missing current ${file} dependency`,
    )
  assert.ok(
    dependencies.some((dep) => dep.path === object(decision.predecessor).path),
    `${id}: missing predecessor dependency`,
  )
  for (const ref of [
    ...array(decision.evidence),
    ...array(decision.source_additions),
    ...(decision.owner_decision ? [decision.owner_decision] : []),
  ].map(object)) {
    assert.ok(
      dependencies.some((dep) => dep.path === ref.path && dep.sha256 === ref.sha256),
      `${id}: missing evidence dependency ${String(ref.path)}`,
    )
  }
  if (id === "H04") {
    assert.equal(manifestRow.adjudication_kind, "owner_provisional_weight")
    assert.equal(manifestRow.estimate, true)
    assert.equal(manifestRow.confidence, "low", "H04 provisional confidence must remain low")
    assert.equal(manifestRow.nearest_alternative, "rich")
    assert.ok(
      string(manifestRow.caveat).includes("carrier"),
      "H04 visible unresolved carrier caveat",
    )
    const ref = object(manifestRow.authority)
    assert.equal(ref.path, `${reader.logical}/resolution-authorities.json`)
    assert.equal(ref.json_pointer, `/records/${index}`)
    assert.deepEqual(reader.resolve(ref), decision)
  } else {
    for (const key of [
      "adjudication_kind",
      "estimate",
      "confidence",
      "nearest_alternative",
      "caveat",
      "authority",
    ])
      assert.equal(manifestRow[key], undefined, `Unexpected owner adjudication on ${id}`)
  }
}

/** Frozen predecessor and owner decisions are the oracle; no builder code is imported. */
export function verifyResolvedRecords(
  root: string,
  directory: string,
  options?: { logicalDirectory?: string },
): ResolutionVerificationReport {
  const report: ResolutionVerificationReport = {
    version: "oil-record-resolution-verification-v0.1",
    ok: false,
    totals: { records: 0, ready: 0, refused: 0, corrected: 0, owner_provisional: 0 },
    errors: [],
  }
  try {
    const reader = new ResolutionReader(root, directory, options?.logicalDirectory)
    const inputBytes = reader.historical.read(INPUT).bytes
    const input = object(JSON.parse(inputBytes))
    const decisions = array(input.records).map(object)
    assert.deepEqual(
      decisions.map((d) => d.case_id),
      CASES,
      "Exact four decision membership",
    )
    assert.equal(input.run_id, RUN)
    const manifest = object(JSON.parse(reader.local("manifest.json")))
    assert.equal(manifest.version, "oil-record-resolution-replay-v0.1")
    assert.equal(manifest.run_id, RUN)
    assert.deepEqual(manifest.predecessor_manifest, input.predecessor_manifest)
    const predecessorRef = object(input.predecessor_manifest)
    assert.equal(
      predecessorRef.path,
      "data/research/oil-inci/v1.0/adapter-replay-v0.2/manifest.json",
    )
    const predecessor = object(JSON.parse(reader.read(predecessorRef)))
    const oldFiles = array(predecessor.files).map(object)
    assert.equal(oldFiles.length, 37)
    const files = array(manifest.files).map(object)
    assert.deepEqual(
      files.map((f) => f.path).sort(),
      [
        "resolution-authorities.json",
        "profiles.json",
        "persistence-traces.json",
        "scenario-fit.json",
        ...oldFiles.map((f) => string(f.path)),
      ].sort(),
      "Exact artifact membership",
    )
    for (const file of files) reader.local(string(file.path), file.sha256)
    assert.deepEqual(
      readdirSync(path.join(reader.actual, "envelopes")).sort(),
      oldFiles.map((f) => path.basename(string(f.path))).sort(),
      "No unmanifested envelopes",
    )
    assert.equal(
      reader.local("resolution-authorities.json"),
      inputBytes,
      "Frozen authored authority bytes",
    )
    const containers = new Map<string, Row>()
    for (const [file, version] of [
      ["profiles.json", "profiles"],
      ["persistence-traces.json", "persistence-traces"],
      ["scenario-fit.json", "scenario-fit"],
    ]) {
      const doc = object(JSON.parse(reader.local(file)))
      assert.equal(doc.version, `oil-record-resolution-${version}-v0.1`)
      assert.equal(doc.run_id, RUN)
      assert.deepEqual(
        array(doc.records).map((r) => object(r).case_id),
        CASES,
      )
      assert.deepEqual(
        array(doc.records).map((r) => object(r).product_key),
        decisions.map((d) => d.product_key),
      )
      containers.set(file, doc)
    }
    for (const decision of decisions) {
      for (const ref of [
        ...array(decision.evidence),
        ...array(decision.source_additions),
        ...(decision.owner_decision ? [decision.owner_decision] : []),
      ].map(object)) {
        const bytes = reader.read(ref)
        if (ref.json_pointer !== undefined)
          assert.deepEqual(
            pointer(JSON.parse(bytes), ref.json_pointer),
            ref.expected_record,
            "Source evidence selector binding",
          )
      }
      if (decision.owner_decision)
        assert.deepEqual(
          object(decision.owner_decision).expected_record,
          decision.owner_weight_adjudication,
        )
    }
    const records = array(manifest.records).map(object)
    report.totals.records = records.length
    assert.equal(records.length, 37)
    assert.equal(new Set(records.map((r) => r.product_key)).size, 37)
    assert.equal(new Set(records.map((r) => r.case_id)).size, 37)
    assert.deepEqual(
      new Set(records.map((r) => r.product_key)),
      new Set(oldFiles.map((r) => r.product_key)),
    )
    for (const row of records) {
      try {
        const file = oldFiles.find((f) => f.product_key === row.product_key)
        assert.ok(file, "Missing predecessor member")
        assert.equal(row.envelope_path, file.path)
        const oldPath: string = `${path.posix.dirname(string(predecessorRef.path))}/${string(file.path)}`
        const oldBytes = reader.read({ path: oldPath, sha256: file.sha256 })
        const original = object(JSON.parse(oldBytes))
        assert.equal(row.case_id, object(original.profile).case_id)
        const bytes = reader.local(string(row.envelope_path), row.sha256)
        const envelope = object(JSON.parse(bytes))
        assert.equal(row.sha256, object(files.find((f) => f.path === row.envelope_path)).sha256)
        const index = decisions.findIndex((d) => d.product_key === row.product_key)
        assert.equal(row.corrected, index >= 0)
        assert.equal(row.status, "ready")
        if (index < 0) {
          assert.equal(bytes, oldBytes, `Unchanged envelope must be byte-exact: ${row.case_id}`)
          assert.equal(row.adjudication_kind, undefined)
          for (const dep of array(object(envelope.provenance).dependencies).map(object))
            reader.read(dep)
        } else {
          report.totals.corrected++
          assert.deepEqual(decisions[index].predecessor, { path: oldPath, sha256: file.sha256 })
          const sidecars = new Map<string, unknown>()
          for (const [name, key] of [
            ["profiles.json", "profile"],
            ["persistence-traces.json", "trace"],
            ["scenario-fit.json", "scenario_fit"],
          ]) {
            const value = object(array(containers.get(name)?.records)[index])[key]
            sidecars.set(name, value)
          }
          verifyCorrected(
            reader,
            envelope,
            original,
            oldBytes,
            decisions[index],
            index,
            row,
            sidecars,
          )
        }
        if (row.adjudication_kind === "owner_provisional_weight") report.totals.owner_provisional++
        const parsed = OilResearchEnvelopeSchema.safeParse(envelope)
        assert.ok(
          parsed.success,
          `${row.case_id}: strict schema: ${parsed.success ? "" : parsed.error.message}`,
        )
        const outcome = projectOilForProduction(envelope)
        assert.equal(
          outcome.status,
          "property_projection_ready",
          `${row.case_id}: ${outcome.issues.join("; ")}`,
        )
        if (outcome.status === "property_projection_ready") {
          assert.deepEqual(
            outcome.category_specs.product_oil_specs,
            {
              weight: object(object(envelope.profile).weight).value,
              role_support: [
                ...new Set(
                  array(object(envelope.profile).supported_uses).filter(
                    (role) => role !== "scalp_application",
                  ),
                ),
              ],
              provides_heat_protection: object(object(envelope.profile).provides_heat_protection)
                .value,
            },
            "Only literal approved production fields",
          )
          report.totals.ready++
        }
      } catch (error) {
        report.totals.refused++
        report.errors.push(
          `${String(row.case_id)}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
    assert.deepEqual(
      report.totals,
      { records: 37, ready: 37, refused: 0, corrected: 4, owner_provisional: 1 },
      "Resolved replay totals",
    )
    assert.deepEqual(manifest.totals, report.totals)
    report.ok = report.errors.length === 0
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error))
  }
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const rootIndex = args.indexOf("--root")
  const root = rootIndex >= 0 ? args[rootIndex + 1] : process.cwd()
  const directory = args[0]
  if (!directory || !root || directory.startsWith("--")) {
    console.error("Usage: verify-resolved-records.ts <replay-directory> [--root <root>]")
    process.exitCode = 1
  } else {
    const report = verifyResolvedRecords(root, path.resolve(directory))
    console.log(JSON.stringify(report, null, 2))
    if (!report.ok) process.exitCode = 1
  }
}
