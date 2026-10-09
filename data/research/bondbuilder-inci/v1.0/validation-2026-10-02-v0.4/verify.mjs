import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const runDir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(runDir, '../../../../..');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(runDir, name), 'utf8'));
const fail = msg => { throw new Error(msg); };
const check = (ok, msg) => { if (!ok) fail(msg); };
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const canonical = x => JSON.stringify(Array.isArray(x) ? x.map(v => JSON.parse(canonical(v))) : isObj(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, JSON.parse(canonical(x[k]))])) : x);
function shape(x, keys, label) {
  check(isObj(x), label + ': object required');
  check(Object.keys(x).sort().join('|') === [...keys].sort().join('|'), label + ': wrong keys');
}
function str(x, label, max = 2000) { check(typeof x === 'string' && x.length <= max, label + ': bounded string required'); }
function strings(x, label, max = 30, len = 500) {
  check(Array.isArray(x) && x.length <= max, label + ': bounded array required');
  x.forEach((s, i) => str(s, label + '[' + i + ']', len));
}
const confidence = x => ['high', 'moderate', 'low'].includes(x);
const markerKey = x => x.toLowerCase().replace(/\s+/g, ' ').trim();
const families = ['sulfur_targeting_dimaleate', 'designed_peptide', 'maleate_ester', 'acid_calcium_management', 'gluconamide_gluconate'];
const factKeys = ['value', 'source_ids', 'limitations'];
function walk(x, f, p = '$') {
  f(x, p);
  if (Array.isArray(x)) x.forEach((v, i) => walk(v, f, p + '[' + i + ']'));
  else if (isObj(x)) Object.entries(x).forEach(([k, v]) => walk(v, f, p + '.' + k));
}
function jsonBounds(x) {
  walk(x, (v, p) => {
    if (typeof v === 'string') check(v.length <= 3000, p + ': text too long');
    if (Array.isArray(v)) check(v.length <= 100, p + ': array too long');
    if (isObj(v)) check(!Object.keys(v).some(k => /intensity/i.test(k)), p + ': forbidden intensity field');
  });
}
function safeFile(relative) {
  str(relative, 'hash path', 600);
  const p = path.resolve(repo, relative);
  check(p.startsWith(repo + path.sep), 'hash path outside task repository');
  return p;
}
let hashCount = 0;
function verifyMap(map) {
  check(isObj(map), 'hash map required');
  for (const [file, expected] of Object.entries(map)) {
    check(/^[a-f0-9]{64}$/.test(expected), 'invalid digest: ' + file);
    check(digest(fs.readFileSync(safeFile(file))) === expected, 'hash mismatch: ' + file);
    hashCount++;
  }
}
const prefix = path.relative(repo, runDir).replaceAll(path.sep, '/');
const topKeys = ['standard_version', 'lane_id', 'stage', 'input_receipt', 'no_web', 'recognition_incidents', 'limitations', 'records'];
function envelope(x, lane, stage, expectedReads) {
  jsonBounds(x);
  shape(x, topKeys, 'envelope');
  check(x.standard_version === 'bondbuilder-inci-v0.4' && x.lane_id === lane && x.stage === stage && x.no_web === true, 'stage metadata');
  strings(x.recognition_incidents, 'recognition'); strings(x.limitations, 'limitations');
  check(Array.isArray(x.input_receipt), 'read receipt array');
  const got = [];
  for (const r of x.input_receipt) {
    shape(r, ['path', 'sha256'], 'read receipt');
    const relative = path.relative(repo, path.resolve(runDir, r.path)).replaceAll(path.sep, '/');
    got.push(relative);
    verifyMap({[relative]: r.sha256});
  }
  check(got.sort().join('|') === [...expectedReads].sort().join('|'), 'unexpected/missing/duplicate stage read receipt');
  check(Array.isArray(x.records) && x.records.length === 4, 'four lane records required');
  check(x.records.map(r => r.slot_id).sort().join('|') === 'V01|V02|V03|V04', 'slot coverage');
}
const Akeys = ['slot_id', 'markers', 'technology_candidates', 'formula_status', 'flags', 'classification_confidence', 'limitations'];
function stageA(lane, anon) {
  const x = read(lane + '/blind-records.json');
  envelope(x, lane, 'A', [prefix + '/method/blind-instructions.md', prefix + '/method/researcher-prompt.md', prefix + '/anonymous.json']);
  for (const r of x.records) {
    shape(r, Akeys, 'A record');
    strings(r.markers, 'markers', 20, 200); strings(r.technology_candidates, 'candidates', 5, 100);
    check(new Set(r.markers).size === r.markers.length && new Set(r.technology_candidates).size === r.technology_candidates.length, 'duplicate A observations');
    check(r.technology_candidates.every(f => families.includes(f)), 'unknown A family');
    check(['complete', 'incomplete', 'conflicting'].includes(r.formula_status) && confidence(r.classification_confidence), 'A status/confidence');
    strings(r.flags, 'flags'); strings(r.limitations, 'A limits');
    const input = anon.records.find(v => v.slot_id === r.slot_id);
    check(r.markers.every(m => input.normalized_inci.includes(m)), 'marker not literally in input');
  }
  return x;
}
const Bkeys = ['slot_id','identity','boundary_status','technology_family','claim_trust_level','trust_basis','policy_reference','holds','classification_confidence','confidence_by_property','assessed_benefit','supporting_source_ids','counter_source_ids','applicability_bridge','evidence_limitations','research_admission_candidate','new_submission_recommended','application_facts','fit_assessment','manufacturer_positioning','intended_role','concise_de','deeper_de','stage_a_to_final_changes'];
const appKeys = ['selected_direction_source_id','placement','physical_format','hair_state','application_area','amount','dilution','contact_time','working_time','sequence','conditioner','cadence','brand_partners','source_variants'];
function num(x) { return x === null || (Number.isFinite(x) && x >= 0 && x <= 10000); }
function stageB(lane, named) {
  const x = read(lane + '/records.json');
  envelope(x, lane, 'B', [prefix + '/method/standard.md', prefix + '/named-evidence.json', prefix + '/' + lane + '/blind-records.json']);
  for (const r of x.records) {
    shape(r, Bkeys, 'B record');
    const input = named.records.find(v => v.slot_id === r.slot_id);
    check(canonical(r.identity) === canonical(input.identity), 'identity drift');
    const allowed = new Set([input.formula_source_id, input.selected_direction_source_id, ...input.supporting_source_ids]);
    function ids(a) { strings(a, 'source IDs', 20, 100); check(a.every(id => allowed.has(id)), 'unknown/foreign source reference'); }
    walk(r, (v, p) => {
      if (isObj(v) && 'source_ids' in v) ids(v.source_ids);
      if (isObj(v) && 'source_id' in v) check(allowed.has(v.source_id), p + ': unknown/foreign source');
    });
    ids(r.supporting_source_ids); ids(r.counter_source_ids);
    check(['in_scope','out_of_scope','category_review','research_hold'].includes(r.boundary_status), 'B boundary');
    check(r.technology_family === null || families.includes(r.technology_family), 'B family');
    check(r.new_submission_recommended === false && r.research_admission_candidate === false, 'unauthorized recommendation/admission');
    if (r.boundary_status === 'in_scope') {
      check(r.technology_family !== null && r.claim_trust_level === 'low' && r.trust_basis === 'owner_default' && r.policy_reference === named.policy.reference, 'owner default violation');
    } else check(r.technology_family === null && r.claim_trust_level === null && r.trust_basis === null && r.policy_reference === null, 'inapplicable finalized policy/family');
    shape(r.holds, ['identity','boundary','claim_trust','protocol','fit'], 'holds');
    Object.values(r.holds).forEach(a => strings(a, 'hold'));
    check(confidence(r.classification_confidence), 'B confidence');
    shape(r.confidence_by_property, ['identity','boundary','technology','policy','protocol','fit'], 'property confidence');
    check(Object.values(r.confidence_by_property).every(v => v === null || confidence(v)), 'invalid property confidence');
    for (const k of ['assessed_benefit','applicability_bridge','manufacturer_positioning','intended_role']) str(r[k], k);
    str(r.concise_de, 'concise_de', 500); str(r.deeper_de, 'deeper_de', 2500);
    strings(r.evidence_limitations, 'evidence limits'); strings(r.stage_a_to_final_changes, 'change log');
    shape(r.fit_assessment, ['fine','normal','coarse','rationale','source_ids'], 'fit');
    check(['fine','normal','coarse'].every(k => r.fit_assessment[k] === null || typeof r.fit_assessment[k] === 'boolean'), 'fit type');
    str(r.fit_assessment.rationale, 'fit rationale'); ids(r.fit_assessment.source_ids);
    const a = r.application_facts;
    shape(a, appKeys, 'application');
    check(a.selected_direction_source_id === input.selected_direction_source_id, 'selected direction source changed');
    for (const k of appKeys.filter(k => !['selected_direction_source_id','sequence','source_variants'].includes(k))) {
      shape(a[k], factKeys, 'fact ' + k); ids(a[k].source_ids); strings(a[k].limitations, 'fact limits');
      check(a[k].source_ids.length || a[k].value === null || a[k].value?.kind === 'unknown' || (Array.isArray(a[k].value) && !a[k].value.length), 'uncited fact ' + k);
      if (a[k].value === null || a[k].value?.kind === 'unknown') check(a[k].limitations.length > 0, 'unexplained unknown ' + k);
    }
    check(a.placement.value === null || ['pre_shampoo','post_shampoo','before_or_after_shampoo'].includes(a.placement.value), 'placement');
    for (const k of ['physical_format','application_area','amount','dilution']) if (a[k].value !== null) str(a[k].value, k);
    if (a.hair_state.value !== null) strings(a.hair_state.value, 'hair state', 10, 200);
    const ct = a.contact_time.value;
    shape(ct, ['kind','minutes_min','minutes_max','branches'], 'contact');
    check(['fixed','range','conditional','no_wait','unknown'].includes(ct.kind) && num(ct.minutes_min) && num(ct.minutes_max) && Array.isArray(ct.branches) && ct.branches.length <= 10, 'contact types');
    for (const b of ct.branches) { shape(b, ['condition','minutes_min','minutes_max'], 'contact branch'); str(b.condition, 'condition', 500); check(num(b.minutes_min) && num(b.minutes_max), 'branch minutes'); }
    if (a.working_time.value !== null) { shape(a.working_time.value, ['minutes_min','minutes_max'], 'work time'); check(Object.values(a.working_time.value).every(num), 'work time numbers'); }
    check(Array.isArray(a.sequence) && a.sequence.length <= 20, 'sequence array');
    for (const s of a.sequence) { shape(s, ['action','requirement','source_ids'], 'sequence step'); str(s.action, 'action', 1000); check(['instruction','recommended','optional'].includes(s.requirement), 'step requirement'); ids(s.source_ids); check(s.source_ids.length > 0, 'uncited step'); }
    if (a.conditioner.value !== null) { shape(a.conditioner.value, ['before','after','after_timing'], 'conditioner'); Object.values(a.conditioner.value).forEach(v => str(v, 'conditioner value', 500)); }
    const ca = a.cadence.value, caKeys = ['kind','times_per_week_min','times_per_week_max','washes_min','washes_max','branches'];
    shape(ca, caKeys, 'cadence');
    check(['weekly','wash_interval','conditional','unknown'].includes(ca.kind) && Array.isArray(ca.branches) && ca.branches.length <= 10, 'cadence types');
    check(caKeys.filter(k => !['kind','branches'].includes(k)).every(k => num(ca[k])), 'cadence numbers');
    for (const b of ca.branches) { shape(b, ['condition','kind','times_per_week_min','times_per_week_max','washes_min','washes_max'], 'cadence branch'); str(b.condition, 'condition', 500); check(['weekly','wash_interval'].includes(b.kind), 'branch kind'); check(['times_per_week_min','times_per_week_max','washes_min','washes_max'].every(k => num(b[k])), 'branch intervals'); }
    if (['conditional','unknown'].includes(ca.kind)) check(['times_per_week_min','times_per_week_max','washes_min','washes_max'].every(k => ca[k] === null), 'flattened unknown/conditional cadence');
    if (ca.kind === 'unknown') check(!ca.branches.length, 'unknown cadence branches');
    check(Array.isArray(a.brand_partners.value) && a.brand_partners.value.length <= 10, 'partners array');
    for (const p of a.brand_partners.value) { shape(p, ['name_or_role','requirement'], 'partner'); str(p.name_or_role, 'partner name', 500); check(['required','recommended','optional'].includes(p.requirement), 'partner requirement'); }
    check(Array.isArray(a.source_variants) && a.source_variants.length <= 10, 'variants array');
    for (const v of a.source_variants) { shape(v, ['source_id','selected','summary'], 'variant'); check(allowed.has(v.source_id) && typeof v.selected === 'boolean', 'variant source/status'); str(v.summary, 'variant summary'); }
  }
  return x;
}

