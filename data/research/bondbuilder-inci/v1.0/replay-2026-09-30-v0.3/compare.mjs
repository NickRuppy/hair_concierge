// Mechanical comparison only. Scientific adjudication is authored separately.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url));
const read = file => JSON.parse(readFileSync(resolve(here, file), 'utf8'));
const digest = file => createHash('sha256').update(readFileSync(resolve(here, file))).digest('hex');
const out = resolve(here, 'comparison.json');
assert(!existsSync(out), 'Refuse comparison overwrite');
for (const stage of ['a', 'b', 'c']) {
  const seal = read(`stage-${stage}-seal.json`);
  for (const [file, expected] of Object.entries(seal.sha256)) assert.equal(digest(file), expected, `Unsealed lane drift: ${file}`);
}
const files = ['lane-a/blind-records.json', 'lane-b/blind-records.json', 'lane-a/control-records.json', 'lane-b/control-records.json', 'lane-a/records.json', 'lane-b/records.json'];
const values = files.map(read);
const [blindA, blindB, controlA, controlB, finalA, finalB] = values;
for (const x of values) { assert.equal(x.records.length, 8); assert.equal(new Set(x.records.map(r => r.pilot_id || r.slot_id)).size, 8); assert.equal(x.no_web, true); }
const normalize = value => JSON.stringify(Array.isArray(value) ? [...value].sort() : value);
const match = (a, b) => normalize(a) === normalize(b);
const confidenceValue = r => typeof r.classification_confidence === 'string' ? r.classification_confidence : r.classification_confidence?.value;
const candidate = r => r.research_admission_candidate ?? r.research_admission_candidacy;
const field = (r, k) => k === 'classification_confidence' ? confidenceValue(r) : k === 'research_admission_candidate' ? candidate(r) : r[k];
const properties = ['boundary_status', 'technology_family', 'claim_trust_level', 'trust_basis', 'classification_confidence', 'research_admission_candidate'];
function compare(a, b) {
  const rows = a.records.map(left => {
    const right = b.records.find(r => r.pilot_id === left.pilot_id); assert(right);
    return { pilot_id: left.pilot_id, equal: Object.fromEntries(properties.map(k => [k, match(field(left, k), field(right, k))])),
      a: Object.fromEntries(properties.map(k => [k, field(left, k)])), b: Object.fromEntries(properties.map(k => [k, field(right, k)])) };
  });
  const assessable = rows.filter(r => r.a.claim_trust_level !== null && r.b.claim_trust_level !== null);
  const anchors = assessable.filter(r => r.a.trust_basis === 'owner_anchor' || r.b.trust_basis === 'owner_anchor');
  const researched = assessable.filter(r => !anchors.includes(r));
  const count = subset => ({ agree: subset.filter(r => r.equal.claim_trust_level).length, n: subset.length, ids: subset.map(r => r.pilot_id) });
  const prevalence = records => records.reduce((acc, r) => { const k = r.claim_trust_level ?? 'hold'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  return { exact_agreement_including_holds: Object.fromEntries(properties.map(k => [k, { agree: rows.filter(r => r.equal[k]).length, n: rows.length }])),
    jointly_assessed_trust: count(assessable), owner_anchor_trust: count(anchors), researched_nonanchor_trust: count(researched),
    excluded_trust_ids: rows.filter(r => !assessable.includes(r)).map(r => r.pilot_id), prevalence: { a: prevalence(a.records), b: prevalence(b.records) },
    disagreements: rows.filter(r => Object.values(r.equal).some(x => !x)), rows };
}
const control = compare(controlA, controlB), amended = compare(finalA, finalB);
const stageA = blindA.records.map(a => {
  const b = blindB.records.find(r => r.slot_id === a.slot_id); assert(b);
  return { slot_id: a.slot_id, markers_equal: match(a.markers, b.markers), candidates_equal: match(a.technology_candidates, b.technology_candidates),
    flags_equal: match(a.flags, b.flags), formula_status_equal: a.formula_status === b.formula_status };
});
const prior = read('../pilot-2026-09-30/adjudication.v0.1.json');
const deltas = (from, to) => to.records.map(next => {
  const before = from.records.find(r => r.pilot_id === next.pilot_id); assert(before);
  return { pilot_id: next.pilot_id, changes: Object.fromEntries(['boundary_status', 'technology_family', 'claim_trust_level', 'research_admission_candidate']
    .filter(k => !match(field(before, k), field(next, k))).map(k => [k, { from: field(before, k), to: field(next, k) }])) };
}).filter(r => Object.keys(r.changes).length);
const result = { standard_version: 'bondbuilder-inci-v0.3', purpose: 'calibration replay, not unseen validation or measured efficacy',
  input_sha256: Object.fromEntries(files.map(f => [f, digest(f)])), stage_a: stageA, control, amended,
  rule_only_reassessment_deltas_from_prior_adjudication: { a: deltas(prior, controlA), b: deltas(prior, controlB) },
  source_only_deltas_under_same_rules: { a: deltas(controlA, finalA), b: deltas(controlB, finalB) },
  limitations: ['Owner-anchor agreement is prescribed, not validation of empirical high-trust judgment.', 'Null/null agreement is reported separately from jointly assessed trust.', 'Prior adjudication vs fresh control changes are method reassessment plus potential rater variation, not experimental causal proof.', 'Small/nondegenerate counts may make chance-corrected diagnostics uninformative.', 'Protocol/fit/catalog readiness is not granted by research-source candidacy.'],
  activation: false };
writeFileSync(out, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ control: control.exact_agreement_including_holds, amended: amended.exact_agreement_including_holds,
  jointly_assessed: amended.jointly_assessed_trust, nonanchor: amended.researched_nonanchor_trust, disagreements: amended.disagreements.map(r => r.pilot_id), activation: false }));
