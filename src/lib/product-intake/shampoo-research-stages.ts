import { createHash, randomBytes } from "node:crypto"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  buildLaneKit,
  inciFingerprint,
  releaseReveal,
  blindPackSize,
  STAGE_A_NORMALIZATION,
  type FreezePacket,
} from "../../../scripts/shampoo-research/build-lane-kit"
import {
  SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD as METHOD,
  SHAMPOO_PRODUCTION_LIGHT_VERSION,
} from "@/lib/shampoo/production-light-adapter"
import { canonicalJson } from "@/lib/product-intake/catalog-enrichment/stage5-v2-application"
import { canonicalizeGtin } from "@/lib/product-identity/normalize"

type JsonRecord = Record<string, unknown>
export const SHAMPOO_STAGE_PROOF_KIND = "shampoo_research_stages_v1"
export type ShampooStageModelRequest = {
  stage: "source_freeze" | "blind_formula" | "revealed_final" | "revealed_repair"
  prompt: string
  outputPath: string
  cwd: string
  webSearch: "disabled" | "live"
}
type Snapshot = { bytes: string; sha256: string }
const ROOT = fileURLToPath(new URL("../../../", import.meta.url))
const PROPERTY_NAMES = [
  "cleansingStrength",
  "conditioningLevel",
  "weightPotential",
  "focusPrimary",
  "focusSecondary",
  "usageRole",
  "scalpComfortTarget",
  "dandruffSupport",
]
const object = (v: unknown): v is JsonRecord => !!v && typeof v === "object" && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0
const hash = (v: string) => createHash("sha256").update(v).digest("hex")
const same = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => same(v, b[i]))
  if (object(a) && object(b))
    return (
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every((k) => same(a[k], b[k]))
    )
  return a === b
}
const snapshot = (v: unknown): Snapshot => {
  const bytes = JSON.stringify(v)
  return { bytes, sha256: hash(bytes) }
}
class EvidenceError extends Error {}
function requireEvidence(ok: unknown, reason: string): asserts ok {
  if (!ok) throw new EvidenceError(reason)
}
function readSnapshot(v: unknown): JsonRecord {
  requireEvidence(
    object(v) && text(v.bytes) && v.sha256 === hash(v.bytes),
    "Beschädigte eingefrorene Recherche.",
  )
  let parsed: unknown
  try {
    parsed = JSON.parse(v.bytes)
  } catch {
    throw new EvidenceError("Ungültige eingefrorene JSON-Recherche.")
  }
  requireEvidence(object(parsed), "Ungültige eingefrorene Recherche.")
  return parsed
}
function methodTexts() {
  const standard = readFileSync(
    path.join(ROOT, "docs/research/shampoo-inci/v1.6.2/classification-standard.md"),
    "utf8",
  )
  const runbook = readFileSync(
    path.join(ROOT, "docs/research/shampoo-inci/v1.6.2/runbook.md"),
    "utf8",
  )
  requireEvidence(
    hash(standard) === METHOD.policySha256 && hash(runbook) === METHOD.runbookSha256,
    "Die eingefrorene Shampoo-Methode stimmt nicht mit den geprüften Dateien überein.",
  )
  return { standard, runbook }
}
// Commas inside synonym parentheses are part of one ingredient (ID-2).
function sourceIngredients(raw: string): string[] {
  let depth = 0,
    current = ""
  const values: string[] = []
  for (const char of raw.replace(/^\s*(?:ingredients|inhaltsstoffe|inci)\s*:\s*/i, "")) {
    if (char === "(") depth++
    if (char === ")") depth--
    if ((char === "," || char === ";") && depth === 0) {
      values.push(current)
      current = ""
    } else current += char
  }
  requireEvidence(depth === 0, "Die INCI-Liste konnte nicht eindeutig gelesen werden.")
  values.push(current)
  return values.map((v) => v.replace(/\*/g, "").trim()).filter(Boolean)
}
// Consume the synonym grammar once. Overlapping whitespace repetitions in a
// regex can backtrack exponentially on a malformed source ingredient.
function isWaterSynonymSequence(value: string): boolean {
  let index = 0
  const word = () => {
    for (const synonym of ["aqua", "water", "eau"])
      if (value.startsWith(synonym, index)) {
        index += synonym.length
        return true
      }
    return false
  }
  const spaces = () => {
    while (value[index] === " ") index++
  }
  if (!word()) return false
  while (index < value.length) {
    spaces()
    if (value[index] !== "/" && value[index] !== "(" && value[index] !== ",") return false
    index++
    spaces()
    if (!word()) return false
    spaces()
    if (value[index] === ")") index++
  }
  return true
}
function formulaKey(list: string[]): string {
  // Accept equivalent water synonym spellings only; never merge unrelated INCI entries.
  return list
    .map((v) => v.toLowerCase().replace(/\*/g, "").replace(/\s+/g, " ").trim())
    .map((v) => (isWaterSynonymSequence(v) ? "aqua" : v))
    .filter((v, i, all) => !(v === "aqua" && i > 0 && all[i - 1] === "aqua"))
    .join("|")
}
function validateFreeze(
  raw: unknown,
  submissionId: string,
): { freeze: FreezePacket; formula: JsonRecord } {
  requireEvidence(object(raw), "inci_unavailable: Die eingefrorene Formel fehlt.")
  requireEvidence(
    raw.productId === submissionId,
    "identity_conflict: Die Produktzuordnung stimmt nicht überein.",
  )
  requireEvidence(
    raw.status === "frozen" &&
      raw.blockReason === null &&
      Array.isArray(raw.conflicts) &&
      raw.conflicts.length === 0,
    "identity_conflict: Offene Quellen- oder Formelkonflikte müssen geklärt werden.",
  )
  requireEvidence(
    text(raw.name) &&
      text(raw.brand) &&
      text(raw.packSize) &&
      text(raw.slot) &&
      text(raw.canonicalReason),
    "identity_conflict: Die genaue Produktidentität ist unvollständig.",
  )
  requireEvidence(
    ["high", "moderate"].includes(String(raw.identityConfidence)) &&
      raw.formulaCompleteness === "complete" &&
      [1, 2, 3, 4].includes(Number(raw.formulaSourceTier)),
    "inci_unavailable: Identität oder vollständige deutsche Formel ist nicht gesichert.",
  )
  requireEvidence(
    Array.isArray(raw.canonicalInci) &&
      raw.canonicalInci.length >= 2 &&
      raw.canonicalInci.every(text),
    "inci_unavailable: Die vollständige INCI-Liste fehlt.",
  )
  const canonical = raw.canonicalInci as string[]
  requireEvidence(
    canonical.every((ingredient) => !/https?:\/\/|\*/i.test(ingredient)),
    "inci_unavailable: Die kanonische INCI-Liste enthält nicht normalisierte Einträge.",
  )
  const fingerprint = inciFingerprint(canonical)
  requireEvidence(
    raw.inciFingerprintSha256 === fingerprint,
    "identity_conflict: Der Formel-Fingerabdruck stimmt nicht mit der INCI-Liste überein.",
  )
  requireEvidence(
    Array.isArray(raw.gtins) && raw.gtins.every((v) => text(v) && canonicalizeGtin(v)),
    "identity_conflict: Ungültige GTIN-Zuordnung.",
  )
  const gtins = (raw.gtins as string[]).map(canonicalizeGtin)
  requireEvidence(new Set(gtins).size === gtins.length, "identity_conflict: Doppelte GTIN-Aliasse.")
  requireEvidence(
    Array.isArray(raw.sources) && raw.sources.length > 0,
    "inci_unavailable: Die deutsche Originalquelle fehlt.",
  )
  const sources = raw.sources.filter(object)
  requireEvidence(
    sources.length === raw.sources.length &&
      sources.every(
        (s) =>
          text(s.url) &&
          /^https?:\/\//i.test(s.url) &&
          text(s.retrievedAt) &&
          Number.isFinite(Date.parse(s.retrievedAt)) &&
          text(s.sourceType) &&
          [
            "pack_front",
            "pack_back",
            "manufacturer_de",
            "manufacturer_foreign",
            "retailer",
          ].includes(String(s.sourceKind)),
      ),
    "inci_unavailable: Ungültige Quellenbelege.",
  )
  const source = sources.find((s) => {
    if (!text(s.inciVerbatim)) return false
    const anchored = text(s.gtinShown) && gtins.includes(canonicalizeGtin(s.gtinShown))
    let hostname: string
    try {
      hostname = new URL(s.url as string).hostname
    } catch {
      return false
    }
    const tierMatches =
      s.sourceKind === "manufacturer_de"
        ? raw.formulaSourceTier === 2
        : ["pack_front", "pack_back"].includes(String(s.sourceKind))
          ? raw.formulaSourceTier === 1
          : [3, 4].includes(Number(raw.formulaSourceTier))
    const german =
      s.sourceKind === "manufacturer_de" ||
      (anchored && ["pack_front", "pack_back"].includes(String(s.sourceKind))) ||
      (anchored && s.sourceKind === "retailer" && (hostname.endsWith(".de") || s.market === "DE"))
    const matchingGtin = !text(s.gtinShown) || anchored
    return (
      tierMatches &&
      german &&
      matchingGtin &&
      formulaKey(sourceIngredients(s.inciVerbatim)) === formulaKey(canonical)
    )
  })
  requireEvidence(
    source,
    "inci_unavailable: Keine eindeutig passende deutsche Quelle für die kanonische INCI-Liste.",
  )
  const freeze = structuredClone(raw) as unknown as FreezePacket
  return {
    freeze,
    formula: {
      raw_inci: source.inciVerbatim,
      source_url: source.url,
      normalized_ingredients: [...canonical],
      formulaFingerprintSha256: fingerprint,
    },
  }
}
function validateRequestedIdentity(packet: JsonRecord, freeze: FreezePacket) {
  requireEvidence(
    packet.submission_id === undefined || packet.submission_id === freeze.productId,
    "identity_conflict: Die Anfrage gehört zu einem anderen Produkt.",
  )
  const context = object(packet.brand_resolution_context) ? packet.brand_resolution_context : {}
  const identifier = object(context.scanned_identifier)
    ? context.scanned_identifier
    : object(packet.scanned_identifier)
      ? packet.scanned_identifier
      : null
  if (
    identifier &&
    ["ean", "gtin", "barcode"].includes(String(identifier.type)) &&
    text(identifier.value)
  ) {
    const canonical = canonicalizeGtin(identifier.value)
    requireEvidence(
      canonical && freeze.gtins.map(canonicalizeGtin).includes(canonical),
      "identity_conflict: Die eingefrorene Formel gehört nicht zum gescannten Produkt.",
    )
  }
}
function validateFormulaBindings(record: JsonRecord, freeze: FreezePacket) {
  for (const key of ["inciFingerprintSha256", "formulaFingerprintSha256"])
    requireEvidence(
      record[key] === undefined || record[key] === freeze.inciFingerprintSha256,
      "identity_conflict: Abweichender Formel-Fingerabdruck im Rechercheergebnis.",
    )
  for (const key of ["raw_inci", "rawInci", "canonicalInci"]) {
    const value = record[key]
    if (value !== undefined) {
      requireEvidence(
        text(value) || (Array.isArray(value) && value.every(text)),
        "identity_conflict: Ungültige finale Formel.",
      )
      requireEvidence(
        formulaKey(
          Array.isArray(value) ? (value as string[]) : sourceIngredients(value as string),
        ) === formulaKey(freeze.canonicalInci),
        "identity_conflict: Geänderte Formel im Rechercheergebnis.",
      )
    }
  }
}
function stageA(freeze: FreezePacket, blindId: string): JsonRecord {
  return {
    blindId,
    packSize: blindPackSize(freeze.packSize),
    canonicalInci: freeze.canonicalInci,
    inciFingerprintSha256: freeze.inciFingerprintSha256,
    normalization: STAGE_A_NORMALIZATION,
    formulaCompleteness: freeze.formulaCompleteness,
    formulaSourceTier: freeze.formulaSourceTier,
    identityConfidence: freeze.identityConfidence,
  }
}
function validateBlind(blind: JsonRecord, packet: JsonRecord) {
  requireEvidence(
    blind.blindId === packet.blindId &&
      blind.inciFingerprintSha256 === packet.inciFingerprintSha256,
    "Die blinde Formelprüfung gehört nicht zu dieser Formel.",
  )
  const properties = blind.directProperties
  requireEvidence(
    object(properties) &&
      PROPERTY_NAMES.every((name) => {
        const p = properties[name]
        return (
          object(p) &&
          (text(p.value) || (name === "focusSecondary" && Array.isArray(p.value))) &&
          text(p.rationale) &&
          ["low", "moderate", "high"].includes(String(p.confidence))
        )
      }),
    "Die blinde Formelprüfung enthält nicht alle acht begründeten Eigenschaften.",
  )
  requireEvidence(
    object(blind.formulaFacts) &&
      Object.keys(blind.formulaFacts).length > 0 &&
      Array.isArray(blind.unresolvedMaterialIngredients),
    "Die blinden Formelbelege oder die Liste ungeklärter Inhaltsstoffe fehlen.",
  )
  requireEvidence(
    blind.unresolvedMaterialIngredients.length === 0,
    "Ungeklärte wesentliche Inhaltsstoffe benötigen eine neue Prüfung.",
  )
}
function nativeRecords(output: JsonRecord): JsonRecord[] {
  if (!Array.isArray(output.artifacts)) return []
  return output.artifacts
    .filter(object)
    .filter(
      (a) =>
        a.kind === "property_synthesis" &&
        object(a.payload) &&
        object(a.payload.shampoo_research_envelope),
    )
    .map((a) => (a.payload as JsonRecord).shampoo_research_envelope as JsonRecord)
}
function bindOutput(raw: JsonRecord, freeze: FreezePacket, formula: JsonRecord): JsonRecord {
  const output = structuredClone(raw)
  for (const native of nativeRecords(output)) {
    validateFormulaBindings(native, freeze)
    if (object(native.formula)) validateFormulaBindings(native.formula, freeze)
    requireEvidence(
      native.researchMethod === undefined || same(native.researchMethod, METHOD),
      "identity_conflict: Die gelieferte Forschungsmethode wurde verändert.",
    )
    for (const key of ["standard", "policy", "policyId"])
      requireEvidence(
        native[key] === undefined || native[key] === METHOD.policyId,
        "identity_conflict: Abweichende Shampoo-Version.",
      )
    requireEvidence(
      native.version === undefined || native.version === SHAMPOO_PRODUCTION_LIGHT_VERSION,
      "identity_conflict: Abweichende Envelope-Version.",
    )
    requireEvidence(
      native.identity === undefined || object(native.identity),
      "identity_conflict: Ungültige native Identität.",
    )
    const identity = (native.identity ?? {}) as JsonRecord
    validateFormulaBindings(identity, freeze)
    const bindings: JsonRecord = {
      productId: freeze.productId,
      formulaFingerprintSha256: freeze.inciFingerprintSha256,
      market: "DE",
      productName: freeze.name,
      brand: freeze.brand,
      packSize: freeze.packSize,
      gtinAliases: freeze.gtins,
      completeness: "complete",
      identityConfidence: freeze.identityConfidence,
    }
    for (const [key, expected] of Object.entries(bindings))
      requireEvidence(
        identity[key] === undefined || same(identity[key], expected),
        `identity_conflict: Abweichende native Produkt- oder Formelbindung (${key}).`,
      )
    native.identity = { ...identity, ...bindings }
    native.researchMethod = { ...METHOD }
    native.version = SHAMPOO_PRODUCTION_LIGHT_VERSION
  }
  if (object(output.researched_payload)) {
    // Research produces a proposal. Human data/image/publication approval never comes from a model.
    if (object(output.researched_payload.final))
      output.researched_payload.final.review = { manual_reviewed: false }
    const draft = object(output.researched_payload.draft) ? output.researched_payload.draft : {}
    if (object(draft.formula) && text(draft.formula.raw_inci))
      requireEvidence(
        formulaKey(sourceIngredients(draft.formula.raw_inci)) === formulaKey(freeze.canonicalInci),
        "identity_conflict: Die finale INCI-Liste weicht von der eingefrorenen Formel ab.",
      )
    output.researched_payload.draft = {
      ...draft,
      formula: { ...(object(draft.formula) ? draft.formula : {}), ...formula },
    }
  }
  return output
}
function proofSeal(proof: JsonRecord): JsonRecord {
  const unsigned = { ...proof }
  delete unsigned.proofSha256
  return { ...unsigned, proofSha256: hash(canonicalJson(unsigned)) }
}
function decodedProof(value: unknown, binding: { submissionId: string; reviewCycleId: string }) {
  requireEvidence(
    object(value) &&
      value.kind === SHAMPOO_STAGE_PROOF_KIND &&
      value.submissionId === binding.submissionId &&
      value.reviewCycleId === binding.reviewCycleId &&
      same(value.researchMethod, METHOD),
    "Die gespeicherte Formelprüfung gehört nicht zu diesem Produkt, Prüfzyklus oder Verfahren.",
  )
  requireEvidence(
    value.proofSha256 === proofSeal(value).proofSha256,
    "Die gespeicherte Formelprüfung wurde verändert.",
  )
  const freeze = readSnapshot(value.freeze)
  const validated = validateFreeze(freeze, binding.submissionId)
  const a = readSnapshot(value.stageA),
    blind = readSnapshot(value.blind)
  requireEvidence(
    text(a.blindId) &&
      same(a, stageA(validated.freeze, a.blindId)) &&
      value.formulaFingerprintSha256 === validated.freeze.inciFingerprintSha256,
    "Die gespeicherte blinde Formelgrundlage wurde verändert.",
  )
  validateBlind(blind, a)
  const context = readSnapshot(value.context),
    revealed = readSnapshot(value.revealed)
  requireEvidence(
    same(revealed, bindOutput(revealed, validated.freeze, validated.formula)),
    "Abweichende gespeicherte finale Formelbindung.",
  )
  requireEvidence(
    Array.isArray(value.repairs) && value.repairs.length <= 2,
    "Ungültige Korrekturhistorie.",
  )
  for (const repair of value.repairs) {
    const output = readSnapshot(repair)
    requireEvidence(
      same(output, bindOutput(output, validated.freeze, validated.formula)),
      "Abweichende Formel in der Korrekturhistorie.",
    )
  }
  return { proof: value, ...validated, a, blind, context, revealed }
}
export function validateShampooStageProof(
  proof: unknown,
  binding: { submissionId: string; reviewCycleId: string; envelope?: unknown },
): { ok: true; formulaFingerprintSha256: string } | { ok: false; reason: string } {
  try {
    methodTexts()
    const decoded = decodedProof(proof, binding)
    if (binding.envelope !== undefined) {
      const repairs = decoded.proof.repairs as unknown[]
      const latest = repairs.length ? readSnapshot(repairs.at(-1)) : decoded.revealed
      const natives = nativeRecords(latest)
      requireEvidence(
        natives.length === 1 && same(natives[0], binding.envelope),
        "Die native Recherche stimmt nicht mit der eingefrorenen finalen Prüfung überein.",
      )
    }
    return { ok: true, formulaFingerprintSha256: decoded.freeze.inciFingerprintSha256 }
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof EvidenceError ? error.message : "Ungültige gespeicherte Shampoo-Prüfung.",
    }
  }
}
function blocked(
  reason: string,
  proof: JsonRecord | null = null,
  formula: JsonRecord | null = null,
) {
  return {
    output: {
      summary: "Shampoo-Recherche benötigt eine Entscheidung.",
      blockers: [
        /^(identity_conflict|inci_unavailable):/.test(reason)
          ? reason
          : `user_info_needed: ${reason}`,
      ],
      researched_payload: null,
      artifacts: [],
    },
    proof,
    formula,
  }
}
const SOURCE_INSTRUCTIONS = `Resolve the exact German Shampoo identity and current complete formula, without classifying properties. Return {freeze_packet, intake_draft}. freeze_packet fields: slot, productId (exact submission_id), name, brand, packSize, gtins[], sources[{url,retrievedAt,sourceType,sourceKind,gtinShown,inciVerbatim,claimsVerbatim,directionsVerbatim}], conflicts[], canonicalInci[], canonicalReason, inciFingerprintSha256, normalization, identityConfidence, formulaCompleteness, formulaSourceTier, status, blockReason, notes. Preserve all conflicting source lists. Only status frozen, complete formula, moderate/high identity and no unresolved conflicts may continue. Capture exact German manufacturer or GTIN-anchored German pack/retailer evidence and verbatim INCI. Fingerprint: lower-case, trim, collapse whitespace on canonical list items, join with |, SHA-256. ID-2: merge synonym entries before numbering, strip marker characters but retain their provenance. intake_draft preserves sourced exact-product identity, directions, commerce and image context needed for final ordinary intake output. No catalog values or previous classifications. No approval/publication.`
const BLIND_INSTRUCTIONS = `Perform only the blind formula pass under the supplied locked standard. No web, no other files, no identity lookup. Return JSON with blindId and inciFingerprintSha256 exactly matching the formula packet, directProperties for all eight properties (value, confidence, rationale, formula facts/normalized positions and counter-signals), formulaFacts with normalized positions, unresolvedMaterialIngredients[]. Claims-dependent properties are provisional; record uncertainty. Do not infer a brand or product name. Record weight subjudgments and supporting/counter evidence. Nothing is approved or published.`
function revealedPrompt(input: JsonRecord, standard: string, runbook: string, repair: boolean) {
  return `${repair ? "Correct the final intake package using the unchanged frozen blind assessment. Never refreeze or reinterpret a different formula." : "Reconcile the frozen blind assessment with the now-released exact product claims and directions."}\nNo web or new evidence. Preserve all formula-only judgments unless a documented method error requires correction; claims cannot upgrade them. Record every blind-to-final change with evidence, full weight/focus reasoning, selfCheck, uncertainties and normalized formula facts. Return the ordinary intake JSON object {summary,blockers,researched_payload:{draft,final},artifacts:[{kind:'property_synthesis',payload:{shampoo_research_envelope:<complete native v1.6.2 record>}}]}. Preserve exact identity and formula. The native record requires directProperties (eight fields with value/confidence/rationale/ruleIds), identity, projection (thicknessFit and confidence for fine/normal/coarse, thicknessRationale, weight/confidence/rationale, scalpTargets, cleansingIntensity/confidence/rationale, explicitResetPositioning, deepCleanserListing/confidence/rationale, rows, requiredProtocolRoles, reviewFlags, informationalNotes). Preserve source-backed protocols/commerce/image evidence in the ordinary intake schema from context. No model-created formula, model_run, model_judgment, stage proofs or approval/publication flags. The server binds identity/method and computes current-storage rows. D2 retains ordinary Shampoo and requests a separate listing decision.\nCONTEXT\n${JSON.stringify(input)}\nSTANDARD\n${standard}\nRUNBOOK\n${runbook}`
}
export async function runShampooResearchStages(params: {
  packet: JsonRecord
  submissionId: string
  reviewCycleId: string
  reservedModelRuns: number
  priorProof?: unknown
  model: (request: ShampooStageModelRequest) => Promise<JsonRecord>
  allowUnfinishedSourceRetry?: boolean
}): Promise<{ output: JsonRecord; proof: JsonRecord | null; formula: JsonRecord | null }> {
  let ownedRoot: string | undefined
  try {
    const { standard, runbook } = methodTexts()
    requireEvidence(
      text(params.submissionId) && text(params.reviewCycleId),
      "Produkt oder Prüfzyklus fehlt.",
    )
    requireEvidence(
      Number.isInteger(params.reservedModelRuns) &&
        params.reservedModelRuns >= 0 &&
        params.reservedModelRuns <= 4,
      "Für Recherche und Qualitätsprüfung reicht das verbleibende Budget nicht aus.",
    )
    let prior: ReturnType<typeof decodedProof> | undefined
    // A parser failure before source freeze accepted any facts has no blind
    // assessment to reuse. Only the worker's recorded source-parser failure may
    // retry that initial source step, with all four stage/judge slots remaining.
    const retryUnfinishedSource =
      params.allowUnfinishedSourceRetry === true &&
      params.priorProof === undefined &&
      params.reservedModelRuns > 0 &&
      params.reservedModelRuns <= 2
    if (
      (params.reservedModelRuns > 0 && !retryUnfinishedSource) ||
      params.priorProof !== undefined
    ) {
      prior = decodedProof(params.priorProof, params)
      validateRequestedIdentity(params.packet, prior.freeze)
      requireEvidence(
        params.reservedModelRuns > 0,
        "Ein neuer Prüfzyklus benötigt eine neue Formelprüfung.",
      )
      requireEvidence(
        same(params.packet.product ?? null, prior.context.request_product ?? null),
        "Eine geänderte Produktidentität benötigt einen neuen Prüfzyklus.",
      )
      // The persisted context is authoritative; a caller can add rework instructions, never replace frozen evidence.
      const currentPayload = object(params.packet.current_payload)
        ? params.packet.current_payload
        : {}
      const researched = object(currentPayload.researched_payload)
        ? currentPayload.researched_payload
        : currentPayload
      const draft = object(researched.draft) ? researched.draft : {}
      const packetDraft = object(params.packet.draft) ? params.packet.draft : {}
      for (const candidate of [params.packet.formula, packetDraft.formula, draft.formula]) {
        if (object(candidate)) validateFormulaBindings(candidate, prior.freeze)
      }
    }
    ownedRoot = mkdtempSync(path.join(tmpdir(), "shampoo-stage-"))
    const launch = async (
      stage: ShampooStageModelRequest["stage"],
      prompt: string,
      cwd: string,
      webSearch: "live" | "disabled",
    ) => {
      mkdirSync(cwd, { recursive: true, mode: 0o700 })
      return params.model({
        stage,
        prompt,
        outputPath: path.join(cwd, `${stage}.codex-output.json`),
        cwd,
        webSearch,
      })
    }
    if (prior) {
      const raw = await launch(
        "revealed_repair",
        revealedPrompt(
          {
            freeze: prior.freeze,
            blind: prior.blind,
            intake_context: prior.context,
            previous_output: (prior.proof.repairs as unknown[]).length
              ? readSnapshot((prior.proof.repairs as unknown[]).at(-1))
              : prior.revealed,
            rework: params.packet,
          },
          standard,
          runbook,
          true,
        ),
        path.join(ownedRoot, "repair"),
        "disabled",
      )
      const output = bindOutput(raw, prior.freeze, prior.formula)
      const proof = proofSeal({
        ...prior.proof,
        repairs: [...(prior.proof.repairs as unknown[]), snapshot(output)],
      })
      return { output, proof, formula: prior.formula }
    }
    const source = await launch(
      "source_freeze",
      `${SOURCE_INSTRUCTIONS}\nSUBMISSION_ID ${params.submissionId}\nPACKET\n${JSON.stringify(params.packet)}\nRUNBOOK\n${runbook}`,
      path.join(ownedRoot, "source"),
      "live",
    )
    const { freeze, formula } = validateFreeze(source.freeze_packet, params.submissionId)
    validateRequestedIdentity(params.packet, freeze)
    requireEvidence(
      object(source.intake_draft),
      "Der Quellenkontext für die finale Recherche fehlt.",
    )
    const context = {
      intake_draft: structuredClone(source.intake_draft),
      request_product: params.packet.product ?? null,
      output_contract: params.packet.output_contract ?? null,
      category_contract: params.packet.category_contract ?? null,
      image_source_contract: params.packet.image_source_contract ?? null,
      commercial_source_contract: params.packet.commercial_source_contract ?? null,
    }
    const kit = path.join(ownedRoot, "kit")
    let mapping: ReturnType<typeof buildLaneKit>["mapping"]
    try {
      ;({ mapping } = buildLaneKit({
        packets: [freeze],
        standardText: standard,
        outDir: kit,
        seed: 1,
        prefix: `K${randomBytes(3).toString("hex").toUpperCase()}`,
      }))
    } catch (error) {
      // Only the kit's validation errors are evidence failures; filesystem errors remain infrastructure failures.
      if (error instanceof Error && !("code" in error))
        throw new EvidenceError(
          "Die isolierte Formelgrundlage konnte nicht sicher aufgebaut werden.",
        )
      throw error
    }
    const blindId = mapping[0].blindId
    const lane = path.join(kit, "lane-a")
    const a = JSON.parse(
      readFileSync(path.join(lane, "formula", `${blindId}.json`), "utf8"),
    ) as JsonRecord
    const blindPrompt = `${BLIND_INSTRUCTIONS}\nFORMULA\n${JSON.stringify(a)}\nSTANDARD\n${readFileSync(path.join(lane, "classification-standard.md"), "utf8")}`
    requireEvidence(
      [freeze.name, freeze.brand, freeze.productId, ...freeze.gtins]
        .filter((v): v is string => text(v) && v.length >= 3)
        .every((v) => !blindPrompt.toLowerCase().includes(v.toLowerCase())),
      "Die blinde Formelprüfung würde Produktidentität enthalten.",
    )
    const blind = await launch("blind_formula", blindPrompt, lane, "disabled")
    validateBlind(blind, a)
    const frozenBlind = snapshot(blind)
    writeFileSync(path.join(lane, "out", "formula-pass", `${blindId}.json`), frozenBlind.bytes, {
      mode: 0o600,
    })
    releaseReveal(kit, "lane-a")
    const reveal = JSON.parse(
      readFileSync(path.join(lane, "reveal", `${blindId}.json`), "utf8"),
    ) as JsonRecord
    const raw = await launch(
      "revealed_final",
      revealedPrompt(
        { reveal, blind: JSON.parse(frozenBlind.bytes), freeze, intake_context: context },
        standard,
        runbook,
        false,
      ),
      path.join(ownedRoot, "final"),
      "disabled",
    )
    const output = bindOutput(raw, freeze, formula)
    const proof = proofSeal({
      kind: SHAMPOO_STAGE_PROOF_KIND,
      submissionId: params.submissionId,
      reviewCycleId: params.reviewCycleId,
      researchMethod: { ...METHOD },
      formulaFingerprintSha256: freeze.inciFingerprintSha256,
      freeze: snapshot(freeze),
      stageA: snapshot(a),
      blind: frozenBlind,
      context: snapshot(context),
      revealed: snapshot(output),
      repairs: [],
    })
    return { output, proof, formula }
  } catch (error) {
    // Model/reservation/lease/auth errors are deliberately not caught as evidence failures.
    if (error instanceof EvidenceError) return blocked(error.message)
    throw error
  } finally {
    if (ownedRoot) rmSync(ownedRoot, { recursive: true, force: true })
  }
}