const mode = process.argv[2] || '--prepared';
check(['--prepared','--stage-a','--complete'].includes(mode), 'invalid mode');
const frozen = read('freeze-receipt.json');
verifyMap(frozen.hashes);
const anon = read('anonymous.json'), named = read('named-evidence.json'), pre = read('preregistration.json');
check(anon.records.length === 4 && named.records.length === 4 && pre.denominators.unique_products === 4, 'input denominator');
const sourceIds = named.source_registry.map(s => s.source_id);
check(new Set(sourceIds).size === sourceIds.length, 'source IDs duplicate');
for (const r of named.records) check([r.formula_source_id,r.selected_direction_source_id,...r.supporting_source_ids].every(id => sourceIds.includes(id)), 'input source closure');
const normalizer = s => s.replace(/\.$/,'').replace(/\*/g,'').split(s.includes('•') ? '•' : ',').map(x => x.trim());
for (const r of anon.records) {
  check(JSON.stringify(normalizer(r.raw_inci)) === JSON.stringify(r.normalized_inci), 'normalization drift');
  const pilotPath = path.join(repo, 'data/research/bondbuilder-inci/v1.0/replay-2026-09-30-v0.3/blind-packet.v0.3.json');
  const pilot = JSON.parse(fs.readFileSync(pilotPath,'utf8'));
  check(!JSON.stringify(pilot).includes(r.raw_inci), 'pilot raw duplicate');
}
check(!/Curlsmith|Balea|Garnier|Absolut Repair|V01|V02|V03|V04/.test(fs.readFileSync(path.join(runDir,'method/blind-instructions.md'),'utf8')), 'blind guide named/cohort leak');
if (mode !== '--prepared') {
  for (const lane of ['lane-a','lane-b']) {
    const output = stageA(lane, anon);
    for (const expected of pre.expected) {
      const record = output.records.find(r => r.slot_id === expected.slot_id);
      check(record.markers.map(markerKey).sort().join('|') === expected.markers.map(markerKey).sort().join('|'), lane + ': frozen marker oracle disagreement ' + expected.slot_id);
    }
  }
  verifyMap(read('stage-a-seal.json').hashes);
}
if (mode === '--complete') {
  for (const lane of ['lane-a','lane-b']) {
    const output = stageB(lane, named);
    for (const expected of pre.expected) {
      const record = output.records.find(r => r.slot_id === expected.slot_id);
      check(record.boundary_status === expected.boundary && record.technology_family === expected.family && record.claim_trust_level === expected.trust && record.trust_basis === expected.basis, lane + ': frozen boundary/policy oracle disagreement ' + expected.slot_id);
    }
  }
  verifyMap(read('stage-b-seal.json').hashes);
  const result = read('adjudication.json');
  check(result.products === 4 && result.database_writes === 0 && result.method_locked === false, 'adjudication scope');
  if (fs.existsSync(path.join(runDir,'final-seal.json'))) verifyMap(read('final-seal.json').hashes);
}
console.log(JSON.stringify({mode, verified_hash_checks:hashCount, products:4, sources:sourceIds.length, full_family_holdout:false, method_locked:false, database_writes:0}));
