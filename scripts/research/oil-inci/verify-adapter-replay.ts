import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { projectOilForProduction } from "../../../src/lib/oil-research/production-adapter"
import {
  HistoricalReader,
  INVENTORY_PATH,
  array,
  object,
  string,
  selectHistoricalRecord,
} from "./export-historical"

const sha = (v: string) => createHash("sha256").update(v).digest("hex")
type AdmissionReason = {
  code: string
  diagnostics: string[]
  evidence: Record<string, unknown>
}

function originalAdmission(
  reader: HistoricalReader,
  original: Record<string, unknown>,
  envelope: Record<string, unknown>,
) {
  const reasons: AdmissionReason[] = []
  const add = (code: string, diagnostics: string[], evidence: Record<string, unknown>) => {
    if (!reasons.some((reason) => reason.code === code))
      reasons.push({ code, diagnostics, evidence })
  }
  const provenance = object(envelope.provenance)
  const sourceReceipt = array(provenance.mapping_receipts)
    .map(object)
    .find((r) => r.kind === "source_context")
  assert.ok(sourceReceipt, "Original controlled source context receipt")
  const stageAuthority = object(object(original.field_authority).provides_heat_protection)
  const sourcePacket = reader.json(string(sourceReceipt.path))
  const controlled = selectHistoricalRecord(sourcePacket, string(stageAuthority.record_key))
  assert.deepEqual(
    sourceReceipt.original,
    controlled,
    "Controlled source record must be read from its original packet",
  )
  const controlledSources = array(controlled.sources).map(object)
  const controlledDirections = array(controlled.directions).map(object)
  // Read only the explicit source amendments actually retained by this record. Their bytes
  // are hash-bound authorities; ordinary dictionaries/other cases are never source registries.
  for (const dep of array(provenance.dependencies)
    .map(object)
    .filter((d) => d.kind === "source_amendment")) {
    const amendment = reader.json(string(dep.path), string(dep.sha256))
    if (Array.isArray(amendment.sources)) controlledSources.push(...amendment.sources.map(object))
    else if (typeof amendment.source_id === "string" && typeof amendment.url === "string") {
      controlledSources.push(amendment)
    }
    if (Array.isArray(amendment.directions))
      controlledDirections.push(...amendment.directions.map(object))
    if (amendment.scenario) controlledDirections.push(object(amendment.scenario))
  }
  const originalSourceIds = new Set(controlledSources.map((s) => string(s.id ?? s.source_id)))
  const registeredSources = array(envelope.sources).map(object)
  assert.deepEqual(
    new Set(registeredSources.map((s) => s.source_id)),
    originalSourceIds,
    "Registered source set must equal controlled original registries",
  )
  for (const source of registeredSources) {
    const candidates = controlledSources.filter((s) => (s.id ?? s.source_id) === source.source_id)
    assert.ok(
      candidates.some((s) => {
        const saved = object(source.original)
        // A single-source amendment gains its literal source_id as the wrapper id only.
        return (
          JSON.stringify(saved) === JSON.stringify(s) ||
          JSON.stringify(saved) === JSON.stringify({ ...s, id: s.source_id })
        )
      }),
      `Registered source bytes differ from original: ${source.source_id}`,
    )
  }
  const sourceReferences = new Map<string, string[]>()
  const recordSource = (id: string, at: string) => {
    sourceReferences.set(id, [...(sourceReferences.get(id) ?? []), at])
  }
  const walk = (value: unknown, at: string) => {
    if (Array.isArray(value)) value.forEach((child, i) => walk(child, `${at}.${i}`))
    else if (typeof value === "string") {
      for (const match of value.matchAll(/source_id\s*=\s*([A-Za-z0-9_-]+)/g))
        recordSource(match[1], at)
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if ((key === "source_id" || key.endsWith("_source_id")) && typeof child === "string")
          recordSource(child, `${at}.${key}`)
        else if (key.endsWith("_source_ids") && Array.isArray(child))
          child
            .filter((id): id is string => typeof id === "string")
            .forEach((id) => recordSource(id, `${at}.${key}`))
        walk(child, `${at}.${key}`)
      }
    }
  }
  walk(original, "original")
  for (const [id, locations] of sourceReferences)
    if (!originalSourceIds.has(id)) {
      add(`unresolved_source_${id}`, [`input: Unresolved source ID: ${id}`], {
        source_id: id,
        original_locations: locations,
        controlled_packet: sourceReceipt.path,
        controlled_record_key: stageAuthority.record_key,
        registry_ids: [...originalSourceIds],
        basis:
          "The original citation is preserved. None of this product's controlled source or explicit amendment registries defines it.",
      })
    }
  const identity = object(original.identity)
  const identityComplete = [
    identity.brand,
    identity.product,
    identity.market ?? identity.market_size,
  ].every((v) => typeof v === "string" && v.length > 0)
  assert.ok(
    identityComplete,
    "Selected corpus original identity requires brand, product and recorded market",
  )
  const identifiers = [identity.gtin_if_verified, identity.identifier_if_verified].filter(
    (id) => id != null,
  )
  assert.ok(
    new Set(identifiers).size <= 1,
    "Original identity has conflicting verified identifiers",
  )
  const formula = object(original.formula)
  const ranks = array(formula.ingredients).map(object),
    ledger = array(original.ingredient_ledger).map(object)
  const formulaAuthority = reader.resolve(object(original.field_authority).formula).record
  const contextual = Array.isArray(formulaAuthority.contextual_declarations)
    ? formulaAuthority.contextual_declarations
    : []
  const literals = contextual.map((value) => {
    if (typeof value !== "string") return string(object(value).raw)
    const code = value.match(/^([A-Z][A-Z0-9/]+) formula code/)
    assert.ok(code, "Original contextual declaration requires an explicit literal")
    return `[${code[1]}]`
  })
  const escape = (literal: string) => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const sequence = [...ranks.map((rank) => string(rank.raw_name)), ...literals]
  const declarationComplete = new RegExp(
    `^[\\s,;.]*${sequence.map(escape).join("[\\s,;.]*")}[\\s,;.]*$`,
  ).test(string(formula.raw_inci))
  if (!declarationComplete)
    add(
      "unrepresented_raw_declaration",
      ["formula.ingredients: Raw declaration contains unrepresented ingredients"],
      {
        raw_inci: formula.raw_inci,
        ordered_raw_names: ranks.map((r) => r.raw_name),
        contextual_literals: literals,
        formula_authority: object(original.field_authority).formula,
        basis:
          "Original raw declaration cannot be reconstructed from its ordered rank names and explicitly recorded contextual suffixes.",
      },
    )
  ranks.forEach((rank, i) => {
    const l = ledger[i]
    if (!l || ["rank", "raw_name", "canonical_name"].some((k) => rank[k] !== l[k])) {
      const diagnostics = [
        "profile.ingredient_ledger: Mechanism ledger must cover exact ordered formula",
      ]
      if (l && rank.canonical_name !== l.canonical_name)
        diagnostics.push(`input: Ingredient evidence mismatch at rank ${rank.rank}`)
      add(`historical_formula_ledger_conflict_rank_${rank.rank}`, diagnostics, {
        formula: rank,
        ledger: l ?? null,
        formula_authority: object(original.field_authority).formula,
        ledger_authority: object(original.field_authority).ingredient_ledger,
      })
    }
  })
  if (object(original.weight).value === "unknown")
    add("unknown_weight", ["Unknown weight requires research; no fallback is applied"], {
      authority: object(original.field_authority).weight,
      original_weight: original.weight,
    })
  if (original.completion_status === "incomplete")
    add("incomplete_research", ["Research profile is incomplete"], {
      completion_status: original.completion_status,
    })
  const scenarios = array(original.application_scenarios).map(object)
  for (const scenario of scenarios) {
    const binding = controlledDirections.some(
      (d) => d.source_id === scenario.source_id && d.direction_id === scenario.direction_id,
    )
    if (!binding)
      add(
        `unresolved_direction_${scenario.source_id}_${scenario.direction_id}`,
        [`input: Unresolved source/direction: ${scenario.source_id}/${scenario.direction_id}`],
        { scenario, controlled_packet: sourceReceipt.path },
      )
  }
  const retained = scenarios.filter((s) =>
    array(s.supported_roles).some((r) => r === "leave_on_fibre_conditioning" || r === "dry_finish"),
  )
  if (!retained.length)
    add("missing_retained_fibre_context", ["No source-supported retained hair-fibre scenario"], {
      original_scenarios: scenarios,
    })
  // Semantic admission facts of this frozen corpus, independent of the production policy implementation.
  const contextChecks = retained.map((s) => ({
    source_id: s.source_id,
    direction_id: s.direction_id,
    fibre_site: array(s.site).some(
      (site) =>
        typeof site === "string" &&
        /^(hair(_fibre)?|ends|lengths|mid_lengths|lower_lengths)$/.test(site),
    ),
    explicit_retention:
      typeof s.removal === "string" &&
      /^(leave_on|explicit_(leave_in|no_rinse)|retained(_by)?_(explicit_)?(after_)?styling(_or_finishing)?_context|retention_by_(sun_swimming_protection|styling|postwash_care)_context)$/.test(
        s.removal,
      ),
    original_removal: s.removal,
    original_site: s.site,
  }))
  if (contextChecks.some((c) => !c.fibre_site || !c.explicit_retention))
    add(
      "invalid_retained_fibre_context",
      ["Retained role lacks established fibre site or retention context"],
      { context_checks: contextChecks },
    )
  return {
    reasons,
    checks: {
      identity_complete: identityComplete,
      verified_identifier_conflict: false,
      controlled_packet: sourceReceipt.path,
      source_ids: [...originalSourceIds],
      source_reference_count: sourceReferences.size,
      raw_declaration_complete: declarationComplete,
      retained_contexts: contextChecks,
      category_admission:
        formulaAuthority.oil_category_evidence ??
        controlled.scope ??
        "Preserved original admission to the source-scoped oil corpus; no new category classification.",
    },
  }
}

