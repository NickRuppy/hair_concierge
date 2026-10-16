import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { orderedFormulaDigest } from "../../../src/lib/oil-research/contracts"
import { OIL_RESEARCH_METHOD, OIL_FIT_POLICY_PINS } from "../../../src/lib/oil-research/registry"
import { assertNoSymlinksOnExistingPath, publishDirectoryAtomically } from "./artifact-io"

export const INVENTORY_PATH =
  "data/research/oil-inci/v1.0/corpus/holdout/targeted-coverage-v0.1/current-view-v0.2/combined-profile-inventory.json"
export type HistoricalObject = Record<string, unknown>
export const object = (value: unknown): HistoricalObject => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected historical object")
  return value as HistoricalObject
}
export const array = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new Error("Expected historical array")
  return value
}
export const string = (value: unknown): string => {
  if (typeof value !== "string" || !value.length) throw new Error("Expected historical string")
  return value
}
export const digest = (bytes: string | Buffer): string =>
  createHash("sha256").update(bytes).digest("hex")

/** Source reads are confined to immutable research authorities in the supplied checkout. */
export function readAuthority(
  root: string,
  relative: string,
  expectedHash?: string,
): { bytes: string; sha256: string } {
  if (
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).some((p) => p === ".." || p === "." || p === "") ||
    !/^(data\/research\/|docs\/research\/|plans\/oil-inci\/)/.test(relative)
  )
    throw new Error("Untrusted authority path")
  const full = path.resolve(root, relative)
  assertNoSymlinksOnExistingPath(full)
  const bytes = readFileSync(full, "utf8")
  const sha256 = digest(bytes)
  if (expectedHash && sha256 !== expectedHash)
    throw new Error(`Authority hash mismatch: ${relative}`)
  return { bytes, sha256 }
}

export function selectHistoricalRecord(document: unknown, key: string): HistoricalObject {
  const keys = ["case_id", "neutral_id", "product_key", "decision_id", "id", "source_key"]
  const top = Array.isArray(document)
    ? document
    : (object(document).records ?? object(document).findings)
  const candidates = Array.isArray(top) ? top.map(object) : [object(document)]
  const matches = candidates.filter((row) => keys.some((name) => row[name] === key))
  if (matches.length !== 1) throw new Error(`Authority record key is missing or ambiguous: ${key}`)
  return matches[0]
}

