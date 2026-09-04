#!/usr/bin/env node
/** Task-local read-only validator. It never writes pilot artifacts. */
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const PROPERTY_KEYS = [
  "cleansingStrength",
  "conditioningLevel",
  "weightPotential",
  "focusPrimary",
  "focusSecondary",
  "usageRole",
  "scalpComfortTarget",
  "dandruffSupport",
]
const JUDGED_KEYS = PROPERTY_KEYS.filter((key) => key !== "dandruffSupport")
const CONFIDENCE = new Set(["moderate", "high"])
const ALLOWED_VALUES = {
  cleansingStrength: ["low", "moderate", "strong"],
  conditioningLevel: ["low", "moderate", "high"],
  weightPotential: ["low", "moderate", "high"],
  focusPrimary: ["volume", "shine", "repair", "clarifying", "scalp_active", "gentle", "general"],
  focusSecondary: ["volume", "shine", "repair", "clarifying", "scalp_active", "gentle"],
  usageRole: ["frequent", "regular", "alternating", "occasional_reset", "treatment"],
  scalpComfortTarget: ["targeted", "not_targeted", "unknown"],
  dandruffSupport: ["supported", "not_supported", "unknown"],
}
const FOCUS_V15_VALUES = [
  "volume",
  "shine",
  "repair",
  "moisture",
  "clarifying",
  "scalp_active",
  "general",
]
const CARE_DIRECTION_V15 = [
  "repair_supported",
  "moisture_supported",
  "dual_supported",
  "nonspecific",
  "not_applicable",
]
const CLAIM_ROLE_V15 = ["candidate", "tie_breaker", "corroborating", "not_applicable"]
const FROZEN_PILOT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "pilot")
const sha256 = (value) => createHash("sha256").update(value).digest("hex")
const own = (value, key) => Object.prototype.hasOwnProperty.call(value ?? {}, key)
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
const nonempty = (value) => typeof value === "string" && value.trim().length > 0
const normalizedInci = (value) =>
  String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ")
    .replace(/[.;]$/, "")
const normalizedIngredient = (value) => String(value).trim().replace(/\s+/g, " ").toUpperCase()

function collectEvidenceRefIds(...values) {
  const ids = new Set()
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!isObject(value)) return
    for (const [key, child] of Object.entries(value)) {
      if (["id", "factId", "fact_id"].includes(key) && nonempty(child)) ids.add(child)
      if (key === "evidenceRefs" && Array.isArray(child))
        child.forEach((entry) => {
          if (nonempty(entry)) ids.add(entry)
        })
      visit(child)
    }
  }
  values.forEach(visit)
  return ids
}

export function validatePilot({ root, phase = "complete" }) {
  const errors = []
  const agreements = []
  const fail = (where, message) => errors.push(`${where}: ${message}`)
  const json = (path, required = true) => {
    if (!existsSync(path)) {
      if (required) fail(path, "missing required file")
      return null
    }
    try {
      return JSON.parse(readFileSync(path, "utf8"))
    } catch (error) {
      fail(path, `invalid JSON (${error.message})`)
      return null
    }
  }
  const manifest = json(resolve(root, "pilot-manifest.json"))
  if (
    !isObject(manifest) ||
    manifest.version !== "shampoo-v14-pilot-manifest-v1" ||
    !Array.isArray(manifest.products)
  ) {
    fail("pilot-manifest.json", "must be shampoo-v14-pilot-manifest-v1 with products array")
    return { ok: false, errors }
  }
  const expected = [
    "elvital-hydra-hyaluronic",
    "syoss-intense-keratin",
    "head-shoulders-classic-clean",
    "isana-sensitiv",
    "isana-2in1-volumen",
  ]
  const ids = manifest.products.map((item) => item?.id)
  const paths = manifest.products.map((item) => item?.path)
  if (resolve(root) === FROZEN_PILOT_ROOT) {
    if (
      ids.length !== 5 ||
      new Set(ids).size !== 5 ||
      ids.some((id) => !expected.includes(id)) ||
      expected.some((id) => !ids.includes(id))
    )
      fail("pilot-manifest.json", "must freeze exactly the five approved product IDs")
  } else if (
    ids.length < 1 ||
    ids.length > 5 ||
    new Set(ids).size !== ids.length ||
    new Set(paths).size !== paths.length ||
    manifest.products.some(
      (item) =>
        !nonempty(item?.id) ||
        !nonempty(item?.path) ||
        !/^[a-z0-9][a-z0-9-]*$/.test(item.id) ||
        !/^[a-z0-9][a-z0-9-]*$/.test(item.path),
    )
  )
    fail(
      "pilot-manifest.json",
      "wave datasets need 1-5 unique safe product IDs and paths",
    )
  if (phase === "sources" || phase === "complete")
    for (const member of manifest.products) validateSource(member, root, fail, json)
  if (phase === "lanes" || phase === "complete") {
    for (const member of manifest.products) validateLanes(member, root, fail, json, agreements)
    enforceAgreement(agreements, fail)
    validateAgreementReport(resolve(root, "agreement.json"), agreements, fail, json)
  }
  if (phase === "complete")
    for (const member of manifest.products) {
      validateComplete(member, root, fail, json)
      validateFocusV15(member, root, fail, json)
    }
  return { ok: errors.length === 0, errors }
}

