/** Create-only producer-direction overlay; never rewrites the sealed or wire inputs. */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { bondbuilderResearchEnvelopeSchema, type BondbuilderResearchEnvelope } from "../../src/lib/bondbuilder-research/contracts"
import { bondbuilderProfileSha256 } from "../../src/lib/bondbuilder-research/production-adapter"
import { runBondbuilderProductionAdapterCli } from "./project-production-adapter"

const ROOT = path.resolve(__dirname, "../..")
const RUN = "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3"
const PRODUCER = "data/research/bondbuilder-inci/v1.0/producer-application-amendment-2026-10-03/application-amendments.json"
const SLOTS = ["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08"]
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex")
const read = (p: string): unknown => JSON.parse(readFileSync(p, "utf8"))
const write = (p: string, value: unknown) => writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" })
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const sameFact = (field: string, actual: Obj, before: Obj) => {
  if (field !== "sequence" || !Array.isArray(actual.value) || !Array.isArray(before.value)) return equal(actual.value, before.value) && equal(actual.source_ids, before.source_ids)
  const compact = (value: unknown) => array(value, "sequence value").map((raw) => { const step = object(raw, "sequence step"); return { action: step.action, optional: step.optional, timing: step.timing, source_ids: step.source_ids } })
  return equal(compact(actual.value), compact(before.value)) && equal(actual.source_ids, before.source_ids)
}
type Obj = Record<string, unknown>
const object = (value: unknown, name: string): Obj => { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Producer amendment refused: ${name}`); return value as Obj }
const array = (value: unknown, name: string): unknown[] => { if (!Array.isArray(value)) throw new Error(`Producer amendment refused: ${name}`); return value }
const text = (value: unknown, name: string): string => { if (typeof value !== "string") throw new Error(`Producer amendment refused: ${name}`); return value }

function fieldValue(application: Obj, field: string) { if (!(field in application)) throw new Error(`Producer amendment refused: unknown application field ${field}`); return application[field] }
function setField(application: Obj, field: string, value: unknown) { if (!(field in application)) throw new Error(`Producer amendment refused: unknown application field ${field}`); application[field] = value }
function refreshReasoning(envelope: BondbuilderResearchEnvelope, changed: Set<string>) {
  const p = envelope.profile, a = p.application, reasoning = p.assessment.reasoning as Record<string, Obj>
  const map: Array<[string, string]> = [["application_mode", "placement"], ["product_format", "applied_format"], ["treatment_mode", "rinse"], ["intended_role", "treatment_role"]]
  const sourceIds = a.direction_source_ids
  const before: Record<string, unknown> = {}
  for (const [reasoningField, applicationField] of map) if (changed.has(applicationField)) {
    before[reasoningField] = structuredClone(reasoning[reasoningField])
    const wrapper = fieldValue(a as unknown as Obj, applicationField) as Obj
    const value = wrapper.value
    reasoning[reasoningField] = { confidence: wrapper.confidence, rationale: value === null ? wrapper.unknown_reason : `Producer application amendment establishes ${applicationField}.`, source_ids: wrapper.source_ids, limitations: wrapper.limitations, assumptions: value === null ? [wrapper.unknown_reason] : [] }
  }
  const unknownCount = Object.values(a).filter((value) => value && typeof value === "object" && "value" in (value as Obj) && (value as Obj).value === null).length
  before.application_facts = structuredClone(reasoning.application_facts)
  reasoning.application_facts = { confidence: unknownCount ? "moderate" : "high", rationale: `Producer application amendment supplies direction sources; ${unknownCount} application fact wrappers remain unknown.`, source_ids: sourceIds, limitations: unknownCount ? ["Remaining application unknowns are retained; no fact was inferred."] : [], assumptions: [] }
  return { before, after: Object.fromEntries(Object.keys(before).map((key) => [key, reasoning[key]])) }
}

export function applyProducerAmendments(runArgument = RUN, producerArgument = PRODUCER, targetName = "source-amendment-02") {
  const run = path.resolve(ROOT, runArgument), producerPath = path.resolve(ROOT, producerArgument), target = path.join(run, targetName)
  if (existsSync(target)) throw new Error("Producer amendment refused: existing target")
  const proposal = object(read(producerPath), "proposal"), inputs = array(proposal.inputs, "proposal.inputs"), records = array(proposal.records, "proposal.records")
  if (text(proposal.version, "proposal.version") !== "producer-application-amendments-v1" || records.length !== 8) throw new Error("Producer amendment refused: unsupported proposal")
  for (const input of inputs) { const i = object(input, "proposal input"), p = path.resolve(ROOT, text(i.path, "input path")); if (sha(p) !== text(i.sha256, "input hash")) throw new Error(`Producer amendment refused: input hash ${i.path}`) }
  const capturesPath = path.resolve(ROOT, "data/research/bondbuilder-inci/v1.0/producer-source-complement-2026-10-03/source-captures.json"), captures = array(object(read(capturesPath), "source captures").sources, "source captures sources")
  const wireReceipt = object(read(path.join(run, "wire-amendment-01/receipt.json")), "wire receipt"), wireRows = array(wireReceipt.envelopes, "wire receipt envelopes")
  const proposals = new Map(records.map((raw) => { const r = object(raw, "record"), slot = text(r.slot_id, "slot"); return [slot, r] }))
  if (proposals.size !== 8 || SLOTS.some((slot) => !proposals.has(slot))) throw new Error("Producer amendment refused: incomplete slot set")
  const work: Array<{ lane: string; slot: string; envelope: BondbuilderResearchEnvelope; changes: unknown[]; removed_holds: unknown[]; added_holds: unknown[]; wrapper_adjustments: unknown[]; reasoning: unknown }> = []
  for (const slot of SLOTS) {
    const record = proposals.get(slot)!, compatibility = object(record.application_compatibility, `${slot} compatibility`)
    if (text(compatibility.output_target, "output target") !== "profile.application") throw new Error("Producer amendment refused: output target")
    const replacements = array(compatibility.field_replacements, "field replacements"), metadata = array(compatibility.metadata_replacements, "metadata replacements"), sources = array(record.research_sources, "research sources")
    for (const lane of ["lane-a", "lane-b"]) {
      const input = path.join(run, "wire-amendment-01", lane, `${slot}.json`), receiptRow = wireRows.find((raw) => { const row = object(raw, "wire row"); return row.lane === lane && row.slot_id === slot })
      const boundRow = receiptRow === undefined ? undefined : object(receiptRow, "wire row")
      if (!boundRow || sha(input) !== text(boundRow.amended_sha256, "wire envelope hash")) throw new Error(`Producer amendment refused: wire receipt binding ${lane}/${slot}`)
      const envelope = bondbuilderResearchEnvelopeSchema.parse(read(input)); const p = envelope.profile
      const current = bondbuilderProfileSha256(p); if (p.method.output_sha256 !== current || p.review.profile_sha256 !== current) throw new Error(`Producer amendment refused: profile digest ${lane}/${slot}`)
      const output = structuredClone(envelope), app = output.profile.application as unknown as Obj, changed = new Set<string>(), changes: unknown[] = [], wrapperAdjustments: unknown[] = []
      for (const raw of replacements) { const r = object(raw, "fact replacement"), field = text(r.field, "field"), before = r.before, after = r.after, actual = fieldValue(app, field)
        if (lane === "lane-a" && !equal(actual, before)) throw new Error(`Producer amendment refused: Lane A preimage ${slot}.${field}`)
        if (lane === "lane-b" && !equal(actual, before)) { const a = object(actual, "Lane B wrapper"), b = object(before, "proposal wrapper"), explicitNull = slot === "P06" && field === "placement" && object(r.after, "P06 placement after").value === null; if (!explicitNull && !sameFact(field, a, b)) throw new Error(`Producer amendment refused: Lane B fact mismatch ${slot}.${field}`); wrapperAdjustments.push({ field, lane, before: actual, proposal_before: before, same_fact_only_replacement: !explicitNull, explicit_null_reconciliation: explicitNull }) }
        setField(app, field, after); changed.add(field); changes.push({ path: `profile.application.${field}`, before: actual, after })
      }
      for (const raw of metadata) { const r = object(raw, "metadata replacement"), field = text(r.field, "metadata field"), actual = fieldValue(app, field)
        if (lane === "lane-a" && !equal(actual, r.before)) throw new Error(`Producer amendment refused: Lane A metadata preimage ${slot}.${field}`)
        if (lane === "lane-b" && !equal(actual, r.before)) {
          if (!["applicability_note", "source_variants"].includes(field)) throw new Error(`Producer amendment refused: Lane B metadata mismatch ${slot}.${field}`)
          wrapperAdjustments.push({ field, lane, before: actual, proposal_before: r.before, shared_source_amendment_not_independent_fact_agreement: true })
        }
        setField(app, field, r.after); changes.push({ path: `profile.application.${field}`, before: actual, after: r.after })
      }
      const known = new Set(output.profile.sources.map((source) => source.id)); for (const raw of sources) { const source = object(raw, "research source"), id = text(source.id, "source id"), capture = captures.find((rawCapture) => object(rawCapture, "capture").source_id === id); if (!capture) throw new Error(`Producer amendment refused: missing capture ${id}`); const c = object(capture, "capture"); if (c.slot_id !== slot || c.url !== source.url || c.access !== source.access || c.checked_date !== source.checked_date || source.access === "uninspected" || source.scope !== "product" || !["manufacturer", "distributor"].includes(text(source.authority, "source authority"))) throw new Error(`Producer amendment refused: source capture mismatch ${id}`); if (known.has(id)) throw new Error(`Producer amendment refused: duplicate source ${id}`); output.profile.sources.push(source as never); known.add(id) }
      const removed = output.profile.holds.protocol.filter((hold) => hold.code === "source_fact_unknown" && typeof hold.field === "string" && changed.has(hold.field.replace("application.", "")) && (fieldValue(app, hold.field.replace("application.", "")) as Obj).value !== null)
      output.profile.holds.protocol = output.profile.holds.protocol.filter((hold) => !removed.includes(hold))
      const reasoning = refreshReasoning(output, changed)
      const added: BondbuilderResearchEnvelope["profile"]["holds"]["protocol"] = []
      if (slot === "P06" && changed.has("placement") && (fieldValue(app, "placement") as Obj).value === null && !output.profile.holds.protocol.some((hold) => hold.field === "application.placement")) {
        added.push({ code: "source_fact_unknown", field: "application.placement", reason: text((fieldValue(app, "placement") as Obj).unknown_reason, "placement unknown reason"), source_ids: (fieldValue(app, "placement") as Obj).source_ids as string[] })
        output.profile.holds.protocol.push(...added)
      }
      // Seal only after every source, reasoning and hold mutation is complete.
      output.profile.method.output_sha256 = "0".repeat(64); output.profile.review.profile_sha256 = "0".repeat(64); const digest = bondbuilderProfileSha256(output.profile); output.profile.method.output_sha256 = digest; output.profile.review.profile_sha256 = digest
      work.push({ lane, slot, envelope: bondbuilderResearchEnvelopeSchema.parse(output), changes, removed_holds: removed, added_holds: added, wrapper_adjustments: wrapperAdjustments, reasoning })
    }
  }
  mkdirSync(target); const outcomes: unknown[] = [], receipt: unknown[] = []
  for (const item of work) { const out = path.join(target, item.lane, `${item.slot}.json`), projection = path.join(target, "projection-replay", item.lane, item.slot); mkdirSync(path.dirname(out), { recursive: true }); write(out, item.envelope); const code = runBondbuilderProductionAdapterCli(["--input", out, "--output", projection]); const result = object(read(path.join(projection, "production-projection.json")), "projection"); outcomes.push({ lane: item.lane, slot_id: item.slot, exit_code: code, status: result.status, errors: result.errors, readiness: result.readiness }); receipt.push({ lane: item.lane, slot_id: item.slot, amended_sha256: sha(out), changes: item.changes, removed_holds: item.removed_holds, added_holds: item.added_holds, lane_b_wrapper_adjustments: item.wrapper_adjustments, dependent_reasoning: item.reasoning }) }
  write(path.join(target, "receipt.json"), { version: "bondbuilder-source-amendment-receipt-v1", producer_amendment: { path: path.relative(ROOT, producerPath), sha256: sha(producerPath) }, wire_receipt: { path: path.relative(run, path.join(run, "wire-amendment-01/receipt.json")), sha256: sha(path.join(run, "wire-amendment-01/receipt.json")) }, envelopes: receipt, projection_replay: outcomes })
  return { total: work.length, target: path.relative(ROOT, target) }
}
if (process.argv[1]?.endsWith("apply-producer-amendments.ts")) { const i = process.argv.indexOf("--run"); if (i !== -1 && !process.argv[i + 1]) throw new Error("--run requires a path"); console.log(JSON.stringify(applyProducerAmendments(i === -1 ? RUN : process.argv[i + 1]))) }
