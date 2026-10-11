/**
 * Shampoo v1.6 two-stage sealed lane kit (runbook steps 3-4; standard Sections 2, 3.1, 3.2, 14).
 *
 * Stage A, `<out>/<lane>/formula/<id>.json`: what the blind formula pass may see, and only
 * that: canonical INCI, its fingerprint and normalization, formula completeness (ID-1),
 * formula source tier (Section 2 hierarchy), identity confidence and pack size. No product
 * name, brand, claims or directions (Section 3.1).
 *
 * Stage B, `<out>/held/<lane>/reveal/<id>.json`: product name, brand and the verbatim claims
 * and directions per source with the source's CL-SRC grade. It is held outside the lane root
 * and copied to `<out>/<lane>/reveal/` by `--release <lane>` only after the lane has written a
 * formula-pass record `<out>/<lane>/out/formula-pass/<id>.json` for every product and each record
 * passes the completeness gate below; the release log pins each record's SHA-256 (Section 3.2:
 * the blind pass is frozen first). The first release log is immutable: a re-release is allowed
 * only when every record still matches it, and the log is never rewritten.
 *
 * `build` refuses an output directory that already holds files, so a rebuild can never leave
 * a previous run's reveals or formula-pass records inside a fresh kit. Its last step writes
 * `<out>/held/build-complete.json` (the full id list and each stage-A packet's SHA-256); `release`
 * refuses without it and derives the cohort from it, so an interrupted build can never release a
 * partial cohort. A first release is "no release log AND no reveal already in the lane": a deleted
 * log over released reveals fails closed instead of minting a fresh freeze.
 *
 * The tool enforces the formula-first order for honest operation by the orchestrator; it is not a
 * security boundary against someone with write access to the kit directory.
 *
 * Each lane also gets a scrubbed copy of the standard (Section 13.10 worked examples removed),
 * and the build fails if any batch brand or product name remains in it.
 *
 * Usage:
 *   npx tsx scripts/shampoo-research/build-lane-kit.ts build <full-packets-dir> <out-dir> --seed <n> [--prefix K]
 *   npx tsx scripts/shampoo-research/build-lane-kit.ts release <out-dir> <lane-a|lane-b>
 *
 * The historical builders in data/research/shampoo-inci/v1.6/calibration/ produced single
 * packets with name, brand and claims co-delivered; they are not used for new runs.
 */
import { createHash } from "node:crypto"
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const STANDARD_PATH = "docs/research/shampoo-inci/v1.6/classification-standard.md"
const LANES = ["lane-a", "lane-b"] as const

/** CL-SRC base grade per source kind. A word in the exact product name is always `high`, and a
 * foreign manufacturer claim is graded by a German source carrying the same claim (E1); the
 * lane applies those two rules. */
const SOURCE_GRADE = {
  pack_front: "high",
  pack_back: "moderate",
  manufacturer_de: "moderate",
  manufacturer_foreign: "low",
  retailer: "low",
} as const
type SourceKind = keyof typeof SOURCE_GRADE

export type FreezePacket = {
  slot: string
  productId: string | null
  name: string
  brand: string
  packSize: string
  gtins: string[]
  sources: Array<{
    url: string
    retrievedAt: string
    sourceType: string
    sourceKind: SourceKind
    gtinShown: string | null
    inciVerbatim: string | null
    claimsVerbatim: string | null
    directionsVerbatim: string | null
  }>
  conflicts: unknown[]
  canonicalInci: string[]
  canonicalReason: string
  inciFingerprintSha256: string
  normalization: string
  identityConfidence: "high" | "moderate" | "low"
  formulaCompleteness?: "complete" | "not_known_complete"
  formulaSourceTier?: 1 | 2 | 3 | 4
  status: "frozen" | "frozen_with_conflict" | "blocked"
  blockReason: string | null
  notes: string
}

/** Runbook step 2 fingerprint: lower-case, trim, collapse whitespace, join with `|`, SHA-256. */
export function inciFingerprint(inci: string[]) {
  const normalized = inci.map((entry) => entry.trim().toLowerCase().replace(/\s+/g, " ")).join("|")
  return createHash("sha256").update(normalized, "utf8").digest("hex")
}

function validate(p: FreezePacket) {
  const where = `packet ${p.slot}`
  if (p.formulaCompleteness !== "complete" && p.formulaCompleteness !== "not_known_complete")
    throw new Error(`${where}: formulaCompleteness must be complete | not_known_complete (ID-1)`)
  if (![1, 2, 3, 4].includes(p.formulaSourceTier as number))
    throw new Error(`${where}: formulaSourceTier must be 1-4 (Section 2 source hierarchy)`)
  if (!["high", "moderate", "low"].includes(p.identityConfidence))
    throw new Error(`${where}: identityConfidence must be high | moderate | low`)
  if (inciFingerprint(p.canonicalInci) !== p.inciFingerprintSha256)
    throw new Error(`${where}: inciFingerprintSha256 does not match canonicalInci (fingerprint)`)
  for (const source of p.sources)
    if (!(source.sourceKind in SOURCE_GRADE))
      throw new Error(
        `${where}: sourceKind ${String(source.sourceKind)} not in ${Object.keys(SOURCE_GRADE).join(", ")}`,
      )
}

