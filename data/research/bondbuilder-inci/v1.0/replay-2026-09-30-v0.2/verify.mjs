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
let hashes = 0;
for (const name of ['freeze-receipt.v0.1.json', 'stage-a-seal.v0.1.json', 'stage-b-seal.v0.1.json']) {
  for (const f of read(resolve(old, name)).files) {
    const target = resolve(name.startsWith('freeze') ? root : old, f.path);
    assert.equal(hash(target), f.sha256, `Historical hash drift: ${f.path}`); hashes++;
  }
}
const receipt = read(resolve(here, 'freeze-receipt.v0.2.json'));
for (const [file, expected] of Object.entries(receipt.sha256)) {
  assert.equal(hash(resolve(root, file)), expected, `Replay input drift: ${file}`); hashes++;
}
const named = read(resolve(here, 'evidence-packet.v0.2.json'));
const blind = read(resolve(here, 'blind-packet.v0.2.json'));
assert.equal(named.products.length, 8); assert.equal(blind.rows.length, 8);
assert.equal(new Set(named.products.map(p => p.pilot_id)).size, 8);
assert.equal(new Set(blind.rows.map(p => p.slot_id)).size, 8);
assert.equal(named.activation, false); assert.equal(receipt.activation, false);
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
for (const lane of ['lane-a', 'lane-b']) {
  const folder = resolve(here, lane);
  if (!existsSync(folder)) continue;
  for (const file of readdirSync(folder).filter(f => f.endsWith('.json'))) {
    const value = read(resolve(folder, file)); laneFiles++;
    for (const key of ['records', 'rule_only_control']) if (Array.isArray(value[key])) {
      assert.equal(value[key].length, 8, `${lane}/${file}:${key} cohort drift`);
      assert.equal(new Set(value[key].map(r => r.pilot_id || r.slot_id)).size, 8);
    }
  }
}
for (const seal of ['stage-a-seal.json', 'stage-b-seal.json']) {
  if (!existsSync(resolve(here, seal))) continue;
  for (const [file, expected] of Object.entries(read(resolve(here, seal)).sha256)) {
    assert.equal(hash(resolve(here, file)), expected, `Lane seal drift ${file}`); hashes++;
  }
}
console.log(JSON.stringify({ verified_hashes: hashes, products: 8, sources: sourceIds.size, lane_json_files: laneFiles, blind_leakage: false, activation: false }));