type Dependency = { kind: string; path: string; sha256: string }
export class HistoricalReader {
  readonly dependencies = new Map<string, Dependency>()
  constructor(readonly root: string) {}
  read(relative: string, expectedHash?: string, kind = "authority") {
    const result = readAuthority(this.root, relative, expectedHash)
    this.dependencies.set(relative, { kind, path: relative, sha256: result.sha256 })
    return result
  }
  json(relative: string, expectedHash?: string, kind?: string): HistoricalObject {
    return object(JSON.parse(this.read(relative, expectedHash, kind).bytes))
  }
  exists(relative: string): boolean {
    try {
      readAuthority(this.root, relative)
      return true
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return false
      throw e
    }
  }
  resolve(reference: unknown): {
    record: HistoricalObject
    container: HistoricalObject
    sha256: string
  } {
    const ref = object(reference)
    const location = string(ref.path)
    const content = this.read(location, string(ref.sha256))
    const key = string(ref.record_key)
    if (location.endsWith(".md")) {
      const sections = content.bytes
        .split(/(?=^## )/m)
        .filter(
          (part) =>
            /^## Accepted:/.test(part) && new RegExp(`Scope: round-[0-9]+ ${key}\\b`).test(part),
        )
      if (sections.length !== 1)
        throw new Error(`Markdown authority key missing or ambiguous: ${key}`)
      return {
        record: { record_key: key, text: sections[0] },
        container: {},
        sha256: content.sha256,
      }
    }
    const document: unknown = JSON.parse(content.bytes)
    return {
      record: selectHistoricalRecord(document, key),
      container: Array.isArray(document) ? {} : object(document),
      sha256: content.sha256,
    }
  }
  runDependencies(runDirectory: string) {
    // Names are established frozen run conventions, never glob another run's dictionary.
    const names = [
      "input-manifest.json",
      "stage2-manifest.json",
      "blind-seal.json",
      "stage2-seal.json",
      "blind-stage-seal.json",
      "seal-bookkeeping-correction.json",
      "normalization-audit.json",
      "main-material-mappings.md",
      "method.md",
      "function-dictionary.json",
      "dictionary.json",
      "blind-lexicon.json",
      "role-lexicon.json",
      "blind-packet.json",
      "source-packet.json",
      "stage2-packet.json",
      "unblinded-packet.json",
    ]
    for (const name of names) {
      const location = `${runDirectory}/${name}`
      if (!this.exists(location)) continue
      const content = this.read(
        location,
        undefined,
        name.includes("dictionary") || name.includes("lexicon")
          ? "function_dictionary"
          : name.includes("normalization") ||
              name.includes("mapping") ||
              name === "blind-packet.json"
            ? "normalization_mapping"
            : name.includes("seal")
              ? "stage_seal"
              : "run_dependency",
      )
      if (!name.includes("manifest")) continue
      const manifest = object(JSON.parse(content.bytes))
      for (const field of ["inputs", "run_inputs", "files", "dependencies"]) {
        if (!manifest[field] || Array.isArray(manifest[field])) continue
        for (const [file, hash] of Object.entries(object(manifest[field]))) {
          if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) continue
          this.read(
            file.startsWith("data/") || file.startsWith("docs/") || file.startsWith("plans/")
              ? file
              : `${runDirectory}/${file}`,
            hash,
            "manifest_dependency",
          )
        }
      }
      if (Array.isArray(manifest.input_files))
        for (const entry of manifest.input_files) {
          const ref = object(entry)
          this.read(
            `${runDirectory}/${string(ref.path)}`,
            string(ref.sha256),
            "manifest_dependency",
          )
        }
    }
  }
}

export function loadInventory(root: string) {
  const reader = new HistoricalReader(root)
  const inventory = reader.json(INVENTORY_PATH)
  const records = array(inventory.records).map(object)
  if (records.length !== 37 || new Set(records.map((row) => row.product_key)).size !== 37)
    throw new Error("Inventory must contain exactly 37 unique product keys")
  return records.map((entry) => {
    const container = reader.json(string(entry.path), string(entry.sha256))
    const profile = selectHistoricalRecord(container, string(entry.product_key))
    if (profile.persistence_potential !== entry.persistence_potential)
      throw new Error("Inventory persistence mismatch")
    if (
      profile.case_id === "T02" &&
      !string(object(object(profile.field_authority).ingredient_ledger).path).includes(
        "/correction-v0.2/",
      )
    )
      throw new Error("Superseded T02 authority refused")
    return { entry, profile, container }
  })
}

function runDirectory(authorityPath: string) {
  const parent = path.posix.dirname(authorityPath)
  return /^lane-[ab]$/.test(path.posix.basename(parent)) ? path.posix.dirname(parent) : parent
}

// Append-only historical source overlays; ordering preserves original merge receipts.
const SOURCE_AMENDMENTS: {
  case_ids: string[]
  path: string
  kind: "single_scenario" | "sources_and_directions" | "supplemental_sources"
}[] = [
  {
    case_ids: ["O05"],
    path: "data/research/oil-inci/v1.0/corpus/exploratory/round-1/post-seal-source-amendment-v0.1.1.json",
    kind: "single_scenario",
  },
  {
    case_ids: ["O08"],
    path: "data/research/oil-inci/v1.0/corpus/exploratory/full-profile-completion-v0.1/source-staging/O08-retained-source-successor.json",
    kind: "sources_and_directions",
  },
  {
    case_ids: ["O04", "O18", "O19", "O15"],
    path: "plans/oil-inci/research/profile-completion-evidence-v0.1/evidence.json",
    kind: "supplemental_sources",
  },
]

function sourceContext(reader: HistoricalReader, profile: HistoricalObject) {
  const reference = object(object(profile.field_authority).provides_heat_protection)
  const run = runDirectory(string(reference.path))
  const packetNames = string(reference.path).endsWith("working-records-v0.1.1.json")
    ? ["unblinded-packet-v0.1.1.json", "stage2-packet.json", "unblinded-packet.json"]
    : ["stage2-packet.json", "unblinded-packet.json"]
  const sourcePath = packetNames.map((name) => `${run}/${name}`).find((name) => reader.exists(name))
  if (!sourcePath) throw new Error(`Missing controlled source packet for ${profile.case_id}`)
  const packet = reader.json(sourcePath, undefined, "source_packet")
  const source = selectHistoricalRecord(packet, string(reference.record_key))
  const sourceRecords = array(source.sources).map(object)
  const directions = array(source.directions).map(object)
  for (const definition of SOURCE_AMENDMENTS.filter((row) =>
    row.case_ids.includes(string(profile.case_id)),
  )) {
    const amendment = reader.json(definition.path, undefined, "source_amendment")
    if (definition.kind === "single_scenario") {
      sourceRecords.push({ ...amendment, id: amendment.source_id })
      directions.push({ ...object(amendment.scenario), text: amendment.direction_paraphrase })
    } else if (definition.kind === "sources_and_directions") {
      sourceRecords.push(...array(amendment.sources).map(object))
      directions.push(...array(amendment.directions).map(object))
    } else {
      for (const item of array(amendment.sources).map(object)) {
        if (
          !sourceRecords.some((existing) => (existing.id ?? existing.source_id) === item.source_id)
        )
          sourceRecords.push(item)
      }
    }
  }
  return { sourcePath, source, sourceRecords, directions }
}

export function buildHistoricalEnvelope(
  root: string,
  selected: ReturnType<typeof loadInventory>[number],
) {
  const { entry, profile, container } = selected
  const reader = new HistoricalReader(root)
  reader.read(INVENTORY_PATH, undefined, "selection_inventory")
  reader.read(string(entry.path), string(entry.sha256), "original_profile")
  const authorities = object(profile.field_authority)
  const resolutions: HistoricalObject[] = []
  const runs = new Set<string>()
  for (const [field, reference] of Object.entries(authorities)) {
    const ref = object(reference),
      resolved = reader.resolve(ref)
    resolutions.push({
      field,
      ...ref,
      original_method: {
        run_id: resolved.container.run_id ?? null,
        declared_version:
          resolved.container.method_revision ?? resolved.container.policy_version ?? null,
        note: "Original declaration only; absence is not replaced with the consolidation method.",
      },
      resolved_record_sha256: digest(JSON.stringify(resolved.record)),
    })
    if (string(ref.path).startsWith("data/")) runs.add(runDirectory(string(ref.path)))
  }
  const traceRef = object(profile.persistence_trace_reference)
  const trace = reader.resolve(traceRef).record
  runs.add(runDirectory(string(traceRef.path)))
  for (const run of runs) reader.runDependencies(run)
  const fitPath = `${path.posix.dirname(string(entry.path))}/scenario-fit.json`
  const fitContainer = reader.json(fitPath, undefined, "scenario_fit")
  const fits = array(fitContainer.records)
    .map(object)
    .filter((row) => row.case_id === profile.case_id)
  const source = sourceContext(reader, profile)
  const uniqueSources = [
    ...new Map(source.sourceRecords.map((row) => [row.id ?? row.source_id, row])).values(),
  ]
  const sources = uniqueSources.map((original) => {
    const sourceId = string(original.id ?? original.source_id)
    return {
      source_id: sourceId,
      url: original.url ?? null,
      url_note: original.url
        ? null
        : "Original source record does not record a URL; retained unchanged.",
      original,
      directions: source.directions
        .filter((d) => d.source_id === sourceId)
        .map((d) => ({
          direction_id: string(d.direction_id),
          text: string(d.text ?? d.direction_paraphrase ?? d.paraphrase),
        })),
    }
  })
  const identity = object(profile.identity)
  const identifiers = [identity.gtin_if_verified, identity.identifier_if_verified].filter(
    (v) => v != null,
  )
  if (new Set(identifiers).size > 1)
    throw new Error(`Conflicting historical identifier: ${profile.case_id}`)
  const canonicalIdentity = {
    brand: identity.brand,
    product: identity.product,
    market: identity.market ?? identity.market_size,
    variant: identity.variant ?? null,
    package: {
      size_text: identity.size ?? null,
      size_ml: identity.size_ml ?? null,
      combined_declaration: identity.market_size ?? null,
    },
    identifier: identifiers[0] ?? null,
    category: "hair_oil",
    original: identity,
    mapping_receipt: [
      {
        rule: "Literal approved historical identity mapping; no unit conversion, market split, or inferred variant.",
        fields: Object.fromEntries(
          [
            "brand",
            "product",
            "market",
            "market_size",
            "size",
            "size_ml",
            "variant",
            "gtin_if_verified",
            "identifier_if_verified",
          ].map((k) => [k, k in identity ? `original.${k}` : null]),
        ),
        source_path: source.sourcePath,
        source_record_key: object(authorities.provides_heat_protection).record_key,
      },
    ],
    source_ids: [
      ...new Set(
        [
          sources[0].source_id,
          identity.gtin_source_id,
          identity.gtin_corroborating_source_id,
        ].filter((id): id is string => typeof id === "string"),
      ),
    ],
    conflicts: [],
  }
  const formula = object(profile.formula)
  const formulaAuthority = reader.resolve(authorities.formula).record
  const contextDeclarations = Array.isArray(formulaAuthority.contextual_declarations)
    ? formulaAuthority.contextual_declarations
    : []
  const contextual = contextDeclarations.map((value) => {
    if (typeof value === "string") {
      const code = value.match(/^([A-Z][A-Z0-9/]+) formula code/)
      if (!code || !string(formula.raw_inci).endsWith(`[${code[1]}]`))
        throw new Error("Unresolved contextual declaration literal")
      return {
        literal: `[${code[1]}]`,
        kind: "formula_code",
        source_id: sources[0].source_id,
        reason: value,
      }
    }
    const original = object(value)
    return {
      literal: original.raw,
      kind: original.type,
      source_id: sources[0].source_id,
      reason: JSON.stringify(original),
    }
  })
  const ingredients = array(formula.ingredients)
    .map(object)
    .map((i) => ({
      rank: Number(i.rank),
      raw_name: string(i.raw_name),
      canonical_name: string(i.canonical_name),
    }))
  const scenario = array(profile.application_scenarios)
    .map(object)
    .find((s) =>
      array(s.supported_roles).some(
        (role) => role === "leave_on_fibre_conditioning" || role === "dry_finish",
      ),
    )
  if (!scenario) throw new Error(`Historical retained-fibre context missing: ${profile.case_id}`)
  const contextRole = array(scenario.supported_roles).find(
    (role) => role === "leave_on_fibre_conditioning" || role === "dry_finish",
  )
  const output = {
    version: "oil-research-envelope-v1",
    research_id: `oil:${string(profile.product_key)}`,
    submission_id: null,
    research_method: OIL_RESEARCH_METHOD,
    identity: canonicalIdentity,
    formula: {
      raw_inci: formula.raw_inci,
      ingredients,
      raw_sha256: digest(string(formula.raw_inci)),
      normalized_sha256: orderedFormulaDigest(ingredients),
      normalization_receipt: ingredients.map((i) => ({
        ...i,
        reason:
          "Literal historical raw/canonical mapping retained from the exact formula authority and its run mapping dependencies.",
      })),
      source_ids: [sources[0].source_id],
      declaration_status: "complete",
      conflicts: [],
      contextual_declarations: contextual,
    },
    profile,
    sources,
    persistence_trace: {
      reason: trace.reason,
      evidence: trace.evidence,
      considered_ranks: trace.considered_ranks,
      tipping_assumption: trace.tipping_assumption ?? null,
      tipping_assumption_note: trace.tipping_assumption
        ? null
        : "Not separately recorded in this historical trace; original reasoning is preserved without a new research judgment.",
      context: {
        source_id: scenario.source_id,
        direction_id: scenario.direction_id,
        role: contextRole,
      },
      original: trace,
    },
    scenario_fit: fits.map((f) => ({
      source_id: f.source_id,
      direction_id: f.direction_id,
      role: f.supported_role,
      thickness: f.thickness,
      texture: f.texture,
      damage: f.damage,
      weight_authority: f.weight_authority,
      policy_pins: OIL_FIT_POLICY_PINS,
      original: f,
    })),
    provenance: {
      import_kind: "historical",
      original_method: {
        run_id: container.run_id,
        path: entry.path,
        sha256: entry.sha256,
        declared_version: container.method_revision ?? container.policy_version ?? null,
        unrecorded_note:
          container.method_revision || container.policy_version
            ? null
            : "The selected consolidated container records no uniform method version; field-specific historical methods remain separately attributed.",
      },
      original_record: profile,
      original_record_sha256: digest(JSON.stringify(profile)),
      field_authorities: authorities,
      dependencies: [...reader.dependencies.values()],
      mapping_receipts: [
        { kind: "field_authority_resolutions", records: resolutions },
        {
          kind: "persistence_trace_resolution",
          ...traceRef,
          resolved_record_sha256: digest(JSON.stringify(trace)),
        },
        {
          kind: "scenario_fit_resolution",
          path: fitPath,
          policy_versions: fitContainer.policy_versions,
          rows: fits.length,
        },
        {
          kind: "source_context",
          path: source.sourcePath,
          original: source.source,
          directions: source.directions,
        },
        {
          kind: "declaration_admission",
          basis:
            "Complete frozen raw formula and ordered ingredients preserved under original source admission; no fresh source acquisition or physical batch verification.",
        },
      ],
    },
  }
  return output
}

/** Publish a completed offline replay only to a new or empty non-symlink directory. */
export async function exportHistoricalReplay(root: string, output: string) {
  const { verifyAdapterReplay } = await import("./verify-adapter-replay")
  let report: ReturnType<typeof verifyAdapterReplay> | undefined
  publishDirectoryAtomically(output, (stage) => {
    const selected = loadInventory(root)
    const envelopes = selected.map((record) => buildHistoricalEnvelope(root, record))
    report = verifyAdapterReplay(root, envelopes)
    mkdirSync(path.join(stage, "envelopes"))
    const files = envelopes.map((envelope) => {
      const name = `${string(envelope.profile.product_key)}.json`
      if (!/^[a-z0-9-]+\.json$/.test(name)) throw new Error("Unsafe output product key")
      const text = `${JSON.stringify(envelope, null, 2)}\n`
      writeFileSync(path.join(stage, "envelopes", name), text, { flag: "wx" })
      return {
        product_key: envelope.profile.product_key,
        path: `envelopes/${name}`,
        sha256: digest(text),
        bytes: Buffer.byteLength(text),
      }
    })
    writeFileSync(
      path.join(stage, "manifest.json"),
      `${JSON.stringify({ version: "oil-adapter-replay-v0.2", inventory: INVENTORY_PATH, files }, null, 2)}\n`,
      { flag: "wx" },
    )
    writeFileSync(path.join(stage, "verification.json"), `${JSON.stringify(report, null, 2)}\n`, {
      flag: "wx",
    })
    writeFileSync(
      path.join(stage, "README.md"),
      `# Oil adapter replay v0.2\n\n37 inventory-selected original profiles, including corrected T02.\n\n${report.statuses.property_projection_ready} property projections; ${report.statuses.needs_research} research refusals; ${report.statuses.not_applicable} scope exclusions.\n\nFull original profiles and source-specific scenarios are retained. Original methods are distinct from current consolidation policy. The historical traces without a separate tipping assumption keep an explicit absence note.\n\nRefusals: H04 unknown weight; O04, O18 and O19 inherited formula/ledger representation conflicts. O04 additionally retains an unresolved original E01-retailer-de identity citation; that source is absent from the controlled registry. O18 also has unrepresented raw declaration text from its truncated parenthetical rank. See verification.json for exact ranks, original authorities and SHA-256 bindings. Every distinct refusal diagnostic maps to an independently established source reason. No classes were invented or frozen records corrected. Envelope bytes match the preserved first replay v0.1; this v0.2 receipt corrects its incomplete refusal explanation while preserving all v0.1 artifacts.\n\nThis verifies serialization and attribution only. It does not validate sensory accuracy, new-product classification, low-band product coverage, method lock or activation. Legacy matching tags remain manual.\n`,
      { flag: "wx" },
    )
  })
  if (!report) throw new Error("Replay publication did not produce a verification report")
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  if (args.length !== 2 || args[0] !== "--output") {
    console.error("Usage: export-historical.ts --output <new-or-empty-directory>")
    process.exitCode = 2
  } else
    exportHistoricalReplay(process.cwd(), args[1])
      .then((report) =>
        console.log(JSON.stringify({ count: report.count, statuses: report.statuses })),
      )
      .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 2
      })
}
