// Local research artifact builder; no network, database or production writes.
// All outputs are create-only. Never rerun over a frozen or partial output set.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../..');
const basePath = resolve(here, '../pilot-2026-09-30/evidence-packet.v0.1.json');
const base = JSON.parse(readFileSync(basePath, 'utf8'));
const amendments = JSON.parse(readFileSync(resolve(here, 'source-amendments.json'), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const outputs = ['evidence-packet.v0.2.json', 'blind-packet.v0.2.json', 'rule-only-control.json', 'freeze-receipt.v0.2.json'];
for (const file of outputs) if (existsSync(resolve(here, file))) throw new Error(`Refuse overwrite: ${file}`);
const merged = structuredClone(base);
merged.schema_version = 'bondbuilder-pilot-packet-v0.2';
merged.standard_version = 'bondbuilder-inci-v0.2';
merged.research_scope = amendments.scope;
merged.lineage = { base_packet: amendments.base_packet, base_packet_sha256: digest(readFileSync(basePath)), amendment_file: 'source-amendments.json' };
merged.sources.push(...amendments.new_sources);
merged.search_receipt = amendments.search_receipt;
merged.policy_anchors = { basis: 'Nick explicit calibration ruling', pilot_anchor_ids: ['P01'], contextual_anchor: 'original OLAPLEX No.3, not a pilot row or unseen holdout' };
for (const row of merged.products) {
  const patch = amendments.patches[row.pilot_id];
  if (!patch) continue;
  row.prior_source_record = structuredClone(base.products.find(p => p.pilot_id === row.pilot_id));
  row.evidence_ids = [...new Set([...row.evidence_ids, ...(patch.evidence_ids_add || [])])];
  row.flags = [...new Set([...row.flags.filter(f => !(patch.flags_remove || []).includes(f)), ...(patch.flags_add || [])])];
  row.limitations = patch.limitations_replace || row.limitations.filter(l => !(patch.limitations_remove || []).includes(l));
  row.limitations.push(...(patch.limitations_add || []));
  if (patch.protocol_patch) Object.assign(row.protocol, patch.protocol_patch);
  for (const key of ['source', 'raw_inci_capture', 'formula_status', 'identity_status', 'size', 'anchor_policy', 'normalization_amendment']) {
    if (patch[key] !== undefined) row[key] = structuredClone(patch[key]);
  }
  if (row.pilot_id === 'P06') {
    // Explicit source-corroborated DE presentation/translation repairs; no ingredient additions.
    row.normalized_ingredients = row.normalized_ingredients.map(i => ({
      'aqua/water/eau': 'aqua', 'parfum/fragrance': 'parfum', 'camelia oleifera seed oil': 'camellia oleifera seed oil'
    })[i] || i);
  }
  row.raw_inci_sha256 = digest(row.raw_inci_capture);
  row.formula_fingerprint_sha256 = digest(JSON.stringify(row.normalized_ingredients));
}
if (merged.products.length !== 8 || new Set(merged.products.map(p => p.pilot_id)).size !== 8) throw new Error('Cohort drift');
const blind = {
  schema_version: 'bondbuilder-blind-packet-v0.2', standard_version: 'bondbuilder-inci-v0.2', lexicon_version: base.lexicon_version,
  normalization_rules: [...base.normalization_rules, 'An explicitly flagged translated/punctuated source list has an evidence-preparation repair record; no hidden ingredient addition.'],
  rows: merged.products.map(row => ({ slot_id: row.slot_id, raw_inci_sha256: row.raw_inci_sha256, normalized_ingredients: row.normalized_ingredients,
    formula_fingerprint_sha256: row.formula_fingerprint_sha256, formula_status: row.formula_status, identity_status: row.identity_status,
    flags: row.flags, alternative_capture: row.alternative_capture ? {
      normalized_ingredients: row.alternative_capture.normalized_ingredients,
      raw_inci_sha256: row.alternative_capture.raw_inci_sha256,
      formula_fingerprint_sha256: row.alternative_capture.formula_fingerprint_sha256
    } : null }))
};
const control = { schema_version: 'bondbuilder-rule-only-control-v0.2', standard_version: 'bondbuilder-inci-v0.2',
  instruction: 'Apply v0.2 rules to only immutable v0.1 source facts and own sealed v0.1 blind record; do not import new-source facts.',
  base_packet_path: amendments.base_packet, base_packet_sha256: digest(readFileSync(basePath)),
  pilot_anchor_ids: ['P01'], activation: false };
const encode = value => JSON.stringify(value, null, 2) + '\n';
for (const [file, value] of [[outputs[0], merged], [outputs[1], blind], [outputs[2], control]]) writeFileSync(resolve(here, file), encode(value), { flag: 'wx' });
const methods = [
  'docs/research/bondbuilder-inci/v1.0/bondbuilder-classification-standard.v0.1.md',
  'docs/research/bondbuilder-inci/v1.0/bondbuilder-classification-standard.v0.2.md',
  'docs/research/bondbuilder-inci/v1.0/runbook.v0.2.md',
  'docs/research/bondbuilder-inci/v1.0/researcher-prompt.v0.2.md'
];
const artifacts = [basePath, resolve(here, 'source-amendments.json'), resolve(here, 'build-packets.mjs'), ...outputs.slice(0, 3).map(f => resolve(here, f)), ...methods.map(f => resolve(root, f))];
const receipt = { standard_version: 'bondbuilder-inci-v0.2', frozen_date: '2026-09-30', purpose: 'calibration replay only',
  sha256: Object.fromEntries(artifacts.map(file => [file.startsWith(root + '/') ? file.slice(root.length + 1) : file, digest(readFileSync(file))])),
  activation: false };
writeFileSync(resolve(here, outputs[3]), encode(receipt), { flag: 'wx' });
console.log(JSON.stringify({ products: merged.products.length, sources: merged.sources.length, files: outputs, activation: false }));