function validateSource(member, root, fail, json) {
  const base = resolve(root, member.path)
  const packet = json(resolve(base, "source-packet.json"))
  if (!packet) return
  const at = `source:${member.id}`
  if (packet.version !== "shampoo-v14-source-packet-v1" || packet.product_id !== member.id)
    fail(at, "version/product_id mismatch")
  const gtin =
    typeof packet.identity?.gtin === "string" ? packet.identity.gtin : packet.identity?.gtin?.value
  const exactName = packet.identity?.exact_current_de_name ?? packet.identity?.exact_name_de
  if (!isObject(packet.identity) || !nonempty(gtin) || !nonempty(exactName))
    fail(at, "identity needs exact current DE name and GTIN")
  const sources = packet.identity?.current_sources
  if (
    !Array.isArray(sources) ||
    sources.length === 0 ||
    sources.some((source) => !nonempty(source?.id ?? source?.source_id) || !nonempty(source?.url))
  )
    fail(at, "identity.current_sources needs nonempty ID/URL provenance")
  if (
    !sources?.some(
      (source) =>
        String(source.tier).includes("exact_gtin") || String(source.tier).includes("exact_barcode"),
    )
  )
    fail(at, "identity must be bound to an exact-GTIN source")
  const formula = packet.formula
  if (
    !isObject(formula) ||
    !nonempty(formula.raw_inci) ||
    !nonempty(formula.normalized_inci_string) ||
    !Array.isArray(formula.normalized_ordered_inci) ||
    formula.normalized_ordered_inci.length === 0 ||
    !formula.normalized_ordered_inci.every(nonempty)
  )
    fail(at, "formula needs nonempty raw_inci, normalized_ordered_inci, and normalized_inci_string")
  else {
    if (formula.normalized_ordered_inci.join(", ") !== formula.normalized_inci_string)
      fail(at, "normalized_ordered_inci must join exactly to normalized_inci_string")
    if (
      normalizedInci(formula.raw_inci) !== formula.normalized_inci_string &&
      !nonempty(formula.normalization_notes)
    )
      fail(at, "raw INCI that cannot mechanically normalize must explain the normalization")
    if (formula.normalized_inci_string.split(",").filter(Boolean).length < 6)
      fail(at, "formula appears truncated (<6 INCI entries)")
    if (formula.sha256_normalized_inci !== sha256(formula.normalized_inci_string))
      fail(at, "sha256_normalized_inci mismatch")
  }
  if (
    !["canonical", "canonical_provisional", "canonical_with_recorded_same_gtin_conflict"].includes(
      formula?.status,
    ) ||
    !String(formula?.completeness).startsWith("complete_inci")
  )
    fail(at, "formula must be complete canonical or documented canonical_provisional")
  if (
    !nonempty(formula?.canonical_source?.id ?? formula?.canonical_source?.source_id) ||
    !sources?.some(
      (source) =>
        (source.id ?? source.source_id) ===
        (formula.canonical_source.id ?? formula.canonical_source.source_id),
    )
  )
    fail(at, "formula canonical_source must bind a current identity source")
  if (
    (packet.status === "formula_packet_ready_with_provenance_concern" ||
      formula?.status === "canonical_provisional") &&
    !packet.open_questions?.some((question) => question?.severity === "non_blocking_for_pilot")
  )
    fail(at, "provisional provenance concern must be explicitly non_blocking_for_pilot")
  if (
    packet.status === "material_conflict" ||
    formula?.status === "material_conflict" ||
    formula?.version_or_reformulation_conflicts?.some(
      (conflict) => conflict?.severity === "material" || conflict?.status === "unresolved",
    )
  )
    fail(at, "material formula conflict is not pilot-ready")
  const blind = packet.blind_packet
  if (!isObject(blind)) fail(at, "blind_packet missing")
  else {
    for (const [key, mustBeNonempty] of [
      ["surfactant_families_positions", true],
      ["conditioning_deposition_routes_positions", false],
      ["architecture_facts", true],
    ]) {
      const facts = blind[key]
      if (
        !Array.isArray(facts) ||
        (mustBeNonempty && facts.length === 0) ||
        facts.some((fact) =>
          key === "architecture_facts"
            ? !nonempty(fact?.fact_id) || !nonempty(fact?.text)
            : !nonempty(fact?.ingredient) || !Number.isInteger(fact?.position),
        )
      )
        fail(at, `blind_packet.${key} has invalid positional/architecture facts`)
    }
    if (
      blind.surfactant_families_positions?.some((fact) =>
        /emulsifier|solubilizer|hydrotrope|emulsion[-_ ]support/i.test(
          `${fact.family ?? ""} ${fact.role ?? ""}`,
        ),
      )
    )
      fail(
        at,
        "blind surfactant routes must not classify emulsifier/solubilizer/hydrotrope/emulsion-support ingredients as cleansing surfactants",
      )
    const embeddedFactIds = new Set()
    const collectFactIds = (value) => {
      if (Array.isArray(value)) value.forEach(collectFactIds)
      else if (isObject(value)) {
        if (nonempty(value.fact_id)) embeddedFactIds.add(value.fact_id)
        Object.values(value).forEach(collectFactIds)
      }
    }
    collectFactIds(blind)
    const topLevelFactIds = new Set(
      (packet.source_facts ?? []).map((fact) => fact?.fact_id).filter(nonempty),
    )
    if (
      !Array.isArray(blind.source_fact_identifiers) ||
      blind.source_fact_identifiers.some(
        (id) => !nonempty(id) || (!topLevelFactIds.has(id) && !embeddedFactIds.has(id)),
      )
    )
      fail(
        at,
        "every blind source_fact_identifier must resolve to top-level source_facts or an embedded blind fact_id",
      )
    if (blind.formula_fingerprint_sha256 !== formula?.sha256_normalized_inci)
      fail(at, "blind packet formula fingerprint mismatch")
    const text = JSON.stringify(blind).toLowerCase()
    const forbidden = [
      member.id,
      "cleansingstrength",
      "conditioninglevel",
      "weightpotential",
      "focusprimary",
      "focussecondary",
      "usagerole",
      "scalpcomforttarget",
      "dandruffsupport",
    ]
    if (forbidden.some((term) => text.includes(term.toLowerCase())))
      fail(at, "blind_packet leaks identity, marketing, directions, or final-output labels")
  }
  const post = packet.post_unblind_evidence
  if (
    !isObject(post) ||
    !Array.isArray(post.claims_and_positioning) ||
    post.claims_and_positioning.length === 0 ||
    !Array.isArray(post.directions) ||
    post.directions.length === 0
  )
    fail(at, "post_unblind_evidence needs nonempty claims_and_positioning and directions arrays")
}

