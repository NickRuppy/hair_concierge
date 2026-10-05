// Read-only verification of historical and replay research artifacts.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../..');
const old = resolve(here, '../pilot-2026-09-30');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const textHash = text => createHash('sha256').update(text).digest('hex');
const complete = process.argv.includes('--complete');
let hashes = 0;
for (const name of ['freeze-receipt.v0.1.json', 'stage-a-seal.v0.1.json', 'stage-b-seal.v0.1.json']) {
  for (const f of read(resolve(old, name)).files) {
    const target = resolve(name.startsWith('freeze') ? root : old, f.path);
    assert.equal(hash(target), f.sha256, `Historical hash drift: ${f.path}`); hashes++;
  }
}
const receipt = read(resolve(here, 'freeze-receipt.v0.3.json'));
for (const [file, expected] of Object.entries(read(resolve(here, '../replay-2026-09-30-v0.2/freeze-receipt.v0.2.json')).sha256)) {
  assert.equal(hash(resolve(root, file)), expected, `Prepared v0.2 input drift: ${file}`); hashes++;
}
for (const [file, expected] of Object.entries(receipt.sha256)) {
  assert.equal(hash(resolve(root, file)), expected, `Replay input drift: ${file}`); hashes++;
}
const named = read(resolve(here, 'evidence-packet.v0.3.json'));
const blind = read(resolve(here, 'blind-packet.v0.3.json'));
assert.equal(named.products.length, 8); assert.equal(blind.rows.length, 8);
assert.equal(new Set(named.products.map(p => p.pilot_id)).size, 8);
assert.equal(new Set(blind.rows.map(p => p.slot_id)).size, 8);
assert.equal(named.activation.production_writes_authorized, false); assert.equal(named.activation.intake_active, false); assert.equal(receipt.activation, false);
assert(!/https?:|olaplex|k18|epres|aveda|kerastase|kérastase|redken|ogx|elvital|claim_trust|owner_anchor/i.test(JSON.stringify(blind)), 'Named evidence leakage');
const sourceIds = new Set(named.sources.map(s => s.id));
assert.equal(sourceIds.size, named.sources.length);
for (const p of named.products) {
  const b = blind.rows.find(row => row.slot_id === p.slot_id); assert(b);
  assert.equal(p.raw_inci_sha256, textHash(p.raw_inci_capture));
  assert.equal(p.formula_fingerprint_sha256, textHash(JSON.stringify(p.normalized_ingredients)));
  assert.deepEqual(b.normalized_ingredients, p.normalized_ingredients);
  assert.deepEqual(b.flags, p.flags);
  for (const id of p.evidence_ids) assert(sourceIds.has(id), `Unknown source ${id}`);
}
const product = id => named.products.find(p => p.pilot_id === id);
assert.equal(product('P05').formula_status, 'conflict_hold');
assert.equal(product('P06').formula_status, 'source_version_resolved');
assert(product('P06').raw_inci_capture.includes('Caprylic, Capric Triglyceride'));
assert(product('P06').normalization_amendment);
assert(product('P06').normalized_ingredients.includes('caprylic/capric triglyceride'));
assert.equal(product('P08').size, '250ml local retailer research target');
assert.equal(product('P08').protocol.rinse_before_shampoo, false);
assert(product('P03').protocol.dilution.includes('150ml'));
assert(!product('P03').flags.includes('dilution_quantity_gap'));
let laneFiles = 0;
const families = ['sulfur_targeting_dimaleate', 'designed_peptide', 'maleate_ester', 'acid_calcium_management', 'gluconamide_gluconate'];
const oldNamed = read(resolve(old, 'evidence-packet.v0.1.json'));
const oldBlind = read(resolve(old, 'blind-packet.v0.1.json'));
for (const lane of ['lane-a', 'lane-b']) {
  const folder = resolve(here, lane);
  if (complete) for (const file of ['blind-records.json', 'blind-notes.md', 'control-records.json', 'control-notes.md', 'records.json', 'notes.md']) assert(existsSync(resolve(folder, file)), `Incomplete replay: ${lane}/${file}`);
  if (!existsSync(folder)) continue;
  for (const file of readdirSync(folder).filter(f => f.endsWith('.json'))) {
    const value = read(resolve(folder, file)); laneFiles++;
    assert.equal(value.standard_version, 'bondbuilder-inci-v0.3'); assert.equal(value.lane_id, lane); assert.equal(value.no_web, true);
    assert.equal(value.stage, { 'blind-records.json': 'A', 'control-records.json': 'B', 'records.json': 'C' }[file]);
    assert(Array.isArray(value.input_receipt) && value.input_receipt.length > 0);
    for (const entry of value.input_receipt) assert.equal(hash(resolve(root, entry.path)), entry.sha256, `Lane input drift ${entry.path}`);
    for (const key of ['records', 'rule_only_control', 'control_records']) if (Array.isArray(value[key])) {
      assert.equal(value[key].length, 8, `${lane}/${file}:${key} cohort drift`);
      assert.equal(new Set(value[key].map(r => r.pilot_id || r.slot_id)).size, 8);
    }
    if (value.stage === 'A') {
      assert.equal(value.control_records.length, 8);
      for (const [key, packet] of [['records', blind.rows], ['control_records', oldBlind.products]]) for (const r of value[key]) {
        const p = packet.find(p => p.slot_id === r.slot_id); assert(p);
        assert.deepEqual(r.flags, p.flags ?? p.input_flags); assert.equal(r.formula_status, p.formula_status);
        for (const marker of r.markers) assert(p.normalized_ingredients.includes(marker));
        for (const family of r.technology_candidates) assert(families.includes(family));
        assert(!('boundary_status' in r) && !('claim_trust_level' in r));
      }
    } else {
      const packet = value.stage === 'B' ? oldNamed : named;
      const allowedSources = new Set(packet.sources.map(s => s.id));
      if (value.stage === 'B') assert(!value.input_receipt.some(e => /evidence-packet\.v0\.3|source-amendments/.test(e.path)), 'Control unblinded to amended evidence');
      for (const r of value.records) {
        const p = packet.products.find(p => p.pilot_id === r.pilot_id); assert(p); assert.equal(r.slot_id, p.slot_id);
        assert(['in_scope', 'out_of_scope', 'category_review', 'research_hold'].includes(r.boundary_status));
        assert([...families, null].includes(r.technology_family)); assert(['high', 'medium', 'low', null].includes(r.claim_trust_level));
        assert(['owner_anchor', 'research_judgment', null].includes(r.trust_basis));
        assert(['high', 'moderate', 'low'].includes(r.classification_confidence));
        for (const key of ['identity', 'boundary', 'claim_trust', 'protocol', 'fit']) assert(Array.isArray(r.holds[key]));
        for (const id of r.supporting_source_ids) assert(allowedSources.has(id), `Unknown lane source ${id}`);
        for (const key of ['confidence_by_property', 'assessed_benefit', 'counterevidence', 'applicability_bridge', 'neighboring_grade_rationale', 'limitations', 'application_facts', 'concise_de', 'deeper_de']) assert(key in r, `Missing ${lane}/${file}:${key}`);
        assert.equal(typeof r.research_admission_candidate, 'boolean');
        if (r.claim_trust_level === null) assert.equal(r.trust_basis, null);
        if (r.trust_basis === 'owner_anchor') { assert.equal(r.pilot_id, 'P01'); assert.equal(r.claim_trust_level, 'high'); }
        if (r.research_admission_candidate) { assert.equal(r.boundary_status, 'in_scope'); assert(['high', 'medium'].includes(r.claim_trust_level)); assert.notEqual(r.classification_confidence, 'low'); assert.equal(p.formula_status, 'source_version_resolved'); assert.equal(r.holds.boundary.length, 0); assert.equal(r.holds.claim_trust.length, 0); }
      }
    }
  }
}
for (const seal of ['stage-a-seal.json', 'stage-b-seal.json', 'stage-c-seal.json']) {
  if (complete) assert(existsSync(resolve(here, seal)), `Incomplete replay: ${seal}`);
  if (!existsSync(resolve(here, seal))) continue;
  for (const [file, expected] of Object.entries(read(resolve(here, seal)).sha256)) {
    assert.equal(hash(resolve(here, file)), expected, `Lane seal drift ${file}`); hashes++;
  }
}
if (complete) for (const file of ['comparison.json', 'adjudication.json', 'findings.md', 'final-seal.json']) assert(existsSync(resolve(here, file)), `Incomplete handoff: ${file}`);
if (existsSync(resolve(here, 'adjudication.json'))) {
  const verdict = read(resolve(here, 'adjudication.json')); assert.equal(verdict.records.length, 8); assert.equal(verdict.activation, false);
  const lane = read(resolve(here, 'lane-a/records.json'));
  for (const row of verdict.records) {
    const original = lane.records.find(r => r.pilot_id === row.pilot_id); assert(original);
    for (const key of ['slot_id', 'boundary_status', 'technology_family', 'claim_trust_level', 'trust_basis', 'classification_confidence', 'research_admission_candidate']) assert.deepEqual(row[key], original[key]);
    assert.deepEqual(row.application_facts, product(row.pilot_id).protocol);
    for (const id of row.supporting_source_ids) assert(sourceIds.has(id));
  }
  const comparison = read(resolve(here, 'comparison.json'));
  for (const [file, expected] of Object.entries(comparison.input_sha256)) assert.equal(hash(resolve(here, file)), expected);
  assert.equal(comparison.amended.researched_nonanchor_trust.n, 2); assert.equal(comparison.amended.owner_anchor_trust.n, 1);
  assert.deepEqual(verdict.coverage.new_expansion_research_candidates, ['P04', 'P08']);
}
if (existsSync(resolve(here, 'final-seal.json'))) for (const [file, expected] of Object.entries(read(resolve(here, 'final-seal.json')).sha256)) { assert.equal(hash(resolve(here, file)), expected, `Final seal drift ${file}`); hashes++; }
console.log(JSON.stringify({ mode: complete ? 'completed_replay' : 'present_artifacts_only', verified_hashes: hashes, products: 8, sources: sourceIds.size, lane_json_files: laneFiles, blind_leakage: false, activation: false }));