function seededShuffle<T>(items: T[], seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Section 13.10 and two catalog references name products (the same scrub as the historical
 * kits); they are dropped, and no batch brand or product name may remain. */
export function scrubStandard(standardText: string, packets: FreezePacket[]) {
  const scrubbed = standardText
    .replace(/### 13\.10 Worked examples[\s\S]*?(?=### 13\.11)/, "")
    .replace(", e.g. OGX Renewing stays visible for normal hair", "")
    .replace(
      /\(pattern: Balea, regular-shampoo record `[^`]*` plus deep-cleanser record `[^`]*`, which owns the barcode\)/,
      "(an existing pattern in the catalog)",
    )
  const leaks = packets
    .flatMap((p) => [p.brand, p.name])
    .filter((term) => term && scrubbed.toLowerCase().includes(term.toLowerCase()))
  if (leaks.length)
    throw new Error(`scrubbed standard still names batch products: ${leaks.join(", ")}`)
  return scrubbed
}

/** Formula-stage fields a formula-pass record must carry before the reveal is released
 * (runbook step 4): the record's own blind id, the stage-A fingerprint it was written against,
 * and the three formula-derived direct properties with a value and a rationale each. */
export const REQUIRED_FORMULA_PASS_PROPERTIES = [
  "cleansingStrength",
  "conditioningLevel",
  "weightPotential",
] as const

const isFilledString = (value: unknown) => typeof value === "string" && value.trim() !== ""

function validateFormulaPassRecord(options: {
  lane: string
  id: string
  passBytes: Buffer
  formulaBytes: Buffer
}) {
  const { lane, id, passBytes, formulaBytes } = options
  const where = `${lane}: formula-pass record ${id}`
  let record: unknown
  try {
    record = JSON.parse(passBytes.toString("utf8"))
  } catch {
    throw new Error(`${where}: is not valid JSON`)
  }
  const object = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
  if (!object(record)) throw new Error(`${where}: blindId missing (record is not a JSON object)`)
  if (record.blindId !== id)
    throw new Error(`${where}: blindId must equal "${id}", found ${JSON.stringify(record.blindId)}`)
  const expected = (JSON.parse(formulaBytes.toString("utf8")) as { inciFingerprintSha256: string })
    .inciFingerprintSha256
  if (record.inciFingerprintSha256 !== expected)
    throw new Error(
      `${where}: inciFingerprintSha256 must match the stage-A packet (${expected}), found ${JSON.stringify(record.inciFingerprintSha256)}`,
    )
  const properties = object(record.directProperties) ? record.directProperties : {}
  for (const name of REQUIRED_FORMULA_PASS_PROPERTIES) {
    const property = properties[name]
    if (!object(property)) throw new Error(`${where}: directProperties.${name} missing`)
    for (const field of ["value", "rationale"] as const)
      if (!isFilledString(property[field]))
        throw new Error(`${where}: directProperties.${name}.${field} missing or empty`)
  }
}

const sha256Bytes = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex")

/** Blind-id prefix: one capital letter, then up to seven capitals or digits. */
const ID_PREFIX = /^[A-Z][A-Z0-9]{0,7}$/
const ID_PATTERN = /^[A-Z][A-Z0-9]{0,7}\d{2,}$/

/** Join `parts` under `root` and assert the result is still inside `root`. */
export function resolveInside(root: string, ...parts: string[]) {
  const resolvedRoot = path.resolve(root)
  const target = path.resolve(resolvedRoot, ...parts)
  const relative = path.relative(resolvedRoot, target)
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error(`path ${JSON.stringify(parts.join("/"))} resolves outside ${resolvedRoot}`)
  return target
}

/** Writes JSON under `root` and returns the SHA-256 of the exact bytes written. */
const writeJson = (root: string, parts: string[], data: unknown) => {
  const file = resolveInside(root, ...parts)
  const text = `${JSON.stringify(data, null, 2)}\n`
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
  return sha256Bytes(text)
}

/** Reads a regular file once; a missing path returns null, a symlink or other type is refused. */
function readRegularFile(file: string, label: string): Buffer | null {
  let stat
  try {
    stat = lstatSync(file)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
  if (stat.isSymbolicLink()) throw new Error(`${label}: is a symlink; only regular files are read`)
  if (!stat.isFile()) throw new Error(`${label}: is not a regular file`)
  return readFileSync(file)
}

const BUILD_MARKER = "build-complete.json"

export function buildLaneKit(options: {
  packets: FreezePacket[]
  standardText: string
  outDir: string
  seed: number
  prefix?: string
}) {
  const prefix = options.prefix ?? "K"
  if (!ID_PREFIX.test(prefix))
    throw new Error(`prefix ${JSON.stringify(prefix)} must match ${ID_PREFIX} (blind id prefix)`)
  const packets = options.packets.filter((p) => p.status !== "blocked")
  packets.forEach(validate)
  if (existsSync(options.outDir) && readdirSync(options.outDir).length > 0)
    throw new Error(
      `output directory ${options.outDir} exists and is not empty; build into a new or empty directory (a rebuild would leave stale reveals and formula-pass records)`,
    )
  const standard = scrubStandard(options.standardText, packets)
  const stageASha256: Record<string, Record<string, string>> = { "lane-a": {}, "lane-b": {} }
  const mapping = seededShuffle(packets, options.seed).map((p, index) => {
    const blindId = `${prefix}${String(index + 1).padStart(2, "0")}`
    const formula = {
      blindId,
      packSize: p.packSize,
      canonicalInci: p.canonicalInci,
      inciFingerprintSha256: p.inciFingerprintSha256,
      normalization: p.normalization,
      formulaCompleteness: p.formulaCompleteness,
      formulaSourceTier: p.formulaSourceTier,
      identityConfidence: p.identityConfidence,
    }
    const reveal = {
      blindId,
      productName: p.name,
      brand: p.brand,
      positioningSources: p.sources
        .filter((s) => s.claimsVerbatim || s.directionsVerbatim)
        .map((s) => ({
          sourceType: s.sourceType,
          sourceKind: s.sourceKind,
          sourceGrade: SOURCE_GRADE[s.sourceKind],
          claimsVerbatim: s.claimsVerbatim ?? "",
          directionsVerbatim: s.directionsVerbatim ?? "",
        })),
    }
    for (const lane of LANES) {
      stageASha256[lane]![blindId] = writeJson(
        options.outDir,
        [lane, "formula", `${blindId}.json`],
        formula,
      )
      writeJson(options.outDir, ["held", lane, "reveal", `${blindId}.json`], reveal)
    }
    return { blindId, slot: p.slot, productId: p.productId, fingerprint: p.inciFingerprintSha256 }
  })
  for (const lane of LANES) {
    mkdirSync(resolveInside(options.outDir, lane, "out", "formula-pass"), { recursive: true })
    writeFileSync(resolveInside(options.outDir, lane, "classification-standard.md"), standard)
  }
  // The mapping stays outside every lane root.
  writeJson(options.outDir, ["blind-mapping.json"], mapping)
  // Last step: `release` refuses a kit without this marker (an interrupted build).
  writeJson(options.outDir, ["held", BUILD_MARKER], {
    builtAt: new Date().toISOString(),
    ids: mapping.map((entry) => entry.blindId).sort(),
    stageASha256,
  })
  return { mapping }
}

export function releaseReveal(outDir: string, lane: string) {
  if (!(LANES as readonly string[]).includes(lane))
    throw new Error(`unknown lane ${JSON.stringify(lane)}; expected ${LANES.join(" | ")}`)
  const held = path.join(outDir, "held", lane, "reveal")
  const passDir = path.join(outDir, lane, "out", "formula-pass")

  // The cohort comes from the completion marker, never from whatever files happen to exist.
  const markerBytes = readRegularFile(
    path.join(outDir, "held", BUILD_MARKER),
    "build-complete marker",
  )
  if (!markerBytes)
    throw new Error(
      `${lane}: held/${BUILD_MARKER} missing; the build did not complete, so no reveal is released`,
    )
  let marker: { ids: string[]; stageASha256: Record<string, Record<string, string>> }
  try {
    marker = JSON.parse(markerBytes.toString("utf8"))
  } catch {
    throw new Error(`${lane}: held/${BUILD_MARKER} is not valid JSON`)
  }
  const stageA = marker.stageASha256?.[lane]
  if (
    !Array.isArray(marker.ids) ||
    marker.ids.length === 0 ||
    !marker.ids.every((id) => typeof id === "string" && ID_PATTERN.test(id)) ||
    !stageA
  )
    throw new Error(`${lane}: held/${BUILD_MARKER} is malformed (ids / stageASha256.${lane})`)
  const ids = [...marker.ids].sort()

  const unrecorded = (existsSync(held) ? readdirSync(held) : [])
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .filter((id) => !ids.includes(id))
  if (unrecorded.length)
    throw new Error(`${lane}: held reveal ${unrecorded.join(", ")} not recorded in ${BUILD_MARKER}`)

  const formulaBytes: Record<string, Buffer> = {}
  for (const id of ids) {
    if (!readRegularFile(path.join(held, `${id}.json`), `${lane}: held reveal ${id}`))
      throw new Error(`${lane}: held reveal ${id} missing; the kit is incomplete`)
    const bytes = readRegularFile(
      path.join(outDir, lane, "formula", `${id}.json`),
      `${lane}: stage-A packet ${id}`,
    )
    if (!bytes) throw new Error(`${lane}: stage-A packet ${id} missing; the kit is incomplete`)
    if (sha256Bytes(bytes) !== stageA[id])
      throw new Error(
        `${lane}: stage-A packet ${id} changed since the build (does not match ${BUILD_MARKER})`,
      )
    formulaBytes[id] = bytes
  }

  // Each formula-pass record is read once; the same buffer is validated and hashed.
  const passBytes: Record<string, Buffer> = {}
  const missing: string[] = []
  for (const id of ids) {
    const bytes = readRegularFile(
      path.join(passDir, `${id}.json`),
      `${lane}: formula-pass record ${id}`,
    )
    if (bytes) passBytes[id] = bytes
    else missing.push(id)
  }
  if (missing.length)
    throw new Error(`${lane}: no formula-pass record yet for ${missing.join(", ")}`)
  const formulaPassSha256: Record<string, string> = {}
  for (const id of ids) {
    validateFormulaPassRecord({
      lane,
      id,
      passBytes: passBytes[id]!,
      formulaBytes: formulaBytes[id]!,
    })
    formulaPassSha256[id] = sha256Bytes(passBytes[id]!)
  }

  const logFile = path.join(outDir, "held", lane, "release-log.json")
  const revealDir = path.join(outDir, lane, "reveal")
  const logBytes = readRegularFile(logFile, `${lane}: release log`)
  if (logBytes) {
    // The first release log is the freeze evidence: re-release must match it exactly.
    const logged = (
      JSON.parse(logBytes.toString("utf8")) as {
        formulaPassSha256: Record<string, string>
      }
    ).formulaPassSha256
    const problems = [
      ...ids.filter((id) => !(id in logged)).map((id) => `${id} added after release`),
      ...Object.keys(logged)
        .filter((id) => !ids.includes(id))
        .map((id) => `${id} removed after release`),
      ...ids
        .filter((id) => id in logged && logged[id] !== formulaPassSha256[id])
        .map((id) => `${id} changed after release`),
    ]
    if (problems.length)
      throw new Error(
        `${lane}: release log already exists and no longer matches the formula-pass records (${problems.join("; ")}); the log is not rewritten`,
      )
  } else {
    // First release = no log AND no reveal already in the lane. A missing log over released
    // reveals is lost freeze evidence, not a fresh start.
    if (existsSync(revealDir) && readdirSync(revealDir).length > 0)
      throw new Error(
        `${lane}: release evidence missing but reveals already released (${logFile} is absent while ${revealDir} holds packets); the freeze cannot be re-established`,
      )
    writeJson(outDir, ["held", lane, "release-log.json"], {
      lane,
      releasedAt: new Date().toISOString(),
      formulaPassSha256,
    })
  }
  mkdirSync(revealDir, { recursive: true })
  for (const id of ids)
    copyFileSync(path.join(held, `${id}.json`), path.join(revealDir, `${id}.json`))
  return ids.map((blindId) => ({ blindId, formulaPassSha256: formulaPassSha256[blindId] }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command, ...args] = process.argv.slice(2)
  const flag = (name: string) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }
  if (command === "build" && args[0] && args[1] && flag("--seed")) {
    const packets = readdirSync(args[0])
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => JSON.parse(readFileSync(path.join(args[0]!, file), "utf8")) as FreezePacket)
    const { mapping } = buildLaneKit({
      packets,
      standardText: readFileSync(STANDARD_PATH, "utf8"),
      outDir: args[1],
      seed: Number(flag("--seed")),
      prefix: flag("--prefix"),
    })
    console.log(
      `${mapping.length} products; formula packets in <out>/<lane>/formula, reveal held in <out>/held`,
    )
  } else if (command === "release" && args[0] && args[1]) {
    console.log(`${releaseReveal(args[0], args[1]).length} reveal packets released to ${args[1]}`)
  } else {
    console.error(
      "usage: build-lane-kit.ts build <full-packets-dir> <out-dir> --seed <n> [--prefix K]\n" +
        "       build-lane-kit.ts release <out-dir> <lane-a|lane-b>",
    )
    process.exit(2)
  }
}