function validatePropertyRecord(record, where, fail, final = false) {
  if (
    !isObject(record) ||
    !own(record, "value") ||
    (final
      ? !CONFIDENCE.has(record.confidence)
      : !["low", ...CONFIDENCE].includes(record.confidence))
  ) {
    fail(
      where,
      final ? "needs value and moderate/high final confidence" : "needs value and confidence",
    )
    return
  }
  if (!nonempty(record.rationale)) fail(where, "missing rationale")
  if (
    !Array.isArray(record.formulaFacts) ||
    record.formulaFacts.length === 0 ||
    record.formulaFacts.some(
      (fact) => !nonempty(fact?.ingredient) || !Number.isInteger(fact?.position),
    )
  )
    fail(where, "needs positional formulaFacts")
  if (!nonempty(record.counterSignal)) fail(where, "missing counterSignal")
  if (!own(record, "neighboringAlternative")) fail(where, "missing neighboringAlternative")
  if (
    !Array.isArray(record.evidenceRefs) ||
    !record.evidenceRefs.every(nonempty) ||
    record.evidenceRefs.length === 0
  )
    fail(where, "missing evidenceRefs")
}

function validateProperties(properties, where, fail, final = false) {
  if (!isObject(properties)) {
    fail(where, "properties missing")
    return
  }
  if (
    Object.keys(properties).length !== PROPERTY_KEYS.length ||
    PROPERTY_KEYS.some((key) => !own(properties, key))
  )
    fail(where, "must contain exactly all eight property records")
  for (const key of PROPERTY_KEYS) {
    const record = properties[key]
    validatePropertyRecord(record, `${where}.${key}`, fail, final)
    if (key === "focusSecondary") {
      if (
        !Array.isArray(record?.value) ||
        record.value.length > 2 ||
        new Set(record.value).size !== record.value.length ||
        record.value.some((value) => !ALLOWED_VALUES.focusSecondary.includes(value)) ||
        record.value.includes(properties.focusPrimary?.value)
      )
        fail(
          `${where}.${key}`,
          "must be <=2 distinct allowed values and cannot repeat focusPrimary",
        )
      if (
        !Array.isArray(record?.neighboringAlternative) ||
        record.neighboringAlternative.length > 2 ||
        new Set(record.neighboringAlternative).size !== record.neighboringAlternative.length ||
        record.neighboringAlternative.some(
          (value) => !ALLOWED_VALUES.focusSecondary.includes(value),
        ) ||
        canonical(record.neighboringAlternative) === canonical(record.value)
      )
        fail(
          `${where}.${key}`,
          "neighboringAlternative must be a distinct valid focusSecondary array",
        )
    } else {
      if (!ALLOWED_VALUES[key].includes(record?.value))
        fail(`${where}.${key}`, "value is outside the v1.4 enum")
      if (
        !ALLOWED_VALUES[key].includes(record?.neighboringAlternative) ||
        record.neighboringAlternative === record.value
      )
        fail(
          `${where}.${key}`,
          "neighboringAlternative must be a distinct value in the same v1.4 enum",
        )
    }
  }
  const weight = properties.weightPotential?.weightAssessment
  if (
    !isObject(weight) ||
    !["light", "moderate", "high"].includes(weight.depositionLoad) ||
    !["low", "moderate", "high"].includes(weight.persistence) ||
    !["weak", "moderate", "strong"].includes(weight.resetCapacity) ||
    !Array.isArray(weight.unresolvedFacts) ||
    !nonempty(weight.whyThisBand) ||
    !nonempty(weight.whyNotNeighborBand)
  )
    fail(
      `${where}.weightPotential`,
      "needs v1.4 depositionLoad/persistence/resetCapacity, unresolvedFacts, whyThisBand and whyNotNeighborBand",
    )
}