/** Independent oracle reads the selected original files, not exporter's normalized output. */
export function verifyAdapterReplay(root: string, envelopes: unknown[]) {
  const reader = new HistoricalReader(root)
  const inventory = reader.json(INVENTORY_PATH)
  const entries = array(inventory.records).map(object)
  assert.equal(entries.length, 37, "Frozen selected inventory size")
  assert.equal(
    new Set(entries.map((e) => e.product_key)).size,
    37,
    "Frozen selected inventory uniqueness",
  )
  assert.equal(envelopes.length, 37, "Replay membership")
  const byKey = new Map(
    envelopes.map((value) => {
      const envelope = object(value)
      return [string(envelope.research_id), envelope]
    }),
  )
  assert.equal(byKey.size, 37, "Exported research identity uniqueness")
  const expected = entries.map((entry) => {
    const original = selectHistoricalRecord(
      reader.json(string(entry.path), string(entry.sha256)),
      string(entry.product_key),
    )
    const envelope = byKey.get(`oil:${entry.product_key}`)
    assert.ok(envelope, `Missing selected product ${entry.product_key}`)
    const admission = originalAdmission(reader, original, envelope)
    return {
      entry,
      original,
      expected_status: admission.reasons.length ? "needs_research" : "property_projection_ready",
      expected_reasons: admission.reasons.map((reason) => reason.code),
      reason_evidence: admission.reasons,
      admission_checks: admission.checks,
    }
  })
  // Admission oracle is complete before the first projector invocation.
  const results = expected.map(
    ({ entry, original, expected_status, expected_reasons, reason_evidence, admission_checks }) => {
      const envelope = byKey.get(`oil:${entry.product_key}`)
      assert.ok(envelope, `Missing selected product ${entry.product_key}`)
      assert.deepEqual(
        envelope.profile,
        original,
        `${entry.product_key}: full property/scenario preservation`,
      )
      const provenance = object(envelope.provenance)
      assert.deepEqual(provenance.original_record, original, "Original record preservation")
      assert.equal(
        provenance.original_record_sha256,
        sha(JSON.stringify(original)),
        "Original record digest",
      )
      assert.deepEqual(
        provenance.field_authorities,
        original.field_authority,
        "Per-field authority references",
      )
      const method = object(provenance.original_method)
      assert.equal(method.path, entry.path)
      assert.equal(method.sha256, entry.sha256)
      const fits = reader.json(`${path.posix.dirname(string(entry.path))}/scenario-fit.json`)
      assert.deepEqual(
        array(envelope.scenario_fit).map((f) => object(f).original),
        array(fits.records).filter((f) => object(f).case_id === original.case_id),
        "Full source scenario fit preservation",
      )
      const trace = reader.resolve(original.persistence_trace_reference).record
      assert.deepEqual(
        object(envelope.persistence_trace).original,
        trace,
        "Exact selected persistence trace",
      )
      for (const ref of Object.values(object(original.field_authority))) reader.resolve(ref)
      for (const dep of array(provenance.dependencies).map(object))
        reader.read(string(dep.path), string(dep.sha256))
      const receipt = array(provenance.mapping_receipts)
        .map(object)
        .find((r) => r.kind === "field_authority_resolutions")
      assert.ok(receipt, "Authority mapping receipt")
      const fields = object(original.field_authority)
      assert.equal(array(receipt.records).length, Object.keys(fields).length)
      for (const row of array(receipt.records).map(object)) {
        const resolved = reader.resolve(fields[string(row.field)])
        assert.equal(
          row.resolved_record_sha256,
          sha(JSON.stringify(resolved.record)),
          "Resolved record digest",
        )
      }
      if (original.case_id === "T02")
        assert.match(string(object(fields.ingredient_ledger).path), /\/correction-v0\.2\//)
      const outcome = projectOilForProduction(envelope)
      assert.equal(
        outcome.status,
        expected_status,
        `${entry.product_key}: admission oracle disagrees with projector: ${outcome.issues.join("; ")}`,
      )
      const actualDiagnostics = [...new Set(outcome.issues)]
      const modeledDiagnostics = new Set(reason_evidence.flatMap((reason) => reason.diagnostics))
      const unexpected = actualDiagnostics.filter(
        (diagnostic) => !modeledDiagnostics.has(diagnostic),
      )
      assert.deepEqual(unexpected, [], `${entry.product_key}: unmodeled refusal diagnostics`)
      for (const reason of reason_evidence) {
        assert.ok(
          reason.diagnostics.some((diagnostic) => actualDiagnostics.includes(diagnostic)),
          `${entry.product_key}: expected reason has no actual diagnostic: ${reason.code}`,
        )
      }
      const reasonMatches = reason_evidence.map((reason) => ({
        code: reason.code,
        actual_diagnostics: actualDiagnostics.filter((diagnostic) =>
          reason.diagnostics.includes(diagnostic),
        ),
      }))
      if (outcome.status === "property_projection_ready") {
        assert.deepEqual(
          outcome.category_specs.product_oil_specs,
          {
            weight: object(original.weight).value,
            role_support: [
              ...new Set(array(original.supported_uses).filter((r) => r !== "scalp_application")),
            ],
            provides_heat_protection: object(original.provides_heat_protection).value,
          },
          "Only the three current catalog fields are projected literally",
        )
      } else
        assert.equal("category_specs" in outcome, false, "Refusal must not have applicable specs")
      return {
        product_key: entry.product_key,
        case_id: original.case_id,
        expected_status,
        expected_reasons,
        reason_evidence,
        admission_checks,
        diagnostic_reason_matches: reasonMatches,
        actual_status: outcome.status,
        actual_issues: actualDiagnostics,
        weight: object(original.weight).value,
        persistence_potential: original.persistence_potential,
        original_path: entry.path,
        original_sha256: entry.sha256,
        conflicts: expected_reasons
          .filter((r) => r.startsWith("historical_formula"))
          .map((reason) => {
            const rank = Number(reason.split("_").at(-1))
            return {
              reason,
              formula: array(object(original.formula).ingredients)[rank - 1],
              ledger: array(original.ingredient_ledger)[rank - 1],
              formula_authority: fields.formula,
              ledger_authority: fields.ingredient_ledger,
            }
          }),
        outcome,
      }
    },
  )
  assert.equal(
    results.find((r) => r.product_key === "oil-holdout-h04")?.actual_status,
    "needs_research",
  )
  return {
    version: "oil-adapter-replay-v0.2",
    count: results.length,
    statuses: Object.fromEntries(
      ["property_projection_ready", "needs_research", "not_applicable"].map((status) => [
        status,
        results.filter((r) => r.actual_status === status).length,
      ]),
    ),
    interpretation:
      "Serialization, original-authority attribution and projection replay only; no unseen classification, measured sensory result, research method lock or live activation.",
    original_files_verified: [...reader.dependencies.values()],
    records: results,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const directory = process.argv[2]
    if (!directory) throw new Error("Usage: verify-adapter-replay.ts <replay-directory>")
    const manifest = object(JSON.parse(readFileSync(path.join(directory, "manifest.json"), "utf8")))
    const inputs = array(manifest.files).map((item) => {
      const file = object(item)
      const location = string(file.path)
      if (!/^envelopes\/[a-z0-9-]+\.json$/.test(location))
        throw new Error("Unsafe replay manifest path")
      const bytes = readFileSync(path.join(directory, location), "utf8")
      assert.equal(sha(bytes), file.sha256, "Published envelope hash")
      return JSON.parse(bytes) as unknown
    })
    const report = verifyAdapterReplay(process.cwd(), inputs)
    console.log(JSON.stringify({ count: report.count, statuses: report.statuses }))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