function validateLanes(member, root, fail, json, agreements) {
  const base = resolve(root, member.path)
  const at = `lanes:${member.id}`
  const files = [
    "lane-a-blind.json",
    "lane-a-final.json",
    "lane-b.json",
    "comparison.json",
    "adjudication.json",
  ]
  const records = Object.fromEntries(files.map((file) => [file, json(resolve(base, file))]))
  for (const [file, record] of Object.entries(records)) {
    const recordId = file === "adapter-input.json" ? record?.identity?.productId : record?.productId
    if (record && recordId !== member.id) fail(`${at}:${file}`, "productId membership mismatch")
    if (record && !nonempty(record.version) && file !== "adapter-input.json")
      fail(`${at}:${file}`, "version missing")
  }
  for (const file of ["lane-a-blind.json", "lane-a-final.json", "lane-b.json"]) {
    const record = records[file]
    if (!record) continue
    validateProperties(record.properties, `${at}:${file}`, fail)
  }
  const blind = records["lane-a-blind.json"],
    final = records["lane-a-final.json"],
    laneB = records["lane-b.json"]
  if (
    !nonempty(blind?.blindReceipt?.sourcePacketSha256) ||
    !Array.isArray(final?.postUnblindDeltas)
  )
    fail(at, "Lane A needs blind receipt and post-unblind deltas")
  if (
    !nonempty(laneB?.independenceReceipt?.sourcePacketSha256) ||
    laneB?.independenceReceipt?.consumedLaneA !== false ||
    laneB?.independenceReceipt?.consumedOldManifest !== false
  )
    fail(at, "Lane B needs independence receipt proving no Lane A/old-manifest consumption")
  const comparison = records["comparison.json"]
  if (
    !isObject(comparison) ||
    comparison.laneAProductId !== member.id ||
    comparison.laneBProductId !== member.id
  )
    fail(at, "comparison must bind exact Lane A and Lane B membership")
  else if (
    !Array.isArray(comparison.judgmentProperties) ||
    comparison.judgmentProperties.length !== JUDGED_KEYS.length ||
    JUDGED_KEYS.some((key) => !comparison.judgmentProperties.includes(key))
  )
    fail(at, "comparison must report exactly the seven judgment properties")
  const adjudication = records["adjudication.json"]
  if (adjudication)
    validateProperties(
      adjudication.finalProperties ?? adjudication.properties,
      `${at}:adjudication`,
      fail,
      true,
    )
  if (final && laneB)
    agreements.push({ productId: member.id, a: final.properties, b: laneB.properties })
  const mapping = json(resolve(root, "blind-stage", "mapping-receipt.json"), false)
  const mapped = mapping?.members?.find((entry) => entry.productId === member.id)
  const inputPath = mapped && resolve(root, "blind-stage", "inputs", `${mapped.candidateSlot}.json`)
  const resultPath =
    mapped && resolve(root, "blind-stage", "results", `${mapped.candidateSlot}.json`)
  const result = resultPath && json(resultPath)
  if (
    mapping &&
    (!mapped ||
      blind?.candidateSlot !== mapped.candidateSlot ||
      final?.candidateSlot !== mapped.candidateSlot)
  )
    fail(at, "Lane A candidateSlot must match blind mapping receipt")
  else if (mapped) {
    if (
      !existsSync(inputPath) ||
      sha256(readFileSync(inputPath, "utf8")) !== mapped.blindInputSha256 ||
      !existsSync(resultPath) ||
      sha256(readFileSync(resultPath, "utf8")) !== mapped.blindResultSha256
    )
      fail(at, "blind-stage input/result bytes must match mapping receipt hashes")
    if (
      JSON.stringify(blind?.properties) !== JSON.stringify(result?.properties) ||
      blind?.blindReceipt?.blindInputSha256 !== mapped.blindInputSha256 ||
      blind?.blindReceipt?.sourcePacketSha256 !== mapped.sourcePacketSha256 ||
      blind?.blindReceipt?.blindResultSha256 !== mapped.blindResultSha256
    )
      fail(at, "mapped Lane A blind properties/receipt must equal hash-frozen candidate result")
    if (
      final?.receipt?.blindResultSha256 !== mapped.blindResultSha256 ||
      final?.receipt?.sourcePacketSha256 !== mapped.sourcePacketSha256
    )
      fail(at, "Lane A final receipt hashes must match mapping receipt")
  }
  if (blind && final) {
    const changed = PROPERTY_KEYS.filter(
      (key) =>
        canonical(blind.properties?.[key]?.value) !== canonical(final.properties?.[key]?.value) ||
        blind.properties?.[key]?.confidence !== final.properties?.[key]?.confidence,
    )
    const deltaKeys = (final.postUnblindDeltas ?? []).map((delta) => delta.property)
    const unchanged = (final.unchangedProperties ?? []).map((entry) =>
      typeof entry === "string" ? entry : entry?.property,
    )
    if (
      changed.some((key) => !deltaKeys.includes(key)) ||
      deltaKeys.some((key) => !changed.includes(key)) ||
      PROPERTY_KEYS.filter((key) => !changed.includes(key)).some((key) => !unchanged.includes(key))
    )
      fail(
        at,
        "Lane A post-unblind deltas and unchangedProperties must account for every value/confidence transition",
      )
  }
  if (comparison && final && laneB)
    for (const key of PROPERTY_KEYS) {
      const row = comparison.propertyComparison?.[key]
      const same =
        canonical(final.properties?.[key]?.value) === canonical(laneB.properties?.[key]?.value)
      if (
        !row ||
        canonical(row.laneAValue) !== canonical(final.properties?.[key]?.value) ||
        canonical(row.laneBValue) !== canonical(laneB.properties?.[key]?.value) ||
        row.laneAConfidence !== final.properties?.[key]?.confidence ||
        row.laneBConfidence !== laneB.properties?.[key]?.confidence ||
        row.exactAgreement !== same
      )
        fail(at, `comparison.propertyComparison.${key} disagrees with actual lanes`)
    }
  if (adjudication)
    for (const key of PROPERTY_KEYS)
      if (
        !adjudication.decisions?.[key] ||
        canonical(adjudication.decisions[key].finalValue) !==
          canonical((adjudication.finalProperties ?? adjudication.properties)?.[key]?.value)
      )
        fail(at, `adjudication decision/final property missing or mismatched for ${key}`)
  const packet = json(resolve(base, "source-packet.json"))
  const expectedDandruff = /piroctone olamine|climbazole/.test(
    packet?.formula?.normalized_inci_string?.toLowerCase() ?? "",
  )
    ? "supported"
    : "not_supported"
  for (const [name, props] of [
    ["lane-a-final", final?.properties],
    ["lane-b", laneB?.properties],
  ])
    if (props?.dandruffSupport?.value && props.dandruffSupport.value !== expectedDandruff)
      fail(at, `${name} dandruffSupport must mechanically equal ${expectedDandruff}`)
}

function canonical(value) {
  return Array.isArray(value) ? [...value].sort().join("\u0000") : JSON.stringify(value)
}
function enforceAgreement(records, fail) {
  if (records.length !== 5) return
  const totals = Object.fromEntries(JUDGED_KEYS.map((key) => [key, 0]))
  let matches = 0
  for (const record of records)
    for (const key of JUDGED_KEYS) {
      const same = canonical(record.a?.[key]?.value) === canonical(record.b?.[key]?.value)
      totals[key] += Number(same)
      matches += Number(same)
    }
  const overall = matches / (records.length * JUDGED_KEYS.length)
  if (overall < 0.75)
    fail("agreement", `overall judgment agreement ${overall.toFixed(2)} below 0.75`)
  for (const key of JUDGED_KEYS) {
    const rate = totals[key] / records.length
    if (rate < 0.6) fail("agreement", `${key} agreement ${rate.toFixed(2)} below 0.60`)
  }
}

function validateAgreementReport(path, records, fail, json) {
  const report = json(path, false)
  if (!report || records.length !== 5) return
  const exactMatches = JUDGED_KEYS.reduce(
    (total, key) =>
      total +
      records.filter((record) => canonical(record.a[key].value) === canonical(record.b[key].value))
        .length,
    0,
  )
  if (
    report.products !== 5 ||
    report.judgmentDecisions !== 35 ||
    report.exactMatches !== exactMatches ||
    report.overallAgreement !== exactMatches / 35 ||
    report.thresholds?.overall !== 0.75 ||
    report.thresholds?.perProperty !== 0.6 ||
    report.thresholds?.dandruff !== 1
  )
    fail("agreement", "agreement.json totals or thresholds do not recompute from lanes")
  for (const key of JUDGED_KEYS) {
    const matches = records.filter(
      (record) => canonical(record.a[key].value) === canonical(record.b[key].value),
    ).length
    const row = report.byProperty?.[key]
    if (
      !row ||
      row.exactMatches !== matches ||
      row.decisions !== 5 ||
      row.agreement !== matches / 5
    )
      fail("agreement", `${key} report does not recompute`)
  }
  const dandruff =
    records.filter(
      (record) =>
        canonical(record.a.dandruffSupport.value) === canonical(record.b.dandruffSupport.value),
    ).length / 5
  if (
    report.dandruffAgreement !== dandruff ||
    report.pass !==
      (exactMatches / 35 >= 0.75 &&
        JUDGED_KEYS.every(
          (key) =>
            records.filter(
              (record) => canonical(record.a[key].value) === canonical(record.b[key].value),
            ).length /
              5 >=
            0.6,
        ) &&
        dandruff === 1)
  )
    fail("agreement", "dandruff/pass report does not recompute")
}

function validateComplete(member, root, fail, json) {
  const base = resolve(root, member.path)
  const at = `complete:${member.id}`
  const packet = json(resolve(base, "source-packet.json"))
  const final = json(resolve(base, "lane-a-final.json"))
  const laneB = json(resolve(base, "lane-b.json"))
  const adjudication = json(resolve(base, "adjudication.json"))
  const input = json(resolve(base, "adapter-input.json"))
  const receipt1 = json(resolve(base, "adapter-cli-receipt-run-1.json"))
  const receipt2 = json(resolve(base, "adapter-cli-receipt-run-2.json"))
  const deterministic = json(resolve(base, "adapter-determinism-receipt.json"))
  const run1 = resolve(base, "adapter-artifacts-run-1"),
    run2 = resolve(base, "adapter-artifacts-run-2")
  const output1 = json(resolve(run1, "production-light.json")),
    output2 = json(resolve(run2, "production-light.json"))
  const summary1 = resolve(run1, "production-light-summary.md"),
    summary2 = resolve(run2, "production-light-summary.md")
  if (!existsSync(summary1) || !existsSync(summary2))
    fail(at, "both nested adapter artifact summaries are required")
  for (const [index, receipt] of [
    [1, receipt1],
    [2, receipt2],
  ])
    if (
      !isObject(receipt) ||
      receipt.kind !== "single" ||
      receipt.status !== "property_lane_ready" ||
      !nonempty(receipt.inputSha256)
    )
      fail(at, `CLI receipt run ${index} must be successful single-product stdout JSON`)
  if (
    input?.identity?.productId !== member.id ||
    input?.formula?.canonicalInci !== packet?.formula?.normalized_inci_string
  )
    fail(at, "adapter input must bind member identity and canonical formula")
  if (input?.formula?.inciFingerprintSha256 !== packet?.formula?.sha256_normalized_inci)
    fail(at, "adapter input fingerprint mismatch")
  for (const [index, output] of [
    [1, output1],
    [2, output2],
  ])
    if (
      !isObject(output) ||
      output.status !== "property_lane_ready" ||
      output?.summary?.productId !== member.id
    )
      fail(at, `adapter run ${index} output must be property_lane_ready for exact member`)
  if (
    receipt1?.inputSha256 &&
    receipt2?.inputSha256 &&
    receipt1.inputSha256 !== receipt2.inputSha256
  )
    fail(at, "adapter runs must use identical input SHA-256")
  const outputPaths = [
    resolve(run1, "production-light.json"),
    resolve(run2, "production-light.json"),
    summary1,
    summary2,
  ]
  if (!outputPaths.every(existsSync))
    fail(at, "both nested adapter outputs and summaries are required for determinism")
  else if (
    !isObject(deterministic) ||
    !nonempty(deterministic.outputSha256) ||
    !nonempty(deterministic.summarySha256) ||
    deterministic.outputSha256 !== sha256(readFileSync(outputPaths[0], "utf8")) ||
    deterministic.outputSha256 !== sha256(readFileSync(outputPaths[1], "utf8")) ||
    deterministic.summarySha256 !== sha256(readFileSync(outputPaths[2], "utf8")) ||
    deterministic.summarySha256 !== sha256(readFileSync(outputPaths[3], "utf8"))
  )
    fail(
      at,
      "determinism receipt must match byte-identical two-run output and summary SHA-256 values",
    )
  const finalProperties = adjudication?.finalProperties ?? adjudication?.properties
  if (input?.properties && finalProperties)
    for (const key of PROPERTY_KEYS) {
      const adapter = input.properties[key],
        rich = finalProperties[key]
      if (
        !adapter ||
        !rich ||
        ["value", "confidence", "rationale"].some(
          (field) => JSON.stringify(adapter[field]) !== JSON.stringify(rich[field]),
        ) ||
        JSON.stringify(adapter.evidenceRefs) !== JSON.stringify(rich.evidenceRefs)
      )
        fail(
          at,
          `adapter input ${key} must project adjudication value/confidence/rationale/evidenceRefs`,
        )
    }
  const inci = packet?.formula?.normalized_inci_string?.toLowerCase() ?? ""
  const expectedDandruff = /piroctone olamine|climbazole/.test(inci) ? "supported" : "not_supported"
  for (const [name, props] of [
    ["lane-a-final", final?.properties],
    ["lane-b", laneB?.properties],
    ["adjudication", finalProperties],
    ["adapter-input", input?.properties],
  ])
    if (props?.dandruffSupport?.value !== expectedDandruff)
      fail(at, `${name} dandruffSupport must mechanically equal ${expectedDandruff}`)
}

function validateFocusV15(member, root, fail, json) {
  const base = resolve(root, member.path)
  const at = `focus-v15:${member.id}`
  const packet = json(resolve(base, "source-packet.json"))
  const adjudication = json(resolve(base, "adjudication.json"))
  const overlay = json(resolve(base, "focus-v15.json"))
  if (!packet || !adjudication || !overlay) return
  const finalProperties = adjudication.finalProperties ?? adjudication.properties
  if (overlay.version !== "shampoo-focus-v15-overlay-v1")
    fail(at, "version must be shampoo-focus-v15-overlay-v1")
  if (overlay.productId !== member.id) fail(at, "productId membership mismatch")
  if (overlay.formulaFingerprintSha256 !== packet.formula?.sha256_normalized_inci)
    fail(at, "formula fingerprint must bind the source packet")
  if (
    overlay.priorV14?.adjudicationSha256 !==
    sha256(readFileSync(resolve(base, "adjudication.json")))
  )
    fail(at, "priorV14.adjudicationSha256 must bind the exact v1.4 adjudication bytes")
  if (
    !isObject(overlay.priorV14) ||
    canonical(overlay.priorV14.primary) !== canonical(finalProperties?.focusPrimary?.value) ||
    canonical(overlay.priorV14.secondary) !== canonical(finalProperties?.focusSecondary?.value)
  )
    fail(at, "priorV14 must equal the v1.4 adjudication")
  const effective = overlay.effectiveV15
  if (!isObject(effective) || !FOCUS_V15_VALUES.includes(effective.primary))
    fail(at, "effectiveV15.primary is outside the forward taxonomy")
  if (
    !Array.isArray(effective?.secondary) ||
    effective.secondary.length > 2 ||
    new Set(effective.secondary).size !== effective.secondary.length ||
    effective.secondary.some((value) => !FOCUS_V15_VALUES.includes(value)) ||
    effective.secondary.includes(effective.primary)
  )
    fail(at, "effectiveV15.secondary must be <=2 distinct forward values and exclude primary")
  if (
    !CONFIDENCE.has(effective?.confidence) ||
    !nonempty(effective?.rationale) ||
    !nonempty(effective?.counterSignal) ||
    !Array.isArray(effective?.evidenceRefs) ||
    effective.evidenceRefs.length === 0 ||
    !effective.evidenceRefs.every(nonempty)
  )
    fail(at, "effectiveV15 needs confidence, rationale, counterSignal, and evidenceRefs")
  if (
    !Array.isArray(effective?.formulaFacts) ||
    effective.formulaFacts.length === 0 ||
    effective.formulaFacts.some(
      (fact) =>
        !nonempty(fact?.ingredient) ||
        !Number.isInteger(fact?.position) ||
        !nonempty(fact?.observation),
    )
  )
    fail(at, "effectiveV15 needs positional formulaFacts with observations")
  else {
    const orderedInci = packet.formula?.normalized_ordered_inci ?? []
    effective.formulaFacts.forEach((fact, index) => {
      const canonicalIngredient = orderedInci[fact.position - 1]
      if (
        !nonempty(canonicalIngredient) ||
        normalizedIngredient(fact.ingredient) !== normalizedIngredient(canonicalIngredient)
      )
        fail(
          at,
          `effectiveV15.formulaFacts.${index} must match canonical INCI position ${fact.position}`,
        )
    })
  }
  if (Array.isArray(effective?.evidenceRefs)) {
    const evidenceRefIds = collectEvidenceRefIds(packet, adjudication)
    effective.evidenceRefs.forEach((reference) => {
      if (!evidenceRefIds.has(reference))
        fail(at, `effectiveV15.evidenceRefs contains unresolved reference: ${reference}`)
    })
  }
  if (
    effective?.neighboringAlternative !== null &&
    (!FOCUS_V15_VALUES.includes(effective?.neighboringAlternative) ||
      effective.neighboringAlternative === effective.primary)
  )
    fail(at, "neighboringAlternative must be null or a distinct forward focus")
  const care = overlay.careDirection
  if (
    !isObject(care) ||
    !CARE_DIRECTION_V15.includes(care.verdict) ||
    ![care.moistureRoutes, care.repairRoutes, care.sharedConditioningRoutes].every(
      (routes) => Array.isArray(routes) && routes.every(nonempty),
    ) ||
    !nonempty(care.limitation)
  )
    fail(at, "careDirection is incomplete or invalid")
  if (!CLAIM_ROLE_V15.includes(overlay.claimRole) || !nonempty(overlay.decisionTrace))
    fail(at, "claimRole and decisionTrace are required")
}

function cli() {
  const args = process.argv.slice(2)
  const phaseIndex = args.indexOf("--phase")
  const phase = phaseIndex >= 0 ? args[phaseIndex + 1] : "complete"
  if (!["sources", "lanes", "complete"].includes(phase))
    throw new Error("--phase must be sources, lanes, or complete")
  const rootIndex = args.indexOf("--root")
  const root =
    rootIndex >= 0
      ? resolve(args[rootIndex + 1])
      : FROZEN_PILOT_ROOT
  const result = validatePilot({ root, phase })
  if (result.ok) console.log(`PASS ${phase}: ${root}`)
  else {
    console.error(`FAIL ${phase}: ${result.errors.length} issue(s)`)
    result.errors.forEach((error) => console.error(`- ${error}`))
    process.exitCode = 1
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) cli()
